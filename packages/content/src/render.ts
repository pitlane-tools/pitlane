import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import * as jsxRuntime from "remix/ui/jsx-runtime";

import type { StoredEntry } from "./store.ts";
import type { Heading, RenderedEntry } from "./types.ts";

import { readImports } from "./mdx.ts";

let rendered = new WeakMap<StoredEntry, Promise<RenderedEntry>>();

/**
 * Renders one entry, once.
 *
 * Nothing parses Markdown until this is called, so loading a collection to list
 * its titles never pays for the bodies it does not show. The result is cached
 * per entry, because a page rendered twice should not compile twice.
 */
export function renderedEntry(collection: string, entry: StoredEntry): Promise<RenderedEntry> {
    let existing = rendered.get(entry);
    if (existing) return existing;
    let pending = render(collection, entry);
    rendered.set(entry, pending);
    return pending;
}

async function render(collection: string, entry: StoredEntry): Promise<RenderedEntry> {
    if (entry.prebuilt) return fromBundle(entry.prebuilt);
    if (entry.body) return await fromSource(entry, entry.body);
    throw new Error(`Entry "${collection}/${entry.id}" has no renderable content.`);
}

/** A body the build compiled: a module for MDX, an HTML string for Markdown. */
function fromBundle(prebuilt: NonNullable<StoredEntry["prebuilt"]>): RenderedEntry {
    if (prebuilt.format === "md") {
        return { Content: htmlComponent(prebuilt.html), headings: [] };
    }
    return {
        Content: mdxComponent(prebuilt.module.default),
        headings: headingList(prebuilt.module.headings),
    };
}

/** A body still in source form, rendered through Sätteri on demand. */
async function fromSource(
    entry: StoredEntry,
    body: NonNullable<StoredEntry["body"]>,
): Promise<RenderedEntry> {
    let satteri = await loadSatteri(entry.filePath ?? entry.id);
    let options = await runtimeOptions(entry);

    if (body.format === "md") {
        let result = await satteri.markdownToHtml(body.source, options);
        return { Content: htmlComponent(result.html), headings: dataHeadings(result.data) };
    }

    let where = entry.filePath ?? entry.id;
    let imported = await importedBindings(satteri, body.source, where, options);
    // Sätteri's `function-body` output destructures each import off the same
    // runtime object it destructures the JSX runtime from, and it does so by
    // *exported* name: `import Def from` reads `default`, `{ A as B }` reads
    // `A`, and two modules exporting one name read the same key, so one
    // silently wins. The imports are compiled out of the source instead and
    // supplied by local name, which is unique by construction.
    let compiled = await satteri.mdxToJs(withoutImports(body.source, imported.statements), {
        ...options,
        jsxImportSource: "remix/ui",
        outputFormat: "function-body",
    });
    // Both mechanisms, because which one Sätteri emits depends on the document:
    // a file containing any Markdown element resolves `<Badge />` through
    // `props.components`, and a file containing only JSX leaves it a free
    // variable. One alone silently fails on half the documents.
    let names = [...imported.bindings.keys()];
    // The leading parameter is what Sätteri's own destructuring reads as
    // `arguments[0]`, so the JSX runtime still arrives the way it expects.
    //
    // `new Function` is what makes runtime `.mdx` Node, Bun, and Deno only, and
    // it is unavoidable on this path: a compiled MDX body is a function body by
    // construction. A host that forbids it prebuilds the collection instead.
    // oxlint-disable-next-line typescript/no-implied-eval
    let evaluate = new Function("__mdxRuntime", ...names, compiled.code);
    let module = evaluate(
        { ...jsxRuntime },
        ...names.map(name => imported.bindings.get(name)),
    ) as Record<string, unknown>;
    return {
        Content: mdxComponent(module.default, imported.bindings),
        headings: headingList(module.headings),
    };
}

/**
 * MDX compiles to a plain function of props; a Remix component is a factory
 * returning a render function. This is the bridge, and it is why props on
 * `<Content />` reach the content and `components` overrides work.
 *
 * A document's own imports are merged last, so a caller's `components` cannot
 * replace one. Under a bundler an `import` is a real import and nothing can
 * override it; the two paths have to agree.
 */
function mdxComponent(
    exported: unknown,
    imported: ReadonlyMap<string, unknown> = new Map(),
): RenderedEntry["Content"] {
    let component = exported as (props: Record<string, unknown>) => never;
    if (imported.size === 0) return handle => () => component(handle?.props ?? {});

    return handle => () => {
        let props = handle?.props ?? {};
        let components = { ...(props.components as object), ...Object.fromEntries(imported) };
        return component({ ...props, components });
    };
}

/**
 * Markdown arrives as an HTML string, and `innerHTML` is an element prop, so
 * the markup needs an element to land on. The wrapper is unavoidable.
 */
function htmlComponent(html: string): RenderedEntry["Content"] {
    return () => () => jsxRuntime.jsx("div", { innerHTML: html });
}

function headingList(value: unknown): Heading[] {
    return Array.isArray(value) ? (value as Heading[]) : [];
}

function dataHeadings(data: unknown): Heading[] {
    if (data && typeof data === "object" && "headings" in data) return headingList(data.headings);
    return [];
}

/**
 * The runtime rendering options: the application's, with the two things both
 * paths must agree on forced on.
 *
 * `headings` is the same plugin `vite-plugin-satteri` runs on the prebuilt
 * path, which is what makes the two produce the same list. Frontmatter parsing
 * stays on because a `LiveLoader` may hand back a body that still carries a
 * fence, and rendering that as a horizontal rule would be worse than parsing
 * it away.
 */
async function runtimeOptions(entry: StoredEntry) {
    // Imported here rather than at module scope because `./satteri.ts` imports
    // `satteri` itself: a static import would make the optional peer dependency
    // mandatory for every consumer, including one whose content is all prebuilt.
    let { headings } = await import("./satteri.ts");
    let configured = (entry.satteri ?? {}) as {
        mdastPlugins?: unknown[];
        features?: Record<string, unknown>;
    };
    return {
        ...configured,
        features: { ...configured.features, frontmatter: true },
        mdastPlugins: [headings(), ...(configured.mdastPlugins ?? [])],
    };
}

/**
 * The components an MDX document imported, keyed by the local name it used,
 * along with the ESM statements they came from so they can be compiled out.
 *
 * Specifiers resolve relative to the document, which is what makes the same
 * file behave identically whether the bundler compiled it or this did.
 */
async function importedBindings(
    satteri: Satteri,
    source: string,
    where: string,
    options: { features?: Record<string, unknown> },
) {
    let tree = satteri.mdxToMdast(source, { features: options.features });
    let statements = esmStatements(tree);
    let bindings = new Map<string, unknown>();
    if (statements.length === 0) return { statements, bindings };

    let from = pathToFileURL(where);
    for (let { specifier, bindings: names } of readImports(statements, where)) {
        let module = await importFrom(specifier, from, where);
        for (let [local, exported] of names) {
            if (!(exported in module)) throw missingExport(exported, specifier, where);
            bindings.set(local, module[exported]);
        }
    }
    return { statements, bindings };
}

/**
 * Drops the document's import statements, whose bindings are supplied as
 * parameters instead. Sätteri hands back each statement verbatim, so removing
 * it is exact rather than a guess at what an import looks like.
 */
function withoutImports(source: string, statements: readonly string[]) {
    let stripped = source;
    for (let statement of statements) stripped = stripped.replace(statement, "");
    return stripped;
}

/**
 * An export the module does not have would otherwise arrive as `undefined` and
 * render as nothing, which is the failure this whole path exists to remove.
 */
function missingExport(exported: string, specifier: string, where: string) {
    let name = exported === "default" ? "a default export" : `\`${exported}\``;
    return new Error(
        `"${where}" imports ${name} from "${specifier}", which that module does not export.`,
    );
}

/** The top-level `mdxjsEsm` node values, which hold the document's imports. */
function esmStatements(tree: unknown): string[] {
    let children = (tree as { children?: { type?: string; value?: string }[] }).children ?? [];
    return children
        .filter(node => node.type === "mdxjsEsm" && typeof node.value === "string")
        .map(node => node.value!);
}

async function importFrom(specifier: string, from: URL, where: string) {
    // `import.meta.resolve` handles a bare or subpath specifier the way Node
    // would from the document's own directory, so `#/ui/public/counter.tsx`
    // means what it means in a controller.
    let resolved = specifier.startsWith(".")
        ? new URL(specifier, from).href
        : resolveBare(specifier, from, where);
    try {
        return (await import(resolved)) as Record<string, unknown>;
    } catch (error) {
        let cause = error instanceof Error ? error.message : String(error);
        throw new Error(`"${where}" imports "${specifier}", which could not be loaded: ${cause}`, {
            cause: error,
        });
    }
}

/**
 * Resolves a bare or subpath specifier from the document's own location.
 *
 * `createRequire` rather than `import.meta.resolve`, whose parent argument is
 * not part of the stable API: resolution has to start at the MDX file so that
 * `#/ui/counter.tsx` means what it means in a controller of the same app.
 */
function resolveBare(specifier: string, from: URL, where: string) {
    try {
        return pathToFileURL(createRequire(from).resolve(specifier)).href;
    } catch (error) {
        let cause = error instanceof Error ? error.message : String(error);
        throw new Error(
            `"${where}" imports "${specifier}", which could not be resolved: ${cause}`,
            { cause: error },
        );
    }
}

interface Satteri {
    markdownToHtml(source: string, options?: unknown): Promise<{ html: string; data: unknown }>;
    mdxToJs(source: string, options: unknown): Promise<{ code: string }>;
    mdxToMdast(source: string, options?: unknown): unknown;
}

/**
 * `satteri` is an optional peer dependency: an application whose content is
 * prebuilt never renders at runtime and so never needs it. The import has to be
 * dynamic for that to be true, and the failure has to name both ways out.
 */
async function loadSatteri(where: string): Promise<Satteri> {
    try {
        return (await import("satteri")) as unknown as Satteri;
    } catch {
        throw new Error(
            `Rendering "${where}" needs the optional peer dependency "satteri"; install it, ` +
                "or add content() from @pitlane/content/vite so the build compiles this collection.",
        );
    }
}

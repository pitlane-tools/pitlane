import * as jsxRuntime from "remix/ui/jsx-runtime";

import type { StoredEntry } from "./store.ts";
import type { Heading, RenderedEntry } from "./types.ts";

import { readEsm } from "./mdx.ts";

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
        return { Content: htmlComponent(prebuilt.html), headings: headingList(prebuilt.headings) };
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
    let compiled = await satteri.mdxToJs(imported.body, {
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
    let evaluate = compile(names, compiled.code, entry.filePath ?? entry.id);
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
 * The compiled body, as a callable function.
 *
 * The engine reports a body it cannot compile against generated source the
 * author never saw: `import.meta` in an expression, which is ordinary under a
 * bundler, arrives as a bare `SyntaxError: Cannot use 'import.meta' outside a
 * module` naming neither the document nor the reason. `readEsm` catches the
 * form written in an `import`/`export` block; this catches every other one.
 */
function compile(names: readonly string[], code: string, where: string) {
    try {
        // oxlint-disable-next-line typescript/no-implied-eval
        return new Function("__mdxRuntime", ...names, code);
    } catch (error) {
        let cause = error instanceof Error ? error.message : String(error);
        throw new Error(
            `"${where}" has a body that cannot be compiled outside a bundler: ${cause}. The ` +
                `document becomes a function body here rather than a module. Add contentLayer() from ` +
                `@pitlane/content/vite so the build compiles this collection.`,
            { cause: error },
        );
    }
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
 * The runtime rendering options: the application's, with the three things both
 * paths must agree on forced on.
 *
 * `headings` and `rawStyles` are the same plugins `vite-plugin-satteri` runs
 * on the prebuilt path, which is what makes the two produce the same list and
 * the same working CSS. `rawStyles` goes last so it sees the `<style>` a
 * highlighter appended. Frontmatter parsing stays on because a `LiveLoader`
 * may hand back a body that still carries a fence, and rendering that as a
 * horizontal rule would be worse than parsing it away.
 */
async function runtimeOptions(entry: StoredEntry) {
    // Imported here rather than at module scope so a bundled application whose
    // collections are all prebuilt never carries the rendering path at all.
    let { headings, rawStyles } = await import("./satteri.ts");
    let configured = (entry.satteri ?? {}) as {
        mdastPlugins?: unknown[];
        hastPlugins?: unknown[];
        features?: Record<string, unknown>;
    };
    return {
        ...configured,
        features: { ...configured.features, frontmatter: true },
        mdastPlugins: [headings(), ...(configured.mdastPlugins ?? [])],
        hastPlugins: [...(configured.hastPlugins ?? []), rawStyles()],
    };
}

/**
 * The components an MDX document imported, keyed by the local name it used,
 * and the source with those import statements removed.
 *
 * Specifiers resolve relative to the document, which is what makes the same
 * file behave identically whether the bundler compiled it or this did.
 */
async function importedBindings(
    satteri: Satteri,
    original: string,
    where: string,
    options: { features?: Record<string, unknown> },
) {
    // Sätteri reports offsets against the source with any byte order mark
    // already removed, so the mark has to go before it is asked: a one
    // character difference makes every splice below land one character early.
    let source = original.replace(/^\uFEFF/, "");
    let tree = satteri.mdxToMdast(source, { features: options.features });
    let blocks = esmBlocks(tree);
    let bindings = new Map<string, unknown>();
    if (blocks.length === 0) return { body: source, bindings };

    let node = await nodeResolution();
    let from = node.pathToFileURL(where);
    let body = source;
    // Last block first, so an earlier block's offsets are still the ones
    // Sätteri measured.
    for (let block of [...blocks].reverse()) {
        let { imports, remainder } = await readEsm(block.value, where);
        body = body.slice(0, block.start) + remainder + body.slice(block.end);

        for (let { specifier, bindings: names, attributes } of imports) {
            let module = await importFrom(specifier, from, where, node, attributes);
            for (let [local, exported] of names) {
                if (!(exported in module)) throw missingExport(exported, specifier, where);
                bindings.set(local, module[exported]);
            }
        }
    }
    return { body, bindings };
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

interface EsmBlock {
    value: string;
    start: number;
    end: number;
}

/**
 * The top-level ESM blocks, with the offsets Sätteri measured them at.
 *
 * Offsets rather than a text search: a page may quote its own import in a
 * fenced code block, and removing the first textual match would strike the
 * fence and leave the real statement behind.
 *
 * The end comes from the block's own text rather than its reported end, which
 * runs to the start of the next node and so swallows the blank line between
 * them. MDX needs that blank line to tell an ESM block from the body.
 */
function esmBlocks(tree: unknown): EsmBlock[] {
    interface Node {
        type?: string;
        value?: string;
        position?: { start?: { offset?: number } };
    }
    let children = (tree as { children?: Node[] }).children ?? [];
    let blocks: EsmBlock[] = [];
    for (let node of children) {
        if (node.type !== "mdxjsEsm" || typeof node.value !== "string") continue;
        let start = node.position?.start?.offset;
        if (typeof start !== "number") continue;
        blocks.push({ value: node.value, start, end: start + node.value.length });
    }
    return blocks;
}

/** The two Node resolution functions the runtime MDX path needs. */
interface NodeResolution {
    createRequire: (from: URL) => { resolve: (specifier: string) => string };
    pathToFileURL: (path: string) => URL;
}

/**
 * `node:module` and `node:url`, loaded on demand.
 *
 * A static import would put them in the chain `index.ts` pulls in, and the
 * package documents itself as safe to import on any host. Only a runtime
 * `.mdx` render reaches here, and that path is already Node, Bun, and Deno
 * only because it needs `new Function`.
 */
async function nodeResolution(): Promise<NodeResolution> {
    let [{ createRequire }, { pathToFileURL }] = await Promise.all([
        import("node:module"),
        import("node:url"),
    ]);
    return { createRequire, pathToFileURL };
}

async function importFrom(
    specifier: string,
    from: URL,
    where: string,
    node: NodeResolution,
    attributes?: Record<string, string>,
) {
    let resolved = specifier.startsWith(".")
        ? new URL(specifier, from).href
        : resolveBare(specifier, from, where, node);
    try {
        // A module with an attributes clause is refused without it, so the
        // clause the author wrote has to reach the import that replaces theirs.
        return (await (attributes
            ? import(resolved, { with: attributes })
            : import(resolved))) as Record<string, unknown>;
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
 * `#/ui/counter.tsx` means what it means in a controller of the same app. The
 * cost is that it resolves under `require` conditions, so a dependency that
 * publishes only an `import` condition fails here — loudly, naming the file
 * and the specifier.
 */
function resolveBare(specifier: string, from: URL, where: string, node: NodeResolution) {
    try {
        return node.pathToFileURL(node.createRequire(from).resolve(specifier)).href;
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
 *
 * The specifier is a variable because a literal one is not dynamic to a
 * bundler — Rolldown resolves it at build time and pulls the whole compiler
 * into the output. Sätteri is a native addon, so a Worker bundle that reaches
 * it fails to build: workerd resolves under the `browser` condition, which
 * sends `satteri` to its WASM binding and on to an optional package that is
 * not installed on a native platform.
 */
async function loadSatteri(where: string): Promise<Satteri> {
    let specifier = "satteri";
    try {
        return (await import(/* @vite-ignore */ specifier)) as unknown as Satteri;
    } catch {
        throw new Error(
            `Rendering "${where}" needs the optional peer dependency "satteri"; install it, ` +
                "or add contentLayer() from @pitlane/content/vite so the build compiles this collection.",
        );
    }
}

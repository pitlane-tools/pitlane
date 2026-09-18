import * as jsxRuntime from "remix/ui/jsx-runtime";

import type { StoredEntry } from "./store.ts";
import type { Heading, RenderedEntry } from "./types.ts";

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

    let module = await satteri.evaluate(body.source, {
        ...jsxRuntime,
        ...options,
        jsxImportSource: "remix/ui",
    });
    return { Content: mdxComponent(module.default), headings: headingList(module.headings) };
}

/**
 * MDX compiles to a plain function of props; a Remix component is a factory
 * returning a render function. This is the bridge, and it is why props on
 * `<Content />` reach the content and `components` overrides work.
 */
function mdxComponent(exported: unknown): RenderedEntry["Content"] {
    let component = exported as (props: Record<string, unknown>) => never;
    return handle => () => component(handle?.props ?? {});
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

interface Satteri {
    markdownToHtml(source: string, options?: unknown): Promise<{ html: string; data: unknown }>;
    evaluate(source: string, options: unknown): Promise<Record<string, unknown>>;
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

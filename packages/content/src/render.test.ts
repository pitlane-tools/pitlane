import { fileURLToPath } from "node:url";
import * as s from "remix/data-schema";
import * as jsxRuntime from "remix/ui/jsx-runtime";
import { renderToString } from "remix/ui/server";
import { evaluate, type EvaluateOptions } from "satteri";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContentLoader, LoadedEntry, PrebuiltCollections } from "./types.ts";

import { createContent } from "./content.ts";
import { headings } from "./satteri.ts";

// Spelled literally rather than imported: this pins the published contract,
// so a rename in `symbols.ts` should fail here rather than pass quietly.
const MANIFEST = Symbol.for("pitlane.content.manifest");

/**
 * Installs a manifest the way the module `content()` emits does: by assigning
 * the symbol the runtime reads. Standing in for the emitted module rather than
 * mocking one keeps the test on the same contract the plugin uses.
 */
function prebuild(collections: PrebuiltCollections | null) {
    let global = globalThis as Record<symbol, unknown>;
    if (collections) global[MANIFEST] = collections;
    else delete global[MANIFEST];
}

afterEach(() => prebuild(null));

let title = s.object({ title: s.string() });

function loaderFor(entries: LoadedEntry[]): ContentLoader {
    return {
        name: "memory",
        async load(context) {
            for (let entry of entries) {
                context.store.set({
                    ...entry,
                    data: await context.parseData({ id: entry.id, data: entry.data }),
                });
            }
        },
    };
}

async function blogFrom(entries: LoadedEntry[]) {
    return await createContent(c => ({
        blog: c.collection({ loader: loaderFor(entries), schema: title }),
    }));
}

/**
 * Stands in for what `vite-plugin-satteri` puts in the bundle: an evaluated MDX
 * module carrying a `default` component and a `headings` export.
 */
async function compiledMdx(source: string) {
    // The runtime's JSX factories are typed for Remix elements; satteri types
    // its own as `unknown`, and the two are the same functions.
    let runtime = jsxRuntime as unknown as EvaluateOptions;
    let module = await evaluate(source, {
        ...runtime,
        jsxImportSource: "remix/ui",
        mdastPlugins: [headings()],
    });
    return { format: "mdx", module } as const;
}

describe("render, on a collection rendered at runtime", () => {
    it("renders a .md body to markup", async () => {
        let content = await blogFrom([
            {
                id: "hello",
                data: { title: "Hello" },
                body: { format: "md", source: "# Greeting\n\nSome *text*.\n" },
            },
        ]);
        let entry = await content.blog.getEntry("hello");
        let { Content } = await entry!.render();

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain("<h1");
        expect(html).toContain("Greeting");
        expect(html).toContain("<em>text</em>");
    });

    it("renders a .mdx body, evaluating its expressions", async () => {
        let content = await blogFrom([
            {
                id: "hello",
                data: { title: "Hello" },
                body: { format: "mdx", source: "# Greeting\n\nInline {1 + 1} expression.\n" },
            },
        ]);
        let entry = await content.blog.getEntry("hello");
        let { Content } = await entry!.render();

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain("Greeting");
        expect(html).toContain("2");
    });

    it("reports the same headings for both formats", async () => {
        let content = await blogFrom([
            {
                id: "md",
                data: { title: "Md" },
                body: { format: "md", source: "# One\n\n## Two\n" },
            },
            {
                id: "mdx",
                data: { title: "Mdx" },
                body: { format: "mdx", source: "# One\n\n## Two\n" },
            },
        ]);

        for (let id of ["md", "mdx"]) {
            let entry = await content.blog.getEntry(id);

            expect((await entry!.render()).headings).toEqual([
                { depth: 1, slug: "one", text: "One" },
                { depth: 2, slug: "two", text: "Two" },
            ]);
        }
    });

    it("parses a body once and caches the result across renders", async () => {
        let content = await blogFrom([
            { id: "hello", data: { title: "Hello" }, body: { format: "md", source: "# Hi\n" } },
        ]);
        let entry = await content.blog.getEntry("hello");

        expect(await entry!.render()).toBe(await entry!.render());
    });

    it("does not parse any body until an entry is rendered", async () => {
        let content = await blogFrom([
            {
                id: "broken",
                data: { title: "Broken" },
                // Unparseable MDX. Listing the collection must not touch it.
                body: { format: "mdx", source: "# Title\n\n<Unclosed>\n" },
            },
        ]);

        await expect(content.blog.getCollection()).resolves.toHaveLength(1);
    });
});

describe("render, on a runtime-resolved MDX entry that imports components", () => {
    let components = fileURLToPath(new URL("./fixtures/components", import.meta.url));

    async function post(source: string) {
        let content = await blogFrom([
            {
                id: "hello",
                data: { title: "Hello" },
                filePath: `${components}/post.mdx`,
                body: { format: "mdx", source },
            },
        ]);
        let entry = await content.blog.getEntry("hello");
        return await entry!.render();
    }

    it("renders a component the document imported", async () => {
        let { Content } = await post(
            'import { Badge } from "./badge.tsx";\n\n# Title\n\n<Badge label="shipped" />\n',
        );

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain("<h1");
        expect(html).toContain('<strong class="badge">shipped</strong>');
    });

    it("keeps a clientEntry component's hydration tag through the import", async () => {
        let { Content } = await post(
            'import { Counter } from "./counter.tsx";\n\n<Counter start={3} />\n',
        );

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain("count 3");
    });

    it("renders several imported components, named and default", async () => {
        let { Content } = await post(
            'import { Badge } from "./badge.tsx";\n' +
                'import { Counter } from "./counter.tsx";\n\n' +
                '<Badge label="a" />\n\n<Counter start={1} />\n',
        );

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain('class="badge"');
        expect(html).toContain("count 1");
    });

    it("fails naming the file and the specifier when an import does not resolve", async () => {
        await expect(post('import { Gone } from "./missing.tsx";\n\n<Gone />\n')).rejects.toThrow(
            /post\.mdx.*\.\/missing\.tsx/s,
        );
    });

    it("still renders a document with no imports", async () => {
        let { Content } = await post("# Plain\n\nNo imports here.\n");

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain("Plain");
    });
});

describe("render, on a prebuilt collection", () => {
    it("renders the compiled MDX module the bundler produced", async () => {
        prebuild({
            blog: [
                {
                    id: "hello",
                    data: { title: "Hello" },
                    body: await compiledMdx("# Greeting\n\nFrom the bundle.\n"),
                },
            ],
        });
        let content = await blogFrom([]);
        let entry = await content.blog.getEntry("hello");
        let { Content, headings: list } = await entry!.render();

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain("Greeting");
        expect(list).toEqual([{ depth: 1, slug: "greeting", text: "Greeting" }]);
    });

    it("renders a prebuilt .md entry's HTML inside one wrapper element", async () => {
        prebuild({
            blog: [
                {
                    id: "hello",
                    data: { title: "Hello" },
                    body: { format: "md", html: "<h1>Greeting</h1>" },
                },
            ],
        });
        let content = await blogFrom([]);
        let entry = await content.blog.getEntry("hello");
        let { Content, headings: list } = await entry!.render();

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain("<h1>Greeting</h1>");
        expect(html.startsWith("<div")).toBe(true);
        expect(list).toEqual([]);
    });

    it("never calls the loader for a collection the manifest carries", async () => {
        let load = vi.fn();
        prebuild({ blog: [{ id: "hello", data: { title: "Hello" } }] });
        let content = await createContent(c => ({
            blog: c.collection({ loader: { name: "spy", load }, schema: title }),
        }));

        expect((await content.blog.getCollection()).map(entry => entry.id)).toEqual(["hello"]);
        expect(load).not.toHaveBeenCalled();
    });

    it("runs the loader for a collection the manifest does not carry", async () => {
        prebuild({ authors: [] });
        let content = await blogFrom([{ id: "hello", data: { title: "Hello" } }]);

        expect((await content.blog.getCollection()).map(entry => entry.id)).toEqual(["hello"]);
    });

    it("passes props to the compiled component, which is how components overrides work", async () => {
        prebuild({
            blog: [
                { id: "hello", data: { title: "Hello" }, body: await compiledMdx("# Greeting\n") },
            ],
        });
        let content = await blogFrom([]);
        let entry = await content.blog.getEntry("hello");
        let { Content } = await entry!.render();

        let html = await renderToString(jsxRuntime.jsx(Content, { components: { h1: "h2" } }));

        expect(html).toContain("<h2");
        expect(html).not.toContain("<h1");
    });
});

describe("render, on an entry that is not a document", () => {
    it("rejects rather than resolving to an empty component", async () => {
        prebuild(null);
        let content = await blogFrom([{ id: "authors", data: { title: "Authors" } }]);
        let entry = await content.blog.getEntry("authors");

        await expect(entry!.render()).rejects.toThrow(
            'Entry "blog/authors" has no renderable content.',
        );
    });
});

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
 * Installs a manifest the way the module `contentLayer()` emits does: by assigning
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

    it("emits a style element's CSS unescaped, so the runtime path ships working rules", async () => {
        // Remix escapes `>` in an element's text children and a browser never
        // undoes that inside `<style>`, which is a raw-text element. The
        // prebuilt path asks the application for `rawStyles`; this path has
        // no config to ask, so `render` applies it after the loader's own
        // plugins — where Expressive Code's stylesheet already is.
        let css = ".expressive-code pre > code{color:red}";
        let content = await blogFrom([
            {
                id: "hello",
                data: { title: "Hello" },
                body: { format: "mdx", source: "# Greeting\n" },
                satteri: {
                    hastPlugins: [
                        {
                            name: "test-inject-style",
                            element: {
                                filter: ["h1"],
                                visit: () => ({
                                    type: "element",
                                    tagName: "style",
                                    properties: {},
                                    children: [{ type: "text", value: css }],
                                }),
                            },
                        },
                    ],
                },
            } as LoadedEntry,
        ]);
        let entry = await content.blog.getEntry("hello");
        let { Content } = await entry!.render();

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain(css);
        expect(html).not.toContain("&gt;");
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

    it("renders several imported components", async () => {
        let { Content } = await post(
            'import { Badge } from "./badge.tsx";\n' +
                'import { Counter } from "./counter.tsx";\n\n' +
                '<Badge label="a" />\n\n<Counter start={1} />\n',
        );

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain('class="badge"');
        expect(html).toContain("count 1");
    });

    it("renders a default import", async () => {
        let { Content } = await post(
            'import Heading from "./heading.tsx";\n\n<Heading label="titled" />\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            '<h2 class="heading">titled</h2>',
        );
    });

    it("renders an import renamed with `as`", async () => {
        let { Content } = await post(
            'import { Badge as Chip } from "./badge.tsx";\n\n<Chip label="renamed" />\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            '<strong class="badge">renamed</strong>',
        );
    });

    it("renders an imported component in a document with no Markdown in it", async () => {
        // Sätteri resolves `<Badge />` through `props.components` in a document
        // that contains any Markdown element, and leaves it a free variable in
        // one that does not. Both shapes have to work.
        let { Content } = await post(
            'import { Badge } from "./badge.tsx";\n\n<Badge label="bare" />\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            '<strong class="badge">bare</strong>',
        );
    });

    it("keeps two modules exporting the same name apart", async () => {
        // A single bindings object keyed by exported name cannot hold both, so
        // the second import would otherwise overwrite the first and the
        // document would render the wrong component with no error at all.
        let { Content } = await post(
            'import { Badge } from "./badge.tsx";\n' +
                'import { Badge as Chip } from "./chip.tsx";\n\n' +
                '# Both\n\n<Badge label="first" />\n\n<Chip label="second" />\n',
        );

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain('<strong class="badge">first</strong>');
        expect(html).toContain('<em class="chip">second</em>');
    });

    it("fails naming the export when a module does not have it", async () => {
        await expect(post('import { Gone } from "./badge.tsx";\n\n<Gone />\n')).rejects.toThrow(
            /`Gone`.*\.\/badge\.tsx.*does not export/s,
        );
    });

    it("fails naming the file and the specifier when an import does not resolve", async () => {
        await expect(post('import { Gone } from "./missing.tsx";\n\n<Gone />\n')).rejects.toThrow(
            /post\.mdx.*\.\/missing\.tsx/s,
        );
    });

    it("refuses a namespace import rather than leaving it undefined at render", async () => {
        // Sätteri's `function-body` output reads each binding off its runtime
        // object, and for `import * as ns` it emits `const {} = arguments[0]`:
        // the name is never bound, so the document throws a bare
        // `ReferenceError` deep in the compiled source. Refused here instead.
        await expect(
            post('import * as ui from "./badge.tsx";\n\n<ui.Badge label="a" />\n'),
        ).rejects.toThrow(/post\.mdx.*\*\s+as\s+ui.*\.\/badge\.tsx/s);
    });

    it("keeps a document's own export, which it needs to render", async () => {
        // Removing whole ESM blocks would take the export with the import, and
        // `{year}` would throw `ReferenceError` at runtime while the same file
        // renders under a bundler.
        let { Content } = await post(
            'import { Badge } from "./badge.tsx";\nexport const year = 2026;\n\n' +
                '<Badge label="x" /> in {year}.\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain("in 2026.");
    });

    it("leaves an import quoted in a fenced code block alone", async () => {
        // Removing the first *textual* occurrence would strike the fence and
        // leave the real statement, which then fails to compile.
        let { Content } = await post(
            'Shown first:\n\n```js\nimport { Badge } from "./badge.tsx";\n```\n\n' +
                'import { Badge } from "./badge.tsx";\n\n<Badge label="real" />\n',
        );

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain('<strong class="badge">real</strong>');
        expect(html).toContain("import { Badge }");
    });

    it("reads an import statement written across several lines", async () => {
        let { Content } = await post(
            'import {\n    Badge,\n} from "./badge.tsx";\n\n<Badge label="multi" />\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            '<strong class="badge">multi</strong>',
        );
    });

    it("ignores a type-only import, which has nothing to bind at runtime", async () => {
        // A bundler erases `import type`. Read as a value import it becomes a
        // request for a default export named `type`, and the render fails on a
        // line the author wrote correctly.
        let { Content } = await post(
            'import type { Handle } from "remix/ui";\n' +
                'import { Badge } from "./badge.tsx";\n\n<Badge label="typed" />\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            '<strong class="badge">typed</strong>',
        );
    });

    it("never imports the module a type-only statement names", async () => {
        // The module may hold nothing but types, or not exist at runtime at
        // all. A bundler erases the statement, so importing it would be a
        // requirement the prebuilt path does not have.
        let { Content } = await post(
            'import type { Gone } from "./types-only.ts";\n' +
                'import { Badge } from "./badge.tsx";\n\n<Badge label="safe" />\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            '<strong class="badge">safe</strong>',
        );
    });

    it("ignores an inline type specifier beside a value one", async () => {
        let { Content } = await post(
            'import { type Handle, Badge } from "./badge.tsx";\n\n<Badge label="inline" />\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            '<strong class="badge">inline</strong>',
        );
    });

    it("strips a comment beside an import instead of rendering it as prose", async () => {
        let { Content } = await post(
            'import { Badge } from "./badge.tsx"; // the component\n\n<Badge label="a" />\n',
        );

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain('<strong class="badge">a</strong>');
        expect(html).not.toContain("// the component");
    });

    it("keeps an export that a comment line sits above", async () => {
        // A comment left in the block starts a paragraph the export cannot
        // interrupt, so the export is swallowed and `{year}` throws.
        let { Content } = await post(
            'import { Badge } from "./badge.tsx";\n// helper\nexport const year = 2026;\n\n' +
                '<Badge label="a" /> {year}\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain("2026");
    });

    it("leaves an import quoted in a template literal alone", async () => {
        // A line-anchored scan of the block would read this as a real import:
        // the quoted text would vanish and `./badge.tsx` would be loaded even
        // though the document never asked for it.
        let { Content } = await post(
            'export const example = `\nimport { Gone } from "./gone.tsx"\n`;\n\n' +
                "<pre>{example}</pre>\n",
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            'import { Gone } from "./gone.tsx"',
        );
    });

    it("keeps a comment marker that is really inside a string", async () => {
        let { Content } = await post(
            'export const url = "https://example.com/x";\n\n<a href={url}>link</a>\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            'href="https://example.com/x"',
        );
    });

    it("binds an export whose name really is `type`", async () => {
        // `{ type }` is a value import; `{ type X }` is a type specifier. The
        // difference is whether a second name follows.
        let { Content } = await post('import { type } from "./named-type.ts";\n\n<p>{type}</p>\n');

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain("a value named type");
    });

    it("renders a document whose source begins with a byte order mark", async () => {
        let { Content } = await post(
            '\uFEFFimport { Badge } from "./badge.tsx";\n\n# T\n\n<Badge label="a" />\n',
        );

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain('<strong class="badge">a</strong>');
        expect(html).not.toMatch(/<p>[;"]/);
    });

    it("keeps an import that follows a regex literal containing a quote", async () => {
        // The quote inside the regex is not a string. Reading it as one
        // swallows the import that follows, and the component renders as
        // nothing at all.
        let { Content } = await post(
            'export const quote = /"/;\nimport { Badge } from "./badge.tsx";\n\n<Badge label="a" />\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            '<strong class="badge">a</strong>',
        );
    });

    it("leaves a property named `import` alone", async () => {
        let { Content } = await post(
            'export const meta = { import: "./x.tsx" };\n\n<p>{meta.import}</p>\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain("./x.tsx");
    });

    it("reads an import with a comment between its parts", async () => {
        let { Content } = await post(
            'import /* the badge */ { Badge } from "./badge.tsx";\n\n<Badge label="a" />\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            '<strong class="badge">a</strong>',
        );
    });

    it("carries an import attribute through to the module it loads", async () => {
        let { Content } = await post(
            'import data from "./data.json" with { type: "json" };\n\n<p>{data.title}</p>\n',
        );

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain("from a json import");
        expect(html).not.toContain("type: &quot;json&quot;");
    });

    it("decodes an escape sequence in a specifier before resolving it", async () => {
        let { Content } = await post(
            'import { Badge } from "./b\\u0061dge.tsx";\n\n<Badge label="a" />\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            '<strong class="badge">a</strong>',
        );
    });

    it("refuses `import.meta`, which a compiled body cannot evaluate", async () => {
        // A bundler compiles the document to a module, where `import.meta` is
        // ordinary. Here the body is a function body, so the engine throws
        // `SyntaxError: Cannot use 'import.meta' outside a module` from
        // generated source, naming neither the document nor the cause.
        await expect(
            post("export const here = import.meta.url;\n\n<p>{here}</p>\n"),
        ).rejects.toThrow(/import\.meta.*outside a bundler/s);
    });

    it("reads imports from a block that also defines a component", async () => {
        // JSX in an ESM block is the canonical way an MDX document defines a
        // local component. A JavaScript lexer cannot parse it.
        let { Content } = await post(
            'import { Badge } from "./badge.tsx";\n' +
                "export const Note = () => <em>n</em>;\n" +
                '\n<Badge label="a" />\n',
        );

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain(
            '<strong class="badge">a</strong>',
        );
    });

    it("keeps a semicolon out of the page when a comment precedes it", async () => {
        let { Content } = await post(
            'import { Badge } from "./badge.tsx" /* c */;\nexport const year = 2026;\n\n<p>{year}</p>\n<Badge label="a" />\n',
        );

        let html = await renderToString(jsxRuntime.jsx(Content, {}));

        expect(html).toContain("2026");
        expect(html).not.toMatch(/<p>\s*;/);
    });

    it("never imports the module a spaceless type-only statement names", async () => {
        // `import type{X}` is valid TypeScript. A bundler erases it, so the
        // module it names need not exist at runtime.
        let { Content } = await post('import type{Handle} from "./nowhere.ts";\n\n<p>safe</p>\n');

        expect(await renderToString(jsxRuntime.jsx(Content, {}))).toContain("safe");
    });

    it("names the document when a body expression cannot be compiled", async () => {
        // `import.meta` in an expression never reaches the ESM block, so the
        // engine reports it from generated source with nothing to locate.
        await expect(post("<p>{import.meta.url}</p>\n")).rejects.toThrow(/post\.mdx/);
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

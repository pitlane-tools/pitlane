import type { HastPluginEntry } from "satteri";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderToString } from "remix/component/server";
import { markdownToHtml, mdxToJs } from "satteri";
import { describe, expect, it } from "vitest";

import type { Heading } from "./types.ts";

import { headings, rawStyles } from "./satteri.ts";

function plugins() {
    return { mdastPlugins: [headings()] };
}

/** `data` is Sätteri's open document bag; the plugin publishes the list on it. */
function headingsOf(data: unknown) {
    return (data as { headings: Heading[] }).headings;
}

describe("headings", () => {
    it("collects every heading with its depth, slug, and text", async () => {
        let { data } = await markdownToHtml(
            "# Getting started\n\n## Install the package\n\n### Notes\n",
            plugins(),
        );

        expect(headingsOf(data)).toEqual([
            { depth: 1, slug: "getting-started", text: "Getting started" },
            { depth: 2, slug: "install-the-package", text: "Install the package" },
            { depth: 3, slug: "notes", text: "Notes" },
        ]);
    });

    it("reads the text of a heading built from several inline nodes", async () => {
        let { data } = await markdownToHtml("## Use `let` *not* var\n", plugins());

        expect(headingsOf(data)).toEqual([
            { depth: 2, slug: "use-let-not-var", text: "Use let not var" },
        ]);
    });

    it("keeps the ids a heading already had on GitHub", async () => {
        let { data } = await markdownToHtml(
            "## Databases & Data Loading\n\n## Jenni’s Quesadillas\n\n## Hello World!\n\n## _Optimistic_ Mutations\n",
            plugins(),
        );

        expect(headingsOf(data).map(heading => heading.slug)).toEqual([
            "databases--data-loading",
            "jennis-quesadillas",
            "hello-world",
            "optimistic-mutations",
        ]);
    });

    it("leaves every hyphen GitHub leaves, collapsing and trimming none", async () => {
        let { data } = await markdownToHtml("## ...Hello, World! ---\n\n## ---\n", plugins());

        expect(headingsOf(data)).toEqual([
            { depth: 2, slug: "hello-world----", text: "...Hello, World! ---" },
            { depth: 2, slug: "---", text: "---" },
        ]);
    });

    it("slugs a non-Latin heading from its own letters, not a counter", async () => {
        let { data, html } = await markdownToHtml("## 日本語\n\n## Статья\n", plugins());

        expect(headingsOf(data)).toEqual([
            { depth: 2, slug: "日本語", text: "日本語" },
            { depth: 2, slug: "статья", text: "Статья" },
        ]);
        expect(html).not.toContain('id=""');
        expect(html).toContain('id="日本語"');
        expect(html).toContain('id="статья"');
    });

    it("keeps every script of a mixed-script heading", async () => {
        let { data } = await markdownToHtml("## Ångström 単位 v2\n", plugins());

        expect(headingsOf(data)).toEqual([
            { depth: 2, slug: "ångström-単位-v2", text: "Ångström 単位 v2" },
        ]);
    });

    it("falls back to a stable slug when a heading slugs to nothing", async () => {
        let { data, html } = await markdownToHtml("## ***\n\n## 🎉\n", plugins());

        expect(headingsOf(data).map(heading => heading.slug)).toEqual(["heading", "heading-1"]);
        expect(html).not.toContain('id=""');
    });

    it("suffixes a colliding slug so every anchor in a document is unique", async () => {
        let { data } = await markdownToHtml(
            "## Notes\n\n## Notes\n\n## Notes-1\n\n## Notes\n",
            plugins(),
        );

        expect(headingsOf(data).map(heading => heading.slug)).toEqual([
            "notes",
            "notes-1",
            "notes-1-1",
            "notes-2",
        ]);
    });

    it("sets each heading's id to its slug so an anchor link lands", async () => {
        let { html } = await markdownToHtml("## Install the package\n", plugins());

        expect(html).toContain('id="install-the-package"');
    });

    it("reads the visible text of inline HTML, not its tags", async () => {
        let { data, html } = await markdownToHtml("## <span>Visible</span> text\n", plugins());

        expect(headingsOf(data)).toEqual([
            { depth: 2, slug: "visible-text", text: "Visible text" },
        ]);
        expect(html).toContain('id="visible-text"');
    });

    it("leaves image alt text out, keeping the spaces around the image", async () => {
        // GitHub and Astro both slug the text left once the image is gone and
        // trim nothing, so a heading ending in an image slugs with a trailing
        // hyphen there too.
        let { data } = await markdownToHtml(
            "## [A](url) ![Cat photo](cat.png)\n\n## Built with ![Acme][logo] tools\n\n[logo]: acme.png\n",
            plugins(),
        );

        expect(headingsOf(data)).toEqual([
            { depth: 2, slug: "a-", text: "A " },
            { depth: 2, slug: "built-with--tools", text: "Built with  tools" },
        ]);
    });

    it("reads a string-literal expression as the text it renders", async () => {
        let { data } = await mdxToJs(
            '## Hello {"world"}\n\n## The {"{"} character\n\n## {\'single\'} and {`template`}\n',
            plugins(),
        );

        expect(headingsOf(data)).toEqual([
            { depth: 2, slug: "hello-world", text: "Hello world" },
            { depth: 2, slug: "the--character", text: "The { character" },
            { depth: 2, slug: "single-and-template", text: "single and template" },
        ]);
    });

    it("decodes the escapes of a string-literal expression as JavaScript does", async () => {
        let { data } = await mdxToJs(
            String.raw`## {"it\"s"} {'it\'s'} {"caf\u00e9 \u{1F600} \x41\tB\0"} {"\q"}` + "\n",
            plugins(),
        );

        expect(headingsOf(data).map(heading => heading.text)).toEqual([
            "it\"s it's café \u{1F600} A\tB\0 q",
        ]);
    });

    it("leaves out an expression whose value is not a lone string literal", async () => {
        let { data } = await mdxToJs(
            '## Sum {1 + 1}\n\n## Name {name}\n\n## Joined {"a" + "b"}\n\n## Template {`${name}`}\n\n## Invalid {"\\8"}\n',
            plugins(),
        );

        expect(headingsOf(data).map(heading => heading.text)).toEqual([
            "Sum ",
            "Name ",
            "Joined ",
            "Template ",
            "Invalid ",
        ]);
    });

    it("reads expressions and text inside JSX elements and emphasis", async () => {
        let { data } = await mdxToJs("## <Badge>new {\"in\"}</Badge> *v{'2'}*\n", plugins());

        expect(headingsOf(data)).toEqual([{ depth: 2, slug: "new-in-v2", text: "new in v2" }]);
    });

    it("exports the heading list from a compiled MDX module", async () => {
        let { code } = await mdxToJs("# Title\n\n## Section\n", {
            ...plugins(),
            jsxImportSource: "remix/component",
        });

        expect(code).toContain("export const headings");
        expect(code).toContain("section");
    });
});

let css = ".expressive-code pre > code{color:red}";

/**
 * Stands in for `satteri-expressive-code`, which appends its theme as a
 * `<style>` element holding one text node. Written as a plugin rather than as
 * MDX source because `{` opens an expression in JSX, so a stylesheet cannot
 * be authored as a text child in the first place.
 */
function styleWith(properties: Record<string, unknown>): HastPluginEntry {
    return {
        name: "test-inject-style",
        element: {
            filter: ["h1"],
            visit: () => ({
                type: "element",
                tagName: "style",
                properties: properties as never,
                children: [{ type: "text", value: css }],
            }),
        },
    };
}

let injectStyle = styleWith({ media: "screen", dataTheme: "dark" });

/**
 * Renders an MDX document the way a prebuilt one is: compiled to a real ES
 * module, imported from disk so its own imports resolve, then rendered.
 */
async function renderCompiled(source: string, hastPlugins: HastPluginEntry[]) {
    let { code } = await mdxToJs(source, { hastPlugins, jsxImportSource: "remix/component" });
    let dir = await mkdtemp(fileURLToPath(new URL("../tests/.tmp-raw-styles-", import.meta.url)));
    try {
        let file = join(dir, "document.mjs");
        await writeFile(file, code);
        // The module is written at run time, so its path cannot be imported statically.
        let module = await import(pathToFileURL(file).href);
        // Compiled MDX is a plain function of props, not a Remix component.
        return await renderToString(module.default({}));
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

describe("rawStyles", () => {
    it("renders a compiled style element's CSS byte for byte, keeping its attributes", async () => {
        // remix/component escapes `>` in the text children of every element but
        // <script>, and <style> is a raw-text element, so a browser never
        // decodes what it receives and the rule is dead.
        let html = await renderCompiled("# Title\n", [injectStyle, rawStyles()]);

        expect(html).toBe(`<style media="screen" data-theme="dark">${css}</style>`);
    });

    it("leaves the CSS escaped when the plugin is absent", async () => {
        // The escaping this works around is Remix's, not Sätteri's. This is
        // what makes the assertion above a measurement rather than a tautology.
        let html = await renderCompiled("# Title\n", [injectStyle]);

        expect(html).toContain("pre &gt; code");
    });

    it("leaves a Markdown document alone, where a style element is already raw text", async () => {
        let { html } = await markdownToHtml(`<style>${css}</style>\n`, {
            hastPlugins: [rawStyles()],
        });

        expect(html).toBe(`<style>${css}</style>\n`);
    });

    it("renders every attribute exactly as Sätteri does without the plugin", async () => {
        let properties = {
            nonce: "n",
            media: "screen",
            blocking: "render",
            title: "",
            className: ["a", "b"],
            dataFooBar: "1",
            data123: "2",
            ariaLabel: "x",
            ariaDescribedBy: ["c", "d"],
            hidden: true,
            disabled: false,
            tabIndex: 2,
        };

        let plain = await renderCompiled("# Title\n", [styleWith(properties)]);
        let raw = await renderCompiled("# Title\n", [styleWith(properties), rawStyles()]);

        expect(raw.slice(0, raw.indexOf(">"))).toBe(plain.slice(0, plain.indexOf(">")));
        expect(raw).toContain(css);
    });

    it("keeps clear of a binding the document already declares", async () => {
        // `\u0048` is `H`: an escaped identifier names the same binding.
        let html = await renderCompiled(
            'export const _rawStyle\\u0048TML = "mine"\n\n# Title\n\n## {_rawStyleHTML}\n',
            [injectStyle, rawStyles()],
        );

        expect(html).toBe(`<style media="screen" data-theme="dark">${css}</style>\n<h2>mine</h2>`);
    });

    it("renders code examples containing escapes outside the Unicode range", async () => {
        let html = await renderCompiled("# Title\n\n`\\u{110000}`\n", [injectStyle, rawStyles()]);

        expect(html).toBe(
            `<style media="screen" data-theme="dark">${css}</style>\n<p><code>\\u{110000}</code></p>`,
        );
    });

    it("keeps clear of a binding only an unreferenced import declares", async () => {
        let html = await renderCompiled(
            'import { css as _rawStyleHTML } from "remix/component";\n\n# Title\n',
            [injectStyle, rawStyles()],
        );

        expect(html).toBe(`<style media="screen" data-theme="dark">${css}</style>`);
    });
});

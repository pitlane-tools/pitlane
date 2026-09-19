import type { HastPluginEntry } from "satteri";

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

    it("collapses runs of non-alphanumerics and trims them from the ends", async () => {
        let { data } = await markdownToHtml("## ...Hello, World! ---\n", plugins());

        expect(headingsOf(data)).toEqual([
            { depth: 2, slug: "hello-world", text: "...Hello, World! ---" },
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

    it("falls back to a stable slug when a heading has no letters or digits", async () => {
        let { data, html } = await markdownToHtml("## ---\n\n## ***\n", plugins());

        expect(headingsOf(data).map(heading => heading.slug)).toEqual(["heading", "heading-1"]);
        expect(html).not.toContain('id=""');
    });

    it("suffixes a colliding slug so every anchor in a document is unique", async () => {
        let { data } = await markdownToHtml("## Notes\n\n## Notes\n\n## Notes\n", plugins());

        expect(headingsOf(data).map(heading => heading.slug)).toEqual([
            "notes",
            "notes-1",
            "notes-2",
        ]);
    });

    it("sets each heading's id to its slug so an anchor link lands", async () => {
        let { html } = await markdownToHtml("## Install the package\n", plugins());

        expect(html).toContain('id="install-the-package"');
    });

    it("exports the heading list from a compiled MDX module", async () => {
        let { code } = await mdxToJs("# Title\n\n## Section\n", {
            ...plugins(),
            jsxImportSource: "remix/ui",
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
let injectStyle: HastPluginEntry = {
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
};

describe("rawStyles", () => {
    it("hands a compiled style element its CSS as innerHTML, not as a text child", async () => {
        // @remix-run/ui escapes `>` in the text children of every element but
        // <script>, and <style> is a raw-text element, so a browser never
        // decodes what it receives and the rule is dead. Only an innerHTML
        // prop reaches the page verbatim.
        let { code } = await mdxToJs("# Title\n", {
            hastPlugins: [injectStyle, rawStyles()],
            jsxImportSource: "remix/ui",
        });

        expect(code).toContain("innerHTML");
        expect(code).toContain("pre > code");
    });

    it("leaves the CSS as a text child when the plugin is absent", async () => {
        // The escaping this works around is Remix's, not Sätteri's, so the
        // defect is invisible in the compiler's own output. This is what makes
        // the assertion above a measurement rather than a tautology.
        let { code } = await mdxToJs("# Title\n", {
            hastPlugins: [injectStyle],
            jsxImportSource: "remix/ui",
        });

        expect(code).not.toContain("innerHTML");
    });

    it("leaves a Markdown document alone, where a style element is already raw text", async () => {
        let { html } = await markdownToHtml(`<style>${css}</style>\n`, {
            hastPlugins: [rawStyles()],
        });

        expect(html).toContain(css);
        expect(html).not.toContain("innerhtml");
    });
});

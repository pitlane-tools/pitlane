import assert from "node:assert/strict";
import test from "node:test";
import { markdownToMdast } from "satteri";

import type { DocumentPage } from "../app/document.ts";

import { exportDocument, markdownFile, markdownLinks } from "../build/exports.ts";

const SITE = { url: "https://pitlane.tools", name: "Pitlane", description: "Remix 3." };

function page(url: string, title: string, extra: Partial<DocumentPage> = {}): DocumentPage {
    return {
        url,
        title,
        description: `About ${title}.`,
        section: "guides",
        headings: [],
        ...extra,
    };
}

let hmr = page("/guides/hmr", "Hot module replacement");
let dev = page("/package/dev/", "@pitlane/dev", { section: "api", module: "@pitlane/dev" });
let vite = page("/guides/prerendering", "Prerendering", {
    buildMode: "vite",
    counterpart: "/guides/prerendering-no-build",
});
let noBuild = page("/guides/prerendering-no-build", "Prerendering (no build)", {
    buildMode: "no-build",
    counterpart: "/guides/prerendering",
});
/** The home page and four documents. */
let link = markdownLinks(SITE, ["/", ...[hmr, dev, vite, noBuild].map(({ url }) => url)]);

function article(body: string, heading = "Prerendering") {
    return `<article><h1 id="top">${heading}<a class="doc-heading__anchor" href="#top"></a></h1>${body}</article>`;
}

test("links to published pages lead to their Markdown, absolute, keeping the fragment", () => {
    for (let [href, expected] of [
        ["/guides/hmr", "https://pitlane.tools/guides/hmr.md"],
        ["/guides/hmr#state", "https://pitlane.tools/guides/hmr.md#state"],
        ["/guides/hmr/", "https://pitlane.tools/guides/hmr.md"],
        ["https://pitlane.tools/guides/hmr#state", "https://pitlane.tools/guides/hmr.md#state"],
        ["https://pitlane.tools/guides/hmr/", "https://pitlane.tools/guides/hmr.md"],
        ["/package/dev/", "https://pitlane.tools/package/dev/index.md"],
        ["/package/dev", "https://pitlane.tools/package/dev/index.md"],
        ["/package/dev/#install", "https://pitlane.tools/package/dev/index.md#install"],
        ["/", "https://pitlane.tools/index.md"],
        ["https://pitlane.tools", "https://pitlane.tools/index.md"],
        // Not published documents: an asset, an unknown path, another site, an anchor.
        ["/media/pitlane-lockup.png", "/media/pitlane-lockup.png"],
        ["/docs", "/docs"],
        ["https://remix.run/docs", "https://remix.run/docs"],
        ["https://pitlane.tools.example/guides/hmr", "https://pitlane.tools.example/guides/hmr"],
        ["#state", "#state"],
    ]) {
        assert.equal(link(href!), expected, href);
    }
});

test("an exported page's links and images follow the same rule", () => {
    let { body } = exportDocument(
        noBuild,
        article(
            '<p>See <a href="/guides/hmr#state">HMR</a>, <a href="https://remix.run">Remix</a>, and <img alt="Lockup" src="/media/lockup.png">.</p>',
            "Prerendering",
        ),
        link,
    );
    let root = markdownToMdast(body);
    assert.ok("children" in root);
    let paragraph = root.children.find(
        child => "children" in child && child.children.some(node => node.type === "image"),
    );
    assert.ok(paragraph && "children" in paragraph);
    assert.deepEqual(
        paragraph.children.filter(child => "url" in child).map(child => [child.type, child.url]),
        [
            ["link", "https://pitlane.tools/guides/hmr.md#state"],
            ["link", "https://remix.run"],
            ["image", "/media/lockup.png"],
        ],
    );
});

test("exported link destinations preserve Markdown punctuation, whitespace, and literal entities", () => {
    for (let [htmlHref, expected] of [
        ["https://example.org/query?expr=one)two", "https://example.org/query?expr=one)two"],
        ["https://example.org/path(one", "https://example.org/path(one"],
        ["https://example.org/path with spaces", "https://example.org/path with spaces"],
        [
            "https://example.org/query?literal=&amp;copy;",
            "https://example.org/query?literal=&copy;",
        ],
        ["https://example.org/query?slash=\\b", "https://example.org/query?slash=\\b"],
        ["https://example.org/query?expr=&lt;item&gt;", "https://example.org/query?expr=<item>"],
    ]) {
        let { body } = exportDocument(hmr, article(`<p><a href="${htmlHref}">Read</a></p>`), link);
        let root = markdownToMdast(body);
        assert.ok("children" in root);
        let paragraph = root.children[0]!;
        assert.ok("children" in paragraph);
        let anchor = paragraph.children[0]!;
        assert.ok("url" in anchor);
        assert.equal(anchor.url, expected);
    }
});

test("exported images retain literal alt text and their destination", () => {
    for (let [htmlAlt, expected] of [
        ["Photo ] today", "Photo ] today"],
        ["*Important* _photo_", "*Important* _photo_"],
        ["A literal &amp;copy; label", "A literal &copy; label"],
        ["Photo [front] \\ side", "Photo [front] \\ side"],
    ]) {
        let { body } = exportDocument(
            hmr,
            article(`<p><img alt="${htmlAlt}" src="/assets/pic(one).png"></p>`),
            link,
        );
        let root = markdownToMdast(body);
        assert.ok("children" in root);
        let paragraph = root.children[0]!;
        assert.ok("children" in paragraph);
        let image = paragraph.children[0]!;
        assert.equal(image.type, "image");
        assert.ok("alt" in image && "url" in image);
        assert.equal(image.alt, expected);
        assert.equal(image.url, "/assets/pic(one).png");
    }
});

test("a two-setup page names its build mode and links its counterpart's Markdown", () => {
    let exported = exportDocument(noBuild, article("<p>Body.</p>"), link);
    let file = markdownFile(SITE, exported);
    let [, frontmatter, rest] = file.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/)!;
    assert.equal(
        frontmatter,
        [
            'title: "Prerendering (no build)"',
            'description: "About Prerendering (no build)."',
            'url: "https://pitlane.tools/guides/prerendering-no-build"',
            'buildMode: "no-build"',
            'counterpart: "https://pitlane.tools/guides/prerendering.md"',
        ].join("\n"),
    );
    assert.equal(
        rest,
        "# Prerendering (no build)\n\n" +
            "This guide for: [Vite](https://pitlane.tools/guides/prerendering.md) · **No Build**\n\n" +
            "Body.\n",
    );
    let other = markdownFile(SITE, exportDocument(vite, article("<p>Body.</p>"), link));
    assert.match(
        other,
        /^# Prerendering\n\nThis guide for: \*\*Vite\*\* · \[No Build\]\(https:\/\/pitlane\.tools\/guides\/prerendering-no-build\.md\)\n\n/m,
    );
});

test("a single-setup page has no build mode, and its one heading is its title", () => {
    let file = markdownFile(SITE, exportDocument(hmr, article("<p>Body.</p>", "HMR"), link));
    assert.equal(
        file,
        '---\ntitle: "Hot module replacement"\ndescription: "About Hot module replacement."\n' +
            'url: "https://pitlane.tools/guides/hmr"\n---\n\n# Hot module replacement\n\nBody.\n',
    );
});

test("an article with more than one level-one heading cannot be exported", () => {
    assert.throws(
        () => exportDocument(hmr, article("<h1>Again</h1><p>Body.</p>"), link),
        /\/guides\/hmr/,
    );
});

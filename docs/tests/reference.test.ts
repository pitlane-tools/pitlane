import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let origin = process.env.DOCS_TEST_ORIGIN ?? "http://127.0.0.1:8788";

/** A symbol page with several examples, one of them many lines long. */
const SYMBOL = "/package/theme/function/tva";
/** A module overview carrying the old module page's anchors. */
const OVERVIEW = "/package/content/hot";

const FENCE = /^```(\w*)\n([\s\S]*?)\n```$/gm;

function generated(url: string) {
    return readFile(
        new URL(`../app/content/api${url.replace(/^\/package/, "")}.md`, import.meta.url),
        "utf8",
    );
}

async function served(path: string) {
    let response = await fetch(new URL(path, origin));
    assert.equal(response.status, 200, path);
    return response.text();
}

async function page(url: string) {
    let html = await served(url);
    let start = html.indexOf("<article");
    let end = html.indexOf("</article>", start);
    assert.ok(start !== -1 && end !== -1, `${url} has no article`);
    return { html, article: html.slice(start, end) };
}

/** Each fenced example; Expressive Code drops trailing whitespace, which no example means. */
function fences(markdown: string) {
    return [...markdown.matchAll(FENCE)].map(([, language, code]) => ({
        language,
        code: code.replace(/[ \t]+$/gm, ""),
    }));
}

test("proposal.0004: generated reference bodies arrive as static Expressive Code blocks", async () => {
    let { article } = await page(SYMBOL);
    let examples = fences(await generated(SYMBOL));

    assert.equal(
        article.includes("<!-- rmx:h:"),
        false,
        "the body carries no hydration boundaries",
    );
    let blocks = article.match(/<div\b[^>]*\bclass="[^"]*\bexpressive-code\b[^"]*"/g) ?? [];
    assert.equal(blocks.length, examples.length, "every example is an Expressive Code block");
    let languages = [...article.matchAll(/<pre\b[^>]*\bdata-language="([^"]*)"/g)].map(
        match => match[1],
    );
    assert.deepEqual(
        languages,
        examples.map(example => example.language),
    );
});

test("proposal.0004: reference outlines lead to headings in the prepared body", async () => {
    let { html, article } = await page(SYMBOL);
    let start = html.indexOf('id="doc-outline"');
    assert.notEqual(start, -1, "the page has an outline");
    let outline = html.slice(start, html.indexOf("</nav>", start));
    let destinations = [...outline.matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
    assert.ok(destinations.length > 0, "the outline links somewhere");
    let unreachable = destinations.filter(
        id =>
            !new RegExp(`<h[1-6]\\b[^>]*\\bid="${id}"`).test(article) ||
            !new RegExp(`<a\\b[^>]*\\bhref="#${id}"`).test(article),
    );
    assert.deepEqual(unreachable, [], "every outline entry is a heading with a permalink");
});

test("proposal.0004: old module anchors remain targets on the overview", async () => {
    let { article } = await page(OVERVIEW);
    let anchors = [...(await generated(OVERVIEW)).matchAll(/<a id="([^"]+)"><\/a>/g)].map(
        match => match[1],
    );
    assert.ok(anchors.length > 0, "the overview has compatibility anchors");
    let missing = anchors.filter(id => !new RegExp(`\\bid="${id}"`).test(article));
    assert.deepEqual(missing, [], "every old anchor is still a target");
});

test("proposal.0004: reference Markdown exports keep every example's language and lines", async () => {
    let exported = await served(`${SYMBOL}.md`);
    assert.deepEqual(fences(exported), fences(await generated(SYMBOL)));
});

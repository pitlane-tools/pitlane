import fc from "fast-check";
import assert from "node:assert/strict";
import test from "node:test";
import { clientEntry, createElement } from "remix/ui";
import { renderToString } from "remix/ui/server";
import { htmlToHast, markdownToHtml } from "satteri";

import { installAlternatives } from "../app/install.ts";
import { renderCode } from "../build/expressive-code.ts";
import { htmlToMarkdown } from "../build/markdown.ts";

const WHERE = "docs/package/example.md";

/** Languages examples name, and a fence that names none. */
const LANGUAGES = [undefined, "ts", "tsx", "js", "json", "sh", "bash", "html", "css", "yaml"];

let character = fc.constantFrom(..."aZ7 \t<>&\"'`*_#$\\{}[]éλ→😀".split(/(?:)/u), "\u00a0");
let line = fc.array(character, { maxLength: 12 }).map(characters => characters.join(""));
let example = fc
    .array(line, { minLength: 1, maxLength: 6 })
    .map(lines => lines.join("\n"))
    .filter(code => code.trim() !== "");

/**
 * The example as Expressive Code displays it: every line without trailing
 * whitespace, and no blank lines before the first or after the last.
 */
function displayed(code) {
    let lines = code.split("\n").map(line => line.trimEnd());
    while (lines[0] === "") lines.shift();
    while (lines.at(-1) === "") lines.pop();
    return lines.join("\n");
}

function elements(node, tagName) {
    if (node.type !== "root" && node.type !== "element") return [];
    let found = node.type === "element" && node.tagName === tagName ? [node] : [];
    return found.concat(...node.children.map(child => elements(child, tagName)));
}

function text(node) {
    if (node.type === "text") return node.value;
    return node.type === "element" ? node.children.map(text).join("") : "";
}

/** What a Markdown reader finds in an export: every code block's language and exact text. */
function readFences(markdown) {
    let { html } = markdownToHtml(markdown);
    let root = htmlToHast(html, { fragment: true });
    let content = root.children.filter(node => node.type !== "text" || node.value.trim() !== "");
    return {
        onlyCodeBlocks: content.every(node => node.type === "element" && node.tagName === "pre"),
        fences: elements(root, "code").map(code => {
            let classes = [code.properties?.className ?? []].flat().map(String);
            let language = classes.find(name => name.startsWith("language-"));
            return {
                language: language?.slice("language-".length) ?? "",
                code: text(code).replace(/\n$/, ""),
            };
        }),
    };
}

/** The text Expressive Code's copy button hands the clipboard, decoded as its script does. */
function copyPayloads(html) {
    return elements(htmlToHast(html, { fragment: true }), "button")
        .filter(button => typeof button.properties?.dataCode === "string")
        .map(button => button.properties.dataCode.replace(/\u007f/g, "\n"));
}

test("proposal.0004: for any example, the Markdown export holds its displayed code and language", async () => {
    await fc.assert(
        fc.asyncProperty(example, fc.constantFrom(...LANGUAGES), async (code, language) => {
            let html = await renderCode(code, language, WHERE);
            assert.deepEqual(readFences(htmlToMarkdown(html)), {
                onlyCodeBlocks: true,
                fences: [{ language: language ?? "", code: displayed(code) }],
            });
        }),
        { seed: 4004 },
    );
});

test("proposal.0004: for any example, copying it yields its displayed code", async () => {
    await fc.assert(
        fc.asyncProperty(example, fc.constantFrom(...LANGUAGES), async (code, language) => {
            let html = await renderCode(code, language, WHERE);
            assert.deepEqual(copyPayloads(html), [displayed(code)]);
        }),
        { seed: 4005 },
    );
});

test("proposal.0004: shell examples copy their comments and blank lines too", async () => {
    let code = "# Install the runtime\nnpm install remix\n\n# Then start it\nnpx remix dev";
    let html = await renderCode(code, "sh", WHERE);
    assert.deepEqual(copyPayloads(html), [code]);
    assert.deepEqual(readFences(htmlToMarkdown(html)).fences, [{ language: "sh", code }]);
});

test("proposal.0004: an example opening with a file-name comment keeps that line", async () => {
    let code = "// vite.config.ts\nexport default defineConfig({ plugins: [remix()] });";
    let html = await renderCode(code, "ts", WHERE);
    assert.deepEqual(copyPayloads(html), [code]);
    assert.deepEqual(readFences(htmlToMarkdown(html)).fences, [{ language: "ts", code }]);
});

test("proposal.0004: HTML examples cannot swallow the document's hydration data", async () => {
    let code = '<html lang="en">\n<head></head>\n<body title="a & b"></body>\n</html>';
    let html = await renderCode(code, "html", WHERE);
    let Control = clientEntry(
        "/control.js#Control",
        () => () => createElement("button", null, "Choose"),
    );
    let document = await renderToString(
        createElement(
            "html",
            null,
            createElement("head"),
            createElement(
                "body",
                null,
                createElement("div", { innerHTML: html }),
                createElement(Control),
            ),
        ),
    );
    let scripts = elements(htmlToHast(document), "script");
    assert.equal(
        scripts.filter(script => script.properties?.id === "rmx-data").length,
        1,
        "the browser must receive hydration data outside the example's copy attribute",
    );
    assert.deepEqual(copyPayloads(document), [code]);
    assert.deepEqual(readFences(htmlToMarkdown(html)).fences, [{ language: "html", code }]);
});

test("proposal.0004: an example in a language no highlighter knows fails the build, naming its document", async () => {
    await assert.rejects(
        renderCode("let answer = 42;", "not-a-language", WHERE),
        error =>
            error instanceof Error &&
            error.message.includes(WHERE) &&
            error.message.includes('"not-a-language"'),
    );
});

test("proposal.0004: an install group offers every package manager's command, each copying what it displays", async () => {
    let alternatives = await installAlternatives({
        packages: ["@pitlane/content"],
        dev: ["satteri", "vite-plugin-satteri"],
    });
    let commands = alternatives.map(({ manager, html }) => {
        let [code] = copyPayloads(html);
        assert.deepEqual(readFences(htmlToMarkdown(html)).fences, [{ language: "sh", code }]);
        return [manager, code];
    });
    assert.deepEqual(commands, [
        ["npm", "npm add @pitlane/content\nnpm add -D satteri vite-plugin-satteri"],
        ["yarn", "yarn add @pitlane/content\nyarn add -D satteri vite-plugin-satteri"],
        ["pnpm", "pnpm add @pitlane/content\npnpm add -D satteri vite-plugin-satteri"],
        ["bun", "bun add @pitlane/content\nbun add -D satteri vite-plugin-satteri"],
        ["deno", "deno add npm:@pitlane/content\ndeno add -D npm:satteri npm:vite-plugin-satteri"],
        ["vp", "vp add @pitlane/content\nvp add -D satteri vite-plugin-satteri"],
        ["vlt", "vlt add @pitlane/content\nvlt add -D satteri vite-plugin-satteri"],
        ["nub", "nub add @pitlane/content\nnub add -D satteri vite-plugin-satteri"],
    ]);
});

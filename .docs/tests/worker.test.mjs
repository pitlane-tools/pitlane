import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { htmlToHast } from "satteri";

let origin = process.env.DOCS_TEST_ORIGIN ?? "http://127.0.0.1:8788";
let request = (path, init) => fetch(new URL(path, origin), { redirect: "manual", ...init });

test("proposal.0004: HEAD serves public document headers without a response body", async () => {
    let response = await request("/guides/vite-plugin", { method: "HEAD" });
    assert.equal(response.status, 200);
    assert.notEqual(response.headers.get("cache-control"), "private, no-store");
    assert.equal(await response.text(), "");
});

test("proposal.0004: explicit variant URLs do not redirect to the stored build preference", async () => {
    let response = await request("/guides/content-no-build", {
        headers: { cookie: "pitlane-build-mode=vite" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
});

test("proposal.0004: unknown documents and retired article-frame paths return real 404s", async () => {
    let notFound = await readFile(new URL("../dist/client/404.html", import.meta.url), "utf8");
    for (let path of [
        "/unknown-document",
        "/__frames/unknown-document/",
        "/__frames/guides/vite-plugin/",
        "/preferences",
    ]) {
        let response = await request(path);
        assert.equal(response.status, 404, path);
        assert.equal(await response.text(), notFound, path);
    }
});

function elements(node, tag) {
    if (node.type !== "root" && node.type !== "element") return [];
    return [
        ...(node.type === "element" && node.tagName === tag ? [node] : []),
        ...node.children.flatMap(child => elements(child, tag)),
    ];
}

function text(node) {
    if (node.type === "text") return node.value;
    return (node.children ?? []).map(text).join("");
}

test("proposal.0004: every install alternative is reachable through a named native disclosure", async () => {
    let response = await request("/guides/vite-plugin");
    let root = htmlToHast(await response.text());
    let article = elements(root, "article")[0];
    for (let manager of ["npm", "yarn", "pnpm", "bun", "deno", "vp", "vlt", "nub"]) {
        let disclosure = elements(article, "details").find(details =>
            elements(details, "summary").some(summary => text(summary).trim() === manager),
        );
        assert.ok(disclosure, `${manager} has a native disclosure`);
        assert.equal(disclosure.properties?.hidden, undefined, `${manager} is not hidden`);
        let code = elements(disclosure, "pre").map(text).join("\n");
        assert.match(code, new RegExp(`\\b${manager}\\b`));
        assert.match(code, /@pitlane\/dev/);
    }
});

test("proposal.0004: authored examples expose library copy payloads matching displayed code", async () => {
    let response = await request("/guides/vite-plugin");
    let root = htmlToHast(await response.text());
    let article = elements(root, "article")[0];
    let examples = elements(article, "pre");
    let payloads = elements(article, "button")
        .filter(button => typeof button.properties?.dataCode === "string")
        .map(button => button.properties.dataCode.replace(/\u007f/g, "\n"));
    for (let example of examples) {
        let lines = elements(example, "div").filter(line =>
            [line.properties?.className ?? []].flat().includes("ec-line"),
        );
        let displayed = lines.length
            ? lines.map(line => text(line).replace(/\n$/, "")).join("\n")
            : text(example).replace(/\n$/, "");
        assert.ok(payloads.includes(displayed), `Missing copy payload for ${displayed}`);
    }
});

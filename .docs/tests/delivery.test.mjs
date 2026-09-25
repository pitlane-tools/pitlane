import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PREFERENCE_CHOICES, PREFERENCE_COOKIES } from "../app/document.ts";

let origin = process.env.DOCS_TEST_ORIGIN ?? "http://127.0.0.1:8788";

/** What Cloudflare serves as static assets before the Worker can run. */
const ASSETS = new URL("../dist/client/", import.meta.url);

/** The Worker this build deploys, rendering in this process as the build's publication does. */
let app = await import(new URL("../dist/ssr/index.js", import.meta.url).href);
let { pages } = await app.publication.documents();
let references = pages.filter(page => page.section === "api").map(page => page.url);
let authored = pages.filter(page => page.section !== "api").map(page => page.url);

/** Every combination of the supported preferences, as the cookies a reader sends with it. */
let preferences = Object.entries(PREFERENCE_CHOICES)
    .reduce(
        (combinations, [key, choices]) =>
            combinations.flatMap(cookies =>
                choices.map(choice => cookies.concat(`${PREFERENCE_COOKIES[key]}=${choice}`)),
            ),
        [[]],
    )
    .map(cookies => cookies.join("; "));

/** The static file at `path`, or `undefined` when the build published none there. */
async function asset(path) {
    try {
        return await readFile(new URL(`.${path}`, ASSETS), "utf8");
    } catch (error) {
        if (error.code === "ENOENT") return undefined;
        throw error;
    }
}

/** Where a document's HTML file serves it at its own address, trailing slash and all. */
function htmlFile(url) {
    return url.endsWith("/") ? `${url}index.html` : `${url}.html`;
}

async function rendered(url, cookie) {
    let response = await app.default.fetch(
        new Request(new URL(url, "https://pitlane.tools"), { headers: { cookie } }),
    );
    assert.equal(response.status, 200, url);
    return response.text();
}

/**
 * A document with its random hydration identifiers numbered in order of
 * appearance. Every render draws new ones; nothing else may differ between
 * two renders of the same document.
 */
function normalized(html) {
    let ids = new Set([...html.matchAll(/<!-- rmx:h:(h[0-9a-f]{8}) -->/g)].map(([, id]) => id));
    let index = 0;
    for (let id of ids) html = html.replaceAll(id, `rmx-${index++}`);
    return html;
}

/** Where `path` finally answers, following only temporary redirects. */
async function destination(path) {
    let location = new URL(path, origin);
    for (let hop = 0; hop < 4; hop++) {
        let response = await fetch(location, { redirect: "manual" });
        await response.body?.cancel();
        if (response.status === 200) return location.pathname + location.search;
        assert.equal(
            response.status,
            307,
            `${path} redirects temporarily from ${location.pathname}`,
        );
        location = new URL(response.headers.get("location"), location);
    }
    assert.fail(`${path} redirects more than four times`);
}

test("proposal.0004: every reference document is a static file served at its canonical address without the Worker", async () => {
    let unpublished = [];
    for (let url of references) {
        let file = await asset(htmlFile(url));
        if (file === undefined) {
            unpublished.push(url);
            continue;
        }
        let response = await fetch(new URL(url, origin), { redirect: "manual" });
        assert.equal(response.status, 200, url);
        assert.match(response.headers.get("content-type"), /^text\/html\b/i, url);
        assert.notEqual(response.headers.get("etag"), null, `${url} is served as an asset`);
        assert.notEqual(response.headers.get("cache-control"), "private, no-store", url);
        assert.equal(response.headers.get("set-cookie"), null, url);
        assert.equal(await response.text(), file, url);
    }
    assert.deepEqual(unpublished, [], "reference documents without a published HTML file");
});

test("proposal.0004: for every supported preference combination, each reference document renders exactly as its published file", async () => {
    let unpublished = [];
    for (let url of references) {
        let file = await asset(htmlFile(url));
        if (file === undefined) {
            unpublished.push(url);
            continue;
        }
        let published = normalized(file);
        for (let cookie of preferences) {
            assert.equal(
                normalized(await rendered(url, cookie)),
                published,
                `${url} with ${cookie}`,
            );
        }
    }
    assert.deepEqual(unpublished, [], "reference documents without a published HTML file");
});

test("proposal.0004: other spellings of a reference address redirect to it temporarily, keeping the query", async () => {
    for (let url of references) {
        let spellings = url.endsWith("/")
            ? [url.slice(0, -1), `${url}index`, `${url}index.html`]
            : [`${url}/`, `${url}.html`];
        for (let spelling of spellings) {
            assert.equal(await destination(`${spelling}?from=elsewhere`), `${url}?from=elsewhere`);
        }
    }
});

test("proposal.0004: authored documents have no static file and are rendered for each request", async () => {
    for (let url of authored) {
        for (let path of [`${url}.html`, `${url}/index.html`]) {
            assert.equal(await asset(path), undefined, `${path} is not published`);
        }
        let response = await fetch(new URL(url, origin), { method: "HEAD", redirect: "manual" });
        assert.equal(response.status, 200, url);
        assert.equal(response.headers.get("cache-control"), "private, no-store", url);
        assert.equal(response.headers.get("etag"), null, url);
    }
});

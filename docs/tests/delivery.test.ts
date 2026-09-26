import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { PREFERENCE_CHOICES } from "../app/document.ts";

let origin = process.env.DOCS_TEST_ORIGIN ?? "http://127.0.0.1:8788";

/** The published files, which Cloudflare serves with no Worker code. */
const ASSETS = new URL("../dist/client/", import.meta.url);

/** The build renderer must stay independent of request cookies. */
let app: { default: { fetch(request: Request): Promise<Response> } } = await import(
    new URL("../dist/ssr/index.js", import.meta.url).href
);
let references = (
    JSON.parse(
        await readFile(new URL("../.generated/reference.json", import.meta.url), "utf8"),
    ) as { url: string }[]
).map(page => page.url);

/**
 * Every authored page, read from the sources rather than from what the build
 * published, so an omitted page shrinks the published set and not this one.
 * Underscored files are partials.
 */
let authored = (
    await Promise.all(
        Object.entries({ guides: "guides", deployment: "deploy" }).map(
            async ([directory, section]) =>
                (await readdir(new URL(`../app/content/${directory}/`, import.meta.url)))
                    .filter(name => !name.startsWith("_") && /\.mdx?$/.test(name))
                    .map(name => `/${section}/${name.replace(/\.mdx?$/, "")}`),
        ),
    )
).flat();
let documents = [...references, ...authored];

/** Every combination of the supported preferences, as the cookies a reader sends with it. */
let preferences = Object.entries(PREFERENCE_CHOICES)
    .reduce<string[][]>(
        (combinations, [key, choices]) =>
            combinations.flatMap(cookies =>
                choices.map(choice =>
                    cookies.concat(
                        `pitlane-${key === "packageManager" ? "package-manager" : "build-mode"}=${choice}`,
                    ),
                ),
            ),
        [[]],
    )
    .map(cookies => cookies.join("; "));

/** The static file at `path`, or `undefined` when the build published none there. */
async function asset(path: string) {
    try {
        return await readFile(new URL(`.${path}`, ASSETS), "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
    }
}

/** Where a document's HTML file serves it at its own address, trailing slash and all. */
function htmlFile(url: string) {
    return url.endsWith("/") ? `${url}index.html` : `${url}.html`;
}

async function rendered(url: string, cookie: string) {
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
function normalized(html: string) {
    let ids = new Set([...html.matchAll(/<!-- rmx:h:(h[0-9a-f]{8}) -->/g)].map(([, id]) => id));
    let index = 0;
    for (let id of ids) html = html.replaceAll(id, `rmx-${index++}`);
    return html;
}

/** Where `path` finally answers, following only temporary redirects. */
async function destination(path: string) {
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
        location = new URL(response.headers.get("location")!, location);
    }
    assert.fail(`${path} redirects more than four times`);
}

test("proposal.0004: every public document is a static file served at its canonical address", async () => {
    let unpublished = [];
    for (let url of documents) {
        let file = await asset(htmlFile(url));
        if (file === undefined) {
            unpublished.push(url);
            continue;
        }
        let response = await fetch(new URL(url, origin), { redirect: "manual" });
        assert.equal(response.status, 200, url);
        assert.match(response.headers.get("content-type")!, /^text\/html\b/i, url);
        assert.notEqual(response.headers.get("cache-control"), "private, no-store", url);
        assert.equal(response.headers.get("set-cookie"), null, url);
        assert.equal(await response.text(), file, url);
    }
    assert.deepEqual(unpublished, [], "public documents without a published HTML file");
});

test("proposal.0004: every document renders identically across supported legacy preference cookies", async () => {
    let unpublished = [];
    for (let url of documents) {
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
    assert.deepEqual(unpublished, [], "public documents without a published HTML file");
});

test("proposal.0004: alternate document spellings redirect temporarily, preserving the query", async () => {
    for (let url of documents) {
        let spellings = url.endsWith("/")
            ? [url.slice(0, -1), `${url}index`, `${url}index.html`]
            : [`${url}/`, `${url}.html`];
        for (let spelling of spellings) {
            assert.equal(await destination(`${spelling}?from=elsewhere`), `${url}?from=elsewhere`);
        }
    }
});

test("proposal.0004: legacy file and index spellings preserve their canonical destination and query", async () => {
    for (let [from, to] of [
        ["/guides/vite-plugin.html/", "/guides/vite-plugin"],
        ["/guides/vite-plugin/index/", "/guides/vite-plugin"],
        ["/guides/vite-plugin/index.html/", "/guides/vite-plugin"],
        ["/guides/vite-plugin.md/", "/guides/vite-plugin.md"],
        ["/guides/vite-plugin/index.md/", "/guides/vite-plugin.md"],
        ["/package/dev.html", "/package/dev/"],
        ["/package/dev/index.md/", "/package/dev/index.md"],
        ["/package/content/index-1/index.html/", "/package/content/"],
        ["/package/content/index-1", "/package/content/"],
        ["/package/content/index-1.md/", "/package/content/index.md"],
    ]) {
        assert.equal(await destination(`${from}?source=legacy`), `${to}?source=legacy`);
    }
});

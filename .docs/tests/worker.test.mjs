import assert from "node:assert/strict";
import test from "node:test";

let origin = process.env.DOCS_TEST_ORIGIN ?? "http://127.0.0.1:8788";
let request = (path, init) => fetch(new URL(path, origin), { redirect: "manual", ...init });

function preference(preference, value, returnTo = "/guides/vite-plugin") {
    return request("/preferences", {
        method: "POST",
        body: new URLSearchParams({ preference, value, returnTo }),
    });
}

test("proposal.0004: cookie-bearing documents cannot enter shared caches", async () => {
    let response = await request("/guides/vite-plugin", {
        headers: { cookie: "pitlane-package-manager=pnpm" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    let html = await response.text();
    assert.equal((html.match(/<html\b/g) ?? []).length, 1);
});

test("proposal.0004: HEAD exposes private document headers without a response body", async () => {
    let response = await request("/guides/vite-plugin", { method: "HEAD" });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(await response.text(), "");
});

test("proposal.0004: explicit variant URLs do not redirect to the stored build preference", async () => {
    let response = await request("/guides/content-no-build", {
        headers: { cookie: "pitlane-build-mode=vite" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
});

test("proposal.0004: preference submissions issue secure cookies and redirect to readable documents", async () => {
    let response = await preference("packageManager", "bun");
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    let cookie = response.headers.get("set-cookie");
    assert.match(cookie, /pitlane-package-manager=bun/);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Max-Age=\d+/i);
    assert.doesNotMatch(cookie, /Domain=/i);
    let location = new URL(response.headers.get("location"), origin);
    assert.equal(location.origin, new URL(origin).origin);
    let selected = await request(location.pathname + location.search);
    assert.equal(selected.status, 200);
});

test("proposal.0004: preference validation rejects retired, unknown, or invalid choices and external destinations", async () => {
    for (let [key, value, destination] of [
        ["packageManager", "invalid", "/guides/vite-plugin"],
        ["unknown", "bun", "/guides/vite-plugin"],
        ["theme", "dark", "/guides/vite-plugin"],
        ["packageManager", "bun", "https://example.com/"],
        ["packageManager", "bun", "//example.com/"],
    ]) {
        let response = await preference(key, value, destination);
        assert.equal(response.status, 400);
        assert.equal(response.headers.get("set-cookie"), null);
    }
});

test("proposal.0004: unknown documents and retired article-frame paths return real 404s", async () => {
    for (let path of [
        "/unknown-document",
        "/__frames/unknown-document/",
        "/__frames/guides/vite-plugin/",
    ]) {
        assert.equal((await request(path)).status, 404);
    }
});

import assert from "node:assert/strict";
import test from "node:test";

let origin = process.env.DOCS_TEST_ORIGIN ?? "http://127.0.0.1:8788";

test("proposal.0004: obsolete module paths reach the canonical module overview", async () => {
    let response = await fetch(new URL("/package/content/index-1?from=legacy", origin));
    assert.equal(response.status, 200);
    let destination = new URL(response.url);
    assert.equal(destination.pathname, "/package/content/");
    assert.equal(destination.searchParams.get("from"), "legacy");
});

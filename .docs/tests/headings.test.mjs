import assert from "node:assert/strict";
import test from "node:test";
import { markdownToHtml } from "satteri";

import { outline } from "../build/satteri.ts";

test("heading destinations remain unique when a title already contains a numeric suffix", async () => {
    let { html } = await markdownToHtml("## Example\n\n## Example\n\n## Example-1\n", {
        hastPlugins: [outline()],
    });
    let ids = [...html.matchAll(/<h2\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(ids, ["example", "example-1", "example-1-1"]);
});

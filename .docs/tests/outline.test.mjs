import assert from "node:assert/strict";
import test from "node:test";

import { outline } from "../app/outline.ts";

let page = {
    url: "/guides/example",
    title: "Example",
    description: "Example guide",
    section: "guides",
    buildMode: "vite",
};
let title = { id: "example", text: "Example", level: 1 };
let shared = { id: "configuration", text: "Configuration", level: 2 };

test("composed pages cannot publish ambiguous heading destinations", () => {
    assert.throws(
        () => outline(page, [title, shared, { ...shared }], "docs/guides/example.mdx"),
        error =>
            error instanceof Error &&
            error.message.includes("docs/guides/example.mdx") &&
            error.message.includes("#configuration"),
    );
});

test("headings in mutually exclusive variants do not collide", () => {
    assert.deepEqual(
        outline(
            page,
            [title, { ...shared, buildMode: "vite" }, { ...shared, buildMode: "no-build" }],
            "docs/guides/example.mdx",
        ),
        [shared],
    );
});

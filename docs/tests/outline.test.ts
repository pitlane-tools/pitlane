import assert from "node:assert/strict";
import test from "node:test";

import type { DocumentPage } from "../app/document.ts";

import { outline } from "../app/outline.ts";

let page: Omit<DocumentPage, "headings"> = {
    url: "/guides/example",
    title: "Example",
    description: "Example guide",
    section: "guides",
    buildMode: "vite",
};
let title = { depth: 1, slug: "example", text: "Example" };
let shared = { depth: 2, slug: "configuration", text: "Configuration" };

test("composed pages cannot publish ambiguous heading destinations", () => {
    assert.throws(
        () => outline(page, [title, shared, { ...shared }], "docs/app/content/guides/example.mdx"),
        error =>
            error instanceof Error &&
            error.message.includes("docs/app/content/guides/example.mdx") &&
            error.message.includes("#configuration"),
    );
});

test("headings in mutually exclusive variants do not collide", () => {
    assert.deepEqual(
        outline(
            page,
            [title, { ...shared, buildMode: "vite" }, { ...shared, buildMode: "no-build" }],
            "docs/app/content/guides/example.mdx",
        ),
        [{ id: "configuration", text: "Configuration", level: 2 }],
    );
});

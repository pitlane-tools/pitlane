import { describe, expect, it, vi } from "vitest";

import { createContent } from "../content.ts";
import { file } from "./file.ts";
import { glob } from "./glob.ts";

// A bundle built without `contentLayer()` reaches the loader on a host that has no
// `node:fs` to import — Cloudflare Workers above all. Refusing the module is
// the only way to reproduce that from Node.
vi.mock("node:fs/promises", () => {
    throw Object.assign(new Error("Cannot find module 'node:fs/promises'"), {
        code: "ERR_MODULE_NOT_FOUND",
    });
});

let expected =
    'Collection "blog" has no prebuilt content and no filesystem to read.\n' +
    'Add contentLayer() from "@pitlane/content/vite" to your Vite config.';

describe("a filesystem loader with no filesystem", () => {
    it("says what to install rather than producing an empty collection", async () => {
        let content = createContent(c => ({
            blog: c.collection({
                loader: glob({ pattern: "**/*.md", base: "app/content/blog" }),
                schema: {
                    "~standard": { version: 1, vendor: "test", validate: value => ({ value }) },
                },
            }),
        }));

        await expect(content.blog.getCollection()).rejects.toThrow(expected);
    });

    it("says the same for loaders.file, which reads the filesystem too", async () => {
        let content = createContent(c => ({
            blog: c.collection({
                loader: file("app/content/authors.json"),
                schema: {
                    "~standard": { version: 1, vendor: "test", validate: value => ({ value }) },
                },
            }),
        }));

        await expect(content.blog.getCollection()).rejects.toThrow(expected);
    });
});

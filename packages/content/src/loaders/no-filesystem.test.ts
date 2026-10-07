import { afterEach, describe, expect, it, vi } from "vite-plus/test";

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

describe("a filesystem loader with no filesystem", () => {
    it("rejects rather than producing an empty collection", async () => {
        let content = createContent(c => ({
            blog: c.collection({
                loader: glob({ pattern: "**/*.md", base: "app/content/blog" }),
                schema: {
                    "~standard": { version: 1, vendor: "test", validate: value => ({ value }) },
                },
            }),
        }));

        await expect(content.blog.getCollection()).rejects.toThrow();
    });

    it("rejects for loaders.file, which reads the filesystem too", async () => {
        let content = createContent(c => ({
            blog: c.collection({
                loader: file("app/content/authors.json"),
                schema: {
                    "~standard": { version: 1, vendor: "test", validate: value => ({ value }) },
                },
            }),
        }));

        await expect(content.blog.getCollection()).rejects.toThrow();
    });

    describe("in an app that imports content through the pitlane umbrella", () => {
        // What each `pitlane/*` module of the umbrella does when it loads.
        let reached = Symbol.for("pitlane.umbrella.packages");
        afterEach(() => {
            delete (globalThis as Record<symbol, unknown>)[reached];
        });

        it("names the umbrella's subpath, which is the one the app can import", async () => {
            (globalThis as Record<symbol, unknown>)[reached] = new Set(["@pitlane/content"]);
            let content = createContent(c => ({
                blog: c.collection({
                    loader: glob({ pattern: "**/*.md", base: "app/content/blog" }),
                    schema: {
                        "~standard": { version: 1, vendor: "test", validate: value => ({ value }) },
                    },
                }),
            }));

            await expect(content.blog.getCollection()).rejects.toThrow(
                '"pitlane/content/vite-plugin"',
            );
        });

        it("keeps the scoped name when the umbrella reached only other packages", async () => {
            (globalThis as Record<symbol, unknown>)[reached] = new Set(["@pitlane/theme"]);
            let content = createContent(c => ({
                blog: c.collection({
                    loader: file("app/content/authors.json"),
                    schema: {
                        "~standard": { version: 1, vendor: "test", validate: value => ({ value }) },
                    },
                }),
            }));

            await expect(content.blog.getCollection()).rejects.toThrow(
                '"@pitlane/content/vite-plugin"',
            );
        });
    });
});

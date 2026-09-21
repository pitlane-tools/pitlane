import * as s from "remix/data-schema";
import { describe, expect, it, vi } from "vitest";

describe("rendering Markdown without satteri installed", () => {
    it("names the package to install and the plugin that avoids needing it", async () => {
        // `satteri` is an optional peer dependency. Refusing the module is how a
        // test stands in for an application that never installed it, and
        // `doMock` is what puts that refusal inside the dynamic import rather
        // than at this file's own import time.
        vi.doMock("satteri", () => {
            throw Object.assign(new Error("Cannot find package 'satteri'"), {
                code: "ERR_MODULE_NOT_FOUND",
            });
        });
        let { createContent } = await import("./content.ts");

        let content = createContent(c => ({
            blog: c.collection({
                loader: {
                    name: "memory",
                    async load(context) {
                        context.store.set({
                            id: "hello",
                            data: await context.parseData({ id: "hello", data: {} }),
                            filePath: "app/content/blog/hello.md",
                            body: { format: "md", source: "# Greeting\n" },
                        });
                    },
                },
                schema: s.object({}),
            }),
        }));
        let entry = await content.blog.getEntry("hello");

        await expect(entry!.render()).rejects.toThrow(
            'Rendering "app/content/blog/hello.md" needs the optional peer dependency "satteri"; ' +
                "install it, or add contentLayer() from @pitlane/content/vite so the build compiles " +
                "this collection.",
        );
    });
});

import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import satteri from "vite-plugin-satteri";
import { afterEach, describe, expect, it } from "vitest";

import { headings } from "../src/satteri.ts";
import { content } from "../src/vite.ts";

let fixture = fileURLToPath(new URL("./fixtures/prebuild-app", import.meta.url));
let open: { server: ViteDevServer; root: string }[] = [];

afterEach(async () => {
    for (let { server, root } of open.splice(0)) {
        await server.close();
        await rm(root, { force: true, recursive: true });
    }
});

/**
 * A dev server over a throwaway copy of the fixture, so a test can edit it.
 *
 * The copy lives inside the package rather than in the system temp directory:
 * the fixture imports `remix` and `@pitlane/content`, and resolution for those
 * only works from somewhere inside the workspace.
 */
async function devServer(options?: { entry?: string }) {
    let root = await mkdtemp(fileURLToPath(new URL("./.tmp-dev-", import.meta.url)));
    await cp(fixture, root, { recursive: true });
    let server = await createServer({
        root,
        logLevel: "silent",
        server: { middlewareMode: true },
        resolve: {
            alias: {
                "@pitlane/content/loaders": fileURLToPath(
                    new URL("../src/loaders.ts", import.meta.url),
                ),
                "@pitlane/content": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
            },
        },
        plugins: [
            satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()] }),
            content(options),
        ],
    });
    open.push({ server, root });
    return { server, root };
}

/**
 * Reads the collection through the dev server until `expected` holds.
 *
 * The retry polls the condition the change produces rather than sleeping for a
 * guessed interval: a change that never lands fails on the suite's own timeout,
 * and one that lands immediately costs one read.
 */
async function until<T>(read: () => Promise<T>, holds: (value: T) => boolean) {
    while (true) {
        let value = await read();
        if (holds(value)) return value;
        let next = Promise.withResolvers<void>();
        setTimeout(() => next.resolve(), 25);
        await next.promise;
    }
}

async function blogIds(server: ViteDevServer, entry: string) {
    let module = await server.ssrLoadModule(entry);
    let entries = await module.content.blog.getCollection();
    return entries.map((loaded: { id: string }) => loaded.id) as string[];
}

function idsBecome(server: ViteDevServer, expected: string[], entry = "/app/content.ts") {
    return until(
        () => blogIds(server, entry),
        ids => ids.length === expected.length && ids.every((id, at) => id === expected[at]),
    );
}

describe("content() in dev", () => {
    it("picks up a post added after the server started", async () => {
        let { server, root } = await devServer();

        expect(await idsBecome(server, ["hello", "second"])).toHaveLength(2);

        await writeFile(
            join(root, "app/content/blog/third.md"),
            "---\ntitle: Third\npublishedOn: 2026-07-08\nauthor: ada\n---\n\n# Third\n",
        );

        expect(await idsBecome(server, ["hello", "second", "third"])).toContain("third");
    });

    it("picks up the first post in a collection that started empty", async () => {
        // `app/later` holds no Markdown and no other collection points at it,
        // so there is no file path to infer a watch from: the directory is
        // watched only if the plugin asked the loader what it reads.
        let { server, root } = await devServer({ entry: "app/content-empty.ts" });
        let entry = "/app/content-empty.ts";

        expect(await idsBecome(server, [], entry)).toEqual([]);

        await writeFile(join(root, "app/later/first.md"), "---\ntitle: First\n---\n\n# First\n");

        expect(await idsBecome(server, ["first"], entry)).toEqual(["first"]);
    });

    it("surfaces a broken edit instead of serving stale content", async () => {
        let { server, root } = await devServer();

        await idsBecome(server, ["hello", "second"]);

        // A schema violation makes the re-prebuild reject. The rejection used
        // to escape into the watcher, which ignores the promise: invalidation
        // was skipped, so the next read quietly returned the old entry and the
        // author saw nothing wrong.
        await writeFile(
            join(root, "app/content/blog/hello.md"),
            "---\ntitle: 7\npublishedOn: not-a-date\n---\n\n# Broken\n",
        );

        let outcome = await until(
            async () => {
                try {
                    let module = await server.ssrLoadModule("/app/content.ts");
                    let entry = await module.content.blog.getEntry("hello");
                    return { titled: entry?.data.title as string };
                } catch (error) {
                    return { failed: error instanceof Error ? error.message : String(error) };
                }
            },
            result => !("titled" in result) || result.titled !== "Hello",
        );

        expect(outcome).not.toHaveProperty("titled", "Hello");
    });

    it("recovers from a first prebuild that failed", async () => {
        let { server, root } = await devServer();

        // Broken before the server ever prebuilt successfully, so the plugin
        // never learned which paths to watch. Fixing the file has to take
        // effect anyway; otherwise the author's only move is a restart, right
        // after being shown an error and told to fix it.
        await writeFile(
            join(root, "app/content/blog/hello.md"),
            "---\ntitle: 7\npublishedOn: not-a-date\n---\n\n# Broken\n",
        );

        await expect(blogIds(server, "/app/content.ts")).rejects.toThrow(/Failed to parse entry/);

        await writeFile(
            join(root, "app/content/blog/hello.md"),
            "---\ntitle: Repaired\npublishedOn: 2026-01-02\nauthor: ada\n---\n\n# Repaired\n",
        );

        // Polls through the rejection: recovery is what is being waited for, so
        // a failing read is a not-yet rather than a result.
        let ids = await until(
            async () => {
                try {
                    return await blogIds(server, "/app/content.ts");
                } catch {
                    return undefined;
                }
            },
            value => value?.length === 2,
        );

        expect(ids).toEqual(["hello", "second"]);
    });

    it("picks up a deleted post", async () => {
        let { server, root } = await devServer();

        await idsBecome(server, ["hello", "second"]);
        await rm(join(root, "app/content/blog/second.mdx"));

        expect(await idsBecome(server, ["hello"])).toEqual(["hello"]);
    });

    it("picks up an edit to a post's frontmatter", async () => {
        let { server, root } = await devServer();

        await idsBecome(server, ["hello", "second"]);
        await writeFile(
            join(root, "app/content/blog/hello.md"),
            "---\ntitle: Renamed\npublishedOn: 2026-01-02\nauthor: ada\n---\n\n# Greeting\n",
        );

        let title = await until(
            async () => {
                let module = await server.ssrLoadModule("/app/content.ts");
                let entry = await module.content.blog.getEntry("hello");
                return entry.data.title as string;
            },
            value => value === "Renamed",
        );

        expect(title).toBe("Renamed");
    });
});

import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import satteri from "vite-plugin-satteri";
import { afterEach, describe, expect, it } from "vitest";

import { headings } from "../src/satteri.ts";
import { content } from "../src/vite.ts";

let fixture = fileURLToPath(new URL("./fixtures/prebuild-app", import.meta.url));
let outputs: string[] = [];

afterEach(async () => {
    await Promise.all(outputs.splice(0).map(dir => rm(dir, { force: true, recursive: true })));
});

/**
 * Builds the fixture for the server with no filesystem access at runtime, then
 * returns what querying the built bundle produces. This is the whole claim of
 * the plugin: the same collection declarations answer without `node:fs`.
 */
async function buildAndQuery(options?: Parameters<typeof content>[0]) {
    let outDir = await mkdtemp(fileURLToPath(new URL("./.tmp-out-", import.meta.url)));
    outputs.push(outDir);
    await build({
        root: fixture,
        logLevel: "silent",
        // The fixture imports the package by name; point that at this source
        // tree so a build under test never depends on a prior `vp pack`.
        resolve: {
            alias: {
                "@pitlane/content/loaders": fileURLToPath(
                    new URL("../src/loaders.ts", import.meta.url),
                ),
                "@pitlane/content": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
            },
        },
        ssr: { noExternal: ["@pitlane/content"] },
        plugins: [
            satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()] }),
            content(options),
        ],
        build: {
            outDir,
            emptyOutDir: true,
            ssr: "app/entry.server.ts",
            rollupOptions: { output: { entryFileNames: "entry.server.mjs" } },
        },
    });
    let entry = await import(pathToFileURL(join(outDir, "entry.server.mjs")).href);
    return { outDir, result: await entry.query() };
}

describe("content()", () => {
    it("answers from the bundle, with no filesystem read at runtime", async () => {
        let { result } = await buildAndQuery();

        expect(result.ids).toEqual(["hello", "second"]);
    });

    it("prebuilds a Date as a Date rather than the string it was written as", async () => {
        let { result } = await buildAndQuery();

        expect(result.publishedOnIsDate).toBe(true);
        expect(result.publishedOn).toEqual(new Date("2026-01-02"));
    });

    it("prebuilds a loaders.file collection, so a reference resolves", async () => {
        let { result } = await buildAndQuery();

        expect(result.authorName).toBe("Ada Lovelace");
    });

    it("leaves a live collection out of the manifest and keeps it running per read", async () => {
        let { result } = await buildAndQuery();

        expect(result.tickerIds).toEqual(["now"]);
    });

    it("compiles an .mdx body into the bundle, headings and all", async () => {
        let { result } = await buildAndQuery();

        expect(result.headings).toEqual([
            { depth: 1, slug: "second", text: "Second" },
            { depth: 2, slug: "details", text: "Details" },
        ]);
    });

    it("fails the build when a prebuilt entry violates its schema", async () => {
        await expect(buildAndQuery({ entry: "app/content-invalid.ts" })).rejects.toThrow(
            /Failed to parse entry "hello" in collection "blog"/,
        );
    });

    it("names the module and the underlying error when the entry cannot be imported", async () => {
        await expect(buildAndQuery({ entry: "app/missing.ts" })).rejects.toThrow(
            /app\/missing\.ts/,
        );
    });
});

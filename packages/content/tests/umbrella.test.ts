import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, resolveConfig } from "vite";
import satteri from "vite-plugin-satteri";
import { afterEach, expect, it } from "vite-plus/test";

import { headings } from "../src/satteri.ts";
import { contentLayer } from "../src/vite-plugin.ts";

let roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })));
});

/**
 * The prebuild fixture as an app that installed the `pitlane` umbrella rather
 * than `@pitlane/content`: its collections import `pitlane/content`, which an
 * installed `pitlane` package re-exports from its own `@pitlane/content`.
 * Node resolves that one to this package's build output, as in an install.
 */
async function umbrellaApp(): Promise<string> {
    let root = await mkdtemp(fileURLToPath(new URL("./.tmp-umbrella-", import.meta.url)));
    roots.push(root);
    await cp(fileURLToPath(new URL("./fixtures/prebuild-app", import.meta.url)), root, {
        recursive: true,
    });
    let declarations = await readFile(join(root, "app/content.ts"), "utf8");
    await writeFile(
        join(root, "app/content.ts"),
        declarations.replaceAll('from "@pitlane/content', 'from "pitlane/content'),
    );

    let umbrella = join(root, "node_modules/pitlane");
    await mkdir(umbrella, { recursive: true });
    await writeFile(
        join(umbrella, "package.json"),
        JSON.stringify({
            name: "pitlane",
            type: "module",
            exports: { "./content": "./content.js", "./content/loaders": "./loaders.js" },
        }),
    );
    await writeFile(join(umbrella, "content.js"), 'export * from "@pitlane/content";\n');
    await writeFile(join(umbrella, "loaders.js"), 'export * from "@pitlane/content/loaders";\n');
    await mkdir(join(umbrella, "node_modules/@pitlane"), { recursive: true });
    await symlink(
        fileURLToPath(new URL("..", import.meta.url)),
        join(umbrella, "node_modules/@pitlane/content"),
        "dir",
    );
    return root;
}

it("prebuilds collections an app declares through the pitlane umbrella", async () => {
    // A server build externalizes an installed dependency, and `pitlane` is
    // one. Left external, `pitlane/content` reaches `@pitlane/content` at run
    // time through Node, past the manifest this build emitted, and every
    // collection comes back empty on a host with no filesystem.
    let root = await umbrellaApp();
    let outDir = join(root, "dist");
    await build({
        root,
        logLevel: "silent",
        resolve: {
            alias: {
                "@pitlane/content/loaders": fileURLToPath(
                    new URL("../src/loaders.ts", import.meta.url),
                ),
                "@pitlane/content": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
            },
        },
        plugins: [
            satteri({ mdx: { jsxImportSource: "remix/component" }, mdastPlugins: [headings()] }),
            contentLayer(),
        ],
        build: {
            outDir,
            ssr: "app/entry.server.ts",
            rollupOptions: { output: { entryFileNames: "entry.server.mjs" } },
        },
    });
    let bundle = await readFile(join(outDir, "entry.server.mjs"), "utf8");

    expect(bundle).not.toMatch(/from\s*["']pitlane\//);
    expect(bundle).toContain("Ada Lovelace");
});

it("keeps the pitlane umbrella out of dev dependency optimization", async () => {
    // The optimizer would pre-bundle `pitlane/content` together with the
    // `@pitlane/content` it re-exports, inlining the shipped manifest where
    // this plugin can no longer replace it.
    let config = await resolveConfig(
        { root: await umbrellaApp(), logLevel: "silent", plugins: [contentLayer()] },
        "serve",
    );

    expect(config.optimizeDeps.exclude).toContain("pitlane");
    expect(config.environments.ssr.optimizeDeps.exclude).toContain("pitlane");
});

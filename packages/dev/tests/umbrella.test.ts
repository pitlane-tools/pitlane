import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterEach, expect, it } from "vite-plus/test";

import { runtimeInline } from "../src/build.ts";

let roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })));
});

it("inlines the runtime an app imports through the pitlane umbrella", async () => {
    // `pitlane/dev/runtime` is an installed dependency, so a server build
    // externalizes it unless the plugin claims it, and the built app would
    // import this package at run time through the umbrella.
    let root = await mkdtemp(fileURLToPath(new URL("./.tmp-umbrella-", import.meta.url)));
    roots.push(root);
    let umbrella = join(root, "node_modules/pitlane");
    await mkdir(join(root, "app"), { recursive: true });
    await mkdir(umbrella, { recursive: true });
    await writeFile(
        join(umbrella, "package.json"),
        JSON.stringify({
            name: "pitlane",
            type: "module",
            exports: { "./dev/runtime": "./runtime.js" },
        }),
    );
    await writeFile(join(umbrella, "runtime.js"), 'export * from "@pitlane/dev/runtime";\n');
    await writeFile(
        join(root, "app/entry.server.ts"),
        'export { mergeAssets } from "pitlane/dev/runtime";\n',
    );

    await build({
        root,
        logLevel: "silent",
        plugins: [runtimeInline()],
        build: {
            outDir: join(root, "dist"),
            ssr: "app/entry.server.ts",
            rollupOptions: { output: { entryFileNames: "entry.server.mjs" } },
        },
    });
    let bundle = await readFile(join(root, "dist/entry.server.mjs"), "utf8");

    expect(bundle).not.toMatch(/from\s*["'](@pitlane\/dev|pitlane)\//);
    expect(bundle).toMatch(/export\s*\{[^}]*mergeAssets/);
});

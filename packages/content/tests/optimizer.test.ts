import type { ViteDevServer } from "vite";

import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import satteri from "vite-plugin-satteri";
import { expect, it } from "vite-plus/test";

import { headings } from "../src/satteri.ts";
import { contentLayer } from "../src/vite.ts";

it("keeps optimized browser dependencies available after prebuilding content", async () => {
    let root = await mkdtemp(fileURLToPath(new URL("./.tmp-optimizer-", import.meta.url)));
    let server: ViteDevServer | undefined;

    try {
        await cp(fileURLToPath(new URL("./fixtures/prebuild-app", import.meta.url)), root, {
            recursive: true,
        });
        await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }));
        await writeFile(
            join(root, "app/browser.js"),
            'export { run } from "remix/component";\nexport { jsxDEV } from "remix/component/jsx-dev-runtime";\n',
        );
        server = await createServer({
            root,
            configFile: false,
            logLevel: "silent",
            // A later import must read its optimized file, not a speculative transform cache.
            server: { host: "127.0.0.1", port: 0, preTransformRequests: false },
            optimizeDeps: {
                include: ["remix/component", "remix/component/jsx-dev-runtime"],
                noDiscovery: true,
            },
            resolve: {
                alias: {
                    "@pitlane/content/loaders": fileURLToPath(
                        new URL("../src/loaders.ts", import.meta.url),
                    ),
                    "@pitlane/content": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
                },
            },
            plugins: [
                satteri({
                    mdx: { jsxImportSource: "remix/component" },
                    mdastPlugins: [headings()],
                }),
                contentLayer(),
            ],
        });
        await server.listen();
        let origin = server.resolvedUrls!.local[0]!;
        let browserModule = await (await fetch(new URL("app/browser.js", origin))).text();
        // `browser.js` re-exports from `remix/component`, then from its
        // dev JSX runtime; Vite rewrites both, in that order, to optimized files.
        let imported = [...browserModule.matchAll(/\bfrom\s*["']([^"'\n]+)["']/g)].map(
            match => match[1]!,
        );
        expect(imported).toHaveLength(2);
        for (let path of imported) expect(path).toContain("/.vite/deps/");
        let [dependencyPath, warmedPath] = imported as [string, string];
        let dependencyUrl = new URL(dependencyPath, origin);
        expect((await fetch(new URL(warmedPath, origin))).status).toBe(200);

        let module = await server.ssrLoadModule("/app/content.ts");
        expect(
            (await module.content.blog.getCollection()).map((entry: { id: string }) => entry.id),
        ).toEqual(["hello", "second"]);

        expect((await fetch(dependencyUrl)).status).toBe(200);
    } finally {
        await server?.close();
        await rm(root, { recursive: true, force: true });
    }
});

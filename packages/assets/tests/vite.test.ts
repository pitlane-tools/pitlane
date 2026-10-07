import type { InlineConfig, ViteDevServer } from "vite";

import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
    createBuilder,
    createServer,
    isRunnableDevEnvironment,
    version as viteVersion,
} from "vite";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { assets } from "../src/vite-plugin.ts";

let roots: string[] = [];
let servers: ViteDevServer[] = [];
let source = fileURLToPath(new URL("../src/index.ts", import.meta.url));

async function fixture(files: Record<string, string> = {}) {
    let root = await mkdtemp(fileURLToPath(new URL("./.vite-", import.meta.url)));
    roots.push(root);
    let sources = {
        "package.json": '{"type":"module"}',
        "app/entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
import "./server.css";
import { readFileSync } from "node:fs";
export const assets = createAssetResolver(manifest);
export const script = await assets.getScriptEntry("app/browser.ts");
export const css = await assets.getHref("app/page.css");
export const stylesheets = await assets.getStylesheets("app/entry.ts");
export const serverOnly = readFileSync;
export default { fetch() { return Response.json({script, css, stylesheets}); } };`,
        "app/browser.ts":
            'import { shared } from "./shared.ts"; export const start = () => shared;',
        "app/shared.ts": 'export const shared = "browser dependency";',
        "app/server.css": "body { color: rgb(12, 34, 56); }",
        "app/page.css": "h1 { font-weight: 700; }",
        ...files,
    };
    for (let [name, contents] of Object.entries(sources)) {
        let location = join(root, name);
        await mkdir(join(location, ".."), { recursive: true });
        await writeFile(location, contents);
    }
    return root;
}

function config(root: string, options: Parameters<typeof assets>[0] = {}): InlineConfig {
    return {
        root,
        configFile: false,
        logLevel: "silent",
        resolve: { alias: [{ find: /^@pitlane\/assets$/, replacement: source }] },
        plugins: [assets(options)],
        environments: {
            client: { build: { outDir: "dist/client" } },
            ssr: {
                build: {
                    outDir: "dist/server",
                    rolldownOptions: {
                        input: { index: "app/entry.ts" },
                        output: { entryFileNames: "index.mjs" },
                    },
                },
            },
        },
    };
}

async function build(
    root: string,
    options?: Parameters<typeof assets>[0],
    overrides: InlineConfig = {},
) {
    let builder = await createBuilder({ ...config(root, options), ...overrides });
    await builder.buildApp();
    return import(pathToFileURL(join(root, "dist/server/index.mjs")).href);
}

async function serve(root: string) {
    let server = await createServer(config(root));
    servers.push(server);
    await server.listen();
    return server;
}

async function query(server: ViteDevServer) {
    let environment = server.environments.ssr;
    if (!isRunnableDevEnvironment(environment))
        throw new Error("Expected runnable SSR environment");
    let module = await environment.runner.import("/app/entry.ts");
    return (await module.default.fetch(new Request("http://example.test/"))).json();
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => server.close()));
    await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("proposal 0005: Vite asset integration", () => {
    it.each([true, false])(
        "observes server CSS with cssCodeSplit=%s without emitting server JS",
        async cssCodeSplit => {
            let root = await fixture();
            let clientModules = new Set<string>();
            let configured = config(root);
            configured.environments!.ssr.build!.cssCodeSplit = cssCodeSplit;
            configured.plugins!.push({
                name: "observe-client-modules",
                generateBundle(_options, bundle) {
                    if (this.environment.name !== "client") return;
                    for (let output of Object.values(bundle)) {
                        if (output.type === "chunk") {
                            for (let id of output.moduleIds) clientModules.add(id);
                        }
                    }
                },
            });
            let module = await build(root, {}, configured);
            expect(module.script.href).toMatch(/^\/assets\/browser-[\w-]+\.js$/);
            expect(module.script.preloads[0]).toBe(module.script.href);
            expect(module.script.importMap).toEqual({ imports: {} });
            expect(module.css).toMatch(/^\/assets\/page-[\w-]+\.css$/);
            expect(module.stylesheets).toEqual([expect.stringMatching(/^\/assets\/.*\.css$/)]);
            expect(clientModules).toContain(join(root, "app/browser.ts"));
            expect(clientModules).not.toContain(join(root, "app/entry.ts"));
            expect(clientModules).not.toContain("node:fs");
            for (let href of [module.script.href, module.css, ...module.stylesheets]) {
                await expect(
                    readFile(join(root, "dist/client", href.slice(1)), "utf8"),
                ).resolves.toBeTypeOf("string");
            }
        },
    );

    it("does not treat a script's extracted stylesheet as that script's asset URL", async () => {
        let root = await fixture({
            "app/browser.ts": 'export const loadRoute = () => import("./route.ts");',
            "app/route.ts": 'import "./route.css"; export const route = "a lazy route";',
            "app/route.css": "h1 { color: rebeccapurple; }",
        });
        let module = await build(root);
        expect(await module.assets.getPreloads("app/route.ts")).toEqual([
            expect.stringMatching(/^\/assets\/route-[\w-]+\.js$/),
        ]);
        await expect(module.assets.getHref("app/route.ts")).rejects.toThrow();
    });

    it("makes the completed manifest available inside a custom orchestrator", async () => {
        let root = await fixture();
        let observed;
        await build(
            root,
            {},
            {
                builder: {
                    async buildApp(builder) {
                        await builder.build(builder.environments.ssr);
                        await builder.build(builder.environments.client);
                        let module = await import(
                            pathToFileURL(join(root, "dist/server/index.mjs")).href
                        );
                        observed = module.script.href;
                    },
                },
            },
        );
        expect(observed).toMatch(/^\/assets\/browser-[\w-]+\.js$/);
    });

    it.each(["dev", "build"])("resolves an asset named __proto__ in %s", async mode => {
        let root = await fixture({
            ["__proto__"]: "opaque asset",
            "app/entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
const assets = createAssetResolver(manifest);
export const href = await assets.getHref("__proto__");
export default { fetch: () => Response.json({ href }) };`,
        });
        let configured = config(root);
        configured.assetsInclude = [/__proto__$/];

        if (mode === "build") {
            let module = await build(root, {}, configured);
            expect(await readFile(join(root, "dist/client", module.href), "utf8")).toBe(
                "opaque asset",
            );
        } else {
            let server = await createServer(configured);
            servers.push(server);
            await server.listen();
            let { href } = await query(server);
            expect(href).toBe("/__proto__");
        }
    });

    it("returns development metadata on the first cyclic manifest import", async () => {
        let server = await serve(await fixture());
        expect(await query(server)).toEqual({
            script: { href: "/app/browser.ts", preloads: [], importMap: { imports: {} } },
            css: "/app/page.css",
            stylesheets: ["/app/server.css"],
        });
    });

    it("refreshes module-level stylesheet observations after invalidation", async () => {
        let root = await fixture({ "app/next.css": "body { color: red; }" });
        let server = await serve(root);
        expect((await query(server)).stylesheets).toEqual(["/app/server.css"]);
        let entry = join(root, "app/entry.ts");
        let code = await readFile(entry, "utf8");
        await writeFile(entry, code.replace('"./server.css"', '"./next.css"'));
        await expect.poll(async () => (await query(server)).stylesheets).toEqual(["/app/next.css"]);
    });

    it("supports a stylesheet-only application without an index.html or emitted JS entry", async () => {
        let root = await fixture({
            "app/entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
export const css = await createAssetResolver(manifest).getHref("app/page.css");`,
        });
        let module = await build(root);
        expect(module.css).toMatch(/^\/assets\/page-[\w-]+\.css$/);
        expect(
            (await readdir(join(root, "dist/client/assets"))).filter(name => name.endsWith(".js")),
        ).toEqual([]);
    });

    it("captures opted-in maps and lets explicit false override a native opt-in", async () => {
        let root = await fixture({
            "app/entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
export const script = await createAssetResolver(manifest).getScriptEntry("app/browser.ts");`,
        });
        let enabled = await build(root, { chunkImportMap: true });
        expect(Object.values(enabled.script.importMap.imports)).toContain(enabled.script.href);
        expect(await readdir(join(root, "dist/client"), { recursive: true })).toEqual(
            expect.arrayContaining(
                Object.values<string>(enabled.script.importMap.imports).map(href => href.slice(1)),
            ),
        );
        let disabledRoot = await fixture();
        let disabledConfig = config(disabledRoot, { chunkImportMap: false });
        disabledConfig.environments!.client.build!.chunkImportMap = true;
        let disabled = await build(disabledRoot, {}, disabledConfig);
        expect(disabled.script.importMap).toEqual({ imports: {} });
    });

    // Before vitejs/vite#23184 (8.2.1), `build.chunkImportMap: true` discarded the
    // configured `fileName`, and Vite's own import analysis then crashed looking
    // for the file it had not emitted.
    let customMapFileName = !/^8\.(1\.|2\.0$)/.test(viteVersion);
    it.skipIf(!customMapFileName)(
        "reads the configured native map artifact rather than unrelated JSON assets",
        async () => {
            let root = await fixture();
            let configured = config(root, { chunkImportMap: true });
            configured.environments!.client.build!.rolldownOptions = {
                experimental: { chunkImportMap: { fileName: "metadata/browser-imports.json" } },
            };
            configured.plugins!.push({
                name: "unrelated-imports-document",
                generateBundle() {
                    if (this.environment.name !== "client") return;
                    this.emitFile({
                        type: "asset",
                        fileName: "application-settings.json",
                        source: JSON.stringify({ imports: { applicationSetting: "not-a-chunk" } }),
                    });
                },
            });
            let module = await build(root, {}, configured);
            expect(Object.values(module.script.importMap.imports)).toContain(module.script.href);
            expect(module.script.importMap.imports).not.toHaveProperty("applicationSetting");
            let nativeMap = JSON.parse(
                await readFile(join(root, "dist/client/metadata/browser-imports.json"), "utf8"),
            );
            expect(module.script.importMap).toEqual(nativeMap);
        },
    );

    it("preserves a CDN public base in hrefs, stylesheets, and preload hints", async () => {
        let root = await fixture();
        let module = await build(root, {}, { base: "https://cdn.example.test/site/" });
        expect(module.script.href).toMatch(/^https:\/\/cdn\.example\.test\/site\/assets\/browser-/);
        expect(module.css).toMatch(/^https:\/\/cdn\.example\.test\/site\/assets\/page-/);
        expect(module.stylesheets[0]).toMatch(/^https:\/\/cdn\.example\.test\/site\/assets\//);
        expect(module.script.preloads[0]).toBe(module.script.href);
    });
});

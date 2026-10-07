import type { InlineConfig, ViteDevServer } from "vite";

import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
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
export const graphs = Object.keys(manifest.environments).sort();
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

/** The JSON the fixture's server entry answers, from a build or a dev server. */
async function respond(mode: string, root: string) {
    if (mode === "dev") return query(await serve(root));
    let module = await build(root);
    return (await module.default.fetch(new Request("http://example.test/"))).json();
}

let resolverModule = `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
export let assets = createAssetResolver(manifest);`;

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

    it.each(["dev", "build"])(
        "resolves a computed asset path registered through include in %s",
        async mode => {
            let root = await fixture({
                "app/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                "app/entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
const assets = createAssetResolver(manifest);
const logo = ["app", "logo.svg"].join("/");
export const href = await assets.getHref(logo);
export default { fetch: () => Response.json({ href }) };`,
            });
            let configured = config(root, { include: ["app/logo.svg"] });

            if (mode === "build") {
                let module = await build(root, {}, configured);
                expect(module.href).toMatch(/^\/assets\/logo-[\w-]+\.svg$/);
                expect(await readFile(join(root, "dist/client", module.href), "utf8")).toBe(
                    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
                );
            } else {
                let server = await createServer(configured);
                servers.push(server);
                await server.listen();
                expect((await query(server)).href).toBe("/app/logo.svg");
            }
        },
    );

    it("keeps a registered script entry when a later plugin clears its chunk's isEntry", async () => {
        let root = await fixture({
            "app/widget.ts": 'export const widget = "registered script";',
            "app/entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
const assets = createAssetResolver(manifest);
const widget = ["app", "widget.ts"].join("/");
export const script = await assets.getScriptEntry(widget);
export const literal = await assets.getScriptEntry("app/browser.ts");
export default { fetch: () => Response.json({}) };`,
        });
        let configured = config(root, { include: ["app/widget.ts"] });
        configured.plugins!.push({
            name: "clear-is-entry",
            generateBundle(_options, bundle) {
                if (this.environment.name !== "client") return;
                for (let output of Object.values(bundle)) {
                    if (output.type === "chunk") output.isEntry = false;
                }
            },
        });
        let module = await build(root, {}, configured);
        expect(module.script.href).toMatch(/^\/assets\/widget-[\w-]+\.js$/);
        expect(module.literal.href).toMatch(/^\/assets\/browser-[\w-]+\.js$/);
        await expect(
            readFile(join(root, "dist/client", module.script.href.slice(1)), "utf8"),
        ).resolves.toContain("registered script");
    });

    it.each(["dev", "build"])(
        "registers no input for a same-named method on a receiver that is not a resolver in %s",
        async mode => {
            let root = await fixture({
                "app/assets.ts": resolverModule,
                "app/router.ts": "export let router = { getHref: (path: string) => path };",
                "app/private.ts": 'export const secret = "server-only secret";',
                "app/factory.ts":
                    "export let createAssetResolver = () => ({ getHref: (key: string) => key });",
                "app/hoisted.ts": `import { assets } from "./assets.ts";
export function hoisted() {
    if (Math.random() > 2) { var assets = { getHref: (key: string) => key }; }
    return assets.getHref("app/private.ts");
}`,
                "app/named.ts": `import { assets } from "./assets.ts";
export let named = function assets() { return assets.getHref("app/private.ts"); };`,
                "app/parameter.ts": `import { createAssetResolver } from "@pitlane/assets";
export let parameter = createAssetResolver => createAssetResolver().getHref("app/private.ts");`,
                "app/impostor.ts": `import { createAssetResolver } from "./factory.ts";
export let impostor = () => createAssetResolver().getHref("app/private.ts");`,
                "app/twice.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
let resolver = createAssetResolver(manifest);
export let twice = () => resolver.getHref("app/private.ts");
export function rebind() { let resolver = 1; return resolver; }`,
                "app/entry.ts": `import * as resolvers from "./assets.ts";
import "./hoisted.ts";
import "./named.ts";
import "./parameter.ts";
import "./impostor.ts";
import "./twice.ts";
import { assets } from "./assets.ts";
import { router } from "./router.ts";
export let lookup = api => [api.getHref("app/private.ts"), api.getScriptEntry("app/private.ts")];
export let shadowed = assets => assets.getHref("app/private.ts");
export let namespaced = () => resolvers.assets.getScriptEntry("app/private.ts");
export let bound = { assets, lookup() { return this.assets.getHref("app/private.ts"); } };
let about = router.getHref("/about");
let href = await assets.getHref(["app", "private.ts"].join("/")).catch(() => null);
export default { fetch: () => Response.json({ about, href }) };`,
            });

            expect(await respond(mode, root)).toEqual({ about: "/about", href: null });
            if (mode === "build") {
                let files = await readdir(join(root, "dist/client"), { recursive: true }).catch(
                    () => [],
                );
                for (let file of files.filter(name => name.endsWith(".js"))) {
                    expect(await readFile(join(root, "dist/client", file), "utf8")).not.toContain(
                        "server-only secret",
                    );
                }
            }
        },
    );

    it.each(["dev", "build"])(
        "registers literal calls on a resolver constructed inline, bound, aliased, imported, re-exported, star-exported, or default-exported in %s",
        async mode => {
            let root = await fixture({
                "app/assets.ts": resolverModule,
                "app/resolvers.ts": 'export { assets } from "./assets.ts";',
                "app/star.ts": 'export * from "./assets.ts";',
                "app/barrel.js": 'export /* every resolver */ * from "./assets.ts";',
                "app/default-assets.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
export default createAssetResolver(manifest);`,
                "app/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg" id="logo"></svg>',
                "app/badge.svg": '<svg xmlns="http://www.w3.org/2000/svg" id="badge"></svg>',
                "app/icon.svg": '<svg xmlns="http://www.w3.org/2000/svg" id="icon"></svg>',
                "app/star.svg": '<svg xmlns="http://www.w3.org/2000/svg" id="star"></svg>',
                "app/made.svg": '<svg xmlns="http://www.w3.org/2000/svg" id="made"></svg>',
                "app/alias.svg": '<svg xmlns="http://www.w3.org/2000/svg" id="alias"></svg>',
                "app/computed.svg": '<svg xmlns="http://www.w3.org/2000/svg" id="computed"></svg>',
                "app/barrel.svg": '<svg xmlns="http://www.w3.org/2000/svg" id="barrel"></svg>',
                "app/widget.ts": 'document.title = "widget";',
                "app/entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
import { assets } from "./assets.ts";
import { assets as resolver } from "./assets.ts";
import { assets as reexported } from "./resolvers.ts";
import { assets as starred } from "./star.ts";
import { assets as barrelled } from "./barrel.js";
import defaultResolver from "./default-assets.ts";
const local = createAssetResolver(manifest);
const make = createAssetResolver;
const made = make(manifest);
const alias = assets;
let hrefs = {
    logo: await assets.getHref("app/logo.svg"),
    widget: (await resolver.getScriptEntry("app/widget.ts")).href,
    badge: await reexported.getHref("app/badge.svg"),
    icon: await defaultResolver.getHref("app/icon.svg"),
    page: await createAssetResolver(manifest).getHref("app/page.css"),
    shared: (await local.getScriptEntry("app/shared.ts")).href,
    star: await starred.getHref("app/star.svg"),
    made: await made.getHref("app/made.svg"),
    alias: await alias.getHref("app/alias.svg"),
    computed: await assets["getHref"]("app/computed.svg"),
    barrel: await barrelled.getHref("app/barrel.svg"),
};
export default { fetch: () => Response.json(hrefs) };`,
            });

            let hrefs = await respond(mode, root);
            if (mode === "dev") {
                expect(hrefs).toEqual({
                    logo: "/app/logo.svg",
                    widget: "/app/widget.ts",
                    badge: "/app/badge.svg",
                    icon: "/app/icon.svg",
                    page: "/app/page.css",
                    shared: "/app/shared.ts",
                    star: "/app/star.svg",
                    made: "/app/made.svg",
                    alias: "/app/alias.svg",
                    computed: "/app/computed.svg",
                    barrel: "/app/barrel.svg",
                });
            } else {
                expect(hrefs).toEqual({
                    logo: expect.stringMatching(/^\/assets\/logo-[\w-]+\.svg$/),
                    widget: expect.stringMatching(/^\/assets\/widget-[\w-]+\.js$/),
                    badge: expect.stringMatching(/^\/assets\/badge-[\w-]+\.svg$/),
                    icon: expect.stringMatching(/^\/assets\/icon-[\w-]+\.svg$/),
                    page: expect.stringMatching(/^\/assets\/page-[\w-]+\.css$/),
                    shared: expect.stringMatching(/^\/assets\/shared-[\w-]+\.js$/),
                    star: expect.stringMatching(/^\/assets\/star-[\w-]+\.svg$/),
                    made: expect.stringMatching(/^\/assets\/made-[\w-]+\.svg$/),
                    alias: expect.stringMatching(/^\/assets\/alias-[\w-]+\.svg$/),
                    computed: expect.stringMatching(/^\/assets\/computed-[\w-]+\.svg$/),
                    barrel: expect.stringMatching(/^\/assets\/barrel-[\w-]+\.svg$/),
                });
            }
        },
    );

    it("treats a configured client input as a script entry without a literal reference", async () => {
        let root = await fixture({
            "app/widget.ts": 'document.title = "configured input";',
            "app/entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
const widget = ["app", "widget.ts"].join("/");
export const script = await createAssetResolver(manifest).getScriptEntry(widget);`,
        });
        let configured = config(root);
        configured.environments!.client.build!.rolldownOptions = {
            input: { widget: "app/widget.ts" },
        };
        let module = await build(root, {}, configured);
        expect(module.script.href).toMatch(/^\/assets\/widget-[\w-]+\.js$/);
        expect(await readFile(join(root, "dist/client", module.script.href), "utf8")).toContain(
            "configured input",
        );
    });

    it("writes each server environment a manifest for its own graph", async () => {
        let root = await fixture({
            "app/edge.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
import "./edge.css";
export const assets = createAssetResolver(manifest);
export const serverEnvironment = manifest.serverEnvironment;
export const graphs = Object.keys(manifest.environments).sort();`,
            "app/edge.css": "main { display: grid; }",
        });
        let configured = config(root, { serverEnvironments: ["ssr", "edge"] });
        configured.environments!.edge = {
            build: {
                outDir: "dist/edge",
                rolldownOptions: {
                    input: { index: "app/edge.ts" },
                    output: { entryFileNames: "index.mjs" },
                },
            },
        };
        let ssr = await build(root, {}, configured);
        let edge = await import(pathToFileURL(join(root, "dist/edge/index.mjs")).href);

        expect(edge.serverEnvironment).toBe("edge");
        expect(edge.graphs).toEqual(["client", "edge"]);
        expect(ssr.graphs).toEqual(["client", "ssr"]);
        let [edgeStylesheet] = await edge.assets.getStylesheets("app/edge.ts");
        expect(edgeStylesheet).toMatch(/^\/assets\/[\w-]+\.css$/);
        expect(edgeStylesheet).not.toBe(ssr.stylesheets[0]);
        await expect(
            readFile(join(root, "dist/client", edgeStylesheet), "utf8"),
        ).resolves.toContain("display");
        await expect(edge.assets.getStylesheets("app/entry.ts")).rejects.toThrow(
            '"client" or "edge"',
        );
        expect(await ssr.assets.getStylesheets("app/entry.ts")).toEqual(ssr.stylesheets);
        await expect(ssr.assets.getStylesheets("app/edge.ts")).rejects.toThrow('"client" or "ssr"');
    });

    it("links a stylesheet both sides import once, as the client's file", async () => {
        let root = await fixture({
            "app/entry.ts": `${resolverModule}
import "./shared.css";
import "./server-only.css";
export const script = await assets.getScriptEntry("app/browser.ts");`,
            "app/browser.ts": 'import "./shared.css"; export const start = () => "browser";',
            "app/shared.css": "main { display: grid; }",
            "app/server-only.css": "aside { color: teal; }",
        });
        let module = await build(root);
        let stylesheets: string[] = await module.assets.getStylesheets([
            "app/entry.ts",
            "app/browser.ts",
        ]);
        // The server graph contributes its own stylesheet; the shared one links
        // once, as the file the client build emitted.
        expect(stylesheets).toHaveLength(2);
        let contents = await Promise.all(
            stylesheets.map(href => readFile(join(root, "dist/client", href.slice(1)), "utf8")),
        );
        expect(contents.join("\n")).toContain("teal");
        expect(contents.filter(css => css.includes("grid"))).toHaveLength(1);
        let files = await readdir(join(root, "dist/client/assets"));
        expect(files.filter(file => file.endsWith(".css")).sort()).toEqual(
            stylesheets.map(href => href.slice(8)).sort(),
        );
    });

    it("fails a build whose unlisted server environment imports the manifest", async () => {
        let root = await fixture();
        let configured = config(root);
        configured.environments!.worker = {
            build: { outDir: "dist/worker", rolldownOptions: { input: "app/entry.ts" } },
        };
        configured.builder = {
            async buildApp(builder) {
                await builder.build(builder.environments.worker);
            },
        };
        await expect(build(root, {}, configured)).rejects.toThrow(
            '[assets] The "worker" environment imported @pitlane/assets/manifest, but assets() serves only "ssr". Add "worker" to assets({ serverEnvironments }) from @pitlane/assets/vite-plugin.',
        );
    });

    it("refuses a client build that runs before the server environments", async () => {
        let root = await fixture();
        let builder = await createBuilder(config(root));
        await expect(builder.build(builder.environments.client)).rejects.toThrow(
            "[assets] Client built before server environments: ssr. Build servers before client.",
        );
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

    it("captures a map when only the native client setting opts in", async () => {
        let root = await fixture();
        let configured = config(root);
        configured.environments!.client.build!.chunkImportMap = true;
        let module = await build(root, {}, configured);
        expect(Object.values(module.script.importMap.imports)).toContain(module.script.href);
    });

    it("refuses chunk import maps combined with renderBuiltUrl", async () => {
        let root = await fixture();
        await expect(
            createBuilder({
                ...config(root, { chunkImportMap: true }),
                experimental: { renderBuiltUrl: file => `https://cdn.example.test/${file}` },
            }),
        ).rejects.toThrow(
            "[assets] chunkImportMap: true cannot be combined with experimental.renderBuiltUrl.",
        );
    });

    it("writes renderBuiltUrl's CDN URLs into server hrefs when maps are off", async () => {
        let root = await fixture();
        let module = await build(
            root,
            {},
            { experimental: { renderBuiltUrl: file => `https://cdn.example.test/${file}` } },
        );
        expect(module.script.href).toMatch(/^https:\/\/cdn\.example\.test\/assets\/browser-/);
        expect(module.script.preloads[0]).toBe(module.script.href);
        expect(module.css).toMatch(/^https:\/\/cdn\.example\.test\/assets\/page-/);
        expect(module.stylesheets).toEqual([
            expect.stringMatching(/^https:\/\/cdn\.example\.test\/assets\/.*\.css$/),
        ]);
    });

    it("keeps base-joined hrefs when renderBuiltUrl asks for relative URLs", async () => {
        let root = await fixture();
        let module = await build(
            root,
            {},
            { experimental: { renderBuiltUrl: () => ({ relative: true }) } },
        );
        expect(module.script.preloads).toEqual([module.script.href]);
        for (let href of [module.script.href, module.css, ...module.stylesheets]) {
            expect(href).toMatch(/^\/assets\/[^/]+$/);
            await expect(readFile(join(root, "dist/client", href), "utf8")).resolves.toBeTypeOf(
                "string",
            );
        }
    });

    it("refuses a renderBuiltUrl that answers server HTML with runtime JavaScript", async () => {
        let root = await fixture();
        await expect(
            build(
                root,
                {},
                {
                    experimental: {
                        renderBuiltUrl: file => ({
                            runtime: `globalThis.cdn + ${JSON.stringify(file)}`,
                        }),
                    },
                },
            ),
        ).rejects.toThrow(
            "[assets] renderBuiltUrl must return a URL for server HTML; runtime JavaScript cannot be serialized in an asset manifest.",
        );
    });

    it.each([true, false])(
        "rebuilds after a dependency-only change with chunkImportMap=%s",
        async chunkImportMap => {
            let root = await fixture({
                "app/entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
export const assets = createAssetResolver(manifest);
export const script = await assets.getScriptEntry("app/browser.ts");`,
                "app/browser.ts":
                    'export const load = () => Promise.all([import("./first.ts"), import("./second.ts")]);',
                "app/first.ts":
                    'import { greet } from "./greeting.ts"; export const first = () => greet("first");',
                "app/second.ts":
                    'import { greet } from "./greeting.ts"; export const second = () => greet("second");',
                "app/greeting.ts":
                    "export function greet(name: string) { return `hello ${name}`; }",
            });
            let output = async (directory: string) => {
                let module = await import(
                    pathToFileURL(join(root, directory, "server/index.mjs")).href
                );
                let read = (href: string) =>
                    readFile(join(root, directory, "client", href), "utf8");
                let [importer] = await module.assets.getPreloads("app/first.ts");
                let [dependency] = await module.assets.getPreloads("app/greeting.ts");
                return {
                    entry: { href: module.script.href, code: await read(module.script.href) },
                    importer: { href: importer, code: await read(importer) },
                    dependency,
                    importMap: module.script.importMap.imports,
                };
            };
            let builder = await createBuilder(config(root, { chunkImportMap }));
            await builder.buildApp();
            await rename(join(root, "dist"), join(root, "before"));
            let before = await output("before");

            let greeting = join(root, "app/greeting.ts");
            await writeFile(
                greeting,
                (await readFile(greeting, "utf8")).replace("hello", "welcome"),
            );
            await build(root, { chunkImportMap });
            let after = await output("dist");

            expect(after.dependency).not.toBe(before.dependency);
            if (chunkImportMap) {
                expect(after.entry).toEqual(before.entry);
                expect(after.importer).toEqual(before.importer);
                let [identity] = Object.entries(before.importMap).find(
                    ([, href]) => href === before.dependency,
                )!;
                expect(after.importMap[identity]).toBe(after.dependency);
            } else {
                expect(after.importer.href).not.toBe(before.importer.href);
                expect(after.importer.code).not.toBe(before.importer.code);
            }
        },
    );

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

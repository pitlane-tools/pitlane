import type { InlineConfig, ViteDevServer } from "vite";

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBuilder, createServer } from "vite";
import { afterEach, describe, expect, it } from "vite-plus/test";

import type { AssetsPluginOptions } from "../src/vite-plugin.ts";

import { assets } from "../src/vite-plugin.ts";

let roots: string[] = [];
let servers: ViteDevServer[] = [];
let source = fileURLToPath(new URL("../src/index.ts", import.meta.url));

/** The remix-store boundary #75 describes, which the fixture's browser files satisfy. */
let boundary: AssetsPluginOptions = {
    allowFiles: ["app/**/public/**"],
    allowPackages: ["fixture-widget"],
    denyFiles: ["app/**/*.test.*"],
};

function packageFiles(name: string, manifest: object, code: string): Record<string, string> {
    return {
        [`node_modules/${name}/package.json`]: JSON.stringify({
            name,
            version: "1.0.0",
            type: "module",
            main: "./index.js",
            ...manifest,
        }),
        [`node_modules/${name}/index.js`]: code,
    };
}

async function fixture(files: Record<string, string> = {}) {
    let root = await mkdtemp(fileURLToPath(new URL("./.vite-", import.meta.url)));
    roots.push(root);
    let sources = {
        "package.json": '{"type":"module"}',
        "app/entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
export const assets = createAssetResolver(manifest);
export const island = await assets.getScriptEntry("app/public/island.ts");
export default { fetch() { return new Response("ok"); } };`,
        "app/public/island.ts": `import { label } from "./label.ts";
import { widget } from "fixture-widget";
import "./island.css";
export const render = () => [label, widget];`,
        "app/public/label.ts": 'export const label = "island";',
        "app/public/island.css": '.island { background: url("./logo.svg"); }',
        "app/public/logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        "app/data/storefront.ts": 'export const token = "server secret";',
        "app/data/secret.svg":
            '<svg xmlns="http://www.w3.org/2000/svg"><title>secret</title></svg>',
        ...packageFiles(
            "fixture-widget",
            { dependencies: { "fixture-dep": "1.0.0" } },
            'import { dep } from "fixture-dep";\nexport const widget = `widget ${dep}`;\n',
        ),
        ...packageFiles("fixture-dep", {}, 'export const dep = "dependency";\n'),
        ...packageFiles("fixture-secret", {}, 'export const secret = "private package";\n'),
        ...files,
    };
    for (let [name, contents] of Object.entries(sources)) {
        let location = join(root, name);
        await mkdir(join(location, ".."), { recursive: true });
        await writeFile(location, contents);
    }
    return root;
}

function config(root: string, options: AssetsPluginOptions): InlineConfig {
    return {
        root,
        configFile: false,
        logLevel: "silent",
        appType: "custom",
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

async function build(root: string, options: AssetsPluginOptions = boundary) {
    let builder = await createBuilder(config(root, options));
    await builder.buildApp();
    return import(pathToFileURL(join(root, "dist/server/index.mjs")).href);
}

async function serve(
    root: string,
    options: AssetsPluginOptions = boundary,
    extra: InlineConfig = {},
) {
    let server = await createServer({ ...config(root, options), ...extra });
    servers.push(server);
    await server.listen();
    return server;
}

async function failure(promise: Promise<unknown>): Promise<string> {
    return promise.then(
        () => "no error",
        (error: Error) => error.message,
    );
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => server.close()));
    await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("#75: browser boundary in builds", () => {
    it("builds a client graph of allowed files, allowed packages, and their dependencies", async () => {
        let root = await fixture();
        let module = await build(root);

        let code = await readFile(join(root, "dist/client", module.island.href), "utf8");
        expect(code).toContain("widget");
        expect(code).toContain("dependency");
    });

    it("fails when an allowed browser module imports a file outside allowFiles", async () => {
        let root = await fixture({
            "app/public/island.ts": `import { token } from "../data/storefront.ts";
export const render = () => token;`,
        });

        expect(await failure(build(root))).toContain(
            "[assets] Outside the browser boundary:\n  app/data/storefront.ts (imported by app/public/island.ts): not in allowFiles or allowPackages",
        );
    });

    it("fails for a module outside allowFiles even when tree-shaking drops its code", async () => {
        let root = await fixture({
            "app/public/island.ts": `import "../data/storefront.ts";
export const render = () => "island";`,
        });

        expect(await failure(build(root))).toContain(
            "app/data/storefront.ts (imported by app/public/island.ts): not in allowFiles or allowPackages",
        );
    });

    it("lets denyFiles override allowFiles", async () => {
        let root = await fixture({
            "app/public/island.ts": `import { fixture } from "./island.test.ts";
export const render = () => fixture;`,
            "app/public/island.test.ts": 'export const fixture = "test data";',
        });

        expect(await failure(build(root))).toContain(
            'app/public/island.test.ts (imported by app/public/island.ts): matches denyFiles "app/**/*.test.*"',
        );
    });

    it("fails when a browser module imports a package allowPackages does not name", async () => {
        let root = await fixture({
            "app/public/island.ts": `import { secret } from "fixture-secret";
export const render = () => secret;`,
        });

        expect(await failure(build(root))).toContain(
            "node_modules/fixture-secret/index.js (imported by app/public/island.ts): not in allowFiles or allowPackages",
        );
    });

    it("does not extend an allowed package to its peer dependencies", async () => {
        let root = await fixture({
            ...packageFiles(
                "fixture-widget",
                { peerDependencies: { "fixture-secret": "1.0.0" } },
                'import { secret } from "fixture-secret";\nexport const widget = secret;\n',
            ),
        });

        expect(await failure(build(root))).toContain(
            "node_modules/fixture-secret/index.js (imported by node_modules/fixture-widget/index.js): not in allowFiles or allowPackages",
        );
    });

    it("fails when a browser stylesheet references a file outside allowFiles", async () => {
        let root = await fixture({
            "app/public/island.css": '.island { background: url("../data/secret.svg"); }',
        });

        expect(await failure(build(root))).toContain(
            "app/data/secret.svg: not in allowFiles or allowPackages",
        );
    });

    it("fails when the server links a stylesheet outside allowFiles into the client output", async () => {
        let root = await fixture({
            "app/entry.ts": `import "./server.css";
export default { fetch() { return new Response("ok"); } };`,
            "app/server.css": "body { color: rgb(12, 34, 56); }",
        });

        expect(await failure(build(root))).toContain(
            "app/server.css (imported by app/entry.ts): not in allowFiles or allowPackages",
        );
    });

    it("fails when the server names a browser entry outside allowFiles", async () => {
        let root = await fixture({
            "app/entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
export const assets = createAssetResolver(manifest);
export const entry = await assets.getScriptEntry("app/data/storefront.ts");
export default { fetch() { return new Response("ok"); } };`,
        });

        expect(await failure(build(root))).toContain(
            "app/data/storefront.ts: not in allowFiles or allowPackages",
        );
    });

    it("lists every file outside the boundary in one error", async () => {
        let root = await fixture({
            "app/public/island.ts": `import { token } from "../data/storefront.ts";
import { secret } from "fixture-secret";
export const render = () => [token, secret];`,
        });

        let message = await failure(build(root));
        expect(message).toContain("app/data/storefront.ts (imported by app/public/island.ts)");
        expect(message).toContain(
            "node_modules/fixture-secret/index.js (imported by app/public/island.ts)",
        );
    });

    it("builds without a boundary when allowFiles is unset", async () => {
        let root = await fixture({
            "app/public/island.ts": `import { token } from "../data/storefront.ts";
export const render = () => token;`,
        });

        let module = await build(root, {});
        let code = await readFile(join(root, "dist/client", module.island.href), "utf8");
        expect(code).toContain("server secret");
    });
});

describe("#75: browser boundary configuration", () => {
    it.each([{ allowPackages: ["fixture-widget"] }, { denyFiles: ["app/**/*.test.*"] }])(
        "refuses %o without allowFiles",
        options => {
            expect(() => assets(options)).toThrow(
                "[assets] allowPackages and denyFiles refine allowFiles. Set allowFiles to turn on the browser boundary.",
            );
        },
    );

    it("refuses an allowed package that is not installed", async () => {
        let root = await fixture();

        expect(
            await failure(
                build(root, { allowFiles: ["app/**"], allowPackages: ["fixture-missing"] }),
            ),
        ).toContain('[assets] Could not resolve allowed package "fixture-missing".');
    });
});

describe("#75: browser boundary in development", () => {
    it("fails the client transform of a file outside allowFiles and names its importer", async () => {
        let root = await fixture({
            "app/public/island.ts": `import { token } from "../data/storefront.ts";
export const render = () => token;`,
        });
        let client = (await serve(root)).environments.client!;

        await client.transformRequest("/app/public/island.ts");
        expect(await failure(client.transformRequest("/app/data/storefront.ts"))).toContain(
            "[assets] Outside the browser boundary: app/data/storefront.ts (imported by app/public/island.ts): not in allowFiles or allowPackages",
        );
    });

    it("transforms Vite's client runtime and allowed files", async () => {
        let client = (await serve(await fixture())).environments.client!;

        for (let url of ["/@vite/client", "/@vite/env", "/app/public/label.ts"]) {
            expect(await client.transformRequest(url)).toBeTruthy();
        }
    });

    it("checks a prebundled dependency by the package it came from", async () => {
        let root = await fixture({
            "app/public/island.ts": `import { widget } from "fixture-widget";
import { secret } from "fixture-secret";
export const render = () => [widget, secret];`,
        });
        let server = await serve(root, boundary, {
            optimizeDeps: { include: ["fixture-widget", "fixture-secret"] },
        });
        let client = server.environments.client!;
        await client.transformRequest("/app/public/island.ts");
        let island = await client.moduleGraph.getModuleByUrl("/app/public/island.ts");
        let urls = [...island!.importedModules].map(module => module.url);
        let widget = urls.find(url => url.includes("fixture-widget"));
        let secret = urls.find(url => url.includes("fixture-secret"));

        expect(await client.transformRequest(widget!)).toBeTruthy();
        expect(await failure(client.transformRequest(secret!))).toContain(
            "node_modules/fixture-secret/index.js (imported by app/public/island.ts): not in allowFiles or allowPackages",
        );
        await client.waitForRequestsIdle();
    });

    it("refuses to serve a file outside the boundary that Vite serves without a transform", async () => {
        let server = await serve(await fixture());
        let origin = new URL(server.resolvedUrls!.local[0]!).origin;

        let allowed = await fetch(`${origin}/app/public/logo.svg`);
        let denied = await fetch(`${origin}/app/data/secret.svg`);

        expect(allowed.status).toBe(200);
        expect(denied.status).toBe(500);
        expect(await denied.text()).toContain(
            "Outside the browser boundary: app/data/secret.svg: not in allowFiles or allowPackages",
        );
    });
});

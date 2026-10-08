import type { InlineConfig, Plugin, ResolvedConfig, ViteDevServer } from "vite";

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createRunnableDevEnvironment,
    createServer,
    isRunnableDevEnvironment,
    parseSync,
} from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import type { AssetsPluginApi } from "../src/vite-plugin.ts";

import { assets } from "../src/vite-plugin.ts";

// Each fixture is a project root plus a sibling `shared/` directory, so a
// linked module outside the root is keyed with a leading `../`.
let directories: string[] = [];
let servers: ViteDevServer[] = [];
let source = fileURLToPath(new URL("../src/index.ts", import.meta.url));

declare global {
    var __devSnapshotExecuted: string[] | undefined;
    var __devSnapshotEvaluations: Record<string, number> | undefined;
}

let record = (key: string) =>
    `(globalThis.__devSnapshotExecuted ??= []).push(${JSON.stringify(key)});\n` +
    `{ const counts = (globalThis.__devSnapshotEvaluations ??= {}); counts[${JSON.stringify(key)}] = (counts[${JSON.stringify(key)}] ?? 0) + 1; }\n`;

let baseFiles: Record<string, string> = {
    "project/package.json": '{"type":"module"}',
    "project/app/assets.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
export const assets = createAssetResolver(manifest);
`,
    "project/app/entry.server.ts": `import { assets } from "./assets.ts";
import { renderPage } from "./page.ts";
import { routes, routeAssets } from "./routes.ts";
${record("app/entry.server.ts")}
export { assets };
export const moduleLevel = await assets.getStylesheets("app/page.ts");
export const routeFiles = Object.keys(routes).sort();
export const sameResolver = () => routeAssets === assets;
export function appName() {
    return "app";
}
export default { fetch: () => new Response(renderPage()) };
`,
    "project/app/page.ts": `import { button } from "./button.ts";
import { layout } from "./layout.ts";
import { widget } from "../../shared/widget.ts";
import { appName } from "./entry.server.ts";
${record("app/page.ts")}
export function renderPage() {
    return [appName(), button(), layout(), widget()].join("|");
}
`,
    "project/app/layout.ts": `import "./layout.css";
import { renderPage } from "./page.ts";
${record("app/layout.ts")}
export const layout = () => (typeof renderPage === "function" ? "layout" : "");
`,
    "project/app/button.ts": `import "./button.css";
${record("app/button.ts")}
export const button = () => "button";
`,
    "project/app/routes.ts": `import { assets } from "./assets.ts";
${record("app/routes.ts")}
export const routes = import.meta.glob("./routes/*.ts");
export const routeAssets = assets;
`,
    "project/app/routes/home.ts": `import "./home.css";
${record("app/routes/home.ts")}
export default "home";
`,
    "project/app/entry.edge.ts": `import { assets } from "./assets.ts";
import { edgeOnly } from "./edge-only.ts";
${record("app/entry.edge.ts")}
export { assets };
export const moduleLevel = await assets.getStylesheets("app/edge-only.ts");
export default { fetch: () => new Response(edgeOnly()) };
`,
    "project/app/edge-only.ts": `import "./edge.css";
import { widget } from "../../shared/widget.ts";
export const edgeOnly = () => "edge|" + widget();
`,
    "project/app/client-input.ts": `import { dependency } from "./client-dependency.ts";
export const start = () => dependency;
`,
    "project/app/client-dependency.ts": `export const dependency = "client";\n`,
    "project/app/universal.ts": `import manifest from "@pitlane/assets/manifest";
export default manifest;
`,
    "project/app/button.css": ".button { color: purple; }\n",
    "project/app/layout.css": ".layout { display: grid; }\n",
    "project/app/edge.css": ".edge { color: teal; }\n",
    "project/app/routes/home.css": ".home { color: green; }\n",
    "shared/widget.ts": `import "./widget.css";
export const widget = () => "widget";
`,
    "shared/widget.css": ".widget { color: orange; }\n",
};

interface Fixture {
    directory: string;
    root: string;
    write(name: string, contents: string): Promise<void>;
    edit(name: string, change: (contents: string) => string): Promise<void>;
    remove(name: string): Promise<void>;
}

async function fixture(): Promise<Fixture> {
    let directory = await mkdtemp(fileURLToPath(new URL("./.tmp-dev-", import.meta.url)));
    directories.push(directory);
    let write = async (name: string, contents: string) => {
        let location = join(directory, name);
        await mkdir(join(location, ".."), { recursive: true });
        await writeFile(location, contents);
    };
    for (let [name, contents] of Object.entries(baseFiles)) await write(name, contents);
    return {
        directory,
        root: join(directory, "project"),
        write,
        async edit(name, change) {
            let location = join(directory, name);
            await writeFile(location, change(await readFile(location, "utf8")));
        },
        remove: name => rm(join(directory, name), { force: true }),
    };
}

/**
 * A minimal island integration. A `// island: <specifier>` comment in a server
 * module declares a browser entry, and `// island@<environment>: <specifier>`
 * declares one in that environment only. Like a real framework plugin, it
 * replaces the module's complete declaration on every transform, including
 * with `[]` once the module declares nothing.
 */
function islands(): Plugin {
    let api: AssetsPluginApi;
    return {
        name: "test-islands",
        configResolved(config) {
            let assetsPlugin = config.plugins.find(plugin => plugin.name === "pitlane-assets");
            if (!assetsPlugin?.api) throw new Error("The pitlane-assets plugin exposes no api.");
            api = assetsPlugin.api as AssetsPluginApi;
        },
        async transform(code, id) {
            let { config, mode } = this.environment;
            if (
                mode !== "dev" ||
                config.consumer !== "server" ||
                id.startsWith("\0") ||
                id.includes(".css")
            )
                return;
            let entries: string[] = [];
            for (let [, environment, specifier] of code.matchAll(
                /\/\/ island(?:@(\w+))?: (\S+)/g,
            )) {
                if (environment && environment !== this.environment.name) continue;
                let resolved = await this.resolve(specifier!, id);
                if (resolved) entries.push(resolved.id);
            }
            api.setBrowserEntries({ environment: this.environment.name, owner: id, entries });
        },
    };
}

/** Where a {@link heldModule}'s transforms of its first code wait, relative to the assets plugin's hook. */
type HoldPoint = "resolving its imports in the hook" | "before the hook";

/**
 * `virtual:held`, generated from `code`. Every transform of that first code
 * waits at `holdPoint` until `release()`, so a test can change the module
 * while transforms of its old code are in flight. `held(count)` resolves once
 * `count` of them are waiting.
 */
function heldModule(holdPoint: HoldPoint, code: string) {
    let id = "\0virtual:held";
    let firstCode = code;
    let waiting = 0;
    let released = Promise.withResolvers<void>();
    let hold = async () => {
        waiting++;
        await released.promise;
    };
    let plugin: Plugin = {
        name: "test-held-module",
        // Ahead of vite:resolve, which would answer the held resolution itself.
        enforce: "pre",
        async resolveId(source, importer) {
            if (source === "virtual:held") return id;
            if (
                holdPoint === "resolving its imports in the hook" &&
                importer === id &&
                firstCode.includes(`"${source}"`)
            )
                await hold();
        },
        load: loaded => (loaded === id ? code : undefined),
        async transform(transformedCode, transformed) {
            if (
                holdPoint === "before the hook" &&
                transformed === id &&
                transformedCode === firstCode
            )
                await hold();
        },
    };
    return {
        plugin,
        held: (count = 1) => expect.poll(() => waiting).toBeGreaterThanOrEqual(count),
        release: () => released.resolve(),
        /** Loads `next` from now on and hard-invalidates the module, as an edit does. */
        change(server: ViteDevServer, next: string) {
            code = next;
            let graph = server.environments.ssr!.moduleGraph;
            graph.invalidateModule(graph.getModuleById(id)!);
        },
    };
}

interface ServeOptions {
    serverEnvironments?: string[];
    clientInput?: string;
    environments?: InlineConfig["environments"];
    plugins?: Plugin[];
}

async function serve(project: Fixture, options: ServeOptions = {}) {
    let server = await createServer({
        root: project.root,
        configFile: false,
        logLevel: "silent",
        appType: "custom",
        resolve: { alias: [{ find: /^@pitlane\/assets$/, replacement: source }] },
        server: {
            fs: { allow: [project.directory] },
            // Native macOS events can report fixture creation writes after the first request.
            watch: { usePolling: true },
        },
        plugins: [
            assets(
                options.serverEnvironments
                    ? { serverEnvironments: options.serverEnvironments }
                    : {},
            ),
            ...(options.plugins ?? []),
        ],
        environments: {
            // Vite 8.1's dependency scanner resolves a relative input against
            // process.cwd() rather than the root; 8.3 resolves it against the root.
            client: options.clientInput
                ? { build: { rolldownOptions: { input: join(project.root, options.clientInput) } } }
                : {},
            ssr: { build: { rolldownOptions: { input: "app/entry.server.ts" } } },
            ...options.environments,
        },
    });
    servers.push(server);
    await server.listen();
    return server;
}

/** A second runnable server environment whose graph is the edge entry. */
let edgeEnvironment = {
    consumer: "server" as const,
    dev: {
        createEnvironment: (name: string, config: ResolvedConfig) =>
            createRunnableDevEnvironment(name, config),
    },
    build: { rolldownOptions: { input: "app/entry.edge.ts" } },
};

/** Imports the server entry per request, as the Fetch server bridge does. */
async function request(server: ViteDevServer, environment = "ssr", entry = "/app/entry.server.ts") {
    let runnableEnvironment = server.environments[environment];
    if (!runnableEnvironment || !isRunnableDevEnvironment(runnableEnvironment)) {
        throw new Error(`Expected runnable environment ${environment}`);
    }
    return runnableEnvironment.runner.import(entry);
}

let outside = (project: Fixture, name: string) => `/@fs${join(project.directory, name)}`;
let executed = () => globalThis.__devSnapshotExecuted ?? [];

/**
 * Loads a browser module graph over HTTP the way a browser does, following
 * every static import of each served module. Returns the requests that failed
 * or did not answer, so an empty list means the page could start.
 */
async function browserLoad(server: ViteDevServer, entry: string): Promise<string[]> {
    let origin = new URL(server.resolvedUrls!.local[0]!).origin;
    let seen = new Set<string>();
    let failures: string[] = [];
    let pending = [entry];
    while (pending.length > 0) {
        await Promise.all(
            pending.splice(0).map(async url => {
                if (seen.has(url)) return;
                seen.add(url);
                let response = await fetch(origin + url, {
                    signal: AbortSignal.timeout(5_000),
                }).catch((error: Error) => error);
                if (response instanceof Error)
                    return void failures.push(`${url}: ${response.name}`);
                if (!response.ok) return void failures.push(`${url}: ${response.status}`);
                if (!/javascript/.test(response.headers.get("content-type") ?? "")) return;
                let { module } = parseSync("module.js", await response.text(), {
                    sourceType: "module",
                });
                for (let { moduleRequest } of module.staticImports) {
                    let target = new URL(moduleRequest.value, origin + url);
                    if (target.origin === origin) pending.push(target.pathname + target.search);
                }
            }),
        );
    }
    return failures;
}

beforeEach(() => {
    globalThis.__devSnapshotExecuted = [];
    globalThis.__devSnapshotEvaluations = {};
});

afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => server.close()));
    await Promise.all(
        directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })),
    );
});

describe("proposal 0005: development asset snapshot", () => {
    it("answers module-level lookups on the first request through a cyclic entry without executing lazy routes", async () => {
        let project = await fixture();
        let server = await serve(project);
        let entry = await request(server);

        let pageStyles = [
            "/app/button.css",
            "/app/layout.css",
            outside(project, "shared/widget.css"),
        ];
        expect(entry.moduleLevel).toEqual(pageStyles);
        expect(await entry.assets.getStylesheets("app/page.ts")).toEqual(pageStyles);
        expect(await entry.assets.getStylesheets("../shared/widget.ts")).toEqual([
            outside(project, "shared/widget.css"),
        ]);
        expect(await entry.assets.getStylesheets("app/routes/home.ts")).toEqual([
            "/app/routes/home.css",
        ]);
        expect(entry.moduleLevel).not.toContain("/app/routes/home.css");
        expect(executed()).not.toContain("app/routes/home.ts");
        expect(entry.sameResolver()).toBe(true);
    });

    it("observes a development entry that shares the resolver with a different build entry", async () => {
        let project = await fixture();
        await project.write("project/app/dev.css", ".dev { color: coral; }\n");
        await project.write(
            "project/app/dev-route.ts",
            `import "./dev.css";
import { assets } from "./assets.ts";
export const client = () => assets.getScriptEntry("app/client-input.ts");
`,
        );
        await project.write(
            "project/app/entry.dev.ts",
            `import { assets } from "./assets.ts";
import "./dev-route.ts";
export { assets };
export const moduleLevel = await assets.getStylesheets("app/entry.dev.ts");
`,
        );
        let server = await serve(project);
        let entry = await request(server, "ssr", "/app/entry.dev.ts");

        expect(entry.moduleLevel).toEqual(["/app/dev.css"]);
        expect((await entry.assets.getScriptEntry("app/client-input.ts")).href).toBe(
            "/app/client-input.ts",
        );

        await project.edit("project/app/entry.dev.ts", code =>
            code.replace('import "./dev-route.ts";\n', ""),
        );
        await expect
            .poll(async () => (await request(server, "ssr", "/app/entry.dev.ts")).moduleLevel)
            .toEqual([]);
        let refreshed = await request(server, "ssr", "/app/entry.dev.ts");
        await expect(refreshed.assets.getScriptEntry("app/client-input.ts")).rejects.toThrow(
            /app\/client-input\.ts/,
        );
    });

    it("refreshes every importer when a CSS import is added and removed", async () => {
        let project = await fixture();
        await project.write("project/app/extra.css", ".extra { color: blue; }\n");
        let server = await serve(project);
        await request(server);

        await project.edit("project/app/page.ts", code => `import "./extra.css";\n${code}`);
        await expect
            .poll(async () => (await request(server)).moduleLevel)
            .toContain("/app/extra.css");
        let added = await request(server);
        expect(await added.assets.getStylesheets("app/page.ts")).toContain("/app/extra.css");
        expect(added.sameResolver()).toBe(true);

        await project.edit("project/app/page.ts", code =>
            code.replace(`import "./extra.css";\n`, ""),
        );
        await expect
            .poll(async () => (await request(server)).moduleLevel)
            .not.toContain("/app/extra.css");
        let removed = await request(server);
        expect(await removed.assets.getStylesheets("app/page.ts")).not.toContain("/app/extra.css");
        await expect(removed.assets.getStylesheets("app/extra.css")).rejects.toThrow(
            "app/extra.css",
        );
        expect(removed.sameResolver()).toBe(true);
    });

    it("adds and removes glob routes without executing them", async () => {
        let project = await fixture();
        let server = await serve(project);
        await request(server);

        await project.write("project/app/routes/about.css", ".about { color: gold; }\n");
        await project.write(
            "project/app/routes/about.ts",
            `import "./about.css";\n${record("app/routes/about.ts")}export default "about";\n`,
        );
        await expect
            .poll(async () => (await request(server)).routeFiles)
            .toContain("./routes/about.ts");
        let added = await request(server);
        expect(await added.assets.getStylesheets("app/routes/about.ts")).toEqual([
            "/app/routes/about.css",
        ]);
        expect(added.sameResolver()).toBe(true);
        expect(executed()).not.toContain("app/routes/about.ts");

        await project.remove("project/app/routes/about.ts");
        await expect
            .poll(async () => (await request(server)).routeFiles)
            .not.toContain("./routes/about.ts");
        let removed = await request(server);
        await expect(removed.assets.getStylesheets("app/routes/about.ts")).rejects.toThrow(
            "app/routes/about.ts",
        );
    });

    it("observes stylesheet changes in a lazy route the server never evaluated", async () => {
        let project = await fixture();
        await project.write("project/app/routes/home-extra.css", ".home-extra { color: lime; }\n");
        let server = await serve(project);
        await request(server);

        await project.edit(
            "project/app/routes/home.ts",
            code => `import "./home-extra.css";\n${code}`,
        );
        await expect
            .poll(async () => (await request(server)).assets.getStylesheets("app/routes/home.ts"))
            .toEqual(["/app/routes/home-extra.css", "/app/routes/home.css"]);
        expect(executed()).not.toContain("app/routes/home.ts");
    });

    it("transforms only the changed module when an edit rebuilds the snapshot", async () => {
        let transformed: string[] = [];
        let counter: Plugin = {
            name: "test-transform-counter",
            transform(code, id) {
                if (this.environment.name === "ssr" && !id.startsWith("\0"))
                    transformed.push(id.slice(id.lastIndexOf("/app/") + 1));
            },
        };
        let project = await fixture();
        let server = await serve(project, { plugins: [counter] });
        await request(server);
        // Discovery reached the lazy route without executing it.
        expect(transformed).toContain("app/routes/home.ts");
        expect(executed()).not.toContain("app/routes/home.ts");

        transformed.length = 0;
        await project.edit("project/app/button.ts", code =>
            code.replace(`import "./button.css";\n`, ""),
        );
        await expect
            .poll(async () => (await request(server)).moduleLevel)
            .not.toContain("/app/button.css");

        expect(transformed).toContain("app/button.ts");
        // Unchanged modules keep their recorded edges, including ones the
        // runner never executed and so never cached a transform for.
        expect(transformed).not.toContain("app/routes/home.ts");
        expect(transformed).not.toContain("app/layout.ts");
        expect(transformed).not.toContain("app/edge-only.ts");
    });

    it("re-analyzes a generated module its plugin invalidates without a file change", async () => {
        let stylesheet = "/app/button.css";
        let generated: Plugin = {
            name: "test-generated",
            resolveId: id => (id === "virtual:lazy-styles" ? "\0virtual:lazy-styles" : undefined),
            load: id =>
                id === "\0virtual:lazy-styles"
                    ? `import "${stylesheet}";\nexport const generated = true;\n`
                    : undefined,
        };
        let project = await fixture();
        await project.edit(
            "project/app/routes/home.ts",
            code => `import "virtual:lazy-styles";\n${code}`,
        );
        let server = await serve(project, { plugins: [generated] });
        let entry = await request(server);
        expect(await entry.assets.getStylesheets("app/routes/home.ts")).toEqual([
            "/app/button.css",
            "/app/routes/home.css",
        ]);
        expect(executed()).not.toContain("app/routes/home.ts");

        stylesheet = "/app/layout.css";
        let graph = server.environments.ssr!.moduleGraph;
        graph.invalidateModule(graph.getModuleById("\0virtual:lazy-styles")!);
        await expect
            .poll(async () => (await request(server)).assets.getStylesheets("app/routes/home.ts"))
            .toEqual(["/app/layout.css", "/app/routes/home.css"]);
    });

    // Discovery and the module runner can transform one module at the same
    // time, and an edit can invalidate it while a transform of the old code is
    // in flight. Each case holds that superseded transform across the edit.
    describe("when a superseded transform of a module finishes late", () => {
        let importing = (stylesheet: string) =>
            `import "${stylesheet}";\nexport const generated = true;\n`;
        let serveWithHeldRoute = async (heldPlugin: Plugin) => {
            let project = await fixture();
            await project.edit(
                "project/app/routes/home.ts",
                code => `import "virtual:held";\n${code}`,
            );
            return serve(project, { plugins: [heldPlugin] });
        };
        let current = ["/app/layout.css", "/app/routes/home.css"];

        it.each<[string, HoldPoint, boolean]>([
            [
                "after the current transform, held resolving its imports",
                "resolving its imports in the hook",
                true,
            ],
            ["after the current transform, held before the hook", "before the hook", true],
            ["before any current transform", "resolving its imports in the hook", false],
        ])(
            "keeps the current code's stylesheets when it finishes %s",
            async (_, holdPoint, transformCurrent) => {
                let module = heldModule(holdPoint, importing("/app/button.css"));
                let server = await serveWithHeldRoute(module.plugin);
                let ssr = server.environments.ssr!;

                let superseded = ssr.transformRequest("virtual:held");
                await module.held();
                module.change(server, importing("/app/layout.css"));
                if (transformCurrent) await ssr.transformRequest("virtual:held");
                module.release();
                await superseded;

                let entry = await request(server);
                expect(await entry.assets.getStylesheets("app/routes/home.ts")).toEqual(current);
            },
        );

        it.each<[string, HoldPoint, boolean]>([
            ["after the current transform, held before the hook", "before the hook", true],
            ["before any current transform", "resolving its imports in the hook", false],
        ])(
            "builds the first manifest from the current code when it finishes %s",
            async (_, holdPoint, transformCurrent) => {
                let module = heldModule(holdPoint, importing("/app/button.css"));
                let server = await serveWithHeldRoute(module.plugin);

                // The first manifest's discovery makes the superseded transform.
                let requested = request(server);
                await module.held();
                module.change(server, importing("/app/layout.css"));
                if (transformCurrent)
                    await server.environments.ssr!.transformRequest("virtual:held");
                module.release();

                let entry = await requested;
                expect(await entry.assets.getStylesheets("app/routes/home.ts")).toEqual(current);
            },
        );

        it("builds the first manifest from the current code when two superseded transforms finish after it", async () => {
            let module = heldModule("before the hook", importing("/app/button.css"));
            let server = await serveWithHeldRoute(module.plugin);
            let ssr = server.environments.ssr!;

            // One is a request like the module runner's, the other the first manifest's discovery.
            let superseded = ssr.transformRequest("virtual:held");
            let requested = request(server);
            await module.held(2);
            module.change(server, importing("/app/layout.css"));
            await ssr.transformRequest("virtual:held");
            module.release();
            await superseded;

            let entry = await requested;
            expect(await entry.assets.getStylesheets("app/routes/home.ts")).toEqual(current);
        });

        it("keeps the current code's browser entries when its imports did not change", async () => {
            let callingWith = (key: string) =>
                `import { assets } from "/app/assets.ts";\nexport const entry = () => assets.getScriptEntry("${key}");\n`;
            let module = heldModule("before the hook", callingWith("app/client-input.ts"));
            let server = await serveWithHeldRoute(module.plugin);
            let ssr = server.environments.ssr!;

            let superseded = ssr.transformRequest("virtual:held");
            await module.held();
            module.change(server, callingWith("app/client-dependency.ts"));
            await ssr.transformRequest("virtual:held");
            module.release();
            await superseded;

            let { assets } = await request(server);
            expect((await assets.getScriptEntry("app/client-dependency.ts")).href).toBe(
                "/app/client-dependency.ts",
            );
            await expect(assets.getScriptEntry("app/client-input.ts")).rejects.toThrow(
                "app/client-input.ts",
            );
        });

        it("follows a browser module's imports when it changes while a module importing it transforms", async () => {
            let released = Promise.withResolvers<void>();
            let holding = false;
            let holdInput: Plugin = {
                name: "test-held-browser-input",
                async transform(_code, id) {
                    if (holding || this.environment.name !== "client") return;
                    if (!id.endsWith("/app/client-input.ts")) return;
                    holding = true;
                    await released.promise;
                },
            };
            let project = await fixture();
            await project.write("project/app/client-leaf.ts", `export const leaf = "leaf";\n`);
            await project.write(
                "project/app/client-dependency.ts",
                `import { leaf } from "./client-leaf.ts";\nexport const dependency = leaf;\n`,
            );
            let server = await serve(project, {
                clientInput: "app/client-input.ts",
                plugins: [holdInput],
            });
            let client = server.environments.client;
            let dependency = async () =>
                client.moduleGraph.getModuleByUrl("/app/client-dependency.ts");
            await client.transformRequest("/app/client-dependency.ts");

            // The input's import analysis requests its dependency again from
            // inside the input's own transform, which started before the change.
            let input = client.transformRequest("/app/client-input.ts");
            await expect.poll(() => holding).toBe(true);
            client.moduleGraph.invalidateModule((await dependency())!);
            released.resolve();
            await input;
            await expect.poll(async () => (await dependency())?.transformResult).toBeTruthy();

            let { assets } = await request(server);
            expect(await assets.getPreloads("app/client-leaf.ts")).toEqual([]);
        });
    });

    it("analyzes a virtual module in a browser entry's graph", async () => {
        let generated: Plugin = {
            name: "test-generated",
            resolveId: id => (id === "virtual:client-flag" ? "\0virtual:client-flag" : undefined),
            load: id =>
                id === "\0virtual:client-flag" ? "export const flag = true;\n" : undefined,
        };
        let project = await fixture();
        await project.edit(
            "project/app/client-input.ts",
            code => `import { flag } from "virtual:client-flag";\n${code}export { flag };\n`,
        );
        let server = await serve(project, {
            clientInput: "app/client-input.ts",
            plugins: [generated],
        });
        let entry = await request(server);
        expect(await entry.assets.getPreloads("app/client-input.ts")).toEqual([]);
        expect(await browserLoad(server, "/app/client-input.ts")).toEqual([]);
    });

    it("leaves browser modules it discovered cached for the browser's first load", async () => {
        let transformed: string[] = [];
        let counter: Plugin = {
            name: "test-transform-counter",
            transform(code, id) {
                if (this.environment.name === "client" && !id.startsWith("\0"))
                    transformed.push(id.slice(id.lastIndexOf("/app/") + 1));
            },
        };
        let project = await fixture();
        let server = await serve(project, {
            clientInput: "app/client-input.ts",
            plugins: [counter],
        });
        await request(server);
        expect(transformed).toEqual(
            expect.arrayContaining(["app/client-input.ts", "app/client-dependency.ts"]),
        );

        transformed.length = 0;
        expect(await browserLoad(server, "/app/client-input.ts")).toEqual([]);
        expect(transformed).toEqual([]);
    });

    it("registers and unregisters literal browser entries found in server source", async () => {
        let project = await fixture();
        await project.write("project/app/island.ts", `export const island = () => "island";\n`);
        let server = await serve(project);
        await expect(
            (await request(server)).assets.getScriptEntry("app/island.ts"),
        ).rejects.toThrow("app/island.ts");

        await project.edit(
            "project/app/button.ts",
            code =>
                `${code}import { assets } from "./assets.ts";\nexport const island = () => assets.getScriptEntry("app/island.ts");\n`,
        );
        await expect
            .poll(async () =>
                (await request(server)).assets
                    .getScriptEntry("app/island.ts")
                    .catch(() => undefined),
            )
            .toEqual({ href: "/app/island.ts", preloads: [], importMap: { imports: {} } });

        await project.write("project/app/button.ts", baseFiles["project/app/button.ts"]!);
        await expect
            .poll(async () =>
                (await request(server)).assets.getScriptEntry("app/island.ts").then(
                    () => "registered",
                    () => "unregistered",
                ),
            )
            .toBe("unregistered");
    });

    it("registers a literal call through a re-export only while the re-export names a resolver", async () => {
        let project = await fixture();
        await project.write("project/app/island.ts", `export const island = () => "island";\n`);
        await project.write("project/app/resolvers.ts", `export { assets } from "./assets.ts";\n`);
        await project.edit(
            "project/app/button.ts",
            code =>
                `${code}import { assets } from "./resolvers.ts";\nexport const island = () => assets.getScriptEntry("app/island.ts");\n`,
        );
        let server = await serve(project);
        let state = async () =>
            (await request(server)).assets.getScriptEntry("app/island.ts").then(
                () => "registered",
                () => "unregistered",
            );
        expect(await state()).toBe("registered");

        await project.write(
            "project/app/resolvers.ts",
            `export const assets = { getScriptEntry: (key: string) => key };\n`,
        );
        await expect.poll(state).toBe("unregistered");
    });

    it("treats configured client inputs as browser entries and follows their client graph", async () => {
        let project = await fixture();
        await project.write("project/app/client-added.ts", `export const added = true;\n`);
        let server = await serve(project, { clientInput: "app/client-input.ts" });
        let entry = await request(server);

        expect(await entry.assets.getScriptEntry("app/client-input.ts")).toEqual({
            href: "/app/client-input.ts",
            preloads: [],
            importMap: { imports: {} },
        });
        expect(await entry.assets.getImportMap(["app/client-dependency.ts"])).toEqual({
            imports: {},
        });
        await expect(entry.assets.getImportMap(["app/client-added.ts"])).rejects.toThrow(
            "app/client-added.ts",
        );

        await project.edit(
            "project/app/client-input.ts",
            code => `import "./client-added.ts";\n${code}`,
        );
        await expect
            .poll(async () =>
                (await request(server)).assets
                    .getImportMap(["app/client-added.ts"])
                    .catch(() => undefined),
            )
            .toEqual({ imports: {} });
    });

    it("keeps each server environment's snapshot to its own graph", async () => {
        let project = await fixture();
        await project.write("project/app/edge-extra.css", ".edge-extra { color: maroon; }\n");
        let server = await serve(project, {
            serverEnvironments: ["ssr", "edge"],
            environments: { edge: edgeEnvironment },
        });
        let ssr = await request(server);
        let edge = await request(server, "edge", "/app/entry.edge.ts");

        expect(edge.moduleLevel).toEqual(["/app/edge.css", outside(project, "shared/widget.css")]);
        await expect(edge.assets.getStylesheets("app/page.ts")).rejects.toThrow("app/page.ts");
        await expect(ssr.assets.getStylesheets("app/edge-only.ts")).rejects.toThrow(
            "app/edge-only.ts",
        );

        let ssrEvaluations = globalThis.__devSnapshotEvaluations?.["app/entry.server.ts"];
        await project.edit(
            "project/app/edge-only.ts",
            code => `import "./edge-extra.css";\n${code}`,
        );
        await expect
            .poll(async () => (await request(server, "edge", "/app/entry.edge.ts")).moduleLevel)
            .toContain("/app/edge-extra.css");
        await request(server);
        expect(globalThis.__devSnapshotEvaluations?.["app/entry.server.ts"]).toBe(ssrEvaluations);

        await project.write("shared/widget-extra.css", ".widget-extra { color: navy; }\n");
        await project.edit("shared/widget.ts", code => `import "./widget-extra.css";\n${code}`);
        await expect
            .poll(async () => (await request(server)).moduleLevel)
            .toContain(outside(project, "shared/widget-extra.css"));
        await expect
            .poll(async () => (await request(server, "edge", "/app/entry.edge.ts")).moduleLevel)
            .toContain(outside(project, "shared/widget-extra.css"));

        let graphsOf = async (environment: string) =>
            Object.keys(
                (await request(server, environment, "/app/universal.ts")).default.environments,
            ).sort();
        expect(await graphsOf("ssr")).toEqual(["client", "ssr"]);
        expect(await graphsOf("edge")).toEqual(["client", "edge"]);
    });

    it("follows browser entries a transform plugin declares through the plugin API", async () => {
        let project = await fixture();
        await project.write("project/app/island.ts", `export const island = () => "island";\n`);
        let server = await serve(project, { plugins: [islands()] });
        let state = async () =>
            (await request(server)).assets.getScriptEntry("app/island.ts").then(
                () => "registered",
                () => "unregistered",
            );
        expect(await state()).toBe("unregistered");

        await project.edit("project/app/button.ts", code => `${code}// island: ./island.ts\n`);
        await expect
            .poll(async () =>
                (await request(server)).assets
                    .getScriptEntry("app/island.ts")
                    .catch(() => undefined),
            )
            .toEqual({ href: "/app/island.ts", preloads: [], importMap: { imports: {} } });
        expect((await request(server)).sameResolver()).toBe(true);

        await project.write("project/app/button.ts", baseFiles["project/app/button.ts"]!);
        await expect.poll(state).toBe("unregistered");
    });

    it("includes declarations only from owners reachable in the server graph", async () => {
        let project = await fixture();
        await project.write("project/app/island.ts", `export const island = () => "island";\n`);
        await project.edit("project/app/button.ts", code => `${code}// island: ./island.ts\n`);
        let server = await serve(project, { plugins: [islands()] });
        let state = async () =>
            (await request(server)).assets.getScriptEntry("app/island.ts").then(
                () => "registered",
                () => "unregistered",
            );
        expect(await state()).toBe("registered");

        await project.edit("project/app/page.ts", code =>
            code.replace(
                `import { button } from "./button.ts";\n`,
                'const button = () => "none";\n',
            ),
        );
        await expect.poll(state).toBe("unregistered");

        await project.write(
            "project/app/routes/about.ts",
            `// island: ../island.ts\nexport default "about";\n`,
        );
        await expect.poll(state).toBe("registered");
        expect(executed()).not.toContain("app/routes/about.ts");

        await project.remove("project/app/routes/about.ts");
        await expect.poll(state).toBe("unregistered");
    });

    it("keeps each server environment's declarations for a shared module separate", async () => {
        let project = await fixture();
        await project.write("project/app/ssr-island.ts", `export const island = "ssr";\n`);
        await project.write("project/app/edge-island.ts", `export const island = "edge";\n`);
        await project.edit(
            "shared/widget.ts",
            code =>
                `${code}// island@ssr: ../project/app/ssr-island.ts\n// island@edge: ../project/app/edge-island.ts\n`,
        );
        let server = await serve(project, {
            serverEnvironments: ["ssr", "edge"],
            environments: { edge: edgeEnvironment },
            plugins: [islands()],
        });
        let registered = async (environment: string, entry: string, key: string) =>
            (await request(server, environment, entry)).assets.getScriptEntry(key).then(
                () => true,
                () => false,
            );

        await request(server);
        await request(server, "edge", "/app/entry.edge.ts");
        expect(await registered("ssr", "/app/entry.server.ts", "app/ssr-island.ts")).toBe(true);
        expect(await registered("ssr", "/app/entry.server.ts", "app/edge-island.ts")).toBe(false);
        expect(await registered("edge", "/app/entry.edge.ts", "app/edge-island.ts")).toBe(true);
        expect(await registered("edge", "/app/entry.edge.ts", "app/ssr-island.ts")).toBe(false);

        await project.edit("shared/widget.ts", code => code.replace(/\/\/ island@edge: .*\n/, ""));
        await expect
            .poll(() => registered("edge", "/app/entry.edge.ts", "app/edge-island.ts"))
            .toBe(false);
        expect(await registered("ssr", "/app/entry.server.ts", "app/ssr-island.ts")).toBe(true);
    });

    it("observes stylesheets and modules of packages the graphs include", async () => {
        let project = await fixture();
        await project.write(
            "project/node_modules/fixture-styles/package.json",
            '{"name":"fixture-styles","version":"1.0.0"}',
        );
        await project.write(
            "project/node_modules/fixture-styles/theme.css",
            ".theme { color: plum; }\n",
        );
        await project.write(
            "project/node_modules/fixture-widget/package.json",
            '{"name":"fixture-widget","version":"1.0.0","type":"module","main":"./index.js"}',
        );
        await project.write(
            "project/node_modules/fixture-widget/index.js",
            'import "./widget.css";\nexport const packaged = "widget";\n',
        );
        await project.write(
            "project/node_modules/fixture-widget/widget.css",
            ".packaged { color: gray; }\n",
        );
        await project.edit(
            "project/app/page.ts",
            code => `import "fixture-styles/theme.css";\nimport "fixture-widget";\n${code}`,
        );
        // The binding is used: TypeScript elides an import whose bindings are never read.
        await project.edit(
            "project/app/client-input.ts",
            code =>
                `import { packaged } from "fixture-widget";\n${code}export const widget = packaged;\n`,
        );
        let server = await serve(project, {
            environments: {
                client: {
                    build: { rolldownOptions: { input: "app/client-input.ts" } },
                    optimizeDeps: { exclude: ["fixture-widget"] },
                },
                ssr: {
                    resolve: { noExternal: ["fixture-widget"] },
                    build: { rolldownOptions: { input: "app/entry.server.ts" } },
                },
            },
        });
        let entry = await request(server);

        expect(entry.moduleLevel.slice(0, 2)).toEqual([
            "/node_modules/fixture-styles/theme.css",
            "/node_modules/fixture-widget/widget.css",
        ]);
        expect(await entry.assets.getStylesheets("node_modules/fixture-styles/theme.css")).toEqual([
            "/node_modules/fixture-styles/theme.css",
        ]);
        expect(await entry.assets.getStylesheets("node_modules/fixture-widget/index.js")).toEqual([
            "/node_modules/fixture-widget/widget.css",
        ]);
        expect(await entry.assets.getImportMap(["node_modules/fixture-widget/index.js"])).toEqual({
            imports: {},
        });
    });

    it("answers without waiting for Vite to prebundle a browser dependency", async () => {
        let project = await fixture();
        await project.write(
            "project/node_modules/fixture-widget/package.json",
            '{"name":"fixture-widget","version":"1.0.0","type":"module","main":"./index.js"}',
        );
        await project.write(
            "project/node_modules/fixture-widget/index.js",
            'import "./widget.css";\nexport const packaged = "widget";\n',
        );
        await project.write(
            "project/node_modules/fixture-widget/widget.css",
            ".packaged { color: gray; }\n",
        );
        await project.edit(
            "project/app/client-input.ts",
            code =>
                `import { packaged } from "fixture-widget";\n${code}export const widget = packaged;\n`,
        );
        let server = await serve(project, { clientInput: "app/client-input.ts" });

        expect(await (await request(server)).assets.getScriptEntry("app/client-input.ts")).toEqual({
            href: "/app/client-input.ts",
            preloads: [],
            importMap: { imports: {} },
        });

        // Vite 8.1 leaves the prebundled dependency's pending load unresolved
        // when the server closes mid-crawl, so `server.close()` never settles.
        await server.environments.client!.waitForRequestsIdle();
    });

    it("lets the browser start when a server entry loads before Vite initializes the client", async () => {
        let project = await fixture();
        await project.write(
            "project/node_modules/fixture-widget/package.json",
            '{"name":"fixture-widget","version":"1.0.0","type":"module","main":"./index.js"}',
        );
        await project.write(
            "project/node_modules/fixture-widget/index.js",
            'export const packaged = "widget";\n',
        );
        await project.write(
            "project/app/client-view.ts",
            `import { packaged } from "fixture-widget";\nexport const view = () => packaged;\n`,
        );
        await project.edit(
            "project/app/client-input.ts",
            code =>
                `import { view } from "./client-view.ts";\n${code}export const rendered = view;\n`,
        );
        // @cloudflare/vite-plugin imports the Worker from configureServer, before
        // Vite starts the client environment's dependency optimizer.
        let earlyImport: Plugin = {
            name: "test-early-server-import",
            async configureServer(server) {
                let ssr = server.environments.ssr;
                if (!ssr || !isRunnableDevEnvironment(ssr))
                    throw new Error("Expected runnable SSR environment");
                await ssr.runner.import("/app/entry.server.ts");
            },
        };

        // The first start writes the optimized-dependency cache; the second starts from it.
        for (let start of ["empty cache", "warm cache"]) {
            let server = await serve(project, {
                clientInput: "app/client-input.ts",
                plugins: [earlyImport],
            });
            expect({ start, failures: await browserLoad(server, "/app/client-input.ts") }).toEqual({
                start,
                failures: [],
            });
            await server.restart();
            expect({
                start,
                afterRestart: await browserLoad(server, "/app/client-input.ts"),
            }).toEqual({ start, afterRestart: [] });
            servers.splice(servers.indexOf(server), 1);
            await server.close();
        }
    });

    it("follows a browser module's asset imports by source identity", async () => {
        let project = await fixture();
        await project.write(
            "project/app/logo.svg",
            '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n',
        );
        await project.edit(
            "project/app/client-input.ts",
            code => `import logo from "./logo.svg";\n${code}export const image = logo;\n`,
        );
        let server = await serve(project, { clientInput: "app/client-input.ts" });
        let entry = await request(server);

        expect(await entry.assets.getImportMap(["app/client-input.ts", "app/logo.svg"])).toEqual({
            imports: {},
        });
    });

    it("does not deliver a server snapshot to browser code", async () => {
        let project = await fixture();
        let server = await serve(project);
        let client = server.environments.client;
        await client.transformRequest("/app/universal.ts");
        let universal = await client.moduleGraph.getModuleByUrl("/app/universal.ts");
        let manifestModule = [...(universal?.importedModules ?? [])][0];
        expect(manifestModule).toBeDefined();

        let transformed = await client.transformRequest(manifestModule!.url);
        expect(transformed?.code).not.toContain("button.css");
        let evaluation = import(`data:text/javascript,${encodeURIComponent(transformed!.code)}`);
        await expect(evaluation).rejects.toThrow(/server/i);
    });

    it("rejects a manifest import from a server environment assets() does not serve", async () => {
        let project = await fixture();
        let server = await serve(project, { environments: { worker: edgeEnvironment } });
        let failure = await request(server, "worker", "/app/entry.edge.ts").then(
            () => undefined,
            (error: Error) => error.message,
        );
        expect(failure).toContain("worker");
        expect(failure).toContain("serverEnvironments");
    });
});

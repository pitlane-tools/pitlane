import * as fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";

import type { AssetBuild, AssetBuildChunk, AssetBuildEnvironment } from "./types.ts";

import { createAssetManifest } from "./build.ts";
import { createAssetResolver } from "./resolver.ts";

function chunk(file: string, fields: Partial<Omit<AssetBuildChunk, "file">> = {}): AssetBuildChunk {
    return { file, modules: [], imports: [], dynamicImports: [], stylesheets: [], ...fields };
}

function client(fields: Partial<Omit<AssetBuildEnvironment, "role">> = {}): AssetBuildEnvironment {
    return { role: "client", chunks: {}, entries: {}, assets: {}, ...fields };
}

function server(fields: Partial<Omit<AssetBuildEnvironment, "role">> = {}): AssetBuildEnvironment {
    return { role: "server", chunks: {}, entries: {}, assets: {}, ...fields };
}

// app/entry.browser.ts → (static) runtime, (dynamic) counter; counter → runtime.
function islandApp(): AssetBuild {
    return {
        base: "/",
        environments: {
            client: client({
                chunks: {
                    entry: chunk("assets/entry.browser-a1.js", {
                        modules: ["app/entry.browser.ts"],
                        imports: ["runtime"],
                        dynamicImports: ["counter"],
                        stylesheets: ["assets/entry.browser-c3.css"],
                    }),
                    counter: chunk("assets/counter-d4.js", {
                        modules: ["app/counter.tsx"],
                        imports: ["runtime"],
                        stylesheets: ["assets/counter-e5.css"],
                    }),
                    runtime: chunk("assets/runtime-b2.js", {
                        modules: ["app/runtime.ts", "node_modules/remix/component.js"],
                        stylesheets: ["assets/reset-z1.css"],
                    }),
                },
                entries: { "app/entry.browser.ts": "entry", "app/counter.tsx": "counter" },
                assets: { "app/styles.css": "assets/styles-i9.css" },
            }),
            ssr: server({
                chunks: {
                    server: chunk("entry.server.js", {
                        modules: ["app/entry.server.tsx", "app/counter.tsx", "app/document.tsx"],
                        stylesheets: ["assets/document-g7.css", "assets/counter-e5.css"],
                    }),
                },
            }),
        },
    };
}

describe("proposal 0005: createAssetManifest", () => {
    it("preserves source and environment keys through manifest serialization", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.stringMatching(/^[A-Za-z_][A-Za-z0-9_]{0,16}$/),
                fc.boolean(),
                async (name, useAsEntry) => {
                    let entryKey = useAsEntry ? name : "entry.js";
                    let assetKey = useAsEntry ? "style.css" : name;
                    let manifest = createAssetManifest({
                        base: "/",
                        environments: {
                            [name]: client({
                                chunks: {
                                    [name]: chunk("entry.js", {
                                        modules: [entryKey],
                                        stylesheets: ["style.css"],
                                    }),
                                },
                                entries: { [entryKey]: name },
                                assets: { [assetKey]: "style.css" },
                            }),
                        },
                    });
                    let resolver = createAssetResolver(JSON.parse(JSON.stringify(manifest)));

                    expect(await resolver.getScriptEntry(entryKey)).toEqual({
                        href: "/entry.js",
                        preloads: ["/entry.js"],
                        importMap: { imports: {} },
                    });
                    expect(await resolver.getHref(assetKey)).toBe("/style.css");
                    expect(await resolver.getStylesheets(entryKey, { environment: name })).toEqual([
                        "/style.css",
                    ]);
                },
            ),
            {
                examples: [
                    ["__proto__", true],
                    ["__proto__", false],
                ],
            },
        );
    });

    it("builds a manifest of entries, assets, and per-environment metadata", () => {
        let manifest = createAssetManifest(islandApp());

        expect(manifest.mode).toBe("build");
        expect(manifest.entries).toEqual({
            "app/entry.browser.ts": "/assets/entry.browser-a1.js",
            "app/counter.tsx": "/assets/counter-d4.js",
        });
        expect(manifest.assets).toEqual({ "app/styles.css": "/assets/styles-i9.css" });
        expect(manifest.environments.client!.role).toBe("client");
        expect(manifest.environments.ssr!.role).toBe("server");
        expect(manifest.serverEnvironment).toBeUndefined();
    });

    it("preloads an entry's chunk first, then its static dependencies, never its dynamic ones", () => {
        let { environments } = createAssetManifest(islandApp());

        expect(environments.client!.modules["app/entry.browser.ts"]!.preloads).toEqual([
            "/assets/entry.browser-a1.js",
            "/assets/runtime-b2.js",
        ]);
        expect(environments.client!.modules["app/counter.tsx"]!.preloads).toEqual([
            "/assets/counter-d4.js",
            "/assets/runtime-b2.js",
        ]);
    });

    it("lists a dependency's stylesheets before those of the chunk importing it", () => {
        let { environments } = createAssetManifest(islandApp());

        expect(environments.client!.modules["app/entry.browser.ts"]!.stylesheets).toEqual([
            "/assets/reset-z1.css",
            "/assets/entry.browser-c3.css",
        ]);
    });

    it("indexes every module of a chunk, including shared ones", () => {
        let { environments } = createAssetManifest(islandApp());

        expect(environments.client!.modules["node_modules/remix/component.js"]).toEqual({
            preloads: ["/assets/runtime-b2.js"],
            stylesheets: ["/assets/reset-z1.css"],
        });
    });

    it("keeps environments separate", () => {
        let { environments } = createAssetManifest(islandApp());

        expect(environments.ssr!.modules["app/entry.server.tsx"]!.stylesheets).toEqual([
            "/assets/document-g7.css",
            "/assets/counter-e5.css",
        ]);
        expect(environments.client!.modules["app/entry.server.tsx"]).toBeUndefined();
        expect(environments.client!.modules["app/counter.tsx"]!.stylesheets).toEqual([
            "/assets/reset-z1.css",
            "/assets/counter-e5.css",
        ]);
    });

    it("never makes an observed server module a browser entry", () => {
        let manifest = createAssetManifest(islandApp());

        expect(Object.keys(manifest.entries)).toEqual(["app/entry.browser.ts", "app/counter.tsx"]);
        expect(manifest.entries["app/entry.server.tsx"]).toBeUndefined();
        expect(manifest.entries["app/document.tsx"]).toBeUndefined();
    });

    it("lets every chunk a module belongs to contribute its dependencies", () => {
        let manifest = createAssetManifest({
            base: "/",
            environments: {
                client: client({
                    chunks: {
                        a: chunk("a.js", { modules: ["app/split.ts"], imports: ["x"] }),
                        b: chunk("b.js", { modules: ["app/split.ts"], imports: ["y"] }),
                        x: chunk("x.js", { stylesheets: ["x.css"] }),
                        y: chunk("y.js", { stylesheets: ["y.css"] }),
                    },
                }),
            },
        });

        expect(manifest.environments.client!.modules["app/split.ts"]).toEqual({
            preloads: ["/a.js", "/x.js", "/b.js", "/y.js"],
            stylesheets: ["/x.css", "/y.css"],
        });
    });

    it("starts an entry's preloads with its entry chunk even when modules omit the entry", () => {
        let manifest = createAssetManifest({
            base: "/",
            environments: {
                client: client({
                    chunks: {
                        shared: chunk("shared.js", { modules: ["app/entry.ts"], imports: [] }),
                        entry: chunk("entry.js", { imports: ["dep"] }),
                        dep: chunk("dep.js"),
                    },
                    entries: { "app/entry.ts": "entry" },
                }),
            },
        });

        expect(manifest.environments.client!.modules["app/entry.ts"]!.preloads).toEqual([
            "/entry.js",
            "/dep.js",
            "/shared.js",
        ]);
    });

    it("terminates on import cycles and lists each chunk once", () => {
        let manifest = createAssetManifest({
            base: "/",
            environments: {
                client: client({
                    chunks: {
                        a: chunk("a.js", {
                            modules: ["app/a.ts"],
                            imports: ["b"],
                            stylesheets: ["a.css"],
                        }),
                        b: chunk("b.js", {
                            modules: ["app/b.ts"],
                            imports: ["a"],
                            stylesheets: ["b.css"],
                        }),
                    },
                    entries: { "app/a.ts": "a" },
                }),
            },
        });

        expect(manifest.environments.client!.modules["app/a.ts"]).toEqual({
            preloads: ["/a.js", "/b.js"],
            stylesheets: ["/b.css", "/a.css"],
        });
    });

    it("resolves relative files against the base and leaves absolute URLs unchanged", () => {
        let bases: Record<string, string> = {
            "/": "/assets/a.js",
            "/docs/": "/docs/assets/a.js",
            "/docs": "/docs/assets/a.js",
            "https://cdn.example/app/": "https://cdn.example/app/assets/a.js",
            "./": "./assets/a.js",
            "": "assets/a.js",
        };

        for (let [base, href] of Object.entries(bases)) {
            let manifest = createAssetManifest({
                base,
                environments: {
                    client: client({
                        chunks: {
                            a: chunk("assets/a.js", {
                                modules: ["app/a.ts"],
                                imports: ["cdn"],
                                stylesheets: ["/static/a.css"],
                            }),
                            cdn: chunk("https://cdn.example/lib.js"),
                        },
                        entries: { "app/a.ts": "a" },
                        assets: { "app/font.woff2": "//fonts.example/font.woff2" },
                    }),
                },
            });

            expect(manifest.entries["app/a.ts"]).toBe(href);
            expect(manifest.environments.client!.modules["app/a.ts"]).toEqual({
                preloads: [href, "https://cdn.example/lib.js"],
                stylesheets: ["/static/a.css"],
            });
            expect(manifest.assets["app/font.woff2"]).toBe("//fonts.example/font.woff2");
        }
    });

    it("normalizes source keys to their portable form, keeping leading ../", () => {
        let manifest = createAssetManifest({
            base: "/",
            environments: {
                client: client({
                    chunks: { w: chunk("w.js", { modules: ["./../shared/./widget.ts"] }) },
                    entries: { "/../shared/widget.ts": "w" },
                    assets: { "./app/img/../logo.svg": "logo.svg" },
                }),
            },
        });

        expect(manifest.entries).toEqual({ "../shared/widget.ts": "/w.js" });
        expect(Object.keys(manifest.environments.client!.modules)).toEqual(["../shared/widget.ts"]);
        expect(manifest.assets).toEqual({ "app/logo.svg": "/logo.svg" });
    });

    it("merges assets from every environment", () => {
        let build = islandApp();
        build.environments.ssr!.assets = {
            "app/logo.svg": "assets/logo-j0.svg",
            "app/styles.css": "assets/styles-i9.css",
        };

        expect(createAssetManifest(build).assets).toEqual({
            "app/styles.css": "/assets/styles-i9.css",
            "app/logo.svg": "/assets/logo-j0.svg",
        });
    });

    it("passes the bundler's import map through, or an empty one", () => {
        let build = islandApp();
        expect(createAssetManifest(build).importMap).toEqual({ imports: {} });

        build.importMap = {
            imports: { "/assets/counter-K1.js": "/assets/counter-d4.js" },
            integrity: { "/assets/counter-d4.js": "sha384-a" },
        };
        expect(createAssetManifest(build).importMap).toEqual(build.importMap);
    });

    it("produces JSON-compatible data", () => {
        let manifest = createAssetManifest(islandApp());

        expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
    });

    it("feeds createAssetResolver once the adapter names the consuming server", async () => {
        let assets = createAssetResolver({
            ...createAssetManifest(islandApp()),
            serverEnvironment: "ssr",
        });

        expect(await assets.getScriptEntry("file:app/counter.tsx#Counter")).toEqual({
            href: "/assets/counter-d4.js",
            preloads: ["/assets/counter-d4.js", "/assets/runtime-b2.js"],
            importMap: { imports: {} },
        });
        expect(await assets.getStylesheets("app/entry.server.tsx")).toEqual([
            "/assets/document-g7.css",
            "/assets/counter-e5.css",
        ]);
    });
});

describe("proposal 0005: createAssetManifest diagnostics", () => {
    it("requires exactly one client environment", () => {
        expect(() => createAssetManifest({ base: "/", environments: { ssr: server() } })).toThrow(
            "createAssetManifest() needs exactly one client environment; found none.",
        );
        expect(() =>
            createAssetManifest({ base: "/", environments: { client: client(), web: client() } }),
        ).toThrow(
            'createAssetManifest() needs exactly one client environment; found "client" and "web".',
        );
    });

    it("rejects an edge to a chunk the environment does not have", () => {
        let build = islandApp();
        build.environments.client!.chunks.entry!.imports.push("missing");
        expect(() => createAssetManifest(build)).toThrow(
            'createAssetManifest(): chunk "entry" in the "client" environment imports "missing", which is not a chunk in that environment.',
        );

        build = islandApp();
        build.environments.ssr!.chunks.server!.dynamicImports.push("lazy");
        expect(() => createAssetManifest(build)).toThrow(
            'createAssetManifest(): chunk "server" in the "ssr" environment dynamically imports "lazy", which is not a chunk in that environment.',
        );
    });

    it("rejects an entry naming a chunk the environment does not have", () => {
        let build = islandApp();
        build.environments.client!.entries["app/lost.ts"] = "lost";

        expect(() => createAssetManifest(build)).toThrow(
            'createAssetManifest(): browser entry "app/lost.ts" in the "client" environment names chunk "lost", which is not a chunk in that environment.',
        );
    });

    it("rejects browser entries outside the client environment", () => {
        let build = islandApp();
        build.environments.ssr!.entries["app/entry.server.tsx"] = "server";

        expect(() => createAssetManifest(build)).toThrow(
            'createAssetManifest(): the "ssr" environment lists browser entries, but only the client environment has them.',
        );
    });

    it("rejects a chunk missing one of its lists", () => {
        for (let field of ["modules", "imports", "dynamicImports", "stylesheets"] as const) {
            let build = islandApp();
            delete (build.environments.client!.chunks.runtime as Partial<AssetBuildChunk>)[field];

            expect(() => createAssetManifest(build)).toThrow(
                `createAssetManifest(): chunk "runtime" in the "client" environment has no ${field} list.`,
            );
        }
    });

    it("rejects a chunk without a file", () => {
        let build = islandApp();
        delete (build.environments.client!.chunks.runtime as Partial<AssetBuildChunk>).file;
        expect(() => createAssetManifest(build)).toThrow(
            'createAssetManifest(): chunk "runtime" in the "client" environment has no file.',
        );
    });

    it("rejects one source key mapped to two different URLs, naming both environments", () => {
        let build = islandApp();
        build.environments.client!.entries["./app/counter.tsx"] = "entry";
        expect(() => createAssetManifest(build)).toThrow(
            'createAssetManifest(): source key "app/counter.tsx" maps to "/assets/counter-d4.js" in the "client" environment and "/assets/entry.browser-a1.js" in the "client" environment.',
        );

        build = islandApp();
        build.environments.ssr!.assets = { "app/styles.css": "assets/styles-other.css" };
        expect(() => createAssetManifest(build)).toThrow(
            'createAssetManifest(): source key "app/styles.css" maps to "/assets/styles-i9.css" in the "client" environment and "/assets/styles-other.css" in the "ssr" environment.',
        );
    });

    it("rejects a source key that is an absolute file URL", () => {
        let build = islandApp();
        build.environments.client!.chunks.entry!.modules.push("file:///Users/me/app/extra.ts");

        expect(() => createAssetManifest(build)).toThrow(
            'createAssetManifest(): source key "file:///Users/me/app/extra.ts" in the "client" environment is an absolute file URL. Normalize it to a path relative to the project root.',
        );
    });
});

describe("proposal 0005: traversal invariants", () => {
    // A random graph of up to eight chunks. Chunk i holds module app/m<i>.ts and
    // file c<i>.js; edges, cycles, self-imports, and stylesheets are arbitrary.
    let graph = fc.integer({ min: 1, max: 8 }).chain(size => {
        let ids = Array.from({ length: size }, (_, index) => `c${index}`);
        let edges = fc.uniqueArray(fc.constantFrom(...ids), { maxLength: size });
        let styles = fc.uniqueArray(fc.constantFrom("s0.css", "s1.css", "s2.css", "s3.css"), {
            maxLength: 3,
        });
        return fc.tuple(...ids.map(() => fc.tuple(edges, edges, styles))).map(specs =>
            Object.fromEntries(
                specs.map(([imports, dynamicImports, stylesheets], index) => [
                    `c${index}`,
                    chunk(`c${index}.js`, {
                        modules: [`app/m${index}.ts`],
                        imports,
                        dynamicImports,
                        stylesheets,
                    }),
                ]),
            ),
        );
    });

    function staticDepths(
        chunks: Record<string, AssetBuildChunk>,
        root: string,
    ): Map<string, number> {
        let depths = new Map([[root, 0]]);
        let frontier = [root];
        for (let depth = 1; frontier.length > 0; depth++) {
            frontier = frontier
                .flatMap(id => chunks[id]!.imports)
                .filter(id => !depths.has(id) && depths.set(id, depth));
        }
        return depths;
    }

    function manifestOf(chunks: Record<string, AssetBuildChunk>) {
        return createAssetManifest({ base: "/", environments: { client: client({ chunks }) } });
    }

    it("preloads the chunk first, then exactly its static closure once each, shallowest first", () => {
        fc.assert(
            fc.property(graph, chunks => {
                let { modules } = manifestOf(chunks).environments.client!;

                for (let id of Object.keys(chunks)) {
                    let depths = staticDepths(chunks, id);
                    let preloads = modules[`app/m${id.slice(1)}.ts`]!.preloads;
                    let order = preloads.map(href => depths.get(href.slice(1, -3))!);

                    expect(preloads[0]).toBe(`/${id}.js`);
                    expect(new Set(preloads).size).toBe(preloads.length);
                    expect(preloads.toSorted()).toEqual(
                        [...depths.keys()].map(c => `/${c}.js`).toSorted(),
                    );
                    expect(order).toEqual(order.toSorted((a, b) => a - b));
                }
            }),
            { seed: 5, numRuns: 300 },
        );
    });

    it("collects exactly the static closure's stylesheets, once each", () => {
        fc.assert(
            fc.property(graph, chunks => {
                let { modules } = manifestOf(chunks).environments.client!;

                for (let id of Object.keys(chunks)) {
                    let reachable = [...staticDepths(chunks, id).keys()];
                    let expected = new Set(reachable.flatMap(c => chunks[c]!.stylesheets));
                    let stylesheets = modules[`app/m${id.slice(1)}.ts`]!.stylesheets;

                    expect(new Set(stylesheets).size).toBe(stylesheets.length);
                    expect(stylesheets.toSorted()).toEqual(
                        [...expected].map(s => `/${s}`).toSorted(),
                    );
                }
            }),
            { seed: 5, numRuns: 300 },
        );
    });

    it("is unaffected by dynamic imports and by server environments", () => {
        fc.assert(
            fc.property(graph, graph, (chunks, serverChunks) => {
                let staticOnly = Object.fromEntries(
                    Object.entries(chunks).map(([id, c]) => [id, { ...c, dynamicImports: [] }]),
                );
                let withServer = createAssetManifest({
                    base: "/",
                    environments: {
                        client: client({ chunks }),
                        ssr: server({ chunks: serverChunks }),
                    },
                });

                expect(withServer.environments.client).toEqual(
                    manifestOf(staticOnly).environments.client,
                );
            }),
            { seed: 5, numRuns: 200 },
        );
    });

    it("is deterministic for identical input", () => {
        fc.assert(
            fc.property(graph, chunks => {
                expect(manifestOf(chunks)).toEqual(manifestOf(structuredClone(chunks)));
            }),
            { seed: 5, numRuns: 100 },
        );
    });
});

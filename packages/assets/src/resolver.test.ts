import type { AssetServer } from "remix/assets";

import * as fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, it } from "vite-plus/test";

import type { BuildAssetsManifest, DevAssetsManifest } from "./types.ts";

import { createAssetResolver } from "./resolver.ts";

// A hand-written manifest, so these tests specify the resolver independently
// of the generator that normally produces one.
function buildManifest(overrides: Partial<BuildAssetsManifest> = {}): BuildAssetsManifest {
    return {
        mode: "build",
        environments: {
            client: {
                role: "client",
                modules: {
                    "app/entry.browser.ts": {
                        preloads: ["/assets/entry.browser-a1.js", "/assets/runtime-b2.js"],
                        stylesheets: ["/assets/entry.browser-c3.css"],
                    },
                    "app/counter.tsx": {
                        preloads: ["/assets/counter-d4.js", "/assets/runtime-b2.js"],
                        stylesheets: ["/assets/counter-e5.css"],
                    },
                    "app/runtime.ts": {
                        preloads: ["/assets/runtime-b2.js"],
                        stylesheets: [],
                    },
                    "../shared/widget.ts": {
                        preloads: ["/assets/widget-f6.js"],
                        stylesheets: [],
                    },
                },
            },
            ssr: {
                role: "server",
                modules: {
                    "app/entry.server.tsx": {
                        preloads: ["/assets/entry.server.js"],
                        stylesheets: ["/assets/document-g7.css", "/assets/counter-e5.css"],
                    },
                    "app/counter.tsx": {
                        preloads: ["/assets/entry.server.js"],
                        stylesheets: ["/assets/counter-e5.css"],
                    },
                    "app/server-only.ts": {
                        preloads: ["/assets/entry.server.js"],
                        stylesheets: [],
                    },
                },
            },
            worker: {
                role: "server",
                modules: {
                    "app/entry.worker.ts": {
                        preloads: ["/assets/entry.worker.js"],
                        stylesheets: ["/assets/worker-h8.css"],
                    },
                },
            },
        },
        entries: {
            "app/entry.browser.ts": "/assets/entry.browser-a1.js",
            "app/counter.tsx": "/assets/counter-d4.js",
            "../shared/widget.ts": "/assets/widget-f6.js",
        },
        assets: {
            "app/styles.css": "/assets/styles-i9.css",
            "app/logo.svg": "/assets/logo-j0.svg",
        },
        importMap: {
            imports: {
                "/assets/counter-K1.js": "/assets/counter-d4.js",
                "/assets/runtime-K2.js": "/assets/runtime-b2.js",
            },
        },
        serverEnvironment: "ssr",
        ...overrides,
    };
}

function devManifest(): DevAssetsManifest {
    return {
        mode: "dev",
        environments: {
            client: {
                role: "client",
                modules: {
                    "app/entry.browser.ts": { preloads: [], stylesheets: [] },
                    "app/counter.tsx": { preloads: [], stylesheets: [] },
                },
            },
            ssr: {
                role: "server",
                modules: {
                    "app/entry.server.tsx": {
                        preloads: [],
                        stylesheets: ["/app/document.css", "/app/counter.css"],
                    },
                    "app/counter.tsx": { preloads: [], stylesheets: ["/app/counter.css"] },
                },
            },
        },
        entries: {
            "app/entry.browser.ts": "/app/entry.browser.ts",
            "app/counter.tsx": "/app/counter.tsx",
        },
        assets: { "app/styles.css": "/app/styles.css" },
        serverEnvironment: "ssr",
    };
}

describe("proposal 0005: createAssetResolver over a build manifest", () => {
    let assets = createAssetResolver(buildManifest());

    it("resolves a script entry to its URL, its static preloads, and the complete client map", async () => {
        expect(await assets.getScriptEntry("app/entry.browser.ts")).toEqual({
            href: "/assets/entry.browser-a1.js",
            preloads: ["/assets/entry.browser-a1.js", "/assets/runtime-b2.js"],
            importMap: {
                imports: {
                    "/assets/counter-K1.js": "/assets/counter-d4.js",
                    "/assets/runtime-K2.js": "/assets/runtime-b2.js",
                },
            },
        });
    });

    it("returns an empty import map when the build has chunk import maps disabled", async () => {
        let disabled = createAssetResolver(buildManifest({ importMap: { imports: {} } }));

        expect((await disabled.getScriptEntry("app/counter.tsx")).importMap).toEqual({
            imports: {},
        });
        expect(await disabled.getImportMap("app/counter.tsx")).toEqual({ imports: {} });
    });

    it("resolves a Remix file: entry id, ignoring its export fragment", async () => {
        let entry = await assets.getScriptEntry("file:app/counter.tsx");
        let fragment = await assets.getScriptEntry("file:app/counter.tsx#Counter");

        expect(entry.href).toBe("/assets/counter-d4.js");
        expect(fragment).toEqual(entry);
    });

    it("resolves a linked module outside the project root by its ../ key", async () => {
        for (let key of [
            "../shared/widget.ts",
            "./../shared/widget.ts",
            "/../shared/widget.ts",
            "file:../shared/widget.ts#Widget",
        ]) {
            expect((await assets.getScriptEntry(key)).href).toBe("/assets/widget-f6.js");
        }
    });

    it("returns the emitted URL of an entry, a stylesheet, or another asset from getHref", async () => {
        expect(await assets.getHref("app/entry.browser.ts")).toBe("/assets/entry.browser-a1.js");
        expect(await assets.getHref("app/styles.css")).toBe("/assets/styles-i9.css");
        expect(await assets.getHref("/app/logo.svg")).toBe("/assets/logo-j0.svg");
    });

    it("unions script preloads in argument order, deduplicated by href, without CSS", async () => {
        expect(await assets.getPreloads(["app/counter.tsx", "app/entry.browser.ts"])).toEqual([
            "/assets/counter-d4.js",
            "/assets/runtime-b2.js",
            "/assets/entry.browser-a1.js",
        ]);
        expect(await assets.getPreloads("app/runtime.ts")).toEqual(["/assets/runtime-b2.js"]);
    });

    it("lets an explicitly requested stylesheet contribute its own URL to getPreloads", async () => {
        expect(await assets.getPreloads(["app/styles.css", "app/runtime.ts"])).toEqual([
            "/assets/styles-i9.css",
            "/assets/runtime-b2.js",
        ]);
    });

    it("combines client and current-server stylesheets by default", async () => {
        expect(await assets.getStylesheets("app/counter.tsx")).toEqual(["/assets/counter-e5.css"]);
        expect(
            await assets.getStylesheets(["app/entry.server.tsx", "app/entry.browser.ts"]),
        ).toEqual([
            "/assets/document-g7.css",
            "/assets/counter-e5.css",
            "/assets/entry.browser-c3.css",
        ]);
    });

    it("leaves unrelated server graphs out of the default stylesheet query", async () => {
        await expect(assets.getStylesheets("app/entry.worker.ts")).rejects.toThrow(
            'assets.getStylesheets("app/entry.worker.ts") found no module "app/entry.worker.ts" in the "client" or "ssr" environment',
        );
    });

    it("takes only the keys in getStylesheets, with no option narrowing the graphs", () => {
        expectTypeOf(assets.getStylesheets).parameters.toEqualTypeOf<
            [path: string | readonly string[]]
        >();
    });

    it("returns the complete client map from getImportMap and an empty map for no paths", async () => {
        expect(await assets.getImportMap(["app/counter.tsx"])).toEqual(buildManifest().importMap);
        expect(await assets.getImportMap([])).toEqual({ imports: {} });
    });
});

describe("proposal 0005: createAssetResolver over a development manifest", () => {
    let assets = createAssetResolver(devManifest());

    it("resolves a script entry to its dev URL with no preloads and an empty map", async () => {
        expect(await assets.getScriptEntry("app/entry.browser.ts")).toEqual({
            href: "/app/entry.browser.ts",
            preloads: [],
            importMap: { imports: {} },
        });
        expect((await assets.getScriptEntry("file:app/counter.tsx#Counter")).href).toBe(
            "/app/counter.tsx",
        );
    });

    it("returns dev URLs from getHref", async () => {
        expect(await assets.getHref("app/styles.css")).toBe("/app/styles.css");
    });

    it("returns no preloads and an empty import map", async () => {
        expect(await assets.getPreloads(["app/entry.browser.ts", "app/styles.css"])).toEqual([]);
        expect(await assets.getImportMap("app/entry.browser.ts")).toEqual({ imports: {} });
    });

    it("reports server-graph stylesheets as dev URLs", async () => {
        expect(await assets.getStylesheets("app/entry.server.tsx")).toEqual([
            "/app/document.css",
            "/app/counter.css",
        ]);
    });
});

describe("proposal 0005: resolver errors", () => {
    let assets = createAssetResolver(buildManifest());

    it("tells an observed module that is not an entry how to register it", async () => {
        let error = assets.getScriptEntry("app/server-only.ts");

        await expect(error).rejects.toThrow(
            'assets.getScriptEntry("app/server-only.ts") found no browser entry "app/server-only.ts" in the "client" environment. The module is in the "ssr" graph but is not registered as a browser entry.',
        );
        await expect(error).rejects.toThrow("assets({ include })");
    });

    it("tells an unknown module how to register it, distinctly from an observed one", async () => {
        let error = assets.getScriptEntry("app/missing.ts");

        await expect(error).rejects.toThrow(
            'assets.getScriptEntry("app/missing.ts") found no browser entry "app/missing.ts" in the "client" environment. No environment\'s graph contains the module.',
        );
        await expect(error).rejects.toThrow("assets({ include })");
    });

    it("points a missing getHref asset at registration", async () => {
        await expect(assets.getHref("app/missing.png")).rejects.toThrow(
            'assets.getHref("app/missing.png") found no browser entry or asset "app/missing.png" in the "client" environment.',
        );
        await expect(assets.getHref("app/missing.png")).rejects.toThrow("assets({ include })");
    });

    it("never recommends emitting a module for a stylesheet or preload lookup", async () => {
        let lookups = [
            () => assets.getStylesheets("app/missing.ts"),
            () => assets.getStylesheets("app/entry.worker.ts"),
            () => assets.getPreloads("app/server-only.ts"),
            () => assets.getImportMap("app/missing.ts"),
        ];

        for (let lookup of lookups) {
            await expect(lookup()).rejects.toThrow(/found no module/);
            await expect(lookup()).rejects.not.toThrow(/include/);
        }
    });

    it("names the method, key, and environment of a missing preload", async () => {
        await expect(assets.getPreloads(["app/counter.tsx", "app/server-only.ts"])).rejects.toThrow(
            'assets.getPreloads("app/server-only.ts") found no module "app/server-only.ts" in the "client" environment',
        );
    });

    it("rejects an absolute file URL and asks for the portable source key", async () => {
        for (let key of ["file:///Users/me/app/counter.tsx", "file:/Users/me/app/counter.tsx"]) {
            await expect(assets.getScriptEntry(key)).rejects.toThrow(
                `assets.getScriptEntry("${key}") received an absolute file URL. Pass the source key relative to the project root instead, such as "file:app/counter.tsx" or "app/counter.tsx".`,
            );
        }
    });
});

describe("proposal 0005: an unavailable manifest", () => {
    afterEach(() => {
        delete (globalThis as Record<symbol, unknown>)[Symbol.for("pitlane.umbrella.packages")];
    });

    it("constructs a resolver whose every call explains how to supply a manifest", async () => {
        let assets = createAssetResolver({ mode: "unavailable" });
        let calls: Record<string, () => Promise<unknown>> = {
            getScriptEntry: () => assets.getScriptEntry("app/entry.browser.ts"),
            getHref: () => assets.getHref("app/entry.browser.ts"),
            getPreloads: () => assets.getPreloads("app/entry.browser.ts"),
            getStylesheets: () => assets.getStylesheets("app/entry.browser.ts"),
            getImportMap: () => assets.getImportMap("app/entry.browser.ts"),
        };

        for (let [method, call] of Object.entries(calls)) {
            await expect(call()).rejects.toThrow(
                `assets.${method}("app/entry.browser.ts") has no asset manifest to read: @pitlane/assets/manifest was not supplied by a build integration. Add assets() from @pitlane/assets/vite-plugin to your Vite config, or pass createAssetResolver() a manifest from createAssetManifest() in @pitlane/assets/build.`,
            );
        }
    });

    it("names the umbrella specifiers when the app imports through pitlane", async () => {
        let globals = globalThis as Record<symbol, Set<string> | undefined>;
        globals[Symbol.for("pitlane.umbrella.packages")] = new Set(["@pitlane/assets"]);

        let assets = createAssetResolver({ mode: "unavailable" });

        await expect(assets.getScriptEntry("app/entry.browser.ts")).rejects.toThrow(
            "pitlane/assets/manifest was not supplied by a build integration. Add assets() from pitlane/assets/vite-plugin to your Vite config, or pass createAssetResolver() a manifest from createAssetManifest() in pitlane/assets/build.",
        );
        await expect(assets.getScriptEntry("app/entry.browser.ts")).rejects.not.toThrow("@pitlane");
    });
});

describe("proposal 0005: portable source keys", () => {
    // Segment names exclude "." and "..", which are the dot segments under test.
    let segment = fc
        .stringMatching(/^[a-z0-9_.-]{1,8}$/)
        .filter(name => name !== "." && name !== "..");
    let sourceKey = fc
        .tuple(fc.nat({ max: 2 }), fc.array(segment, { minLength: 1, maxLength: 4 }))
        .map(([parents, segments]) =>
            [...Array<string>(parents).fill(".."), ...segments].join("/"),
        );

    // Every spelling of a key the proposal says denotes the same source module.
    let spelling = fc.constantFrom(
        (key: string) => key,
        (key: string) => `./${key}`,
        (key: string) => `/${key}`,
        (key: string) => `file:${key}`,
        (key: string) => `file:./${key}`,
        (key: string) => `${key}#Export`,
        (key: string) => `file:${key}#Component`,
        (key: string) => key.replace(/\/([^/]+)$/, "/./$1"),
        (key: string) => key.replace(/\/([^/]+)$/, "/detour/../$1"),
    );

    it("resolves every spelling of a key to the same entry", async () => {
        await fc.assert(
            fc.asyncProperty(sourceKey, spelling, async (key, spell) => {
                let assets = createAssetResolver({
                    mode: "build",
                    environments: {
                        client: {
                            role: "client",
                            modules: { [key]: { preloads: ["/entry.js"], stylesheets: [] } },
                        },
                    },
                    entries: { [key]: "/entry.js" },
                    assets: {},
                    importMap: { imports: {} },
                });

                expect((await assets.getScriptEntry(spell(key))).href).toBe("/entry.js");
            }),
            { seed: 5, numRuns: 300 },
        );
    });

    it("never resolves an absolute file URL", async () => {
        await fc.assert(
            fc.asyncProperty(sourceKey, async key => {
                let assets = createAssetResolver(buildManifest());

                await expect(assets.getScriptEntry(`file:///${key}`)).rejects.toThrow(
                    "absolute file URL",
                );
            }),
            { seed: 5, numRuns: 100 },
        );
    });
});

describe("proposal 0005: compatibility with remix/assets", () => {
    it("is assignable where Remix expects an asset server's resolution methods", () => {
        expectTypeOf(createAssetResolver(buildManifest())).toExtend<
            Pick<AssetServer, "getScriptEntry" | "getHref" | "getPreloads" | "getImportMap">
        >();
    });
});

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, createLogger, type Logger, type Plugin, resolveConfig } from "vite";
import satteri from "vite-plugin-satteri";
import { afterEach, describe, expect, it } from "vitest";

import { headings } from "../src/satteri.ts";
import { contentLayer } from "../src/vite.ts";

let fixture = fileURLToPath(new URL("./fixtures/prebuild-app", import.meta.url));

/** A logger that forwards warnings to the test and swallows everything else. */
function warnCollector(onWarn: (warning: string) => void): Logger {
    return {
        ...createLogger("silent"),
        warn: message => onWarn(message),
        warnOnce: message => onWarn(message),
    };
}
let outputs: string[] = [];

afterEach(async () => {
    await Promise.all(outputs.splice(0).map(dir => rm(dir, { force: true, recursive: true })));
});

/**
 * Builds the fixture for the server with no filesystem access at runtime, then
 * returns what querying the built bundle produces. This is the whole claim of
 * the plugin: the same collection declarations answer without `node:fs`.
 */
async function buildFixture(
    options?: Parameters<typeof contentLayer>[0],
    onWarn?: (warning: string) => void,
    output?: { ssr?: string; satteri?: boolean },
    // A Worker build has no node_modules to import from at runtime, so it
    // bundles every dependency. That is the shape in which what the graph
    // reaches becomes a build failure rather than a runtime import.
    bundling?: { noExternal?: boolean; plugins?: Plugin[] },
) {
    let outDir = await mkdtemp(fileURLToPath(new URL("./.tmp-out-", import.meta.url)));
    outputs.push(outDir);
    await build({
        customLogger: onWarn ? warnCollector(onWarn) : undefined,
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
        ssr: bundling?.noExternal ? { noExternal: true } : undefined,
        plugins: [
            ...(output?.satteri === false
                ? []
                : [satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()] })]),
            contentLayer(options),
            ...(bundling?.plugins ?? []),
        ],
        build: {
            outDir,
            emptyOutDir: true,
            ssr: output?.ssr ?? "app/entry.server.ts",
            rollupOptions: { output: { entryFileNames: "entry.server.mjs" } },
        },
    });
    return outDir;
}

/** Builds the fixture, then asks the built bundle what it can see. */
async function buildAndQuery(options?: Parameters<typeof contentLayer>[0]) {
    let outDir = await buildFixture(options);
    let entry = await import(pathToFileURL(join(outDir, "entry.server.mjs")).href);
    return { outDir, result: await entry.query() };
}

describe("the two paths agree", () => {
    it("produces the same data and the same rendered body on both paths", async () => {
        // The proposal's stated reason for parsing frontmatter in-package is
        // that "a prebuilt and a runtime-resolved collection cannot disagree
        // about an entry's `data`". This is that claim, measured, and extended
        // to the body: the bundler compiles Markdown and MDX through
        // `vite-plugin-satteri`, the runtime compiles it through
        // `runtimeOptions`, and those are two pipelines that have to agree.
        let outDir = await buildFixture({ entry: "app/content-passthrough.ts" }, undefined, {
            ssr: "app/entry.passthrough.ts",
        });
        let bundled = await import(pathToFileURL(join(outDir, "entry.server.mjs")).href);
        let prebuilt = await bundled.query();

        // Both handshake globals are `Symbol.for`, so the build the line above
        // ran leaks its manifest into this process. Without clearing them the
        // read below answers from that manifest and this test compares it with
        // itself, which is a comparison that cannot fail.
        delete (globalThis as Record<symbol, unknown>)[Symbol.for("pitlane.content.manifest")];
        delete (globalThis as Record<symbol, unknown>)[Symbol.for("pitlane.content.prebuild")];

        // A loader with no manifest resolves its base against the working
        // directory, which is this package rather than the fixture.
        let cwd = process.cwd();
        process.chdir(fixture);
        let runtime: { settings: unknown[]; rendered: { html: string }[] };
        try {
            let source = await import(
                `${pathToFileURL(join(fixture, "app/entry.passthrough.ts")).href}?filesystem`
            );
            runtime = await source.query();
        } finally {
            process.chdir(cwd);
        }

        expect(runtime).toStrictEqual(prebuilt);
        // And the comparison has to be capable of failing: values only a real
        // read and a real render produce have to reach `runtime`.
        expect(runtime.settings).toHaveLength(1);
        expect(runtime.rendered.map(page => page.html).join("")).toContain(
            '<em class="note">from mdx</em>',
        );
    });
});

describe("contentLayer()", () => {
    it("answers from the bundle, with no filesystem read at runtime", async () => {
        let { result } = await buildAndQuery();

        expect(result.ids).toEqual(["hello", "second"]);
    });

    it("bundles the package, so a server build cannot externalize the manifest away", async () => {
        // Nothing here asks for `noExternal`. A server build externalizes its
        // dependencies by default, which would leave the runtime importing the
        // manifest the package ships — the one that registers nothing — rather
        // than the one this build emitted.
        let outDir = await buildFixture();
        let bundle = await readFile(join(outDir, "entry.server.mjs"), "utf8");

        expect(bundle).toContain('Symbol.for("pitlane.content.manifest")');
        expect(bundle).toContain("Ada Lovelace");
        expect(bundle).toMatch(/new Date\("2026-01-02/);
    });

    it("keeps itself out of dev dependency optimization, so the manifest stays replaceable", async () => {
        // The manifest reaches the runtime as a module this plugin replaces in
        // `load`. Vite's dev optimizer pre-bundles a real node_modules
        // dependency ahead of any plugin, inlining the shipped manifest — the
        // one that registers nothing — and `load` never runs. A collection
        // then falls through to its loader, which on a host with no
        // filesystem answers with nothing at all.
        //
        // Invisible from the demos in this repository: a workspace link is
        // never a candidate for optimization, so only an application that
        // installed the package sees it.
        let config = await resolveConfig(
            { root: fixture, logLevel: "silent", plugins: [contentLayer()] },
            "serve",
        );

        expect(config.environments.ssr.optimizeDeps.exclude).toContain("@pitlane/content");
    });

    it("leaves no filesystem or resolver builtin in a fully prebuilt bundle", async () => {
        // The package documents itself as safe to import on any host, with
        // Workers as the constrained case. A static import of these anywhere in
        // the chain `index.ts` pulls in breaks that for every consumer, whether
        // or not they ever render at runtime. `node:path` is deliberately not
        // in the list: Workers provides it, and the loaders resolve a base with
        // it before they know whether a collection was prebuilt.
        let outDir = await buildFixture();
        let bundle = await readFile(join(outDir, "entry.server.mjs"), "utf8");

        expect(bundle).not.toMatch(/from\s*["']node:(module|url|fs|fs\/promises)["']/);
    });

    it("leaves the Markdown compiler out of a fully prebuilt bundle", async () => {
        // Sätteri is a native addon. A Worker cannot load one, and a prebuilt
        // collection has nothing left to compile, so the compiler must not be
        // in the graph at all. Reaching it is not a size regression but a
        // build failure: workerd resolves under the `browser` condition, which
        // sends `satteri` to its WASM binding and then to an optional package
        // that is not installed on a native platform.
        let modules: string[] = [];
        await buildFixture(undefined, undefined, undefined, {
            noExternal: true,
            plugins: [
                {
                    name: "record-modules",
                    transform: (_code, id) => {
                        modules.push(id);
                        return null;
                    },
                },
            ],
        });

        expect(modules.filter(id => /[\\/]node_modules[\\/]satteri[\\/]/.test(id))).toEqual([]);
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

    it("warns when a prebuilt collection configures options.satteri", async () => {
        let warnings: string[] = [];

        await buildFixture({ entry: "app/content-satteri.ts" }, warning => {
            warnings.push(warning);
        });

        expect(warnings.join("\n")).toMatch(
            /Collection "blog" configures loader options\.satteri, but contentLayer\(\) prebuilt it/,
        );
    });

    it("stays quiet when a prebuilt collection configures nothing", async () => {
        let warnings: string[] = [];

        await buildFixture(undefined, warning => warnings.push(warning));

        expect(warnings.filter(warning => warning.includes("options.satteri"))).toEqual([]);
    });

    it("fails the build when the entry does not await createContent", async () => {
        // The collections are declared but the promise is never awaited, so the
        // build sees nothing. An empty manifest is the one outcome this design
        // refuses: it works on Node and fails only on a host with no filesystem.
        await expect(buildFixture({ entry: "app/content-unawaited.ts" })).rejects.toThrow(
            /app\/content-unawaited\.ts.*await/s,
        );
    });

    it("names vite-plugin-satteri when nothing can compile a Markdown body", async () => {
        // Without a Markdown compiler the emitted body module is parsed as
        // JavaScript, which used to die on a tokenizer error pointing at a
        // virtual path the author has never seen.
        await expect(
            buildFixture({ entry: "app/content-markdown-only.ts" }, undefined, {
                satteri: false,
            }),
        ).rejects.toThrow(/vite-plugin-satteri/);
    });

    it("names the module and the underlying error when the entry cannot be imported", async () => {
        await expect(buildAndQuery({ entry: "app/missing.ts" })).rejects.toThrow(
            /app\/missing\.ts/,
        );
    });
});

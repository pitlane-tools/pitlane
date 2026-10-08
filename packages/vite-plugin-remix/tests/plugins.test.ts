import { join } from "node:path";
import { resolveConfig, type InlineConfig } from "vite";
import { describe, expect, it } from "vite-plus/test";

import { remix, type RemixPluginOptions } from "../src/index.ts";

const FIXTURE = join(import.meta.dirname, "fixtures/node-app");
let renderBuiltUrl = (file: string) => `https://cdn.example.test/${file}`;

async function clientChunkImportMap(
    options: RemixPluginOptions,
    overrides: InlineConfig = {},
): Promise<boolean | undefined> {
    let config = await resolveConfig(
        {
            root: FIXTURE,
            configFile: false,
            logLevel: "error",
            plugins: [remix(options)],
            ...overrides,
        },
        "build",
    );
    return config.environments.client?.build.chunkImportMap;
}

describe("remix() chunk import maps", () => {
    it("turns them on by default", async () => {
        expect(await clientChunkImportMap({})).toBe(true);
    });

    it("turns them off with remix({ assets: { chunkImportMap: false } })", async () => {
        expect(await clientChunkImportMap({ assets: { chunkImportMap: false } })).toBe(false);
    });

    it("turns them on for a SPA too, where Vite writes the map into index.html", async () => {
        expect(await clientChunkImportMap({ server: false })).toBe(true);
        expect(
            await clientChunkImportMap({ server: false, assets: { chunkImportMap: false } }),
        ).toBe(false);
    });

    it("respects a native client setting when the plugin option is absent", async () => {
        let native = { environments: { client: { build: { chunkImportMap: false } } } };
        expect(await clientChunkImportMap({}, native)).toBe(false);
    });

    it("lets the plugin option win over a native client setting", async () => {
        let native = { environments: { client: { build: { chunkImportMap: true } } } };
        expect(await clientChunkImportMap({ assets: { chunkImportMap: false } }, native)).toBe(
            false,
        );
    });

    it("refuses the default together with experimental.renderBuiltUrl", async () => {
        await expect(
            clientChunkImportMap({}, { experimental: { renderBuiltUrl } }),
        ).rejects.toThrow(
            "[assets] chunkImportMap: true cannot be combined with experimental.renderBuiltUrl.",
        );
    });

    it("accepts renderBuiltUrl once maps are turned off", async () => {
        let config = { experimental: { renderBuiltUrl } };
        expect(await clientChunkImportMap({ assets: { chunkImportMap: false } }, config)).toBe(
            false,
        );
    });
});

async function environmentOutDirs(overrides: InlineConfig = {}) {
    let config = await resolveConfig(
        { root: FIXTURE, configFile: false, logLevel: "error", plugins: [remix()], ...overrides },
        "build",
    );
    return {
        client: config.environments.client?.build.outDir,
        ssr: config.environments.ssr?.build.outDir,
    };
}

describe("remix() output directories", () => {
    it("builds into dist/client and dist/ssr by default", async () => {
        expect(await environmentOutDirs()).toEqual({
            client: join("dist", "client"),
            ssr: join("dist", "ssr"),
        });
    });

    it("nests both environments under the configured build.outDir", async () => {
        expect(await environmentOutDirs({ build: { outDir: ".tmp/out" } })).toEqual({
            client: join(".tmp/out", "client"),
            ssr: join(".tmp/out", "ssr"),
        });
    });

    it("lets an environment's own outDir win over build.outDir", async () => {
        let overrides: InlineConfig = {
            build: { outDir: ".tmp/out" },
            environments: { ssr: { build: { outDir: "worker" } } },
        };
        expect(await environmentOutDirs(overrides)).toEqual({
            client: join(".tmp/out", "client"),
            ssr: "worker",
        });
    });
});

describe("remix()", () => {
    it("refuses prerendering in SPA mode", () => {
        // Prerendering renders through the server entry, which SPA mode does
        // not build. Failing at config time beats failing mid-build.
        expect(() => remix({ server: false, prerender: true })).toThrow(/not supported/);
        expect(() => remix({ server: false, prerender: ["/"] })).toThrow(/not supported/);
        expect(() => remix({ server: false })).not.toThrow();
    });
});

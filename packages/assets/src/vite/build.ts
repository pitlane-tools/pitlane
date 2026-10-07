import type { Plugin, ResolvedConfig } from "vite";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, posix, resolve } from "node:path";
import { isCSSRequest } from "vite";

import type { AssetBuildEnvironment } from "../types.ts";
import type { AssetPluginState } from "./state.ts";

import { createAssetManifest } from "../build.ts";
import { inputPath, sourceKey } from "./entries.ts";
import { captureImportMap, captureOutput, publicFile } from "./output.ts";
import { literalInputs } from "./resolver-usage.ts";
import { EMPTY_INPUT, MANIFEST_EXTERNAL, MANIFEST_FILE } from "./state.ts";

async function writeManifests(state: AssetPluginState): Promise<void> {
    let config = state.config!;
    let client = state.outputs.get("client");
    if (!client || state.serverEnvironments.some(name => !state.outputs.has(name))) return;
    // A stylesheet both sides import is emitted by each build under its own name;
    // a server file byte-identical to a client one links as the client's file.
    let clientStylesheets = new Map<string, string>();
    for (let asset of Object.values(client.bundle)) {
        if (asset.type === "asset" && isCSSRequest(asset.fileName)) {
            clientStylesheets.set(Buffer.from(asset.source).toString("latin1"), asset.fileName);
        }
    }
    let environments: Record<string, AssetBuildEnvironment> = Object.create(null);
    let twins = new Map<string, Map<string, string>>();
    for (let [name, output] of state.outputs) {
        let graph = output.graph;
        let twin = new Map<string, string>();
        if (output !== client) {
            for (let asset of Object.values(output.bundle)) {
                if (asset.type !== "asset" || !isCSSRequest(asset.fileName)) continue;
                let file = clientStylesheets.get(Buffer.from(asset.source).toString("latin1"));
                if (file) twin.set(asset.fileName, file);
            }
        }
        twins.set(name, twin);
        environments[name] = {
            ...graph,
            chunks: Object.fromEntries(
                Object.entries(graph.chunks).map(([key, chunk]) => [
                    key,
                    {
                        ...chunk,
                        file: publicFile(config, chunk.file),
                        stylesheets: chunk.stylesheets.map(file =>
                            publicFile(config, twin.get(file) ?? file),
                        ),
                    },
                ]),
            ),
            assets: Object.fromEntries(
                Object.entries(graph.assets).map(([key, file]) => [
                    key,
                    publicFile(config, twin.get(file) ?? file),
                ]),
            ),
        };
    }
    for (let name of state.serverEnvironments) {
        // Like a dev snapshot, a server's manifest describes the client graph and
        // its own, so an explicit lookup in another server's graph fails the same
        // way in both modes.
        let manifest = createAssetManifest({
            base: config.base,
            environments: { client: environments.client!, [name]: environments[name]! },
            importMap: state.importMap,
        });
        let output = state.outputs.get(name)!;
        await mkdir(output.outDir, { recursive: true });
        // Object literals reinterpret __proto__; JSON parsing preserves it as a source key.
        await writeFile(
            resolve(output.outDir, MANIFEST_FILE),
            `export default JSON.parse(${JSON.stringify(JSON.stringify({ ...manifest, serverEnvironment: name }))});\n`,
        );
        for (let asset of Object.values(output.bundle)) {
            if (asset.type !== "asset" || twins.get(name)!.has(asset.fileName)) continue;
            let destination = resolve(client.outDir, asset.fileName);
            await mkdir(dirname(destination), { recursive: true });
            await writeFile(destination, asset.source);
        }
    }
}

function importMapFileName(config: ResolvedConfig): string {
    let options = config.build.rolldownOptions.experimental?.chunkImportMap;
    return typeof options === "object" ? (options.fileName ?? "importmap.json") : "importmap.json";
}

export function assetBuild(state: AssetPluginState): Plugin {
    return {
        name: "pitlane-assets-build",
        sharedDuringBuild: true,
        apply: "build",
        configEnvironment(name, config) {
            if (state.serverEnvironments.includes(name)) return { build: { emitAssets: true } };
            if (
                name === "client" &&
                !config.build?.rolldownOptions?.input &&
                !config.build?.rollupOptions?.input
            ) {
                return { build: { rolldownOptions: { input: EMPTY_INPUT } } };
            }
        },
        resolveId(id) {
            if (id === EMPTY_INPUT) return id;
        },
        load(id) {
            if (id === EMPTY_INPUT) return "export {};";
        },
        async buildStart() {
            if (this.environment.name !== "client") return;
            let missing = state.serverEnvironments.filter(name => !state.outputs.has(name));
            if (missing.length)
                throw new Error(
                    `[assets] Client built before server environments: ${missing.join(", ")}. Build servers before client.`,
                );
            let root = state.config!.root;
            state.assetReferences.clear();
            state.scriptReferences.clear();
            let inputs = new Map(state.inputs);
            for (let modules of state.resolverUsage.values()) {
                for (let owner of modules.keys()) {
                    for (let input of literalInputs(modules, owner)) {
                        let file = inputPath(root, input.key);
                        inputs.set(file, { ...input, key: sourceKey(root, file) });
                    }
                }
            }
            for (let input of inputs.values()) {
                let id = inputPath(state.config!.root, input.key);
                if (
                    input.kind === "asset" &&
                    !isCSSRequest(id) &&
                    state.config!.assetsInclude(id)
                ) {
                    let reference = this.emitFile({
                        type: "asset",
                        name: basename(id),
                        originalFileName: id,
                        source: await readFile(id),
                    });
                    state.assetReferences.set(sourceKey(root, id), reference);
                } else {
                    let reference = this.emitFile({
                        type: "chunk",
                        id,
                        preserveSignature: "exports-only",
                    });
                    // Another plugin may clear this chunk's isEntry; the reference still names it.
                    if (!isCSSRequest(id))
                        state.scriptReferences.set(sourceKey(root, id), reference);
                }
            }
        },
        renderChunk(code, chunk) {
            if (!code.includes(MANIFEST_EXTERNAL)) return;
            let file = posix.relative(posix.dirname(chunk.fileName), MANIFEST_FILE);
            if (!file.startsWith(".")) file = `./${file}`;
            return { code: code.replaceAll(MANIFEST_EXTERNAL, file), map: null };
        },
        generateBundle: {
            order: "post",
            handler(_options, bundle) {
                for (let [name, output] of Object.entries(bundle)) {
                    if (output.type === "chunk" && output.facadeModuleId === EMPTY_INPUT)
                        delete bundle[name];
                }
                if (this.environment.name !== "client" || !state.mapsEnabled) return;
                // Vite's map still names the empty JS placeholder of every CSS-only
                // entry after css-post deletes it, and this plugin's own placeholder.
                let fileName = importMapFileName(this.environment.config);
                let map = captureImportMap(bundle, fileName);
                let base = this.environment.config.base;
                for (let [key, href] of Object.entries(map.imports)) {
                    if (href.startsWith(base) && !(href.slice(base.length) in bundle))
                        delete map.imports[key];
                }
                let artifact = bundle[fileName]!;
                if (artifact.type === "asset") artifact.source = JSON.stringify(map);
            },
        },
        writeBundle: {
            order: "post",
            async handler(_options, bundle) {
                let name = this.environment.name;
                if (name !== "client" && !state.serverEnvironments.includes(name)) return;
                let config = this.environment.config;
                let assets = new Map<string, string>();
                let scripts = new Map<string, string>();
                if (name === "client") {
                    for (let [key, reference] of state.assetReferences)
                        assets.set(key, this.getFileName(reference));
                    for (let [key, reference] of state.scriptReferences)
                        scripts.set(key, this.getFileName(reference));
                    state.importMap = state.mapsEnabled
                        ? captureImportMap(bundle, importMapFileName(config))
                        : undefined;
                }
                state.outputs.set(name, {
                    graph: captureOutput(
                        bundle,
                        config,
                        name === "client" ? "client" : "server",
                        assets,
                        scripts,
                    ),
                    bundle,
                    outDir: resolve(config.root, config.build.outDir),
                });
                await writeManifests(state);
            },
        },
        buildApp: {
            order: "pre",
            async handler(builder) {
                let build = builder.build.bind(builder);
                builder.build = (async environment => {
                    if (environment.isBuilt) return;
                    return build(environment);
                }) as typeof builder.build;
                for (let name of state.serverEnvironments) {
                    let environment = builder.environments[name];
                    if (!environment)
                        throw new Error(`[assets] Unknown server environment: ${name}`);
                    await builder.build(environment);
                }
                await builder.build(builder.environments.client);
            },
        },
    };
}

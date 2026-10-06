// An Rsbuild plugin that hands real Rspack compilations to `createAssetManifest`.
// It is application code, not a Pitlane API: it understands the browser ES
// module output `rsbuild.config.ts` declares and fails the build for anything
// else, rather than describe a startup sequence it cannot express.
import type { AssetBuildChunk, AssetBuildEnvironment } from "@pitlane/assets/build";
import type { EnvironmentContext, RsbuildPlugin, Rspack } from "@rsbuild/core";

import { createAssetManifest } from "@pitlane/assets/build";
import { rspack } from "@rsbuild/core";
import { copyFileSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** The file each server environment's manifest is written to, inside its output directory. */
const MANIFEST_FILE = "pitlane-assets-manifest.json";

interface CapturedEnvironment {
    context: EnvironmentContext;
    graph: AssetBuildEnvironment;
}

export function pitlaneAssets(): RsbuildPlugin {
    return {
        name: "pitlane-assets-example",
        setup(api) {
            // Rspack resolves symlinks, so module paths are real paths; the root must be too.
            let root = realpathSync(api.context.rootPath);
            let captured = new Map<string, CapturedEnvironment>();

            api.onAfterEnvironmentCompile(({ stats, environment }) => {
                if (!stats) {
                    throw new Error(`[pitlane-assets] ${environment.name} finished without stats`);
                }
                captured.set(environment.name, {
                    context: environment,
                    graph: readEnvironment(stats.compilation, environment, root),
                });
            });

            // Runs once every environment has compiled, so the manifest sees all of them.
            api.onAfterBuild(({ environments }) => {
                let graphs: Record<string, AssetBuildEnvironment> = {};
                for (let name of Object.keys(environments)) {
                    let environment = captured.get(name);
                    if (!environment) {
                        throw new Error(`[pitlane-assets] ${name} was built but not captured`);
                    }
                    graphs[name] = environment.graph;
                }

                let all = [...captured.values()];
                let clients = all.filter(({ graph }) => graph.role === "client");
                if (clients.length !== 1) {
                    throw new Error(
                        `[pitlane-assets] expected one web environment, found ${clients.length}`,
                    );
                }
                let client = clients[0]!.context;
                let base = client.config.output.assetPrefix;
                if (base === "auto") {
                    throw new Error(
                        `[pitlane-assets] ${client.name} needs a fixed output.assetPrefix; "auto" leaves the public base unknown`,
                    );
                }

                let manifest = createAssetManifest({ base, environments: graphs });

                for (let { context, graph } of all) {
                    if (graph.role !== "server") continue;
                    // Stylesheets and files the server imports are served from the client output.
                    let emitted = [
                        ...Object.values(graph.chunks).flatMap(chunk => chunk.stylesheets),
                        ...Object.values(graph.assets),
                    ];
                    for (let file of emitted) {
                        let target = join(client.distPath, file);
                        mkdirSync(dirname(target), { recursive: true });
                        copyFileSync(join(context.distPath, file), target);
                    }
                    writeFileSync(
                        join(context.distPath, MANIFEST_FILE),
                        JSON.stringify(
                            { ...manifest, serverEnvironment: context.name },
                            undefined,
                            4,
                        ),
                    );
                }
            });
        },
    };
}

function readEnvironment(
    compilation: Rspack.Compilation,
    environment: EnvironmentContext,
    root: string,
): AssetBuildEnvironment {
    let role = roleOf(environment);
    if (role === "client") assertBrowserModules(compilation, environment.name);

    let key = (path: string) => sourceKey(root, path);
    let chunks: Record<string, AssetBuildChunk> = {};
    let chunksByModule = new Map<string, string[]>();

    for (let chunk of compilation.chunks) {
        let id = chunkId(chunk);
        let files = [...chunk.files];
        let scripts = files.filter(file => /\.m?js$/.test(file));
        if (scripts.length !== 1) {
            throw new Error(
                `[pitlane-assets] chunk ${id} in ${environment.name} emitted ${scripts.length} JavaScript files; this integration expects exactly one`,
            );
        }
        let modules = unique(
            compilation.chunkGraph.getChunkModules(chunk).flatMap(sourcePaths).map(key),
        );
        for (let module of modules) {
            chunksByModule.set(module, [...(chunksByModule.get(module) ?? []), id]);
        }
        chunks[id] = {
            file: scripts[0]!,
            modules,
            imports: [],
            dynamicImports: [],
            stylesheets: files.filter(file => file.endsWith(".css")),
        };
    }

    let entries: Record<string, string> = {};
    for (let [name, entrypoint] of compilation.entrypoints) {
        let entryChunk = chunkId(entrypoint.getEntrypointChunk());
        // In Rspack's ES module chunk format, the entry chunk statically imports
        // the entrypoint's other chunks before it starts, so they are its static
        // dependencies and its URL is the only script a document needs.
        chunks[entryChunk]!.imports = unique(
            entrypoint.chunks.map(chunkId).filter(id => id !== entryChunk),
        );
        if (role !== "client") continue;
        let entryModules = compilation.chunkGraph.getChunkEntryModulesIterable(
            entrypoint.getEntrypointChunk(),
        );
        for (let module of entryModules) {
            let path = entryPath(module);
            if (!path) continue;
            let source = key(path);
            if (entries[source] && entries[source] !== entryChunk) {
                throw new Error(
                    `[pitlane-assets] ${source} is the entry of two chunks in ${environment.name}, the second from entry "${name}"`,
                );
            }
            entries[source] = entryChunk;
        }
    }

    // A lazy chunk group lists the import() expressions that load it as origins.
    // Every chunk holding one of those modules dynamically imports the whole group.
    for (let group of compilation.chunkGroups) {
        if (group.isInitial()) continue;
        let targets = group.chunks.map(chunkId);
        for (let origin of group.origins) {
            if (!origin.module) continue;
            for (let path of sourcePaths(origin.module)) {
                for (let importer of chunksByModule.get(key(path)) ?? []) {
                    let chunk = chunks[importer]!;
                    chunk.dynamicImports = unique([...chunk.dynamicImports, ...targets]);
                }
            }
        }
    }

    // Asset modules record the source file they were emitted from.
    let assets: Record<string, string> = {};
    for (let asset of compilation.getAssets()) {
        let source = asset.info.sourceFilename;
        if (source) assets[key(resolve(compilation.compiler.context, source))] = asset.name;
    }

    return { role, chunks, entries, assets };
}

function roleOf(environment: EnvironmentContext): "client" | "server" {
    let target = environment.config.output.target;
    if (target === "web") return "client";
    if (target === "node") return "server";
    throw new Error(`[pitlane-assets] ${environment.name} targets ${target}, which is not handled`);
}

function assertBrowserModules(compilation: Rspack.Compilation, name: string) {
    let { module, chunkFormat, chunkLoading } = compilation.options.output;
    if (module !== true || chunkFormat !== "module" || chunkLoading !== "import") {
        throw new Error(
            `[pitlane-assets] ${name} must emit ES module chunks loaded with import() (output.module: true); found module ${String(module)}, chunkFormat ${String(chunkFormat)}, chunkLoading ${String(chunkLoading)}`,
        );
    }
}

function chunkId(chunk: Rspack.Chunk): string {
    if (chunk.id === undefined || chunk.id === null) {
        throw new Error(`[pitlane-assets] chunk ${chunk.name ?? "(unnamed)"} has no id`);
    }
    return String(chunk.id);
}

/** The source files a module was built from; concatenated modules expand into their parts. */
function sourcePaths(module: Rspack.Module): string[] {
    if (module instanceof rspack.ConcatenatedModule) return module.modules.flatMap(sourcePaths);
    if (module instanceof rspack.NormalModule) {
        return [module.resourceResolveData?.path ?? module.resource];
    }
    // Runtime, external, and extracted-CSS modules have no source file of their own.
    return [];
}

/** The source file an entry module starts from, which for a concatenated module is its root. */
function entryPath(module: Rspack.Module): string | undefined {
    let root = module instanceof rspack.ConcatenatedModule ? module.rootModule : module;
    return sourcePaths(root)[0];
}

/** A project-root-relative, slash-separated key; linked modules outside the root keep `../`. */
function sourceKey(root: string, path: string): string {
    let key = relative(root, path);
    if (isAbsolute(key))
        throw new Error(`[pitlane-assets] ${path} has no path relative to ${root}`);
    return key.split(sep).join("/");
}

function unique<T>(values: T[]): T[] {
    return [...new Set(values)];
}

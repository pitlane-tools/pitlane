import type { Plugin, ViteBuilder } from "vite";

import * as fs from "node:fs";
import * as path from "node:path";

import { mergeAssets } from "./runtime.ts";

export interface BuildPluginOptions {
    clientEntry: string | false;
    serverEntry: string;
}

/**
 * The builder method `@hiogawa/vite-plugin-fullstack` declaration-merges onto
 * `ViteBuilder`. We feature-detect it instead of loading the dependency's
 * ambient types, so the dependency never enters Pitlane's public type graph.
 */
interface FullstackBuilder {
    writeAssetsManifest(): Promise<void>;
}

function isFullstackBuilder(builder: ViteBuilder): builder is FullstackBuilder & ViteBuilder {
    return "writeAssetsManifest" in builder && typeof builder.writeAssetsManifest === "function";
}

/**
 * Patches the builder so pitlane-remix-build coexists with plugins that also
 * orchestrate builds (e.g. @cloudflare/vite-plugin). Runs at "pre" order so
 * the guards are in place before any building starts, regardless of plugin
 * registration order.
 *
 * Written against builder semantics, not any platform: everything is
 * feature-detected, nothing platform-specific is imported.
 */
export function buildCompat(): Plugin {
    return {
        name: "pitlane-remix-build:compat",
        buildApp: {
            order: "pre",
            async handler(builder) {
                // Guard builder.build() against redundant calls. Without this,
                // two orchestrators (pitlane-remix-build plus a platform plugin's
                // buildApp) would each trigger a full build of every
                // environment. `isBuilt` is native Vite BuildEnvironment API.
                // The cast is deliberate: skipped environments resolve to
                // undefined, which orchestrators ignore.
                let originalBuild = builder.build.bind(builder);
                builder.build = (async environment => {
                    if ("isBuilt" in environment && environment.isBuilt) return;
                    return originalBuild(environment);
                }) as typeof builder.build;

                // Some orchestrators relocate SSR assets into the client output
                // before the assets manifest copy runs, causing ENOENT on files
                // that were already moved. Safe to ignore; anything else is a
                // real failure and still throws.
                if (isFullstackBuilder(builder)) {
                    let originalWrite = builder.writeAssetsManifest.bind(builder);
                    builder.writeAssetsManifest = async () => {
                        try {
                            await originalWrite();
                        } catch (error) {
                            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
                        }
                    };
                }
            },
        },
    };
}

/**
 * Minimal structural views of the Rollup output bundle — enough to resolve
 * `?assets=` module keys to built chunks without importing any bundler types.
 */
interface CapturedChunk {
    type: "chunk";
    fileName: string;
    facadeModuleId: string | null;
    imports: string[];
    code?: string;
    viteMetadata?: { importedCss?: Iterable<string> };
}

interface CapturedAsset {
    type: "asset";
    fileName: string;
}

type CapturedBundle = Record<string, CapturedChunk | CapturedAsset>;

interface CapturedEnvironment {
    bundle: CapturedBundle;
    root: string;
    base: string;
    outDir: string;
}

/**
 * Keyed on globalThis so the captures survive duplicate plugin instantiation —
 * config files can be evaluated more than once in a single process.
 */
function bundleStore(): Map<string, CapturedEnvironment> {
    let host = globalThis as { __pitlaneBundleStore?: Map<string, CapturedEnvironment> };
    return (host.__pitlaneBundleStore ??= new Map());
}

const MANIFEST_NAME = "__fullstack_assets_manifest.js";
const MANIFEST_REFERENCE = /__assets_manifest\["([^"]+)"\]\["([^"]+)"\]/g;

interface ManifestRecord {
    entry?: string;
    js: { href: string }[];
    css: { href: string }[];
}

function joinBase(base: string, fileName: string): string {
    return (base.endsWith("/") ? base : base + "/") + fileName;
}

function findChunkForModule(
    bundle: CapturedBundle,
    root: string,
    key: string,
): CapturedChunk | undefined {
    let moduleId = root.replaceAll("\\", "/") + "/" + key;
    for (let entry of Object.values(bundle)) {
        if (entry.type !== "chunk" || !entry.facadeModuleId) continue;
        if (entry.facadeModuleId.replaceAll("\\", "/") === moduleId) return entry;
    }
    return undefined;
}

function collectDependencies(bundle: CapturedBundle, entryChunk: CapturedChunk) {
    let js: string[] = [];
    let css = new Set<string>();
    let visited = new Set<string>();
    let queue = [entryChunk];

    while (queue.length > 0) {
        let chunk = queue.shift()!;
        if (visited.has(chunk.fileName)) continue;
        visited.add(chunk.fileName);
        // The upstream manifest lists the entry chunk in its own js deps.
        js.push(chunk.fileName);
        for (let file of chunk.viteMetadata?.importedCss ?? []) css.add(file);
        for (let imported of chunk.imports) {
            let entry = bundle[imported];
            if (entry?.type === "chunk") queue.push(entry);
        }
    }

    return { js, css: [...css] };
}

/**
 * Synthesizes the `?assets=` manifest module when the upstream write never
 * landed. Some orchestrators (observed with Nitro) bundle the SSR output
 * inside their own buildApp without the upstream post-order write having run
 * against the same builder, leaving the built server entry importing a
 * manifest file that does not exist. Everything needed to produce it is in
 * the captured output bundles: the built server code names the exact
 * `(environment, module)` pairs it reads, and the chunk graph names the JS
 * and CSS dependencies of each module.
 *
 * No-op whenever the upstream write already produced the file.
 */
function ensureAssetsManifest(): void {
    let ssr = bundleStore().get("ssr");
    if (!ssr) return;

    let ssrOutDir = path.resolve(ssr.root, ssr.outDir);
    let manifestPath = path.join(ssrOutDir, MANIFEST_NAME);
    if (fs.existsSync(manifestPath)) return;

    // Which (environment, module) pairs does the built server code read?
    let references = new Map<string, Set<string>>();
    for (let entry of Object.values(ssr.bundle)) {
        if (entry.type !== "chunk") continue;
        let code = entry.code;
        if (code === undefined) {
            try {
                code = fs.readFileSync(path.join(ssrOutDir, entry.fileName), "utf8");
            } catch {
                continue;
            }
        }
        for (let match of code.matchAll(MANIFEST_REFERENCE)) {
            let keys = references.get(match[1]) ?? new Set<string>();
            keys.add(match[2]);
            references.set(match[1], keys);
        }
    }
    if (references.size === 0) return;

    let client = bundleStore().get("client");
    // Assets are served from the client origin; its base wins when present.
    let base = (client ?? ssr).base;
    let manifest: Record<string, Record<string, ManifestRecord>> = {};

    for (let [environmentName, keys] of references) {
        let captured = bundleStore().get(environmentName);
        if (!captured) continue;
        for (let key of keys) {
            let chunk = findChunkForModule(captured.bundle, captured.root, key);
            if (!chunk) continue;
            let dependencies = collectDependencies(captured.bundle, chunk);
            let record: ManifestRecord = { js: [], css: [] };
            if (environmentName === "client") {
                record.entry = joinBase(base, chunk.fileName);
                record.js = dependencies.js.map(fileName => ({ href: joinBase(base, fileName) }));
            }
            record.css = dependencies.css.map(fileName => ({ href: joinBase(base, fileName) }));
            (manifest[environmentName] ??= {})[key] = record;
        }
    }

    fs.mkdirSync(ssrOutDir, { recursive: true });
    fs.writeFileSync(manifestPath, `export default ${JSON.stringify(manifest)};\n`);

    // SSR-built static assets (e.g. CSS imported by the server entry) are
    // served from the client output; mirror them there like the upstream
    // write does.
    if (client) {
        let clientOutDir = path.resolve(client.root, client.outDir);
        for (let entry of Object.values(ssr.bundle)) {
            if (entry.type !== "asset") continue;
            let source = path.join(ssrOutDir, entry.fileName);
            let destination = path.join(clientOutDir, entry.fileName);
            if (!fs.existsSync(source) || fs.existsSync(destination)) continue;
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.copyFileSync(source, destination);
        }
    }
}

/**
 * Environment defaults and build sequencing. SSR builds first, then the
 * client: the client build resolves `?assets=ssr` against the SSR manifest,
 * so the order is load-bearing.
 */
export function build({ clientEntry, serverEntry }: BuildPluginOptions): Plugin {
    let hasClientEntry = clientEntry !== false;

    return {
        name: "pitlane-remix-build",
        writeBundle(_options, bundle) {
            bundleStore().set(this.environment.name, {
                bundle: bundle as unknown as CapturedBundle,
                root: this.environment.config.root,
                base: this.environment.config.base,
                outDir: this.environment.config.build.outDir,
            });
        },
        async buildApp(builder) {
            await builder.build(builder.environments.ssr);
            if (hasClientEntry) {
                await builder.build(builder.environments.client);
            }
            // Write the assets manifest as soon as the app environments are
            // built. The upstream write is a "post"-order buildApp hook — too
            // late for orchestrators that bundle the SSR output inside their
            // own buildApp. The write is idempotent, so the later post-hook
            // call becomes a no-op.
            if (isFullstackBuilder(builder)) {
                await builder.writeAssetsManifest();
            }
            // And when the upstream write never lands at all, synthesize the
            // manifest from our own bundle captures.
            ensureAssetsManifest();
        },
        config(userConfig) {
            // Never clobber inputs the user configured themselves (plugin
            // config merges over user config): e.g. an index.html client
            // entry for a fully static SPA shell.
            let environments = userConfig.environments as
                | Record<string, { build?: { rollupOptions?: { input?: unknown } } }>
                | undefined;
            let hasUserClientInput = Boolean(environments?.client?.build?.rollupOptions?.input);
            let hasUserServerInput = Boolean(environments?.ssr?.build?.rollupOptions?.input);

            return {
                // `vite build` runs the full multi-environment app build.
                builder: {},
                build: {
                    // Every asset gets a hashed file URL the ?assets= protocol
                    // can resolve — nothing is inlined away.
                    assetsInlineLimit: 0,
                },
                environments: {
                    ...(hasClientEntry && {
                        client: {
                            build: {
                                outDir: "dist/client",
                                rollupOptions: {
                                    input: hasUserClientInput
                                        ? undefined
                                        : clientEntry || undefined,
                                },
                            },
                        },
                    }),
                    ssr: {
                        resolve: {
                            // Bundle the runtime helpers into the build output:
                            // @pitlane/dev is a dev dependency, so the built
                            // server can never require it at runtime (pruned
                            // containers, Deno import maps, serverless bundles).
                            noExternal: [/^@pitlane\/dev(\/|$)/],
                        },
                        build: {
                            outDir: "dist/ssr",
                            rollupOptions: {
                                input: hasUserServerInput ? undefined : { index: serverEntry },
                            },
                        },
                    },
                },
            };
        },
    };
}

const RUNTIME_MODULE_ID = "\0pitlane:runtime";
const RUNTIME_MODULE_FILTER = new RegExp(`^${RUNTIME_MODULE_ID}$`);

/**
 * Resolves `@pitlane/dev/runtime` imports to an inlined copy of the
 * implementation. The package is a dev dependency: built output must never
 * import it at runtime (pruned containers, Deno import maps, serverless
 * bundles), and dependency-externalization behavior varies across cores and
 * orchestrators — inlining by construction removes the variable.
 */
export function runtimeInline(): Plugin {
    return {
        name: "pitlane-runtime-inline",
        enforce: "pre",
        resolveId: {
            filter: { id: /^@pitlane\/dev\/runtime$/ },
            handler(source) {
                if (source === "@pitlane/dev/runtime") return RUNTIME_MODULE_ID;
            },
        },
        load: {
            filter: { id: RUNTIME_MODULE_FILTER },
            handler(id) {
                if (id === RUNTIME_MODULE_ID) {
                    return `export const mergeAssets = ${mergeAssets.toString()};\n`;
                }
            },
        },
    };
}

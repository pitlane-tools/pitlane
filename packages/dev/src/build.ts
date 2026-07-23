import type { Plugin, ViteBuilder } from "vite";

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
 * Patches the builder so remix-build coexists with plugins that also
 * orchestrate builds (e.g. @cloudflare/vite-plugin). Runs at "pre" order so
 * the guards are in place before any building starts, regardless of plugin
 * registration order.
 *
 * Written against builder semantics, not any platform: everything is
 * feature-detected, nothing platform-specific is imported.
 */
export function buildCompat(): Plugin {
    return {
        name: "remix-build:compat",
        buildApp: {
            order: "pre",
            async handler(builder) {
                // Guard builder.build() against redundant calls. Without this,
                // two orchestrators (remix-build plus a platform plugin's
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
 * Environment defaults and build sequencing. SSR builds first, then the
 * client: the client build resolves `?assets=ssr` against the SSR manifest,
 * so the order is load-bearing.
 */
export function build({ clientEntry, serverEntry }: BuildPluginOptions): Plugin {
    let hasClientEntry = clientEntry !== false;

    return {
        name: "remix-build",
        async buildApp(builder) {
            await builder.build(builder.environments.ssr);
            if (hasClientEntry) {
                await builder.build(builder.environments.client);
            }
        },
        config() {
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
                                    input: clientEntry || undefined,
                                },
                            },
                        },
                    }),
                    ssr: {
                        build: {
                            outDir: "dist/ssr",
                            rollupOptions: {
                                input: { index: serverEntry },
                            },
                        },
                    },
                },
            };
        },
    };
}

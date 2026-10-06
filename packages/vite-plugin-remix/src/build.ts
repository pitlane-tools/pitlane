import type { Plugin } from "vite";

import type { PrerenderOption } from "./prerender.ts";

import { prerender } from "./prerender.ts";

export interface BuildPluginOptions {
    clientEntry: string | false;
    serverEntry: string;
    prerender: PrerenderOption | undefined;
}

/**
 * Environment defaults and prerendering. The asset plugin builds the server
 * environments, then the client, and writes the asset manifest in its own
 * earlier `buildApp` hook; prerendering runs after it, against the completed
 * build.
 */
export function build({ clientEntry, serverEntry, prerender: paths }: BuildPluginOptions): Plugin {
    return {
        name: "pitlane-remix-build",
        async buildApp(builder) {
            if (paths === undefined) return;

            let { written, redirected } = await prerender(builder, paths, serverEntry);
            for (let file of written) this.info(`prerendered ${file}`);

            // Silence here would read as a path that prerendered fine, and
            // the file it should have produced is the one nobody finds
            // missing until the host 404s on it.
            for (let { pathname, location } of redirected) {
                let target = location ?? "an unnamed location";
                this.info(`skipped ${pathname} (redirects to ${target})`);
            }
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
                appType: userConfig.appType ?? "custom",
                // `vite build` runs the full multi-environment app build.
                builder: {},
                environments: {
                    client: {
                        build: {
                            outDir: "dist/client",
                            rollupOptions: {
                                // `clientEntry: false` removes the browser
                                // script, not the client output: stylesheets
                                // and assets the server registers still land
                                // in dist/client.
                                input: hasUserClientInput ? undefined : clientEntry || undefined,
                            },
                        },
                    },
                    ssr: {
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

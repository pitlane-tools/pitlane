import type { Plugin } from "vite";

import { join } from "node:path";

import type { PrerenderOption } from "./prerender.ts";

import { prerender } from "./prerender.ts";

export interface BuildPluginOptions {
    clientEntry: string | false;
    serverEntry: string;
    prerender: PrerenderOption | undefined;
}

/**
 * Environment defaults and prerendering, as two plugins because `enforce`
 * moves every hook of a plugin. The defaults keep their place among the
 * user's plugins, so a platform plugin listed after `remix()` reads them in
 * its own `config` hook.
 *
 * Prerendering renders against the completed build, so it runs after the
 * post-ordered `buildApp` hooks of every plugin that is not itself
 * post-enforced: the asset plugin's, which writes the asset manifest, and
 * `@cloudflare/vite-plugin` 2's, which writes the Build Output its preview
 * server reads.
 */
export function build({
    clientEntry,
    serverEntry,
    prerender: paths,
}: BuildPluginOptions): Plugin[] {
    return [
        {
            name: "pitlane-remix-build",
            config(userConfig) {
                // Never clobber what the user configured themselves (plugin
                // config merges over user config): e.g. an index.html client
                // entry for a fully static SPA shell, or an output directory.
                let environments = userConfig.environments as
                    | Record<
                          string,
                          { build?: { outDir?: string; rollupOptions?: { input?: unknown } } }
                      >
                    | undefined;
                let hasUserClientInput = Boolean(environments?.client?.build?.rollupOptions?.input);
                let hasUserServerInput = Boolean(environments?.ssr?.build?.rollupOptions?.input);
                let rootOutDir = userConfig.build?.outDir ?? "dist";

                return {
                    appType: userConfig.appType ?? "custom",
                    // `vite build` runs the full multi-environment app build.
                    builder: {},
                    environments: {
                        client: {
                            build: {
                                outDir:
                                    environments?.client?.build?.outDir ??
                                    join(rootOutDir, "client"),
                                rollupOptions: {
                                    // `clientEntry: false` removes the browser
                                    // script, not the client output: stylesheets
                                    // and assets the server registers still land
                                    // in the client outDir.
                                    input: hasUserClientInput
                                        ? undefined
                                        : clientEntry || undefined,
                                },
                            },
                        },
                        ssr: {
                            build: {
                                outDir: environments?.ssr?.build?.outDir ?? join(rootOutDir, "ssr"),
                                rollupOptions: {
                                    input: hasUserServerInput ? undefined : { index: serverEntry },
                                },
                            },
                        },
                    },
                };
            },
        },
        {
            name: "pitlane-remix-prerender",
            enforce: "post",
            buildApp: {
                order: "post",
                async handler(builder) {
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
            },
        },
    ];
}

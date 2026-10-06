import type { ClientAddress, FetchHandler } from "@remix-run/node-fetch-server";
import type { Plugin } from "vite";

import { createRequestListener } from "@remix-run/node-fetch-server";
import { once } from "node:events";
import { isRunnableDevEnvironment } from "vite";

/** Options for {@link fetchServer}. */
export interface FetchServerOptions {
    /**
     * Path to the application's server module, resolved through the
     * environment's module runner, e.g. `"src/http.ts"`. Its default export
     * must be an object with a `fetch(request)` method.
     *
     * Required. It is never inferred from the environment's build inputs.
     */
    entry: string;
    /**
     * Vite environment whose module runner loads `entry`. It must be a
     * runnable environment, one whose modules run inside the dev server
     * process.
     *
     * @default "ssr"
     */
    environment?: string;
}

const PREFIX = "[@pitlane/vite-plugin-fetch-server]";

/**
 * Serves `vite dev` requests through the Fetch handler an application's server
 * module exports. Every request Vite does not answer itself goes to the
 * current `default.fetch` of `entry`, loaded through the environment's module
 * runner on each request, so an edit applies to the next request. Errors go to
 * Vite's development error page.
 *
 * Development only: the plugin takes no part in `vite build` or
 * `vite preview`. It sets `appType: "custom"` unless the config sets one.
 *
 * @param options - The server module and the environment that loads it; see {@link FetchServerOptions}
 * @returns The plugin, passed to Vite as one entry of `plugins`
 * @throws Error when `entry` is missing or empty
 * @throws Error at dev server startup when `environment` does not exist or is not runnable
 *
 * @see {@link https://pitlane.tools/guides/fetch-server | Fetch server guide}
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
 * import { defineConfig } from "vite";
 *
 * export default defineConfig({
 *     plugins: [fetchServer({ entry: "src/http.ts" })],
 * });
 * ```
 */
export function fetchServer(options: FetchServerOptions): Plugin {
    let { entry, environment: environmentName = "ssr" } = options;
    if (typeof entry !== "string" || entry === "") {
        throw new Error(
            `${PREFIX} fetchServer() requires \`entry\`, the path to your server module, ` +
                `e.g. fetchServer({ entry: "src/http.ts" }). It is never inferred from build inputs.`,
        );
    }

    return {
        name: "pitlane-fetch-server",
        apply: (_config, env) => env.command === "serve" && !env.isPreview,
        config(userConfig) {
            return { appType: userConfig.appType ?? "custom" };
        },
        configureServer(server) {
            let environment = server.environments[environmentName];
            if (environment === undefined) {
                let names = Object.keys(server.environments)
                    .map(name => `"${name}"`)
                    .join(", ");
                throw new Error(
                    `${PREFIX} fetchServer() environment "${environmentName}" does not exist. ` +
                        `This config has ${names}.`,
                );
            }
            if (!isRunnableDevEnvironment(environment)) {
                throw new Error(
                    `${PREFIX} fetchServer() environment "${environmentName}" is not a runnable ` +
                        `environment: its modules do not run inside the dev server process, so ` +
                        `this plugin cannot load "${entry}" there. An integration that owns its ` +
                        `runtime, such as @cloudflare/vite-plugin, serves that environment's ` +
                        `requests itself; remove fetchServer() from this config.`,
                );
            }
            let runner = environment.runner;

            // Returned, so it runs after Vite's own middleware: the application
            // only sees requests Vite and other plugins did not answer.
            return () => {
                server.middlewares.use(async (req, res, next) => {
                    let handler: FetchHandlerModule;
                    try {
                        let module: { default?: unknown } = await runner.import(entry);
                        if (!isFetchHandlerModule(module.default)) {
                            throw new Error(
                                `${PREFIX} "${entry}" must default-export an object with a ` +
                                    `fetch(request) method, and its default export has no fetch method.`,
                            );
                        }
                        handler = module.default;
                    } catch (error) {
                        next(error);
                        return;
                    }

                    // Vite strips its base from req.url; the handler gets the
                    // URL the client requested.
                    req.url = req.originalUrl ?? req.url;

                    let listener = createRequestListener(
                        // A method call keeps the default export as `this`. The
                        // fixed two-parameter arity also matters: the adapter
                        // picks its calling convention from `handler.length`.
                        (request: Request, client: ClientAddress) => handler.fetch(request, client),
                        {
                            // Hand the error to Vite's error middleware, then
                            // wait for it to finish the response so the adapter
                            // sends nothing of its own.
                            async onError(error) {
                                let closed = res.destroyed ? undefined : once(res, "close");
                                next(error);
                                await closed;
                            },
                        },
                    );
                    listener(req, res);
                });
            };
        },
    };
}

interface FetchHandlerModule {
    fetch: FetchHandler;
}

function isFetchHandlerModule(value: unknown): value is FetchHandlerModule {
    return (
        typeof value === "object" &&
        value !== null &&
        "fetch" in value &&
        typeof value.fetch === "function"
    );
}

import type { Plugin } from "vite";

/**
 * The server entry contract: the built SSR module default-exports an object
 * exposing `fetch(Request): Response | Promise<Response>` — a `createRouter()`
 * router, or a worker-style `{ fetch }` object wrapping one.
 */
interface FetchHandler {
    fetch(request: Request): Response | Promise<Response>;
}

function isFetchHandler(value: unknown): value is FetchHandler {
    return (
        typeof value === "object" &&
        value !== null &&
        "fetch" in value &&
        typeof value.fetch === "function"
    );
}

/**
 * Serves the production build through `vite preview` using the same SSR entry
 * that production deploys, adapted with `remix/node-fetch-server`.
 *
 * When the SSR bundle targets a non-Node runtime (e.g. Cloudflare Workers,
 * whose bundle imports `cloudflare:workers`), the dynamic import fails and the
 * plugin skips itself so the platform plugin's preview can take over. That
 * failure → skip contract is documented behavior, not an accident.
 */
export function preview(): Plugin {
    return {
        name: "remix-preview-server",
        async configurePreviewServer(server) {
            let ssrOutDir = server.config.environments.ssr?.build?.outDir ?? "dist/ssr";
            let entryPath = new URL(`${ssrOutDir}/index.js`, `file://${server.config.root}/`).href;

            let mod: { default?: unknown };
            try {
                // Dynamic by necessity: the specifier is a runtime-computed
                // path into the app's build output, and import failure is the
                // documented "non-Node bundle" signal handled below.
                mod = await import(/* @vite-ignore */ entryPath);
            } catch {
                // SSR bundle targets a non-Node runtime that provides its own
                // preview server. Skip.
                return;
            }

            let handler = mod.default;
            if (!isFetchHandler(handler)) {
                throw new Error(
                    `[@pitlane/dev] ${ssrOutDir}/index.js must default-export a fetch handler ` +
                        `(an object with fetch(request: Request)), e.g. \`export default router\`.`,
                );
            }

            // Dynamic by design: `remix` is a peer resolved from the app, and
            // it must load only when this preview path actually runs — never
            // at config load time.
            let { createRequestListener } = await import("remix/node-fetch-server");

            return () => {
                server.middlewares.use(
                    createRequestListener((request: Request) => handler.fetch(request)),
                );
            };
        },
    };
}

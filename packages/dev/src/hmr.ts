import type { Plugin } from "vite";

import MagicString from "magic-string";
import { resolve as resolvePath } from "node:path";
import { transformComponentsForBrowser, transformComponentsForServer } from "remix/ui-hmr";

/**
 * Component modules Remix authors as `.tsx`/`.jsx`. The `remix/ui-hmr` transform
 * self-guards (it returns the source unchanged when a module holds no
 * `function`-form component or `clientEntry`), so this filter only trims the
 * common non-candidates — non-JSX source, query variants like `?assets=`, and
 * dependencies — before the parse cost.
 */
const COMPONENT_ID_FILTER = /\.[jt]sx$/;

/** Custom Vite HMR event that asks the browser to revalidate server-rendered data. */
const SERVER_UPDATE_EVENT = "pitlane:server-update";

const DEV_CLIENT_ID = "virtual:pitlane-dev/server-data-hmr";
const RESOLVED_DEV_CLIENT_ID = `\0${DEV_CLIENT_ID}`;

/**
 * Instruments `function`-form Remix UI components and `clientEntry()` exports
 * with the `remix/ui-hmr` transforms so component edits hot-swap in place while
 * preserving live component state.
 *
 * The browser transform runs in the client environment and the server transform
 * in the server environment(s); both emit the standard `import.meta.hot.accept()`
 * protocol that Vite's own HMR runtime drives. Components authored as arrow
 * functions are left untouched by design (`ui-hmr` requires named function
 * forms to keep identity stable) — those modules fall back to a server-data
 * reload.
 *
 * Dev-only: production builds never carry the wrapper indirection or the runtime
 * imports.
 */
export function componentHmr(serverEnvironments: Set<string>): Plugin {
    return {
        name: "pitlane-remix-component-hmr",
        apply: "serve",
        transform: {
            filter: {
                id: {
                    include: COMPONENT_ID_FILTER,
                    exclude: /\/node_modules\//,
                },
            },
            handler(code, id) {
                let result = serverEnvironments.has(this.environment.name)
                    ? transformComponentsForServer(code, {
                          importSource: "remix",
                          moduleUrl: id,
                          sourceMap: true,
                      })
                    : transformComponentsForBrowser(code, {
                          importSource: "remix",
                          moduleUrl: id,
                          sourceMap: true,
                      });

                if (!result.transformed) return;

                return { code: result.code, map: result.map };
            },
        },
    };
}

/**
 * Server-side data HMR: when a server-only module changes, the browser
 * revalidates its server-rendered content without a full reload, keeping
 * hydrated client-entry state intact — the Remix 3 analog of React Router's
 * loader/action hot revalidation.
 *
 * Two halves cooperate:
 *
 * - A `hotUpdate` hook on the server environment(s) detects changes to modules
 *   that live only in the server graph and broadcasts a `pitlane:server-update`
 *   event. Changes to modules that also live in the client graph are left to the
 *   client component-HMR boundary, so a `function`-form component edit still
 *   hot-swaps instantly instead of triggering a network reload.
 * - A virtual client module, injected into the client entry, listens for the
 *   event and re-navigates to the current URL. That routes through the Remix
 *   frame runtime, which re-fetches the server-rendered HTML and reconciles it
 *   in place — preserving hydrated component state the way `router.revalidate()`
 *   does under React Router.
 *
 * Dev-only, and only meaningful when a client entry exists (a fully
 * server-rendered app has no client state to preserve).
 */
export function serverDataHmr(serverEnvironments: Set<string>, clientEntry: string): Plugin {
    return {
        name: "pitlane-remix-server-data-hmr",
        apply: "serve",

        resolveId(id) {
            if (id === DEV_CLIENT_ID) return RESOLVED_DEV_CLIENT_ID;
        },

        load(id) {
            if (id === RESOLVED_DEV_CLIENT_ID) return DEV_CLIENT_SOURCE;
        },

        transform: {
            filter: { id: { include: /\.[jt]sx?$/, exclude: /\/node_modules\// } },
            handler(code, id) {
                if (serverEnvironments.has(this.environment.name)) return;
                if (!isEntryModule(id, this.environment.config.root, clientEntry)) return;

                let rewritten = new MagicString(code);
                rewritten.prepend(`import ${JSON.stringify(DEV_CLIENT_ID)};\n`);

                return {
                    code: rewritten.toString(),
                    map: rewritten.generateMap({ hires: "boundary", source: id }),
                };
            },
        },

        hotUpdate({ modules, server }) {
            if (!serverEnvironments.has(this.environment.name)) return;
            if (modules.length === 0) return;

            let clientGraph = server.environments.client?.moduleGraph;
            let hasServerOnlyChange = modules.some(mod => {
                if (!mod.file) return true;
                let clientModules = clientGraph?.getModulesByFile(mod.file);
                return !clientModules || clientModules.size === 0;
            });
            if (!hasServerOnlyChange) return;

            server.hot.send({ type: "custom", event: SERVER_UPDATE_EVENT });
        },
    };
}

/**
 * Client runtime for {@link serverDataHmr}. On a `pitlane:server-update` event it
 * re-navigates to the current URL through the Remix frame runtime, coalescing
 * overlapping reloads. Falls back to a full page reload when the frame runtime
 * cannot handle the navigation (e.g. no Navigation API).
 */
const DEV_CLIENT_SOURCE = `import { navigate } from "remix/ui";

if (import.meta.hot) {
    let inFlight = false;
    let queued = false;

    async function revalidate() {
        if (inFlight) {
            queued = true;
            return;
        }
        inFlight = true;
        try {
            await navigate(location.href, { history: "replace", resetScroll: false });
        } catch {
            location.reload();
            return;
        } finally {
            inFlight = false;
        }
        if (queued) {
            queued = false;
            revalidate();
        }
    }

    import.meta.hot.on(${JSON.stringify(SERVER_UPDATE_EVENT)}, revalidate);
}
`;

/**
 * Matches a resolved module id against the configured client entry, which the
 * user supplies without an extension (e.g. `"app/entry.browser"`).
 */
function isEntryModule(id: string, root: string, entry: string): boolean {
    let withoutQuery = id.split("?")[0];
    let withoutExtension = withoutQuery.replace(/\.[jt]sx?$/, "");
    let target = resolvePath(root, entry);
    return withoutExtension === target;
}

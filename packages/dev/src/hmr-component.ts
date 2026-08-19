import type { Plugin } from "vite";

import { SERVER_UPDATE_EVENT } from "./hmr-protocol.ts";

/** Public specifier apps import the dev HMR component from. */
const PUBLIC_ID = "pitlane:dev";
const ISLAND_ID = `\0${PUBLIC_ID}`;
const INERT_ID = `\0${PUBLIC_ID}?inert`;

/**
 * The `clientEntry()` transform asks a module for its own client URL through
 * `?assets=client` on its resolved id. This module answers for itself.
 */
const ISLAND_ASSETS_ID = `${ISLAND_ID}?assets=client`;
const RESOLVED_ISLAND_ASSETS_ID = `\0${PUBLIC_ID}?island-assets`;

/**
 * Serves the `<HMR />` component apps render in their document, which drives
 * server-data revalidation.
 *
 * The specifier is an indirection the plugin repoints by mode. During `vite dev`
 * it is a hydrated island whose handle reaches the top frame. In a build, and in
 * apps with no client runtime to hydrate it, it is a component that renders
 * nothing, so `<HMR />` can stay in the document unconditionally and cost
 * nothing in production.
 *
 * Kept virtual rather than shipped as a file on disk: a file inside the package
 * resolves outside the app's root, and the dev server hands out a `file://` URL
 * for those, which a browser refuses to import.
 */
export function hmrComponent(clientEntry: string | false): Plugin {
    return {
        name: "pitlane-remix-hmr-component",
        // Ahead of the asset-manifest plugin, which would otherwise try to
        // resolve this module's `?assets=client` query against the file system.
        enforce: "pre",

        resolveId(id) {
            if (id === ISLAND_ASSETS_ID) return RESOLVED_ISLAND_ASSETS_ID;
            if (id !== PUBLIC_ID) return;
            if (this.environment.mode === "build" || clientEntry === false) return INERT_ID;
            return ISLAND_ID;
        },

        load(id) {
            if (id === INERT_ID) return INERT_SOURCE;
            if (id === ISLAND_ID) return ISLAND_SOURCE;
            if (id === RESOLVED_ISLAND_ASSETS_ID) {
                return islandAssetsSource(this.environment.config.base);
            }
        },
    };
}

/** A component that renders nothing and carries no client code. */
const INERT_SOURCE = `export const HMR = () => () => null;\n`;

/**
 * The island. Revalidates by reloading its top frame, which refetches the page
 * through the app's fetch handler and reconciles it, with no navigation
 * involved. Overlapping revalidations collapse into one follow-up.
 *
 * Renders nothing: it contributes markup only as the hydration marker Remix
 * emits around it, which is what gives it a handle in the browser.
 */
const ISLAND_SOURCE = `import { clientEntry } from "remix/ui";

export const HMR = clientEntry(import.meta.url, function HMR(handle) {
    if (import.meta.hot) {
        let inFlight = false;
        let queued = false;

        let revalidate = async () => {
            if (inFlight) {
                queued = true;
                return;
            }
            inFlight = true;
            try {
                await handle.frames.top.reload();
            } finally {
                inFlight = false;
            }
            if (queued) {
                queued = false;
                await revalidate();
            }
        };

        import.meta.hot.on(${JSON.stringify(SERVER_UPDATE_EVENT)}, () => void revalidate());
    }

    return () => null;
});
`;

/**
 * The island's own `?assets=client` answer: the dev-server URL for a virtual
 * module, which is what the server writes into the hydration marker for the
 * browser to import.
 */
function islandAssetsSource(base: string): string {
    let prefix = base.endsWith("/") ? base : `${base}/`;
    let url = `${prefix}@id/__x00__${PUBLIC_ID}`;
    return `export default { entry: ${JSON.stringify(url)}, js: [], css: [] };\n`;
}

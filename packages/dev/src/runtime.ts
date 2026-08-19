/**
 * Server- and client-safe runtime helpers for the `?assets=` import
 * convention. Import from `@pitlane/dev/runtime` in application code.
 *
 * @module @pitlane/dev/runtime
 */
import { mergeAssets as mergeAssetsImpl } from "@hiogawa/vite-plugin-fullstack/runtime";

import { REVALIDATION_CLAIM, SERVER_UPDATE_EVENT } from "./hmr-protocol.ts";

/**
 * The result shape of a `?assets=` import: the resolved entry URL (client
 * environment only), plus the JS and CSS assets reachable from the imported
 * module in that environment.
 *
 * During dev, `js` is always empty (no chunk graph exists yet) and
 * `?assets=client` carries no CSS — Vite injects dev styles itself; the
 * server-environment results carry `data-vite-dev-id` stylesheet links.
 */
export interface ImportedAssets {
    entry?: string;
    js: Array<{ href: string }>;
    css: Array<{ href: string; "data-vite-dev-id"?: string }>;
    merge(...results: ImportedAssets[]): ImportedAssets;
}

/**
 * Merges multiple `?assets=` results, deduplicating `js` and `css` entries by
 * href. Typical use: combining the client entry's assets with the SSR
 * module's CSS inside a `<Document>` component.
 *
 * The annotation re-types the delegated implementation against Pitlane-owned
 * shapes so the dependency never appears in this package's public types.
 */
export const mergeAssets: (...results: ImportedAssets[]) => ImportedAssets = mergeAssetsImpl;

/**
 * The part of a Remix UI `Handle` that {@link acceptServerUpdates} needs. Typed
 * structurally so `remix` never appears in this package's public types; any
 * component `handle` satisfies it.
 */
export interface RevalidationHandle {
    frames: { readonly top: { reload(): unknown } };
}

interface DevHot {
    on(event: string, handler: () => void): void;
}

/**
 * Revalidates this app's server-rendered content through the component's top
 * frame whenever a server-only module changes during `vite dev`. Call it in the
 * setup scope of any hydrated `clientEntry()` island:
 *
 * ```tsx
 * export const Counter = clientEntry(import.meta.url, handle => {
 *     acceptServerUpdates(handle);
 *     // ...
 * });
 * ```
 *
 * A direct frame reload refetches the page through the app's fetch handler and
 * reconciles it, which is what revalidation means. It performs no navigation, so
 * it produces no history entry, fires no `navigate` events, and keeps working in
 * apps that intercept navigation themselves. Registering it also tells the
 * plugin's injected fallback to stand down.
 *
 * Inert outside `vite dev`: `import.meta.hot` is undefined in a production
 * build, and island setup that runs during SSR exits before touching a frame.
 */
export function acceptServerUpdates(handle: RevalidationHandle): void {
    let hot = (import.meta as { hot?: DevHot }).hot;
    if (!hot) return;
    if (!("document" in globalThis)) return;

    (globalThis as unknown as Record<string, boolean>)[REVALIDATION_CLAIM] = true;

    let inFlight = false;
    let queued = false;

    async function revalidate(): Promise<void> {
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
    }

    hot.on(SERVER_UPDATE_EVENT, () => void revalidate());
}

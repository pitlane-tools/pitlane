/**
 * Browser-side half of server-data HMR. Import from `@pitlane/dev/hmr` in the
 * app's browser entry.
 *
 * @see {@link https://pitlane.tools/guides/hmr#setup | HMR guide: Setup}
 *
 * @module @pitlane/dev/hmr
 */
import type { AppRuntime } from "remix/component";

/**
 * Applies a server update to the page: waits for initial hydration, then
 * reloads the runtime's top frame, which refetches the current page through
 * the app's fetch handler and reconciles it in place.
 *
 * Call it from the browser entry's `server:update` listener:
 *
 * ```ts
 * if (import.meta.hot) {
 *     import.meta.hot.on("server:update", () => revalidate(app));
 * }
 * ```
 *
 * It returns nothing on purpose. Vite handles HMR messages one at a time and
 * waits for the promise a listener returns, so returning the pending reload
 * would hold back the next update until it settled. A newer reload supersedes
 * an older one, which Remix aborts. A failed reload is logged, and the next
 * update tries again.
 *
 * @param app - The runtime `run()` returned
 */
export function revalidate(app: AppRuntime): void {
    void reloadTopFrame(app);
}

async function reloadTopFrame(app: AppRuntime): Promise<void> {
    try {
        await app.ready();
        await app.frames.top.reload();
    } catch (error) {
        console.error("[pitlane] Failed to apply server update:", error);
    }
}

import { run } from "remix/component";

/**
 * Hydrates the `clientEntry` components on the page.
 *
 * `loadModule` is how the runtime fetches the module a hydration marker names;
 * with a bundler those URLs are built assets, so an ordinary dynamic import is
 * all it takes.
 */
let app = run({
    async loadModule(moduleUrl: string, exportName: string) {
        let module = (await import(/* @vite-ignore */ moduleUrl)) as Record<string, () => unknown>;
        return module[exportName]!;
    },
});

// During `vite dev`, @pitlane/dev broadcasts `pitlane:server-update` when a
// server-only module changes. Reloading the top frame refetches the page through
// the app's fetch handler and reconciles it in place. Overlapping updates
// collapse into one follow-up. Builds drop this branch entirely.
if (import.meta.hot) {
    let inFlight = false;
    let queued = false;

    let revalidate = async (): Promise<void> => {
        if (inFlight) {
            queued = true;
            return;
        }
        inFlight = true;
        try {
            await app.ready();
            await app.frames.top.reload();
        } catch (error) {
            console.error("[pitlane] Failed to apply server update:", error);
        } finally {
            inFlight = false;
        }
        if (queued) {
            queued = false;
            await revalidate();
        }
    };

    import.meta.hot.on("pitlane:server-update", () => void revalidate());
}

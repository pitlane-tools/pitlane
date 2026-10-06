import { run } from "remix/component";

// Recorded so the browser suite can assert which revalidation mechanism ran: a
// navigation fallback shows up here, a direct frame reload does not.
let navigations: string[] = [];
(globalThis as unknown as { __navigations: string[] }).__navigations = navigations;
navigation.addEventListener("navigate", event => {
    navigations.push(event.navigationType);
});

let app = run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
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

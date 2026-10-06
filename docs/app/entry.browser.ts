import { run } from "remix/component";
import "virtual:expressive-code.css";
import "virtual:expressive-code.js";

import "./styles/code-font.css";
import "./home/type.css";
import { resolveDocument } from "./browser/navigation.ts";
import { migrateLegacyCookies } from "./browser/preferences.ts";

// Before hydration, so the components adopt the choices the previous reader left behind.
migrateLegacyCookies();

// In-page fragment links stay with the browser: the runtime would otherwise
// fetch the whole document again for a same-document `#section` navigation.
window.navigation?.addEventListener("navigate", event => {
    if (event.hashChange) event.stopImmediatePropagation();
});

let app = run({
    // Client entries name their module at hydration time, so the specifier is only known at runtime.
    async loadModule(moduleUrl, exportName) {
        let module = await import(/* @vite-ignore */ moduleUrl);
        return module[exportName];
    },
    resolveFrame: resolveDocument,
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

import { revalidate } from "@pitlane/dev/hmr";
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

// Server-only edits during `vite dev` refetch the page in place.
if (import.meta.hot) {
    import.meta.hot.on("server:update", () => revalidate(app));
}

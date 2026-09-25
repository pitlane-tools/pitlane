import { run } from "remix/ui";

import { resolveDocument } from "./browser/navigation.ts";
import { migrateLegacyPreferences, rerenderAfterMigration } from "./browser/preferences.ts";

// Before anything else can submit a preference, so the reader's own later
// choices always win over the storage the previous site left behind.
let migrated = migrateLegacyPreferences();

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

if (migrated) rerenderAfterMigration(app);

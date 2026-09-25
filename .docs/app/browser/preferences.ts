import type { AppRuntime } from "remix/ui";

import {
    PREFERENCE_CHOICES,
    PREFERENCE_COOKIES,
    PREFERENCE_MAX_AGE,
    type Preferences,
} from "../document.ts";
import { readStorage, writeStorage } from "./storage.ts";

type PreferenceKey = keyof Preferences;

/**
 * Where the VitePress site kept each choice. Its stored appearance is not
 * here: the site follows the operating system's color scheme.
 */
const LEGACY_STORAGE: Record<PreferenceKey, string> = {
    packageManager: "pitlane-package-manager",
    buildMode: "pitlane-build-mode",
};

function hasCookie(key: PreferenceKey): boolean {
    return document.cookie
        .split(/;\s*/)
        .some(cookie => cookie.startsWith(`${PREFERENCE_COOKIES[key]}=`));
}

/** Migrate before navigation starts so later explicit submissions win. */
export function migrateLegacyPreferences(): boolean {
    let migrated = false;
    for (let key of Object.keys(LEGACY_STORAGE) as PreferenceKey[]) {
        let legacyKey = LEGACY_STORAGE[key];
        let value = readStorage(legacyKey);
        if (value === null) continue;
        if (!hasCookie(key) && (PREFERENCE_CHOICES[key] as readonly string[]).includes(value)) {
            document.cookie = `${PREFERENCE_COOKIES[key]}=${value}; Path=/; Max-Age=${PREFERENCE_MAX_AGE}; SameSite=Lax; Secure`;
            // A browser refusing the cookie keeps the stored value for a later visit.
            if (!hasCookie(key)) continue;
            migrated = true;
        }
        writeStorage(legacyKey, null);
    }
    return migrated;
}

/** Refresh the initial response unless the reader already started another navigation. */
export function rerenderAfterMigration(app: AppRuntime): void {
    let interrupted = false;
    let listening = new AbortController();
    let interrupt = () => {
        interrupted = true;
    };
    document.addEventListener("submit", interrupt, { capture: true, signal: listening.signal });
    window.navigation?.addEventListener(
        "navigate",
        event => {
            if (!event.hashChange) interrupt();
        },
        { signal: listening.signal },
    );
    void app.ready().then(() => {
        listening.abort();
        if (!interrupted) void app.frames.top.reload();
    });
}

import type { ScriptEntry } from "remix/assets";

import * as path from "node:path";
import { getContext } from "remix/middleware/async-context";
import { type Middleware, createContextKey } from "remix/router";

import { assets } from "#/utils/assets.ts";

interface AssetEntry {
    scriptEntry: ScriptEntry;
    stylesheetHref: string;
}

let assetEntryKey = createContextKey<AssetEntry>();
let defaultScriptEntry = path.resolve(import.meta.dirname, "../public/entry.browser.ts");
let defaultStylesheetEntry = path.resolve(import.meta.dirname, "../public/index.css");

/**
 * Resolves the document's own browser assets for the current request.
 *
 * The components a page hydrates are resolved separately, by the renderer, as
 * it meets them. This is only the pair every page needs: the script that
 * starts the runtime, and the stylesheet.
 */
export function loadAssetEntry(
    scriptEntry = defaultScriptEntry,
    stylesheetEntry = defaultStylesheetEntry,
): Middleware<{ key: typeof assetEntryKey; value: AssetEntry }> {
    return async (context, next) => {
        let [resolvedScriptEntry, stylesheetHref] = await Promise.all([
            assets.getScriptEntry(scriptEntry),
            assets.getHref(stylesheetEntry),
        ]);

        context.set(assetEntryKey, { scriptEntry: resolvedScriptEntry, stylesheetHref });
        return next();
    };
}

export function getAssetEntry(): AssetEntry {
    return getContext().get(assetEntryKey);
}

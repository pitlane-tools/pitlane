import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

/** Resolves browser entries and islands to what the build emitted; `render({ assets })` reads it too. */
export let assets = createAssetResolver(manifest);

export let scriptEntry = await assets.getScriptEntry("app/entry.browser.ts");
/** The browser entry's stylesheets after a build; in dev, Vite injects them from the script. */
export let stylesheets = await assets.getStylesheets("app/entry.browser.ts");

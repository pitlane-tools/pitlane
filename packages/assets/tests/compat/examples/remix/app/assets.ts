import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

export let assets = createAssetResolver(manifest);

// Module-level reads: the literals register the browser entry and the
// document stylesheet; the server graph supplies route and island CSS.
export let scriptEntry = await assets.getScriptEntry("app/entry.browser.ts");
export let stylesheetHref = await assets.getHref("app/root.css");
export let stylesheets = await assets.getStylesheets("app/entry.server.tsx");

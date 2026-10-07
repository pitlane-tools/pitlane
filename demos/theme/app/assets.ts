import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

/** What the build emitted for each source module, read by the document and by `render({ assets })`. */
export let assets = createAssetResolver(manifest);

export let stylesheetHref = await assets.getHref("app/index.css");
/** Stylesheets the server's modules import. */
export let stylesheets = await assets.getStylesheets("app/entry.server.tsx");

// The "pitlane" theme and router for typedoc-plugin-markdown: one page per
// public module and per top-level export, root-relative links, a site-wide
// reference manifest, and compatibility anchors for the fragments the old
// module-sized pages had. See lib/ for the pieces.
import { Converter } from "typedoc";

import { writeSiteManifests } from "./lib/manifest.mjs";
import { nameModulesAfterExports } from "./lib/modules.mjs";
import { SymbolRouter } from "./lib/router.mjs";
import { importBlock, SymbolTheme } from "./lib/theme.mjs";

/** @param {import("typedoc-plugin-markdown").MarkdownApplication} app */
export function load(app) {
    app.converter.on(Converter.EVENT_RESOLVE_BEGIN, context => {
        nameModulesAfterExports(context.project, app.options.getValue("entryModule"));
    });
    app.renderer.defineTheme("pitlane", SymbolTheme);
    app.renderer.defineRouter("pitlane", SymbolRouter);
    app.renderer.markdownHooks.on("content.begin", importBlock);
    writeSiteManifests(app.renderer);
}

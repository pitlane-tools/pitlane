// The "pitlane" theme and router for typedoc-plugin-markdown: one page per
// public module and per top-level export, root-relative links, a site-wide
// reference manifest, and compatibility anchors for the fragments the old
// module-sized pages had. See lib/ for the pieces.
import type { DeclarationReflection } from "typedoc";
import type { MarkdownApplication } from "typedoc-plugin-markdown";

import { Converter, ParameterType, ReflectionKind } from "typedoc";

import { writeSiteManifests } from "./lib/manifest.ts";
import { nameModulesAfterExports } from "./lib/modules.ts";
import { SymbolRouter } from "./lib/router.ts";
import { importBlock, SymbolTheme } from "./lib/theme.ts";

export function load(app: MarkdownApplication): void {
    app.options.addDeclaration({
        name: "summarizeInheritedFrom",
        help: "Base types whose inherited members a page counts instead of listing.",
        type: ParameterType.Array,
        defaultValue: [],
    });
    app.converter.on(Converter.EVENT_RESOLVE_BEGIN, context => {
        // typedoc-plugin-markdown declares this option without adding it to TypeDoc's option map.
        nameModulesAfterExports(context.project, app.options.getValue("entryModule") as string);
        // A variable's initializer is its implementation, not its contract:
        // TypeDoc keeps one only when it is a bare name or literal, and a bare
        // name is exactly the private binding a declared type exists to hide.
        for (let variable of context.project.getReflectionsByKind(ReflectionKind.Variable)) {
            delete (variable as DeclarationReflection).defaultValue;
        }
    });
    app.renderer.defineTheme("pitlane", SymbolTheme);
    app.renderer.defineRouter("pitlane", SymbolRouter);
    app.renderer.markdownHooks.on("content.begin", importBlock);
    writeSiteManifests(app.renderer);
}

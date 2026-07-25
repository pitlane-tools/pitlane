// Local typedoc-plugin-markdown extensions ("pitlane" theme + router), working
// around two behaviors of the upstream plugin (4.12.0) with our config
// (entryModule + readme: "none" + sibling subpath modules):
//
// 1. Page titles: the router never assigns the project reflection a URL
//    (markdown-router.js only calls `fullUrls.set(project, ...)` when a readme
//    page exists). `urlTo()` then returns "" for the project AND for any
//    page's link to itself, so on every module page
//    `urlTo(page.model) === urlTo(page.project)` and the pageTitle partial
//    mistakes the page for the project index, titling it with the project
//    name — @pitlane/dev/runtime rendered as "# @pitlane/dev". The theme
//    renders non-entry module pages with their own module name instead.
//
// 2. File paths: module file paths are the raw module name, so the
//    @pitlane/dev/runtime page lands at <out>/@pitlane/dev/runtime.md and the
//    site serves /package/dev/@pitlane/dev/runtime. The router strips the
//    entryModule prefix so subpath modules sit at the out-dir root:
//    <out>/runtime.md -> /package/dev/runtime.
import { ReflectionKind } from "typedoc";
import { MarkdownTheme, ModuleRouter } from "typedoc-plugin-markdown";

/** @param {import("typedoc-plugin-markdown").MarkdownApplication} app */
export function load(app) {
    app.renderer.defineTheme(
        "pitlane",
        class extends MarkdownTheme {
            getRenderContext(page) {
                const context = super.getRenderContext(page);
                const pageTitle = context.partials.pageTitle;
                context.partials.pageTitle = () => {
                    const { model } = page;
                    const isMistitledModulePage =
                        model.kind === ReflectionKind.Module &&
                        model.name !== app.options.getValue("entryModule");
                    return isMistitledModulePage ? model.name : pageTitle();
                };
                return context;
            }
        },
    );

    app.renderer.defineRouter(
        "pitlane",
        class extends ModuleRouter {
            getIdealBaseName(reflection) {
                const baseName = super.getIdealBaseName(reflection);
                const prefix = `${this.entryModule}/`;
                return baseName.startsWith(prefix) ? baseName.slice(prefix.length) : baseName;
            }
        },
    );
}

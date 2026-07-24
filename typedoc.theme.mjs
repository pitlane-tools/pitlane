// Works around a typedoc-plugin-markdown bug (present in 4.12.0): with
// `entryModule` set and `readme: "none"`, the router never assigns the project
// reflection a URL (markdown-router.js only calls `fullUrls.set(project, ...)`
// when a readme page exists). `urlTo()` then returns "" for the project AND
// for any page's link to itself, so on every module page
// `urlTo(page.model) === urlTo(page.project)` and the pageTitle partial
// mistakes the page for the project index, titling it with the project name —
// `@pitlane/dev/runtime` rendered as "# @pitlane/dev".
//
// Fix: render non-entry module pages with their own module name.
import { ReflectionKind } from "typedoc";
import { MarkdownTheme } from "typedoc-plugin-markdown";

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
}

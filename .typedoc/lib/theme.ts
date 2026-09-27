import type { DeclarationReflection, Options, ReferenceReflection, Reflection } from "typedoc";
import type { MarkdownPageEvent } from "typedoc-plugin-markdown";

import { ReflectionKind } from "typedoc";
import { MarkdownTheme, MarkdownThemeContext } from "typedoc-plugin-markdown";

import type { SymbolRouter } from "./router.ts";

import { legacyAnchors, legacySlug } from "./legacy-anchors.ts";
import { KIND_SEGMENTS } from "./router.ts";

/** An overview line: the name a module exports and the declaration it reaches. */
interface OverviewEntry {
    child: DeclarationReflection;
    target: DeclarationReflection;
}

export class SymbolTheme extends MarkdownTheme {
    getRenderContext(page: MarkdownPageEvent<Reflection>): SymbolThemeContext {
        return new SymbolThemeContext(this, page, this.application.options);
    }
}

export class SymbolThemeContext extends MarkdownThemeContext {
    // base.json pairs the pitlane theme with the pitlane router.
    declare router: SymbolRouter;

    constructor(theme: MarkdownTheme, page: MarkdownPageEvent<Reflection>, options: Options) {
        super(theme, page, options);
        let reflection = this.templates.reflection;
        this.templates.reflection = page =>
            this.router.modules.get(page.model) ? this.overview(page.model) : reflection(page);
        this.partials.pageTitle = () => this.page.model.name;
    }

    // Every link is root-relative, so a page reads the same wherever the
    // pipeline embeds it.
    urlTo(reflection: Reflection): string {
        return this.router.hasUrl(reflection)
            ? this.router.layout.urlOf(this.router.getFullUrl(reflection))
            : "";
    }

    overview(model: DeclarationReflection): string {
        let { name } = this.router.modules.get(model)!;
        let anchors = legacyAnchors(this);
        let currentHeadings = new Set([
            legacySlug(name),
            ...[...KIND_SEGMENTS.keys()].map(kind => legacySlug(ReflectionKind.pluralString(kind))),
        ]);
        let previousHeadings = (anchors.get(model) ?? [])
            .filter(anchor => !currentHeadings.has(anchor))
            .map(anchor => `<a id="${anchor}"></a>`);
        let md = [...previousHeadings, `# ${name}`];
        if (model.comment) {
            md.push(this.partials.comment(model.comment, { headingLevel: 2 }));
        }
        let groups = new Map<ReflectionKind, OverviewEntry[]>(
            [...KIND_SEGMENTS.keys()].map(kind => [kind, []]),
        );
        for (let child of model.children ?? []) {
            let target =
                child.kind === ReflectionKind.Reference
                    ? (child as ReferenceReflection).getTargetReflectionDeep()
                    : child;
            if (target && this.router.hasUrl(target) && groups.has(target.kind)) {
                // Every kind an overview groups is a declaration kind.
                groups.get(target.kind)!.push({ child, target: target as DeclarationReflection });
            }
        }
        for (let [kind, entries] of groups) {
            if (entries.length === 0) {
                continue;
            }
            md.push(`## ${ReflectionKind.pluralString(kind)}`);
            md.push(
                entries
                    .sort((a, b) => a.child.name.localeCompare(b.child.name))
                    .map(entry => this.overviewEntry(entry, anchors))
                    .join("\n"),
            );
        }
        return md.join("\n\n");
    }

    overviewEntry({ child, target }: OverviewEntry, legacy: Map<Reflection, string[]>): string {
        let anchors = (legacy.get(child) ?? []).map(anchor => `<a id="${anchor}"></a>`).join("");
        let link = `[${child.name}](${this.urlTo(target)})`;
        let alias = child.name === target.name ? "" : ` (alias of \`${target.name}\`)`;
        let comment = target.comment ?? target.signatures?.[0]?.comment;
        let description = comment ? this.helpers.getDescriptionForComment(comment) : null;
        return `- ${anchors}${link}${alias}${description ? `. ${description}` : ""}`;
    }
}

// The `content.begin` hook: how a symbol page's declaration is imported,
// through every public module that exports it.
export function importBlock(context: MarkdownThemeContext): string {
    let { model } = context.page;
    // base.json pairs the pitlane theme with the pitlane router.
    let { modules } = context.router as SymbolRouter;
    if (modules.get(model) || !modules.isTopLevel(model)) {
        return "";
    }
    let keyword = model.kindOf(ReflectionKind.Interface | ReflectionKind.TypeAlias)
        ? "import type"
        : "import";
    let lines = modules
        .exportsOf(model)
        .map(({ module, name }) => `${keyword} { ${name} } from "${module.name}";`);
    return ["```ts", ...lines, "```"].join("\n");
}

import { ReflectionKind } from "typedoc";
import { MarkdownTheme, MarkdownThemeContext } from "typedoc-plugin-markdown";

import { legacyAnchors, legacySlug } from "./legacy-anchors.mjs";
import { KIND_SEGMENTS } from "./router.mjs";

export class SymbolTheme extends MarkdownTheme {
    getRenderContext(page) {
        return new SymbolThemeContext(this, page, this.application.options);
    }
}

class SymbolThemeContext extends MarkdownThemeContext {
    constructor(theme, page, options) {
        super(theme, page, options);
        let reflection = this.templates.reflection;
        this.templates.reflection = page =>
            this.router.modules.get(page.model) ? this.overview(page.model) : reflection(page);
        this.partials.pageTitle = () => this.page.model.name;
    }

    // Every link is root-relative, so a page reads the same wherever the
    // pipeline embeds it.
    urlTo(reflection) {
        return this.router.hasUrl(reflection)
            ? this.router.layout.urlOf(this.router.getFullUrl(reflection))
            : "";
    }

    overview(model) {
        let { name } = this.router.modules.get(model);
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
        let groups = new Map([...KIND_SEGMENTS.keys()].map(kind => [kind, []]));
        for (let child of model.children ?? []) {
            let target =
                child.kind === ReflectionKind.Reference ? child.getTargetReflectionDeep() : child;
            if (target && this.router.hasUrl(target) && groups.has(target.kind)) {
                groups.get(target.kind).push({ child, target });
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

    overviewEntry({ child, target }, legacy) {
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
export function importBlock(context) {
    let { model } = context.page;
    let { modules } = context.router;
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

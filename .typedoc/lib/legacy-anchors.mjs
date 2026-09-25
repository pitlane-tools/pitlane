import MarkdownIt from "markdown-it";
import { MarkdownThemeContext } from "typedoc-plugin-markdown";

import { withOriginalModuleNames } from "./modules.mjs";

let markdown = new MarkdownIt({ html: true });

export function legacyAnchors(context) {
    let legacy = new MarkdownThemeContext(context.theme, context.page, context.options);
    legacy.router = context.router.legacy;
    legacy.hook = () => [];
    let members = new Map((context.page.model.children ?? []).map(member => [member.id, member]));
    let renderMember = legacy.partials.memberContainer;
    legacy.partials.memberContainer = (member, options) => {
        let body = renderMember(member, options);
        return members.has(member.id)
            ? `\n<!--pitlane-member:${member.id}-->\n\n${body}\n\n<!--pitlane-member:end-->\n`
            : body;
    };
    // Markdown's headings include nested fields that TypeDoc deliberately omits from its router.
    let source = withOriginalModuleNames(context.page.project, () =>
        legacy.templates.reflection(context.page),
    );
    return collectAnchors(markdown.parse(source, {}), members, context.page.model);
}

function collectAnchors(tokens, members, module) {
    let anchors = new Map();
    let used = new Set();
    let member = module;
    for (let [index, token] of tokens.entries()) {
        let marker =
            token.type === "html_block" && token.content.match(/^<!--pitlane-member:(\d+|end)-->/);
        if (marker) {
            member = members.get(Number(marker[1])) ?? module;
        }
        if (token.type !== "heading_open") continue;
        let title = tokens[index + 1].children
            .filter(child => !["html_inline", "emoji"].includes(child.type))
            .map(child => child.content)
            .join("");
        let base = legacySlug(title);
        let anchor = base;
        for (let suffix = 1; used.has(anchor); suffix++) anchor = `${base}-${suffix}`;
        used.add(anchor);
        if (member) {
            let found = anchors.get(member) ?? [];
            found.push(anchor);
            anchors.set(member, found);
        }
    }
    return anchors;
}

// VitePress's default heading normalization; existing inbound fragments depend on these rules.
export function legacySlug(title) {
    return title
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u0000-\u001f]/g, "")
        .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/^(\d)/, "_$1")
        .toLowerCase();
}

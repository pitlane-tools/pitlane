import { parse } from "yaml";

/**
 * A leading `---`-fenced block, and everything after it.
 *
 * The lazy body match takes the first closing fence, so a `---` thematic break
 * further down the document stays in the body.
 */
let fenced = /^---[^\S\n]*\r?\n([\s\S]*?)^---[^\S\n]*(?:\r?\n|$)/m;

/**
 * Splits a Markdown document's YAML frontmatter from its body.
 *
 * `@pitlane/content` parses frontmatter here rather than reading the one
 * `vite-plugin-satteri` also produces, so a prebuilt and a runtime-resolved
 * collection cannot disagree about an entry's data.
 */
export function splitFrontmatter(text: string): {
    data: Record<string, unknown>;
    body: string;
} {
    let match = fenced.exec(text);
    if (!match) return { data: {}, body: text };

    let data = parse(match[1]!) as Record<string, unknown> | null;
    return { data: data ?? {}, body: text.slice(match[0].length) };
}

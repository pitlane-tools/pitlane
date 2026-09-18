import { parse } from "yaml";

/**
 * A leading `---`-fenced block, and everything after it.
 *
 * Anchored with `\A`-style intent rather than `m`: with the multiline flag,
 * `^---` matches at any line start, so an ordinary document containing two
 * thematic breaks reads as a fenced block and loses both its data and the top
 * of its body. Only a fence at position zero is frontmatter.
 *
 * The body match is lazy, so a `---` break after real frontmatter stays in the
 * body rather than ending the block early.
 */
let fenced = /^---[^\S\n]*\r?\n([\s\S]*?)\r?\n?---[^\S\n]*(?:\r?\n|$)/;

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

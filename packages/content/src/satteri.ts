import { defineMdastPlugin, type MdastPluginEntry } from "satteri";

import type { Heading } from "./types.ts";

/**
 * The base slug for a heading with no letters or digits at all (`## ---`). An
 * empty `id` is invalid HTML and makes the anchor a bare `#`, which lands
 * nowhere; a fixed word plus the usual collision suffix keeps such headings
 * addressable and distinct.
 */
const FALLBACK_SLUG = "heading";

/**
 * The slug for `text`, kept distinct from every slug `taken` already holds by
 * suffixing `-1`, `-2`, … The map remembers the last suffix tried for a base so
 * a document of a hundred identical headings stays linear, and the loop covers
 * the case where the suffixed candidate is itself a real heading's slug.
 */
function uniqueSlug(text: string, taken: Map<string, number>): string {
    // Unicode letters and numbers, plus the combining marks that belong to
    // them: a Japanese or Cyrillic heading has to slug to its own text rather
    // than to nothing, and dropping marks would shatter Devanagari, Hebrew, and
    // Arabic words into bare consonants.
    let base = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
    if (!base) base = FALLBACK_SLUG;
    let suffix = taken.get(base) ?? 0;
    let slug = base;
    while (taken.has(slug)) {
        suffix += 1;
        slug = `${base}-${suffix}`;
    }
    taken.set(base, suffix);
    if (!taken.has(slug)) taken.set(slug, 0);
    return slug;
}

/**
 * Collects every heading of a document as `{ depth, slug, text }`, publishes the
 * list as `data.headings`, and gives each heading an `id` matching its slug so an
 * anchor link lands on it. On MDX the list is also appended to the tree as
 * `export const headings`, so the compiled module carries its own table of
 * contents.
 *
 * The plugin is a factory rather than a definition because Sätteri resolves a
 * factory once per compile: a single `headings()` shared by a whole build gets
 * fresh slug state per document, instead of the second document's `notes`
 * reading `notes-1`.
 */
export function headings(): MdastPluginEntry {
    return factoryContext => {
        let collected: Heading[] = [];
        let taken = new Map<string, number>();

        factoryContext.data.headings = collected;

        return defineMdastPlugin({
            name: "pitlane-headings",
            heading(node, context) {
                let text = context.textContent(node);
                let slug = uniqueSlug(text, taken);
                collected.push({ depth: node.depth, slug, text });
                context.setProperty(node, "data", { hProperties: { id: slug } });
            },
            after(root, context) {
                if (context.sourceFormat !== "mdx") return;
                context.appendChild(root, {
                    type: "mdxjsEsm",
                    value: `export const headings = ${JSON.stringify(collected)};`,
                });
            },
        });
    };
}

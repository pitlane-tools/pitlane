import type {
    HastPluginDefinition,
    HastPluginEntry,
    MdastPluginDefinition,
    MdastPluginEntry,
} from "satteri";

import type { Heading } from "./types.ts";

/**
 * The base slug for a heading that slugs to nothing at all, such as `## ***` or
 * `## 🎉`. GitHub answers the empty string there; an empty `id` is invalid HTML
 * and makes the anchor a bare `#`, which lands nowhere, so a fixed word plus
 * the usual collision suffix keeps such headings addressable and distinct. This
 * is the one case where these slugs are deliberately not GitHub's.
 */
const FALLBACK_SLUG = "heading";

/**
 * Every character GitHub's slugger removes: anything that is not alphabetic, a
 * combining mark, a decimal digit, connector punctuation, a space, or a hyphen.
 * Marks are kept because dropping them would shatter Devanagari, Hebrew, and
 * Arabic words into bare consonants; letters of every script are kept so a
 * Japanese or Cyrillic heading slugs to its own text rather than to nothing.
 *
 * `github-slugger` ships this set as a table generated from Unicode 13, while a
 * regular expression matches against whatever Unicode version the engine
 * carries. A character assigned after Unicode 13 therefore survives here and
 * would be stripped there; nothing assigned in Unicode 13 or earlier differs.
 */
const STRIPPED = /[^\p{Alphabetic}\p{M}\p{Nd}\p{Pc} -]/gu;

/**
 * The slug for `text`, built the way GitHub builds a heading's `id`: lowercase
 * it, remove every stripped character, then turn each remaining space into a
 * hyphen. Nothing is collapsed and nothing is trimmed, so `Databases & Data
 * Loading` slugs to `databases--data-loading` and `## ---` to `---`. Astro slugs
 * with the same algorithm, so a table of contents written by hand against
 * either of them keeps landing after a move to Pitlane.
 *
 * The result is then kept distinct from every slug `taken` already holds by
 * suffixing `-1`, `-2`, … The map remembers the last suffix tried for a base so
 * a document of a hundred identical headings stays linear, and the loop covers
 * the case where the suffixed candidate is itself a real heading's slug.
 */
function uniqueSlug(text: string, taken: Map<string, number>): string {
    let base = text.toLowerCase().replace(STRIPPED, "").replaceAll(" ", "-");
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
 *
 * The definition is written out rather than passed through Sätteri's
 * `defineMdastPlugin`, whose entire body checks that `name` is set. Calling it
 * would make this module import the `satteri` package, and `render.ts` imports
 * this module: a Worker bundle whose collections `contentLayer()` already prebuilt
 * would then have to resolve a native addon it can never load.
 */
export function headings(): MdastPluginEntry {
    return factoryContext => {
        let collected: Heading[] = [];
        let taken = new Map<string, number>();

        factoryContext.data.headings = collected;

        let definition: MdastPluginDefinition = {
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
        };
        return definition;
    };
}

/**
 * Hands a `<style>` element's CSS to Remix as markup rather than as text, so
 * the stylesheet survives being rendered.
 *
 * `@remix-run/ui` escapes `&`, `<`, and `>` in the text children of every
 * element except `<script>`, and emits an `innerHTML` prop verbatim. `<style>`
 * is a raw-text element, which is exactly the case where a browser does not
 * undo that escaping: a rule written `pre > code` reaches the page as
 * `pre &gt; code`, matches nothing, and says nothing. Expressive Code is how
 * most applications meet this, because it ships its theme as one such element.
 *
 * A workaround, not a design. The fix belongs in `@remix-run/ui`, which
 * already special-cases `<script>` and should treat `<style>` the same way.
 * `<script>` is deliberately not touched here: routing it through `innerHTML`
 * would skip `escapeScriptTextContent`, which keeps a `</script>` inside a
 * string from ending the element early.
 */
export function rawStyles(): HastPluginEntry {
    return factoryContext => {
        // Markdown serializes to an HTML string, where `<style>` is already
        // raw text. Only MDX becomes JSX that Remix renders, and an
        // `innerHTML` property on the string path would leak as an attribute.
        if (factoryContext.sourceFormat !== "mdx") return false;

        let definition: HastPluginDefinition = {
            name: "pitlane-raw-styles",
            element: {
                filter: ["style"],
                visit(node) {
                    let css = "";
                    for (let child of node.children) {
                        // An expression or a nested element is not text to
                        // hand over, and guessing at it would lose content.
                        if (child.type !== "text") return;
                        css += child.value;
                    }
                    if (!css) return;

                    return {
                        type: "element",
                        tagName: "style",
                        properties: { ...node.properties, innerHTML: css },
                        children: [],
                    };
                },
            },
        };
        return definition;
    };
}

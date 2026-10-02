/**
 * Sätteri plugins that Markdown and MDX entry bodies need:
 * {@link headings} collects the heading list `render()` returns, and
 * {@link rawStyles} keeps the CSS inside a `<style>` element intact. With a
 * Vite build, register both with `vite-plugin-satteri`; without one,
 * `render()` applies them itself.
 *
 * @see {@link https://pitlane.tools/guides/content | Content guide}
 *
 * @module
 */
import type {
    HastPluginDefinition,
    HastPluginEntry,
    MdastPluginDefinition,
    MdastPluginEntry,
    MdxJsxAttributeNode,
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
 * The mdast nodes a heading can hold, as far as reading their text needs:
 * leaves carry `value` and containers `children`.
 */
interface InlineNode {
    type: string;
    value?: string;
    children?: InlineNode[];
}

/**
 * The text a heading shows on the page, which is what GitHub and Astro slug.
 * Sätteri's `textContent` differs in three places: it keeps raw HTML tags as
 * text, includes image alt text, and reads every MDX expression as nothing.
 * Its options drop the first two, but an expression only carries its source,
 * so the walk is done here.
 *
 * Raw HTML nodes hold only the tags; the text between them is already its own
 * sibling node, so dropping `html` leaves the visible words. Images render no
 * text.
 */
function visibleText(node: InlineNode): string {
    switch (node.type) {
        case "html":
        case "image":
        case "imageReference":
            return "";
        case "mdxTextExpression":
            return stringLiteralValue(node.value ?? "") ?? "";
    }
    if (node.children) return node.children.map(visibleText).join("");
    return node.value ?? "";
}

/** A lone JavaScript string or template literal, surrounded by nothing but whitespace. */
const STRING_LITERAL =
    /^\s*(?:"((?:[^"\\\n\r]|\\[^])*)"|'((?:[^'\\\n\r]|\\[^])*)'|`((?:[^`\\$]|\\[^]|\$(?!\{))*)`)\s*$/;

/**
 * One escape sequence: a code point in either `\u` form, a `\x` byte, `\0` not
 * followed by a digit, a line continuation, or any other escaped character.
 */
const ESCAPE =
    /\\(?:u\{([\da-fA-F]+)\}|u([\da-fA-F]{4})|x([\da-fA-F]{2})|(0)(?!\d)|(\r\n|[\n\r\u2028\u2029])|([^]))/g;

const SINGLE_CHARACTER_ESCAPES: Record<string, string> = {
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
    v: "\v",
};

/**
 * The value of an MDX expression whose source is a lone string literal, such
 * as `{"{"}`, the usual way to write a brace in MDX text. `undefined` for any
 * other expression, whose value is only known once the module runs.
 *
 * Escapes decode as in a module, which is strict code: a legacy octal escape
 * such as `\1`, a `\8`, or a malformed `\x` or `\u` makes the literal invalid.
 */
function stringLiteralValue(source: string): string | undefined {
    let match = STRING_LITERAL.exec(source);
    if (!match) return undefined;
    let [, double, single, template] = match;
    // A template's raw line breaks read as `\n` whichever way they were saved.
    let body = double ?? single ?? template!.replace(/\r\n?/g, "\n");

    let valid = true;
    let value = body.replace(ESCAPE, (_, braced, unit, byte, nul, lineBreak, other: string) => {
        if (braced !== undefined) {
            let codePoint = Number.parseInt(braced, 16);
            if (codePoint <= 0x10ffff) return String.fromCodePoint(codePoint);
        } else if (unit !== undefined || byte !== undefined) {
            return String.fromCharCode(Number.parseInt(unit ?? byte, 16));
        } else if (nul !== undefined) {
            return "\0";
        } else if (lineBreak !== undefined) {
            return "";
        } else if (!/[ux\d]/.test(other)) {
            return SINGLE_CHARACTER_ESCAPES[other] ?? other;
        }
        valid = false;
        return "";
    });
    return valid ? value : undefined;
}

/**
 * Collects every heading of a document as `{ depth, slug, text }`, publishes the
 * list as `data.headings`, and gives each heading an `id` matching its slug so an
 * anchor link lands on it. A heading's text is the text it shows on the page,
 * as `visibleText` reads it. On MDX the list is also appended to the tree as
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
                let text = visibleText(node);
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
 * `base`, or `base` with the first numeric suffix from 2 that `source` does
 * not already spell as an identifier. Sätteri prints `\u0048`-style escapes
 * in identifiers as the characters they stand for, so they are decoded
 * first: `_rawStyle\u0048TML` in the source is `_rawStyleHTML` in the output.
 */
function unusedName(source: string, base: string): string {
    let decoded = source.replace(
        /\\u\{([\da-fA-F]+)\}|\\u([\da-fA-F]{4})/g,
        (escape, braced, short) => {
            let point = Number.parseInt(braced ?? short, 16);
            return point <= 0x10ffff ? String.fromCodePoint(point) : escape;
        },
    );
    let taken = new Set(decoded.match(/[$\p{ID_Continue}\u200c\u200d]+/gu));
    let name = base;
    for (let suffix = 2; taken.has(name); suffix++) name = `${base}${suffix}`;
    return name;
}

/**
 * Hands a `<style>` element's CSS to Remix as markup rather than as text, so
 * the stylesheet survives being rendered.
 *
 * `remix/component` escapes `&`, `<`, and `>` in the text children of every
 * element except `<script>`, and emits an `innerHTML` prop verbatim. `<style>`
 * is a raw-text element, which is exactly the case where a browser does not
 * undo that escaping: a rule written `pre > code` reaches the page as
 * `pre &gt; code`, matches nothing, and says nothing. Expressive Code is how
 * most applications meet this, because it ships its theme as one such element.
 *
 * `innerHTML` only accepts a value made by `unsafeHTML()`, so the element
 * becomes JSX whose prop calls it, and the document gains the import that
 * provides it. The CSS was already in the compiled document, so this trusts
 * nothing the document did not already ship.
 *
 * A workaround, not a design. The fix belongs in `remix/component`, which
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

        // The local name the added import binds `unsafeHTML` to, chosen on
        // first use so it meets no identifier the document already spells.
        let alias: string | undefined;
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

                    alias ??= unusedName(factoryContext.source, "_rawStyleHTML");
                    let attributes: MdxJsxAttributeNode[] = [];
                    for (let [name, value] of Object.entries(node.properties ?? {})) {
                        let attribute = jsxAttribute(name, value);
                        if (attribute) attributes.push(attribute);
                    }
                    attributes.push({
                        type: "mdxJsxAttribute",
                        name: "innerHTML",
                        value: {
                            type: "mdxJsxAttributeValueExpression",
                            value: `${alias}(${JSON.stringify(css)})`,
                        },
                    });
                    return { type: "mdxJsxFlowElement", name: "style", attributes, children: [] };
                },
            },
            after(root, context) {
                if (!alias) return;
                context.prependChild(root, {
                    type: "mdxjsEsm",
                    value: `import { unsafeHTML as ${alias} } from "remix/component";`,
                });
            },
        };
        return definition;
    };
}

/**
 * One HAST property as the JSX attribute Sätteri emits for it on an element:
 * `aria*` names lowercased after `aria-`, `data*` names in kebab case, lists
 * joined with spaces, `true` as a bare attribute, and `false` or nothing left
 * out. A `style` string stays a string, which Sätteri would turn into an object.
 */
function jsxAttribute(
    name: string,
    value: string | number | boolean | null | undefined | (string | number)[],
): MdxJsxAttributeNode | undefined {
    if (value === false || value === null || value === undefined) return;
    let attribute = name;
    if (/^aria[A-Z]/.test(name)) attribute = `aria-${name.slice(4).toLowerCase()}`;
    else if (/^data[^a-z]/.test(name)) {
        // `dataFooBar` is `data-foo-bar` and `data123` is `data-123`.
        let rest = name.slice(4).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
        attribute = `data${rest.startsWith("-") ? "" : "-"}${rest}`;
    }
    if (value === true) return { type: "mdxJsxAttribute", name: attribute, value: null };
    let text = Array.isArray(value) ? value.join(" ") : String(value);
    return { type: "mdxJsxAttribute", name: attribute, value: text };
}

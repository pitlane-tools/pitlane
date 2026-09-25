import type { HighlighterCore } from "shiki/core";

import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";

/** The languages a fenced example may name, by their canonical Shiki id. */
const LANGUAGES = [
    "shellscript",
    "typescript",
    "tsx",
    "javascript",
    "json",
    "jsonc",
    "yaml",
    "html",
    "dockerfile",
    "toml",
    "markdown",
] as const;

const PLAIN = "text";

/** Every token carries both colors; the stylesheet picks one per theme. */
const THEMES = { light: "github-light", dark: "github-dark" } as const;

let highlighter: HighlighterCore = createHighlighterCoreSync({
    engine: createJavaScriptRegexEngine(),
    langs: await Promise.all(
        LANGUAGES.map(async language => (await bundledLanguages[language]()).default),
    ),
    themes: await Promise.all(
        Object.values(THEMES).map(async theme => (await bundledThemes[theme]()).default),
    ),
});

/**
 * One example as a highlighted `<pre class="shiki">`, carrying the language
 * the fence named as `data-language`, which is what the Markdown export writes
 * back onto the fence.
 *
 * A fence with no language is plain text. A language nobody loaded is an
 * authoring error, reported with the document's name rather than from inside
 * a compile that has none.
 */
export function highlight(code: string, language: string | undefined, where: string): string {
    let lang = language || PLAIN;
    if (lang !== PLAIN && !highlighter.getLoadedLanguages().includes(lang)) {
        throw new Error(
            `${where} has a "${lang}" code block, which no loaded language covers. ` +
                `Add it to LANGUAGES in .docs/build/highlight.ts.`,
        );
    }
    return highlighter.codeToHtml(code, {
        lang,
        themes: THEMES,
        defaultColor: false,
        transformers: language
            ? [{ pre: node => void (node.properties["data-language"] = language) }]
            : [],
    });
}

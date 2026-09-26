import { ExpressiveCode, loadShikiTheme } from "expressive-code";
import { h, selectAll, toHtml } from "expressive-code/hast";
import { bundledLanguages } from "shiki/langs";

import { t } from "../app/theme.ts";

let engine = new ExpressiveCode({
    themes: [await loadShikiTheme("github-light"), await loadShikiTheme("github-dark")],
    themeCssSelector: false,
    useDarkModeMediaQuery: true,
    frames: { extractFileNameFromCode: false, removeCommentsWhenCopyingTerminalFrames: false },
    styleOverrides: { codeFontFamily: t.font.mono, frames: { frameBoxShadowCssValue: "none" } },
});

/**
 * Preserves displayed code and fence language for copying and exports; unknown languages fail with source context.
 * `meta` takes Expressive Code's per-block options, such as `frame="none"`.
 */
export async function renderCode(
    code: string,
    language: string | undefined,
    where: string,
    meta = "",
): Promise<string> {
    let lang = language || "text";
    if (!["text", "txt", "plaintext"].includes(lang) && !Object.hasOwn(bundledLanguages, lang)) {
        throw new Error(`${where} has an unsupported code language: "${lang}".`);
    }
    let { renderedGroupAst, renderedGroupContents, styles } = await engine.render({
        code,
        language: lang,
        meta,
    });
    let displayed = renderedGroupContents[0].codeBlock.code;
    for (let pre of selectAll("pre", renderedGroupAst)) {
        pre.properties.dataLanguage = language ?? "";
    }
    for (let button of selectAll("button[data-code]", renderedGroupAst)) {
        button.properties.dataCode = displayed.replace(/\n/g, "\u007f");
    }
    for (let control of selectAll(".header, .copy", renderedGroupAst)) {
        control.properties.dataPagefindIgnore = true;
    }
    // Remix scans raw HTML for closing document tags, including inside quoted attributes.
    let html = toHtml(renderedGroupAst).replace(
        /(<button\b[^>]*\bdata-code=")([^"]*)/g,
        (_attribute, prefix: string, code: string) =>
            prefix + code.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    );
    return [...styles].map(style => toHtml(h("style", style))).join("") + html;
}

/** The stylesheet every rendered example shares. */
export async function codeStyles(): Promise<string> {
    return [await engine.getBaseStyles(), await engine.getThemeStyles()].join("\n");
}

/** Expressive Code's own browser behavior, copying among it. */
export async function codeScripts(): Promise<string> {
    return (await engine.getJsModules()).join("\n");
}

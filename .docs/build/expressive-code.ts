import { ExpressiveCode, loadShikiTheme } from "expressive-code";
import { h, selectAll, toHtml } from "expressive-code/hast";
import { bundledLanguages } from "shiki/langs";

import { t } from "../app/theme.ts";

let engine = new ExpressiveCode({
    themes: [await loadShikiTheme("github-light"), await loadShikiTheme("github-dark")],
    themeCssSelector: false,
    useDarkModeMediaQuery: true,
    frames: { extractFileNameFromCode: false, removeCommentsWhenCopyingTerminalFrames: false },
    styleOverrides: { codeFontFamily: t.font.mono },
});

export async function renderReferenceCode(
    code: string,
    language: string | undefined,
    where: string,
): Promise<string> {
    let lang = language || "text";
    if (!["text", "txt", "plaintext"].includes(lang) && !Object.hasOwn(bundledLanguages, lang)) {
        throw new Error(`${where} has an unsupported code language: "${lang}".`);
    }
    let { renderedGroupAst, renderedGroupContents, styles } = await engine.render({
        code,
        language: lang,
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
    return [...styles].map(style => toHtml(h("style", style))).join("") + toHtml(renderedGroupAst);
}

export async function referenceCodeStyles(): Promise<string> {
    return [
        await engine.getBaseStyles(),
        await engine.getThemeStyles(),
        `.expressive-code { margin: 0 0 ${t.spacing(4)}; }`,
    ].join("\n");
}

export async function referenceCodeScripts(): Promise<string> {
    return (await engine.getJsModules()).join("\n");
}

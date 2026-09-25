import type { Plugin } from "vite";

import { fileURLToPath, pathToFileURL } from "node:url";
import { markdownToHtml, markdownToJs, mdxToJs } from "satteri";
import { normalizePath } from "vite";

import { bindings } from "./bindings.ts";
import { codeBlocks, outline, type OutlineItem, referenceCode } from "./satteri.ts";

/** A document import: the body module, or with `?outline` its heading list. */
const DOCUMENT = /\.(mdx?)(\?outline)?$/;

/** Where `mise run docs:api` writes the generated reference. */
const REFERENCE = normalizePath(fileURLToPath(new URL("../../docs/package/", import.meta.url)));

/**
 * Compiles every imported `.md` and `.mdx` file during the build, so no
 * Markdown, MDX, or highlighter code reaches the Worker.
 *
 * An authored guide or deployment page becomes a Remix component module.
 * Both formats go through the same Sätteri pipeline and plugins: Markdown
 * through `markdownToJs`, with raw HTML parsed into elements the component
 * can render, and MDX through `mdxToJs`. The module's default export is the
 * document as a function of props, which is what an MDX import is anywhere
 * else.
 *
 * A generated reference page becomes a module whose default export is the
 * HTML its article shows: the same `outline()` gives its headings their ids
 * and permalinks, its compatibility anchors stay in place, and every example
 * is an Expressive Code block. A request inserts that string as it is.
 *
 * `file.md?outline` compiles the same file to `export const headings`, the
 * document's outline with each heading's build mode, including the outlines
 * of the documents it includes. It is its own module so a server can hold
 * every page's outline without loading every page's body.
 */
export function compileDocuments(): Plugin {
    let development = false;

    return {
        name: "docs-compile",
        enforce: "pre",

        configResolved(config) {
            development = config.command === "serve";
        },

        transform: {
            filter: { id: DOCUMENT },
            async handler(source, id) {
                let [, format, query] = DOCUMENT.exec(id)!;
                let file = id.slice(0, id.length - (query?.length ?? 0));
                let fileURL = pathToFileURL(file);
                if (file.startsWith(REFERENCE)) return compileReference(source, fileURL, !!query);

                let options = {
                    fileURL,
                    jsxImportSource: "remix/ui",
                    development,
                    features: format === "md" ? { rawHtml: true } : undefined,
                };

                if (!query) {
                    let hastPlugins = [bindings(), outline(), codeBlocks()];
                    let { code } =
                        format === "md"
                            ? await markdownToJs(source, { ...options, hastPlugins })
                            : await mdxToJs(source, { ...options, hastPlugins });
                    return { code, map: null };
                }

                let hastPlugins = [bindings(), outline()];
                let { data } =
                    format === "md"
                        ? await markdownToJs(source, { ...options, hastPlugins })
                        : await mdxToJs(source, { ...options, hastPlugins });
                return { code: outlineModule(data.outline as OutlineItem[]), map: null };
            },
        },
    };
}

/**
 * A generated reference page as an HTML string module, or with `headingsOnly`
 * as its outline module. Both parse the page alike and run the same
 * `outline()`, so every heading the outline lists is one the HTML carries.
 */
async function compileReference(source: string, fileURL: URL, headingsOnly: boolean) {
    let { html, data } = await markdownToHtml(source, {
        fileURL,
        features: { rawHtml: true },
        hastPlugins: headingsOnly ? [outline()] : [outline(), referenceCode()],
    });
    let code = headingsOnly
        ? outlineModule(data.outline as OutlineItem[])
        : `export default ${JSON.stringify(html)};\n`;
    return { code, map: null };
}

/**
 * The outline as a module. An included document's headings are spliced in
 * where its `<Include>` stood; inside a `<Vite>` or `<NoBuild>` section they
 * take that build mode, and those belonging to the other one drop out.
 */
function outlineModule(items: OutlineItem[]): string {
    let imports: string[] = [];
    let entries = items.map(item => {
        if ("heading" in item) return JSON.stringify(item.heading);
        let binding = `included${imports.length}`;
        imports.push(
            `import { headings as ${binding} } from ${JSON.stringify(`${item.include.specifier}?outline`)};`,
        );
        let mode = item.include.buildMode;
        if (!mode) return `...${binding}`;
        return (
            `...${binding}.flatMap(heading => heading.buildMode && heading.buildMode !== ${JSON.stringify(mode)} ` +
            `? [] : [{ ...heading, buildMode: ${JSON.stringify(mode)} }])`
        );
    });
    return `${imports.join("\n")}\nexport const headings = [${entries.join(",\n")}];\n`;
}

import type { Plugin } from "vite";

import { pathToFileURL } from "node:url";
import { markdownToJs, mdxToJs } from "satteri";

import { bindings } from "./bindings.ts";
import { codeBlocks, outline, type OutlineItem } from "./satteri.ts";

/** A document import: the body module, or with `?outline` its heading list. */
const DOCUMENT = /\.(mdx?)(\?outline)?$/;

/**
 * Compiles every imported `.md` and `.mdx` file into a Remix component module
 * during the build, so no Markdown, MDX, or highlighter code reaches the
 * Worker.
 *
 * Both formats go through the same Sätteri pipeline and plugins: Markdown
 * through `markdownToJs`, with raw HTML parsed into elements so the
 * reference's compatibility anchors survive, and MDX through `mdxToJs`. The
 * module's default export is the document as a function of props, which is
 * what an MDX import is anywhere else.
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
                let options = {
                    fileURL: pathToFileURL(file),
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

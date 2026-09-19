import * as jsxRuntime from "remix/ui/jsx-runtime";
import { renderToString } from "remix/ui/server";

import { content } from "./content-passthrough.ts";

export async function query() {
    let settings = await content.settings.getCollection();
    let pages = await content.pages.getCollection();

    let rendered = [];
    for (let page of pages) {
        let { Content, headings } = await page.render();
        rendered.push({
            id: page.id,
            html: await renderToString(jsxRuntime.jsx(Content, {})),
            headings,
        });
    }

    return {
        settings: settings.map(entry => ({
            id: entry.id,
            data: entry.data,
            filePath: entry.filePath,
        })),
        rendered,
    };
}

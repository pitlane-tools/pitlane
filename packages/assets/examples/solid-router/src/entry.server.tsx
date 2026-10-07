import { renderImportMap } from "@pitlane/assets";
import { html } from "@remix-run/html-template";
import { generateHydrationScript, renderToStream } from "@solidjs/web";

import { App } from "./app.tsx";
import { assets } from "./assets.ts";
import { Router } from "./router.ts";

const clientEntryKey = "src/entry.client.tsx";

// Solid's lazy() needs the script URL of every lazy module it renders, keyed by
// source path, so the browser can import it before hydrating. Every page is
// registered through `assets({ include })` in `vite.config.ts`, so its script
// entry answers in dev and in a build alike.
const lazyModules = {
    async resolve(key: string) {
        let page = await assets.getScriptEntry(key);
        return { js: [page.href], css: [] };
    },
};

async function handler(request: Request): Promise<Response> {
    let sources = Router.match(request.url).map(match => match.info!.source);
    if (sources.length === 0) return new Response("Not Found", { status: 404 });

    let entry = await assets.getScriptEntry("src/entry.client.tsx");
    let preloads = await assets.getPreloads([clientEntryKey, ...sources]);
    let stylesheets = await assets.getStylesheets([clientEntryKey, ...sources]);

    // Awaiting the stream waits for the lazy route to load and render. Its head
    // output is not collected: it would only repeat the preloads above.
    let body = await renderToStream(() => <App url={request.url} />, { manifest: lazyModules });

    // `html` escapes every interpolated value. The import map, Solid's
    // hydration script, and the rendered app are complete markup, so they go
    // in through `html.raw`. The map precedes every module link and script.
    let document = html`<!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Solid Router with @pitlane/assets</title>
                <link rel="icon" href="data:," />
                ${html.raw`${renderImportMap({ value: entry.importMap })}`}
                ${stylesheets.map(href => html`<link rel="stylesheet" href="${href}" />`)}
                ${preloads.map(href => html`<link rel="modulepreload" href="${href}" />`)}
                ${html.raw`${generateHydrationScript()}`}
                <script type="module" src="${entry.href}"></script>
            </head>
            <body>
                <div id="app">${html.raw`${body}`}</div>
            </body>
        </html>`;
    return new Response(String(document), {
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}

export default { fetch: handler };

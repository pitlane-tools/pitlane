import { renderImportMap } from "@pitlane/assets";
import { html } from "@remix-run/html-template";
import { createSSRApp } from "vue";
import { RouterView, createMemoryHistory, createRouter } from "vue-router";
import { renderToString } from "vue/server-renderer";

import { assets } from "./assets.ts";
import { routes } from "./routes.ts";

export default {
    async fetch(request: Request): Promise<Response> {
        // On the server a Vapor page compiles to an ordinary SSR render
        // function, and Node's build of `vue` has no Vapor runtime, so only
        // the browser app installs `vaporInteropPlugin`.
        let app = createSSRApp(RouterView);
        let router = createRouter({ history: createMemoryHistory(), routes });
        app.use(router);

        let url = new URL(request.url);
        await router.push(url.pathname + url.search);
        await router.isReady();
        let matched = router.currentRoute.value.matched;
        if (matched.length === 0) return new Response("Not Found", { status: 404 });

        let sources = matched
            .map(route => route.meta.source)
            .filter(source => typeof source === "string");
        let keys = ["src/entry.client.ts", ...sources];
        // A string literal, so the assets plugin registers the client entry.
        let entry = await assets.getScriptEntry("src/entry.client.ts");
        let preloads = await assets.getPreloads(keys);
        let stylesheets = await assets.getStylesheets(keys);
        let body = await renderToString(app);

        // `html` escapes every interpolated href. The import map and Vue's
        // rendered markup are complete HTML already, so they go in through `html.raw`.
        let page = html`<!doctype html>
            <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <link rel="icon" href="data:," />
                    <title>Vue Vapor with @pitlane/assets</title>
                    ${html.raw`${renderImportMap({ value: entry.importMap })}`}
                    ${stylesheets.map(href => html`<link rel="stylesheet" href="${href}" />`)}
                    ${preloads.map(href => html`<link rel="modulepreload" href="${href}" />`)}
                    <script type="module" src="${entry.href}"></script>
                </head>
                <body>
                    <div id="root">${html.raw`${body}`}</div>
                </body>
            </html> `;
        return new Response(String(page), {
            headers: { "content-type": "text/html; charset=utf-8" },
        });
    },
};

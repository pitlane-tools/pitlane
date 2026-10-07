import { renderImportMap } from "@pitlane/assets";
import { html } from "@remix-run/html-template";
import { renderToReadableStream } from "react-dom/server.edge";
import { StaticRouterProvider, createStaticHandler, createStaticRouter } from "react-router";

import { assets } from "./assets.ts";
import { routes } from "./routes.ts";

let { query, dataRoutes } = createStaticHandler(routes);

async function fetch(request: Request): Promise<Response> {
    // Matching happens before rendering, so the head can name the matched routes' assets.
    let context = await query(request);
    if (context instanceof Response) return context;

    let sources = context.matches.flatMap(match => match.route.handle?.source ?? []);
    // A string literal, so the assets plugin registers the module as a browser entry.
    let entry = await assets.getScriptEntry("src/entry.client.tsx");
    let keys = ["src/entry.client.tsx", ...sources];
    let preloads = await assets.getPreloads(keys);
    let stylesheets = await assets.getStylesheets(keys);

    // React renders only the router, streamed into #root at the <!--app-->
    // marker; the document around it is ordinary server HTML. The import map
    // comes first, because the browser ignores a map that arrives after a
    // module starts loading.
    let page = html`<!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>React Router with @pitlane/assets</title>
                ${html.raw`${renderImportMap({ value: entry.importMap })}`}
                ${stylesheets.map(href => html`<link rel="stylesheet" href="${href}" />`)}
                ${preloads.map(href => html`<link rel="modulepreload" href="${href}" />`)}
                <script type="module" src="${entry.href}"></script>
            </head>
            <body>
                <div id="root"><!--app--></div>
            </body>
        </html>`;
    let [head, tail] = String(page).split("<!--app-->");

    let body = await renderToReadableStream(
        <StaticRouterProvider router={createStaticRouter(dataRoutes, context)} context={context} />,
        { signal: request.signal },
    );
    return new Response(body.pipeThrough(around(head!, tail!)), {
        status: context.statusCode,
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}

function around(head: string, tail: string): TransformStream<Uint8Array, Uint8Array> {
    let encoder = new TextEncoder();
    return new TransformStream({
        start: controller => controller.enqueue(encoder.encode(head)),
        flush: controller => controller.enqueue(encoder.encode(tail)),
    });
}

export default { fetch };

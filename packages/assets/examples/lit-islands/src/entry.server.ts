import type { TemplateResult } from "lit";

import { renderThunked } from "@lit-labs/ssr";
import { collectResult } from "@lit-labs/ssr/lib/render-result.js";
import { renderImportMap } from "@pitlane/assets";
import { createRouter } from "@remix-run/fetch-router";
import { route } from "@remix-run/fetch-router/routes";
import { html } from "@remix-run/html-template";

import { assets } from "./assets.ts";
import { islands } from "./framework/islands.ts";
import "./styles.css";

interface Page {
    title: string;
    content: TemplateResult;
}

interface PageModule {
    source: string;
    load: () => Promise<Page>;
}

let routes = route({ home: "/", about: "/about" });

// Each page names its source key so the resolver can find its stylesheets in
// the server graph. Loading pages lazily gives each one its own CSS file.
let home: PageModule = { source: "src/pages/home.ts", load: () => import("./pages/home.ts") };
let about: PageModule = { source: "src/pages/about.ts", load: () => import("./pages/about.ts") };

async function renderPage({ source, load }: PageModule): Promise<Response> {
    let page = await load();

    // Lit reports every custom element it renders, so only the islands this
    // page actually used load in the browser.
    let rendered = new Set<string>();
    let body = await collectResult(
        renderThunked(page.content, { customElementRendered: tag => rendered.add(tag) }),
    );
    let entries = [...rendered].flatMap(tag => islands[tag] ?? []);
    let preloads = [...new Set(entries.flatMap(entry => entry.preloads))];
    let stylesheets = await assets.getStylesheets(["src/entry.server.ts", source]);
    // Every entry carries the complete client import map, so any one will do.
    let importMap = entries[0]?.importMap ?? { imports: {} };

    // `html` escapes every interpolated href. `renderImportMap` escapes its own
    // output and Lit escapes the values in the body it rendered, so both go in
    // through `html.raw`.
    let document = html`<!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>${page.title} · Lit islands</title>
                <link rel="icon" href="data:," />
                ${stylesheets.map(href => html`<link rel="stylesheet" href="${href}" />`)}
                ${html.raw`${renderImportMap({ value: importMap })}`}
                ${preloads.map(href => html`<link rel="modulepreload" href="${href}" />`)}
                ${entries.map(entry => html`<script type="module" src="${entry.href}"></script>`)}
            </head>
            <body>
                <nav>
                    <a href="${routes.home.href()}">Home</a>
                    <a href="${routes.about.href()}">About</a>
                </nav>
                <main>${html.raw`${body}`}</main>
            </body>
        </html>`;
    return new Response(String(document), {
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}

let router = createRouter();
router.map(routes, {
    actions: {
        home: () => renderPage(home),
        about: () => renderPage(about),
    },
});

// `fetchServer()` passes a client address as a second argument, which
// `router.fetch` would read as `RequestInit`, so only the request goes through.
export default {
    fetch: (request: Request) => router.fetch(request),
};

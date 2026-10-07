import type { ComponentType } from "preact";

import { renderImportMap } from "@pitlane/assets";
import { createRouter } from "@remix-run/fetch-router";
import { route } from "@remix-run/fetch-router/routes";
import { html } from "@remix-run/html-template";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";

import { assets } from "./assets.ts";
import "./styles.css";

interface Page {
    title: string;
    /** The page module's source key, for the stylesheets it and its islands import. */
    source: string;
    load(): Promise<{ default: ComponentType }>;
}

// Pages load through import() so the server entry's own stylesheets leave
// them out: each page links only its CSS and its islands' CSS.
const pages = {
    home: { title: "Home", source: "src/pages/home.tsx", load: () => import("./pages/home.tsx") },
    about: {
        title: "About",
        source: "src/pages/about.tsx",
        load: () => import("./pages/about.tsx"),
    },
} satisfies Record<string, Page>;

const routes = route({ home: "/", about: "/about" });

const router = createRouter();
router.map(routes, {
    actions: {
        home: () => render(pages.home),
        about: () => render(pages.about),
    },
});

async function render(page: Page): Promise<Response> {
    let { default: Component } = await page.load();
    let body = renderToString(h(Component, {}));
    let entry = await assets.getScriptEntry("src/entry.client.ts");
    let stylesheets = await assets.getStylesheets([
        "src/entry.server.ts",
        "src/entry.client.ts",
        page.source,
    ]);

    // `html` escapes every interpolated value. The import map and the page body
    // are complete markup that `renderImportMap` and Preact already escaped, so
    // they go in through `html.raw`. The map precedes every module link and
    // script, as chunk import maps require.
    let document = html`<!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>${page.title} · Preact islands</title>
                <link rel="icon" href="data:," />
                ${html.raw`${renderImportMap({ value: entry.importMap })}`}
                ${stylesheets.map(href => html`<link rel="stylesheet" href="${href}" />`)}
                ${entry.preloads.map(href => html`<link rel="modulepreload" href="${href}" />`)}
                <script type="module" src="${entry.href}"></script>
            </head>
            <body>
                <nav>
                    <a href="${routes.home.href()}">Home</a>
                    <a href="${routes.about.href()}">About</a>
                </nav>
                ${html.raw`${body}`}
            </body>
        </html>`;
    return new Response(String(document), {
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}

// `fetchServer()` calls `fetch(request, client)`, but the router's second
// parameter is a `RequestInit`, so only the request is passed on.
export default {
    fetch: (request: Request) => router.fetch(request),
};

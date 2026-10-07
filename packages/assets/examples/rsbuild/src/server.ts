import type { BuildAssetsManifest } from "@pitlane/assets";

import { createAssetResolver, renderImportMap } from "@pitlane/assets";
import { html } from "@remix-run/html-template";
import { createRequestListener } from "@remix-run/node-fetch-server";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, sep } from "node:path";

import "./page.css";

// Rspack keeps `import.meta.dirname` in Node output, so this is the built
// server's own directory, `dist/server`. It would replace `import.meta.url`
// with the source file's URL, which names the build machine's checkout.
let manifest = JSON.parse(
    await readFile(join(import.meta.dirname, "pitlane-assets-manifest.json"), "utf8"),
) as BuildAssetsManifest;
let assets = createAssetResolver(manifest);
let publicRoot = join(import.meta.dirname, "../web");

const CONTENT_TYPES: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
};

async function renderPage(): Promise<Response> {
    let entry = await assets.getScriptEntry("src/client.ts");
    // Without options, this reads the client graph and this server's own graph.
    let stylesheets = await assets.getStylesheets(["src/server.ts", "src/client.ts"]);
    // The client entry inserts this image; the document only hints at it.
    let logo = await assets.getHref("src/logo.svg");

    // `html` escapes every interpolated href. `renderImportMap` escapes its own
    // output, so it goes in through `html.raw`.
    let page = html`<!doctype html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>Rsbuild with @pitlane/assets</title>
                ${stylesheets.map(href => html`<link rel="stylesheet" href="${href}" />`)}
                ${html.raw`${renderImportMap({ value: entry.importMap })}`}
                ${entry.preloads.map(href => html`<link rel="modulepreload" href="${href}" />`)}
                <link rel="preload" as="image" href="${logo}" />
                <script type="module" src="${entry.href}"></script>
            </head>
            <body>
                <main class="page">
                    <button type="button" id="load">Load the lazy module</button>
                    <output id="status">Waiting for the client entry.</output>
                </main>
            </body>
        </html> `;
    return new Response(String(page), {
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}

async function servePublicFile(pathname: string): Promise<Response> {
    let file = join(publicRoot, decodeURIComponent(pathname));
    let type = CONTENT_TYPES[extname(file)];
    if (!file.startsWith(publicRoot + sep) || !type) {
        return new Response(null, { status: 404 });
    }
    try {
        return new Response(await readFile(file), { headers: { "content-type": type } });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return new Response(null, { status: 404 });
    }
}

// `createRequestListener` logs anything the handler throws and answers 500.
let server = createServer(
    createRequestListener(request => {
        let { pathname } = new URL(request.url);
        return pathname === "/" ? renderPage() : servePublicFile(pathname);
    }),
);

let port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Listening on http://localhost:${port}/`));

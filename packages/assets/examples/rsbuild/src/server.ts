import type { BuildAssetsManifest } from "@pitlane/assets";

import { createAssetResolver, renderImportMap } from "@pitlane/assets";
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

// A filename, base, or asset name can contain a quote or `<`; escape URLs before
// placing them in attributes. `renderImportMap` escapes its own output.
function attribute(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

async function renderPage(): Promise<string> {
    let entry = await assets.getScriptEntry("src/client.ts");
    // Without options, this reads the client graph and this server's own graph.
    let stylesheets = await assets.getStylesheets(["src/server.ts", "src/client.ts"]);
    // The client entry inserts this image; the document only hints at it.
    let logo = await assets.getHref("src/logo.svg");

    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <title>Rsbuild with @pitlane/assets</title>
        ${stylesheets.map(href => `<link rel="stylesheet" href="${attribute(href)}" />`).join("\n        ")}
        ${renderImportMap({ value: entry.importMap })}
        ${entry.preloads.map(href => `<link rel="modulepreload" href="${attribute(href)}" />`).join("\n        ")}
        <link rel="preload" as="image" href="${attribute(logo)}" />
        <script type="module" src="${attribute(entry.href)}"></script>
    </head>
    <body>
        <main class="page">
            <button type="button" id="load">Load the lazy module</button>
            <output id="status">Waiting for the client entry.</output>
        </main>
    </body>
</html>
`;
}

let server = createServer(async (request, response) => {
    let { pathname } = new URL(request.url ?? "/", "http://localhost");
    try {
        if (pathname === "/") {
            response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            response.end(await renderPage());
            return;
        }
        let file = join(publicRoot, decodeURIComponent(pathname));
        let type = CONTENT_TYPES[extname(file)];
        if (!file.startsWith(publicRoot + sep) || !type) {
            response.writeHead(404).end();
            return;
        }
        let body = await readFile(file);
        response.writeHead(200, { "content-type": type });
        response.end(body);
    } catch (error) {
        let missing = (error as NodeJS.ErrnoException).code === "ENOENT";
        if (!missing) console.error(error);
        response.writeHead(missing ? 404 : 500).end();
    }
});

let port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Listening on http://localhost:${port}/`));

// Serves the production build: files from dist/client, everything else
// through the built server entry's `fetch`.
import { createRequestListener } from "@remix-run/node-fetch-server";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, sep } from "node:path";
import { pathToFileURL } from "node:url";

interface FetchHandler {
    fetch(request: Request): Promise<Response>;
}

const CONTENT_TYPES: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
};

let clientRoot = join(import.meta.dirname, "dist/client");
// A computed specifier: the built entry does not exist when `tsc` checks this file.
let built: { default: FetchHandler } = await import(
    pathToFileURL(join(import.meta.dirname, "dist/ssr/index.js")).href
);
let app = built.default;

async function serveClientFile(pathname: string): Promise<Response | undefined> {
    let file = join(clientRoot, decodeURIComponent(pathname));
    let type = CONTENT_TYPES[extname(file)];
    if (!file.startsWith(clientRoot + sep) || !type) return undefined;
    try {
        return new Response(await readFile(file), { headers: { "content-type": type } });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return undefined;
    }
}

// `createRequestListener` logs anything the handler throws and answers 500.
let server = createServer(
    createRequestListener(
        async request =>
            (await serveClientFile(new URL(request.url).pathname)) ?? app.fetch(request),
    ),
);

let port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Listening on http://localhost:${port}/`));

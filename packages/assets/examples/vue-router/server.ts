// The production server: built client files from dist/client, everything else
// through the built server entry's Fetch handler.
import { createRequestListener } from "@remix-run/node-fetch-server";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, sep } from "node:path";
import { pathToFileURL } from "node:url";

let clientRoot = join(import.meta.dirname, "dist/client");
// A runtime path, not a static import: the build output does not exist when
// `tsc` checks this file, and it is not part of the source graph.
let app: { default: { fetch(request: Request): Promise<Response> } } = await import(
    pathToFileURL(join(import.meta.dirname, "dist/ssr/index.js")).href
);

const CONTENT_TYPES: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
};

async function serveClientFile(pathname: string): Promise<Response | undefined> {
    let file = join(clientRoot, decodeURIComponent(pathname));
    let type = CONTENT_TYPES[extname(file)];
    if (!file.startsWith(clientRoot + sep) || !type) return undefined;
    try {
        return new Response(await readFile(file), { headers: { "content-type": type } });
    } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        return new Response(null, { status: 404 });
    }
}

// `createRequestListener` logs anything the handler throws and answers 500.
let server = createServer(
    createRequestListener(async request => {
        let { pathname } = new URL(request.url);
        return (await serveClientFile(pathname)) ?? app.default.fetch(request);
    }),
);

let port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Listening on http://localhost:${port}/`));

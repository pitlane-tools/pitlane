// Serves the production build: files from dist/client, everything else
// through the server bundle's `fetch`. Run `npm run build` first.
import { createRequestListener } from "@remix-run/node-fetch-server";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, sep } from "node:path";
import { pathToFileURL } from "node:url";

interface App {
    fetch(request: Request): Promise<Response>;
}

const CONTENT_TYPES: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
};

let root = import.meta.dirname;
let publicRoot = join(root, "dist/client");
// The bundle does not exist until a build, so it cannot be a static import.
let bundle: { default: App } = await import(pathToFileURL(join(root, "dist/ssr/index.js")).href);
let app = bundle.default;

async function servePublicFile(pathname: string): Promise<Response | undefined> {
    let file = join(publicRoot, decodeURIComponent(pathname));
    let type = CONTENT_TYPES[extname(file)];
    if (!file.startsWith(publicRoot + sep) || !type) return undefined;
    try {
        return new Response(await readFile(file), { headers: { "content-type": type } });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return undefined;
    }
}

// `createRequestListener` logs anything the handler throws and answers 500.
let server = createServer(
    createRequestListener(async request => {
        let { pathname } = new URL(request.url);
        return (await servePublicFile(pathname)) ?? app.fetch(request);
    }),
);

let port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Listening on http://localhost:${port}/`));

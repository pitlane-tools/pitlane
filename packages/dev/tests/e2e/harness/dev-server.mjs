// Persistent dev-server harness. Boots a Remix app's Vite dev server through
// the local remix() plugin and keeps it running, printing a single machine-
// readable ready line with the resolved URL:
//
//     pitlane-hmr-harness ready <url>
//
// The browser HMR e2e suite spawns this and parses that line; it is also the
// manual harness (see tests/fixtures/hmr-app/README.md). Importing Vite here
// (rather than via the `vite` CLI) keeps a single Vite identity — the one the
// plugin itself resolves — which the fullstack dev server asserts on.
//
// Usage: node dev-server.mjs <root> [port]
import { resolve } from "node:path";
import { createServer } from "vite";

let rootArg = process.argv[2];
if (!rootArg) {
    console.error("usage: node dev-server.mjs <root> [port]");
    process.exit(1);
}
let root = resolve(rootArg);
let port = Number(process.argv[3] ?? 0);

process.chdir(root);

let server = await createServer({
    root,
    logLevel: "warn",
    server: { host: "127.0.0.1", port, strictPort: port !== 0 },
});
await server.listen();

let url =
    server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${server.config.server.port ?? port}/`;
console.log(`pitlane-hmr-harness ready ${url}`);

async function shutdown() {
    await server.close().catch(() => {});
    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Persistent dev-server harness. Boots a Remix app's Vite dev server through
// the local remix() plugin and keeps it running, printing a single machine-
// readable ready line with the resolved URL:
//
//     pitlane-hmr-harness ready <url>
//
// The browser HMR e2e suite spawns this and parses that line; it is also the
// manual harness (see tests/fixtures/hmr-app/README.md). Importing Vite here
// (rather than via the `vite` CLI) keeps a single Vite identity: the one the
// plugin itself resolves.
//
// Pass --bundled to enable Vite's experimental bundled dev mode (full bundle
// mode), which serves the app as a rolldown bundle instead of unbundled ESM.
//
// Usage: node dev-server.ts <root> [port] [--bundled]
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "vite";

let args = process.argv.slice(2);
let bundled = args.includes("--bundled");
let [rootArg, portArg] = args.filter(arg => !arg.startsWith("--"));
if (!rootArg) {
    console.error("usage: node dev-server.ts <root> [port] [--bundled]");
    process.exit(1);
}
let root = resolve(rootArg);
let port = Number(portArg ?? 0);

process.chdir(root);

let cacheDir = await mkdtemp(join(tmpdir(), "pitlane-hmr-"));

let server = await createServer({
    root,
    cacheDir,
    logLevel: "warn",
    experimental: { bundledDev: bundled },
    server: { host: "127.0.0.1", port, strictPort: port !== 0 },
});
await server.listen();

let url =
    server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${server.config.server.port ?? port}/`;
console.log(`pitlane-hmr-harness ready ${url}`);

async function shutdown() {
    await server.close().catch(() => {});
    await rm(cacheDir, { recursive: true, force: true });
    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

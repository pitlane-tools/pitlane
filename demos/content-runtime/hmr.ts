import * as http from "node:http";
import { createFetchProxy } from "remix/fetch-proxy";
import { createRequestListener } from "remix/node-fetch-server";
import { createHmrReadyFetch, run } from "remix/node-hmr";

/**
 * The development supervisor.
 *
 * Nothing is bundled here, so hot reloading is a process that watches the
 * server's module graph and a proxy in front of it. `run` owns the app: it
 * applies an accepted module change in place, restarts the child when a change
 * is not accepted, and hosts the event stream the browser listens on.
 *
 * The proxy is what makes that invisible. `createHmrReadyFetch` holds a
 * request until the current generation is ready, so a reload that lands mid
 * restart waits rather than failing.
 */
let proxyPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 1613;
let hmrEventPort = process.env.HMR_PORT ? Number.parseInt(process.env.HMR_PORT, 10) : proxyPort + 1;
let appPort = process.env.APP_PORT ? Number.parseInt(process.env.APP_PORT, 10) : hmrEventPort + 1;

let runner = run("server.ts", {
    env: { ...process.env, PORT: String(appPort), HMR_PROXY_PORT: String(proxyPort) },
    // `remix/ui-hmr/node` is what teaches the server half of a component to
    // accept a hot update instead of restarting the process.
    nodeArgs: ["--import", "remix/node-tsx", "--import", "remix/ui-hmr/node"],
    browserHmrChannel: { port: hmrEventPort },
});

let server = http.createServer(
    createRequestListener(
        createHmrReadyFetch(
            runner,
            createFetchProxy(`http://127.0.0.1:${appPort}`, { xForwardedHeaders: true }),
        ),
    ),
);

server.listen(proxyPort, "127.0.0.1");

let shuttingDown = false;

function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => void runner.close().finally(() => process.exit(0)));
    server.closeAllConnections();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

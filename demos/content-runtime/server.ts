import * as http from "node:http";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import { createRequestListener } from "remix/node-fetch-server";

import router from "./app/entry.server.tsx";

let Env = s.object({
    PORT: s.defaulted(coerce.number(), 1613),
    // `hmr.ts` listens here and proxies to this process, so the URL to print
    // is its port rather than the one this server bound.
    HMR_PROXY_PORT: s.optional(coerce.number()),
});
const { HMR_PROXY_PORT, PORT } = s.parse(Env, process.env);

let server = http.createServer(createRequestListener(request => router.fetch(request)));

server.listen(PORT, () => {
    // The supervisor holds browser reloads until this arrives, so a restarted
    // server is never refreshed against before it can answer.
    if (process.env.REMIX_NODE_HMR) {
        void import("remix/node-hmr/runtime").then(hmr => hmr.emitServerReady());
    }

    console.log(`content-runtime (no bundler) on http://localhost:${HMR_PROXY_PORT ?? PORT}`);
});

let shuttingDown = false;

function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => process.exit(0));
    server.closeAllConnections();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Dev-server e2e harness. Runs a Vite dev server in its own process — the
// way users actually run it — and reports fetch results as JSON on stdout.
//
// Why a child process: in-fork dev servers inside the test runner's worker
// pool deadlock nondeterministically (native-addon thread pools under
// tinypool). Standalone Node is deterministic; see the design spec's
// verification notes.
//
// Usage: node serve.mjs '<spec-json>'
// Spec:  { root: string, port: number, requests: [{ path: string, abort?: true }] }
// Out:   { requests: [{ path, aborted?, status?, body? }] }

import { createServer } from "vite";

let spec = JSON.parse(process.argv[2]);

process.chdir(spec.root);

let server = await createServer({
    root: spec.root,
    logLevel: "error",
    server: { host: "127.0.0.1", port: spec.port, strictPort: true },
});
await server.listen();

let results = [];
for (let request of spec.requests) {
    let url = `http://127.0.0.1:${spec.port}${request.path}`;
    if (request.abort) {
        let controller = new AbortController();
        let pending = fetch(url, { signal: controller.signal });
        controller.abort();
        let aborted = await pending.then(
            () => false,
            () => true,
        );
        results.push({ path: request.path, aborted });
        continue;
    }

    let response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    results.push({
        path: request.path,
        status: response.status,
        body: await response.text(),
    });
}

console.log(JSON.stringify({ requests: results }));

// server.close() can wait forever on kept-alive sockets from our own fetches;
// results are already flushed, so exit hard.
process.exit(0);

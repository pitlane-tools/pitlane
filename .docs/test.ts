import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdir } from "node:fs/promises";
import { createInterface } from "node:readline";

// The published files under Cloudflare's local runtime, configured exactly as
// they deploy: static assets only, with no Worker code for any request.
let server = spawn(
    "./node_modules/.bin/wrangler",
    [
        "dev",
        "--config",
        "wrangler.jsonc",
        "--ip",
        "127.0.0.1",
        "--port",
        "0",
        "--inspector-port",
        "0",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
);
let timer: NodeJS.Timeout | undefined;
try {
    let origin = await new Promise<string>((resolve, reject) => {
        timer = setTimeout(
            () => reject(new Error("Documentation assets did not become ready within 60 seconds.")),
            60_000,
        );
        server.once("error", reject);
        server.once("exit", code =>
            reject(new Error(`Documentation assets server exited before readiness (${code}).`)),
        );
        server.stdout.pipe(process.stdout);
        createInterface({ input: server.stdout }).on("line", line => {
            let ready = line.match(/Ready on (http:\/\/127\.0\.0\.1:\d+)/);
            if (ready) resolve(ready[1]);
        });
        server.stderr.pipe(process.stderr);
    });
    clearTimeout(timer);
    let files = (await readdir(".docs/tests")).filter(name => name.endsWith(".test.ts")).sort();
    let tests = spawn(process.execPath, ["--test", ...files.map(name => `.docs/tests/${name}`)], {
        stdio: "inherit",
        env: { ...process.env, DOCS_TEST_ORIGIN: origin },
    });
    let [code] = await once(tests, "exit");
    process.exitCode = code ?? 1;
} finally {
    clearTimeout(timer);
    if (server.exitCode === null && server.signalCode === null) {
        server.kill("SIGTERM");
        await once(server, "exit");
    }
}

import { execFile, spawn } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const HARNESS = join(import.meta.dirname, "harness/serve.mjs");
const DEV_HARNESS = join(import.meta.dirname, "harness/dev-server.mjs");

export interface ServeRequest {
    path: string;
    abort?: true;
}

export interface ServeResult {
    path: string;
    aborted?: boolean;
    status?: number;
    body?: string;
}

/**
 * Boots the fixture's dev server in a dedicated child process (the way users
 * run Vite) and plays the given requests against it. Dev servers must not run
 * inside the test runner's worker pool: native-addon thread pools deadlock
 * nondeterministically under tinypool, while a standalone process is
 * deterministic on every runtime we test.
 */
export async function serveFixture(
    root: string,
    port: number,
    requests: ServeRequest[],
): Promise<ServeResult[]> {
    let { stdout } = await promisify(execFile)(
        process.execPath,
        [HARNESS, JSON.stringify({ root, port, requests })],
        { timeout: 90_000 },
    );

    let lines = stdout.trim().split("\n");
    let payload: { requests: ServeResult[] } = JSON.parse(lines.at(-1) ?? "");
    return payload.requests;
}

export interface DevServer {
    url: string;
    close(): void;
}

/**
 * Boots a fixture's long-lived dev server in a dedicated child process and
 * resolves once it prints its ready line. Browser suites drive the returned
 * URL and call `close()` when done.
 *
 * `bundled` selects Vite's experimental bundled dev mode, so a suite can run
 * the same scenarios against both dev pipelines.
 */
export async function startDevServer(
    root: string,
    options: { bundled?: boolean } = {},
): Promise<DevServer> {
    let args = [DEV_HARNESS, root, "0"];
    if (options.bundled) args.push("--bundled");

    let child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let { promise, resolve, reject } = Promise.withResolvers<DevServer>();
    let output = "";

    // Integration timeout: a real dev server may hang on boot, and a bounded
    // failure carrying the captured log beats a bare test-runner timeout.
    let timeout = AbortSignal.timeout(60_000);
    timeout.addEventListener("abort", () =>
        reject(new Error(`dev server never became ready:\n${output}`)),
    );

    child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        let match = /pitlane-hmr-harness ready (\S+)/.exec(output);
        if (match) resolve({ url: match[1]!, close: () => void child.kill("SIGTERM") });
    });
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("exit", code => reject(new Error(`dev server exited early (${code}):\n${output}`)));

    return promise;
}

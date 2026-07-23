import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const HARNESS = join(import.meta.dirname, "harness/serve.mjs");

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

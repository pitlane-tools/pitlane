import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const DEV_HARNESS = join(import.meta.dirname, "harness/dev-server.ts");
const FIXTURE = join(import.meta.dirname, "fixtures/http-app");

/** What the child harness builds its inline Vite config from. */
export interface HarnessSpec {
    root: string;
    cacheDir: string;
    /** Passed to `fetchServer()` unchanged, including omitted or empty entries. */
    plugin: { entry?: string; environment?: string };
    base?: string;
    appType?: "spa" | "mpa" | "custom";
    /** `environments.ssr.build.rolldownOptions.input`. */
    ssrInput?: string | Record<string, string>;
    /** Extra environments using Vite's default runnable dev environment. */
    runnableEnvironments?: string[];
    /** Extra environments created as a plain, non-runnable `DevEnvironment`. */
    nonRunnableEnvironments?: string[];
}

export interface FixtureCopy {
    root: string;
    cacheDir: string;
    remove(): Promise<void>;
}

/**
 * Copies the fixture app into a fresh temporary directory, so a test can edit
 * its source without touching the repository.
 */
export async function copyFixture(): Promise<FixtureCopy> {
    let base = await mkdtemp(join(tmpdir(), "pitlane-fetch-server-"));
    let root = join(base, "app");
    await cp(FIXTURE, root, { recursive: true });
    return {
        root,
        cacheDir: join(base, "vite-cache"),
        remove: () => rm(base, { recursive: true, force: true }),
    };
}

export interface DevServer {
    /** `http://127.0.0.1:<port>`, without the configured base. */
    origin: string;
    /** Everything the server process has written to stderr so far. */
    stderr(): string;
    close(): Promise<void>;
}

type BootResult = { ready: true; server: DevServer } | { ready: false; message: string };

function boot(spec: HarnessSpec): Promise<BootResult> {
    let child = spawn(process.execPath, [DEV_HARNESS, JSON.stringify(spec)], {
        stdio: ["ignore", "pipe", "pipe"],
    });
    let { promise, resolve, reject } = Promise.withResolvers<BootResult>();
    let stdout = "";
    let stderr = "";
    let exited = once(child, "exit");

    // A real dev server may hang on boot; a bounded failure carrying the
    // captured output beats a bare test-runner timeout.
    let timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`dev server never reported:\n${stdout}\n${stderr}`));
    }, 30_000);

    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        let ready = /fetch-server-harness ready (\S+)/.exec(stdout);
        if (ready) {
            clearTimeout(timer);
            resolve({
                ready: true,
                server: {
                    origin: ready[1]!,
                    stderr: () => stderr,
                    close: async () => {
                        child.kill("SIGTERM");
                        await exited;
                    },
                },
            });
            return;
        }
        let failed = /fetch-server-harness failed (.+)/.exec(stdout);
        if (failed) {
            clearTimeout(timer);
            resolve({ ready: false, message: JSON.parse(failed[1]!) });
        }
    });
    child.once("exit", code => {
        clearTimeout(timer);
        reject(new Error(`dev server exited (${code}) without reporting:\n${stdout}\n${stderr}`));
    });

    return promise;
}

/** Boots a dev server that is expected to start. */
export async function startDevServer(spec: HarnessSpec): Promise<DevServer> {
    let result = await boot(spec);
    if (!result.ready) throw new Error(`dev server failed to start: ${result.message}`);
    return result.server;
}

/** Boots a dev server that is expected to refuse to start; resolves with its error. */
export async function startupError(spec: HarnessSpec): Promise<string> {
    let result = await boot(spec);
    if (result.ready) {
        await result.server.close();
        throw new Error("dev server started, but a configuration error was expected");
    }
    return result.message;
}

/**
 * Polls `probe` until it returns true. Used only where the condition depends
 * on Vite's file watcher or on connection teardown, which settle on their own
 * schedule.
 */
export async function waitFor(probe: () => Promise<boolean>, timeout = 15_000): Promise<void> {
    let deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (await probe()) return;
        await sleep(100);
    }
    throw new Error(`condition not met within ${timeout}ms`);
}

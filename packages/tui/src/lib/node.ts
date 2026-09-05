import type { ReadStream, WriteStream } from "node:tty";

import { alternateBuffer, cursor, mouseTracking, settings } from "@bomb.sh/tty";

import type { TerminalRoot } from "../index.ts";

import { createRoot as createTerminalRoot } from "../index.ts";

/** Streams used by the Node terminal runner. Both must be interactive TTYs. */
export interface NodeTerminalOptions {
    /** Terminal input stream (defaults to `process.stdin`). */
    stdin?: ReadStream;
    /** Terminal output stream (defaults to `process.stdout`). */
    stdout?: WriteStream;
}

/**
 * An interactive terminal root that restores terminal state when unmounted.
 * Rendering errors are fatal: the runner restores the terminal and rejects
 * `closed`, even when an application error listener calls `preventDefault()`.
 */
export interface NodeTerminalRoot extends TerminalRoot {
    /** Resolves after teardown, or rejects after a rendering, stream, or teardown error. */
    readonly closed: Promise<void>;
}

/**
 * Connects a terminal renderer to Node streams and enters the alternate screen.
 * Ctrl+C, SIGINT, SIGTERM, input EOF, and `unmount()` restore the terminal.
 *
 * @param options Interactive input and output streams.
 * @returns A root ready for `render()`, with a promise for session completion.
 */
export async function createRoot(options: NodeTerminalOptions = {}): Promise<NodeTerminalRoot> {
    let stdin = options.stdin ?? process.stdin;
    let stdout = options.stdout ?? process.stdout;
    if (!stdin.isTTY || !stdout.isTTY) {
        throw new Error("The Node TUI renderer requires interactive stdin and stdout");
    }

    let root = await createTerminalRoot({
        width: stdout.columns,
        height: stdout.rows,
        write(bytes) {
            // tty returns a WASM memory view; Node may retain it until a later write.
            stdout.write(Buffer.from(bytes));
        },
    });
    let screen = settings(alternateBuffer(), cursor(false), mouseTracking());
    let wasRaw = stdin.isRaw;
    let wasFlowing = stdin.readableFlowing === true;
    let listeners = new AbortController();
    let completion = Promise.withResolvers<void>();
    let removed = false;
    let unmount = root.unmount.bind(root);

    function close(): void {
        if (removed) return;
        removed = true;
        stdin.off("data", receive);
        stdin.off("end", close);
        stdin.off("close", close);
        stdin.off("error", fail);
        stdout.off("resize", resize);
        stdout.off("error", fail);
        process.off("SIGINT", close);
        process.off("SIGTERM", close);
        process.off("exit", close);
        try {
            try {
                unmount();
            } finally {
                listeners.abort();
                try {
                    stdout.write(screen.revert);
                } finally {
                    stdin.setRawMode(wasRaw);
                    if (!wasFlowing) stdin.pause();
                }
            }
            completion.resolve();
        } catch (error) {
            completion.reject(error);
        }
    }

    function fail(error: unknown): void {
        completion.reject(error);
        close();
    }

    function receive(bytes: Buffer): void {
        try {
            root.writeInput(bytes);
        } catch (error) {
            fail(error);
        }
    }

    function resize(): void {
        try {
            root.resize(stdout.columns, stdout.rows);
        } catch (error) {
            fail(error);
        }
    }

    root.addEventListener(
        "input",
        event => {
            let key = event.detail;
            if (key.type === "keydown" && key.ctrl && key.code === "c") close();
        },
        { signal: listeners.signal },
    );
    root.addEventListener(
        "error",
        event => {
            event.preventDefault();
            fail(event.error);
        },
        { signal: listeners.signal },
    );
    stdin.on("data", receive);
    stdin.on("end", close);
    stdin.on("close", close);
    stdin.on("error", fail);
    stdout.on("resize", resize);
    stdout.on("error", fail);
    process.on("SIGINT", close);
    process.on("SIGTERM", close);
    process.on("exit", close);

    try {
        stdin.setRawMode(true);
        stdout.write(screen.apply);
        stdin.resume();
    } catch (error) {
        close();
        await completion.promise.catch(() => {});
        throw error;
    }

    return Object.assign(root, { unmount: close, closed: completion.promise });
}

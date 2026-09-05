import type { InputEvent, Op, ScanResult } from "@bomb.sh/tty";
import type { RemixNode } from "@remix-run/ui";
import type { RendererErrorEvent } from "@remix-run/ui/renderer";

import { createInput, createTerm } from "@bomb.sh/tty";
import { TypedEventTarget } from "@remix-run/ui";
import { createRenderer } from "@remix-run/ui/renderer";

import type { TerminalElement, TerminalNode } from "./host.ts";

import { TerminalRenderError } from "./error.ts";
import { createTerminalHost, TerminalBox, TerminalPointerEvent } from "./host.ts";
import { serialize } from "./serialize.ts";

// Redraw cadence used only while tty reports a transition in flight.
const FRAME_INTERVAL = 16;

interface Pointer {
    x: number;
    y: number;
    down: boolean;
}

// Timer handles differ by runtime (a number in browsers, an object in Node),
// so the platform's own return type is the only portable name for them.
type Timer = ReturnType<typeof setTimeout>;

/**
 * Options for {@link createRoot}.
 */
export interface TerminalRootOptions {
    /**
     * Terminal width in columns.
     */
    width: number;

    /**
     * Terminal height in rows.
     */
    height: number;

    /**
     * Receives the escape sequences for each changed frame. The bytes are a
     * view into tty's WASM memory that the next frame invalidates, so write or
     * copy them before returning.
     */
    write(output: Uint8Array): void;
}

/**
 * Event dispatched for each event the terminal input parser produces.
 */
export interface TerminalInputEvent extends Event {
    /**
     * The parsed key, mouse, wheel, resize, or cursor event.
     */
    readonly detail: InputEvent;
}

/**
 * Events dispatched by a {@link TerminalRoot}.
 */
export interface TerminalRootEventMap {
    /**
     * A terminal input event was parsed from bytes passed to
     * {@link TerminalRoot.writeInput}.
     */
    input: TerminalInputEvent;

    /**
     * A component error, or a terminal render error reported by tty. Call
     * `preventDefault()` to mark it handled; otherwise it is rethrown so the
     * platform's uncaught handler sees it.
     */
    error: RendererErrorEvent;
}

/**
 * Controller for a Remix tree rendered to a terminal.
 */
export interface TerminalRoot extends TypedEventTarget<TerminalRootEventMap> {
    /**
     * Renders a node into the terminal, replacing the previous tree.
     *
     * @param node The node to render.
     */
    render(node: RemixNode): void;

    /**
     * Applies pending component updates immediately instead of waiting for the
     * next microtask.
     */
    flush(): void;

    /**
     * Tears down the tree, stops all timers, and releases listeners. Repeated
     * calls do nothing. Terminal modes belong to the caller, so the screen is
     * left exactly as the last frame drew it.
     */
    unmount(): void;

    /**
     * Changes the terminal dimensions and redraws. Redundant when the size did
     * not change.
     *
     * @param width New width in columns.
     * @param height New height in rows.
     */
    resize(width: number, height: number): void;

    /**
     * Feeds raw terminal bytes to the input parser, dispatching an `input`
     * event per parsed event and updating pointer state.
     *
     * @param bytes Bytes read from the terminal.
     */
    writeInput(bytes: Uint8Array): void;
}

/**
 * Creates a terminal root backed by the tty layout and input engines.
 *
 * The root performs no I/O: it hands changed frames to `write` and consumes
 * the bytes given to {@link TerminalRoot.writeInput}, so the caller owns raw
 * mode, screen modes, and signals. On Node, `@pitlane/tui/node` wires all
 * of that to `process.stdin` and `process.stdout`.
 *
 * @param options Terminal dimensions and the output sink.
 * @returns A root ready to render Remix nodes to the terminal.
 *
 * @example
 * ```ts
 * let root = await createRoot({
 *     width: process.stdout.columns,
 *     height: process.stdout.rows,
 *     write: bytes => process.stdout.write(Buffer.from(bytes)),
 * });
 *
 * root.addEventListener("input", event => {
 *     if (event.detail.type === "keydown") handleKey(event.detail);
 * });
 * root.render(<App />);
 * ```
 */
export async function createRoot(options: TerminalRootOptions): Promise<TerminalRoot> {
    let write = options.write;
    let [term, input] = await Promise.all([
        createTerm({ width: options.width, height: options.height }),
        createInput(),
    ]);

    let target = new TypedEventTarget<TerminalRootEventMap>();
    // Never serialized: tty gives every frame an implicit root container sized
    // to the terminal, so emitting an element for this one would impose layout
    // the caller did not ask for.
    let container = new TerminalBox("~root");
    let ops: Op[] = [];
    let targets = new Map<string, TerminalBox>();
    // Bumped once per frame. The ops array and the targets map describe the
    // newest frame only, so anything still walking an older frame compares its
    // generation against this to notice it has been superseded.
    let drawn = 0;
    let pointer: Pointer | undefined;
    let renderOptions: { pointer: Pointer } | undefined;
    let escapeTimer: Timer | undefined;
    let frameTimer: Timer | undefined;
    let unmounted = false;

    let renderer = createRenderer<TerminalNode, TerminalElement>(createTerminalHost(draw));
    let root = renderer.createRoot(container);
    let forwarding = new AbortController();

    root.addEventListener(
        "error",
        event => {
            let forwarded = Object.assign(new Event("error", { cancelable: true }), {
                error: event.error,
            });
            // Cancelling ours means a listener took responsibility, so the
            // universal root must not rethrow it as well.
            if (!target.dispatchEvent(forwarded)) event.preventDefault();
        },
        { signal: forwarding.signal },
    );

    function draw(): void {
        if (unmounted) return;

        let generation = ++drawn;
        ops.length = 0;
        targets.clear();
        serialize(container, ops, targets);

        let frame = term.render(ops, renderOptions);
        // Unchanged frames produce no bytes, and the bytes that do come back are
        // only valid until the next render, so hand them over before anything
        // else can run.
        if (frame.output.byteLength > 0) write(frame.output);
        if (unmounted || drawn !== generation) return;

        for (let error of frame.errors) {
            fail(new TerminalRenderError(error.type, error.message));
            if (unmounted || drawn !== generation) return;
        }
        for (let event of frame.events) {
            let box = targets.get(event.id);
            if (box === undefined) continue;
            box.dispatchEvent(new TerminalPointerEvent(event.type, event.id));
            // A handler that flushed synchronously has already drawn a newer frame
            // over the shared targets map, so the events left in this one would be
            // delivered to elements tty never hit tested.
            if (unmounted || drawn !== generation) return;
        }

        // A pointer handler or an error listener may have unmounted the root, and
        // an unmounted root must leave no timer behind.
        if (frame.animating && !unmounted) frameTimer ??= setTimeout(tick, FRAME_INTERVAL);
    }

    function redraw(): void {
        try {
            draw();
        } catch (error) {
            // Redraws that no caller asked for share one error contract: report the
            // failure as a cancelable event instead of throwing from a timer, or
            // part way through a batch of parsed input.
            fail(error);
        }
    }

    function tick(): void {
        frameTimer = undefined;
        if (unmounted) return;
        redraw();
    }

    function fail(error: unknown): void {
        let event = Object.assign(new Event("error", { cancelable: true }), { error });
        if (target.dispatchEvent(event)) {
            // Unhandled. Logging would corrupt the screen the app is drawing to, so
            // hand it to the platform's uncaught handler instead.
            setTimeout(() => {
                throw error;
            });
        }
    }

    function movePointer(x: number, y: number, down: boolean): boolean {
        // Hit test at the center of the reported cell. Cell origins fall exactly
        // on the shared edge of two adjacent elements, and tty counts an edge as
        // inside both, so integer coordinates would target the row above and the
        // row below at once. The input events keep the parser's integers.
        let centerX = x + 0.5;
        let centerY = y + 0.5;
        if (pointer === undefined) {
            pointer = { x: centerX, y: centerY, down };
            renderOptions = { pointer };
            return true;
        }
        if (pointer.x === centerX && pointer.y === centerY && pointer.down === down) return false;
        pointer.x = centerX;
        pointer.y = centerY;
        pointer.down = down;
        return true;
    }

    function consume(scan: ScanResult): void {
        let moved = false;

        for (let event of scan.events) {
            // An input listener may unmount the root part way through a batch.
            if (unmounted) return;

            target.dispatchEvent(Object.assign(new Event("input"), { detail: event }));
            if (unmounted) return;

            switch (event.type) {
                case "mousedown":
                case "mouseup": {
                    // Press and release each need their own frame: tty derives a click
                    // from a pressed frame followed by a released frame over the same
                    // element, so button changes cannot be coalesced.
                    movePointer(event.x, event.y, event.type === "mousedown");
                    redraw();
                    moved = false;
                    break;
                }
                case "mousemove":
                case "wheel": {
                    moved = movePointer(event.x, event.y, pointer?.down ?? false) || moved;
                    break;
                }
                case "resize": {
                    // An invalid size is still thrown back at whoever reported it, but
                    // the redraw belongs to this batch like any other input driven one.
                    term.update({ width: event.width, height: event.height });
                    redraw();
                    moved = false;
                    break;
                }
            }
        }

        if (moved) redraw();

        // A pointer or input callback may have unmounted the root while drawing.
        if (unmounted) return;

        clearTimeout(escapeTimer);
        escapeTimer =
            scan.pending === undefined ? undefined : setTimeout(flushEscape, scan.pending.delay);
    }

    function flushEscape(): void {
        escapeTimer = undefined;
        if (unmounted) return;
        try {
            // Scanning with no bytes resolves a buffered lone ESC, now that the
            // parser's latency window has elapsed.
            consume(input.scan());
        } catch (error) {
            // Nothing is above a timer to catch this, so report it instead of
            // crashing as an uncaught throw.
            fail(error);
        }
    }

    function resize(width: number, height: number): void {
        if (unmounted) return;
        // A caller driven resize keeps its failures: an invalid size throws from
        // term.update, and a tree the resized frame cannot serialize throws from
        // draw, both at the caller that asked for the new size.
        term.update({ width, height });
        // A real dimension change makes the next frame a complete redraw; an
        // unchanged size leaves tty untouched and emits nothing.
        draw();
    }

    function writeInput(bytes: Uint8Array): void {
        if (unmounted) return;
        consume(input.scan(bytes));
    }

    function unmount(): void {
        if (unmounted) return;
        // Set before tearing down: the renderer commits while unmounting, and
        // there is no frame left to draw.
        unmounted = true;
        clearTimeout(escapeTimer);
        clearTimeout(frameTimer);
        escapeTimer = undefined;
        frameTimer = undefined;
        try {
            root.unmount();
        } finally {
            forwarding.abort();
            targets.clear();
            ops.length = 0;
        }
    }

    return Object.assign(target, {
        render(node: RemixNode): void {
            root.render(node);
        },
        flush(): void {
            root.flush();
        },
        resize,
        writeInput,
        unmount,
    });
}

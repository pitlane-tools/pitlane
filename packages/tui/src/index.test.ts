import type { InputEvent } from "@bomb.sh/tty";
import type { Handle, RemixNode } from "@remix-run/ui";

import { close, createTerm, fixed, grow, open, rgba, text } from "@bomb.sh/tty";
import { on } from "@remix-run/ui";
import { jsx } from "@remix-run/ui/jsx-runtime";
import { describe, expect, it } from "vitest";

import type { TerminalBox, TerminalRoot } from "./index.ts";

import {
    Box,
    createRoot,
    style,
    TerminalPointerEvent,
    TerminalRenderError,
    Text,
} from "./index.ts";

let encoder = new TextEncoder();
let decoder = new TextDecoder();

interface Session {
    root: TerminalRoot;
    frames: string[];
    errors: unknown[];
    input: InputEvent[];
}

async function session(width = 20, height = 3): Promise<Session> {
    let frames: string[] = [];
    let errors: unknown[] = [];
    let input: InputEvent[] = [];
    let root = await createRoot({
        width,
        height,
        write(output) {
            frames.push(decoder.decode(output));
        },
    });
    root.addEventListener("error", event => {
        event.preventDefault();
        errors.push(event.error);
    });
    root.addEventListener("input", event => {
        input.push(event.detail);
    });
    return { root, frames, errors, input };
}

// The tty parser decides when a buffered escape resolves from its own clock
// inside WASM, so fake timers cannot move it: these waits must be real.
function sleep(ms: number): Promise<void> {
    let { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, ms);
    return promise;
}

describe("createRoot", () => {
    it("writes a frame for a rendered tree and nothing for an identical one", async () => {
        let { root, frames } = await session();

        root.render(jsx(Text, { children: "hello" }));
        expect(frames).toHaveLength(1);
        expect(frames[0]).toContain("hello");

        root.render(jsx(Text, { children: "hello" }));
        expect(frames).toHaveLength(1);

        root.render(jsx(Text, { children: "goodbye" }));
        expect(frames).toHaveLength(2);
        expect(frames[1]).toContain("goodbye");

        root.unmount();
    });

    it("repaints only the changed cells for a batched component update", async () => {
        let { root, frames } = await session();
        let expected = await createTerm({ width: 20, height: 3 });
        // Replaced when the component renders; calling it before then is the
        // failure the assertions below would otherwise have to check for.
        let bump: () => Promise<AbortSignal> = () => {
            throw new Error("Counter has not rendered yet");
        };

        function Counter(handle: Handle): () => RemixNode {
            let count = 0;
            bump = () => {
                count += 1;
                return handle.update();
            };
            return () => jsx(Text, { children: `count ${count}` });
        }

        root.render(jsx(Counter, {}));
        expect(frames[0]).toBe(decoder.decode(expected.render([text("count 0")]).output));

        let first = bump();
        let second = bump();
        await Promise.all([first, second]);
        expect(frames).toHaveLength(2);
        expect(frames[1]).toBe(decoder.decode(expected.render([text("count 2")]).output));

        root.unmount();
    });

    it("redraws for a new size and skips a resize to the same size", async () => {
        let { root, frames } = await session();

        root.render(jsx(Text, { children: "sized" }));
        expect(frames).toHaveLength(1);

        root.resize(20, 3);
        expect(frames).toHaveLength(1);

        root.resize(30, 4);
        expect(frames).toHaveLength(2);
        expect(frames[1]).toContain("sized");

        root.unmount();
    });

    it("merges style mixins and clears the fields a removed one contributed", async () => {
        let { root, frames } = await session();
        let expected = await createTerm({ width: 20, height: 3 });
        let base = { layout: { width: fixed(6), height: fixed(1) } };
        let deselect: () => Promise<AbortSignal> = () => {
            throw new Error("Row has not rendered yet");
        };

        function Row(handle: Handle): () => RemixNode {
            let selected = true;
            deselect = () => {
                selected = false;
                return handle.update();
            };
            return () =>
                jsx(Box, {
                    id: "row",
                    mix: [style(base), selected && style({ bg: rgba(200, 40, 40) })],
                    children: jsx(Text, { children: "row" }),
                });
        }

        root.render(jsx(Row, {}));
        expect(frames[0]).toBe(
            decoder.decode(
                expected.render([
                    open("row", { ...base, bg: rgba(200, 40, 40) }),
                    text("row"),
                    close(),
                ]).output,
            ),
        );

        await deselect();
        expect(frames).toHaveLength(2);
        expect(frames[1]).toBe(
            decoder.decode(expected.render([open("row", base), text("row"), close()]).output),
        );

        root.unmount();
    });

    it("hit tests pointer input against the rendered layout", async () => {
        let { root } = await session();
        let seen: string[] = [];
        let clicked: TerminalPointerEvent | undefined;
        let clickedId: string | undefined;

        root.render(
            jsx(Box, {
                id: "button",
                mix: [
                    style({ layout: { width: fixed(6), height: fixed(1) } }),
                    on<TerminalBox>("pointerenter", event => {
                        seen.push(`enter:${event.id}`);
                    }),
                    on<TerminalBox>("pointerclick", event => {
                        seen.push(`click:${event.id}`);
                        clicked = event;
                        clickedId = event.currentTarget.id;
                    }),
                    on<TerminalBox>("pointerleave", event => {
                        seen.push(`leave:${event.id}`);
                    }),
                ],
                children: jsx(Text, { children: "press" }),
            }),
        );

        // SGR mouse reports are 1-based, so column 1 row 1 is the box's first cell.
        root.writeInput(encoder.encode("\x1b[<0;1;1M"));
        root.writeInput(encoder.encode("\x1b[<0;1;1m"));
        expect(seen).toEqual(["enter:button", "click:button"]);

        // Handlers receive a real event dispatched on the box itself.
        expect(clicked).toBeInstanceOf(TerminalPointerEvent);
        expect(clicked?.type).toBe("pointerclick");
        expect(clicked?.id).toBe("button");
        expect(clickedId).toBe("button");

        root.writeInput(encoder.encode("\x1b[<0;18;3M"));
        expect(seen).toEqual(["enter:button", "click:button", "leave:button"]);

        root.unmount();
    });

    it("targets only the row under the pointer for flush adjacent rows", async () => {
        let { root } = await session();
        let clicks: string[] = [];
        let enters: string[] = [];
        let leaves: string[] = [];

        function row(id: string): RemixNode {
            return jsx(Box, {
                id,
                mix: [
                    style({ layout: { width: grow(), height: fixed(1) } }),
                    on<TerminalBox>("pointerenter", event => {
                        enters.push(event.id);
                    }),
                    on<TerminalBox>("pointerleave", event => {
                        leaves.push(event.id);
                    }),
                    on<TerminalBox>("pointerclick", event => {
                        clicks.push(event.id);
                    }),
                ],
                children: jsx(Text, { children: id }),
            });
        }

        root.render(
            jsx(Box, {
                id: "rows",
                mix: style({ layout: { width: fixed(6), height: fixed(2), direction: "ttb" } }),
                children: [row("first"), row("second")],
            }),
        );

        root.writeInput(encoder.encode("\x1b[<0;1;1M"));
        root.writeInput(encoder.encode("\x1b[<0;1;1m"));
        expect(enters).toEqual(["first"]);
        expect(clicks).toEqual(["first"]);

        // Row 2 begins where row 1 ends, and that shared edge is inside both
        // boxes: only the row the cell actually belongs to may be hit.
        root.writeInput(encoder.encode("\x1b[<0;1;2M"));
        root.writeInput(encoder.encode("\x1b[<0;1;2m"));
        expect(clicks).toEqual(["first", "second"]);
        expect(enters).toEqual(["first", "second"]);
        expect(leaves).toEqual(["first"]);

        root.unmount();
    });

    it("aborts a pointer handler signal on reentry and on unmount", async () => {
        let { root } = await session();
        let reasons: string[] = [];
        let pending: AbortSignal | undefined;

        root.render(
            jsx(Box, {
                mix: [
                    style({ layout: { width: fixed(4), height: fixed(1) } }),
                    on<TerminalBox>("pointerclick", (_event, signal) => {
                        pending = signal;
                        signal.addEventListener("abort", () => {
                            reasons.push((signal.reason as DOMException).name);
                        });
                    }),
                ],
                children: jsx(Text, { children: "go" }),
            }),
        );

        root.writeInput(encoder.encode("\x1b[<0;1;1M"));
        root.writeInput(encoder.encode("\x1b[<0;1;1m"));
        expect(pending).toBeDefined();
        expect(pending?.aborted).toBe(false);

        // A second click supersedes the first: the run in flight is cancelled
        // before the handler starts again.
        root.writeInput(encoder.encode("\x1b[<0;1;1M"));
        root.writeInput(encoder.encode("\x1b[<0;1;1m"));
        expect(reasons).toEqual(["EventReentry"]);

        // Tearing down removes the listener and cancels the last run with it.
        root.unmount();
        expect(reasons).toEqual(["EventReentry", "AbortError"]);
    });

    it("stops a batch of input as soon as a listener unmounts", async () => {
        let { root, input, frames } = await session();

        root.render(jsx(Text, { children: "keys" }));
        let painted = frames.length;
        root.addEventListener("input", () => root.unmount());

        root.writeInput(encoder.encode("ab\x1b"));
        expect(input).toHaveLength(1);

        await sleep(60);
        expect(input).toHaveLength(1);
        expect(frames).toHaveLength(painted);
    });

    it("holds a lone escape byte until the parser latency elapses", async () => {
        let { root, input } = await session();

        root.render(jsx(Text, { children: "keys" }));
        root.writeInput(new Uint8Array([0x1b]));
        expect(input).toHaveLength(0);

        await sleep(60);
        expect(input).toHaveLength(1);
        expect(input).toMatchObject([{ type: "keydown", key: "Escape" }]);

        root.unmount();
    });

    it("drops a pending escape and further input once unmounted", async () => {
        let { root, input } = await session();

        root.render(jsx(Text, { children: "keys" }));
        root.writeInput(new Uint8Array([0x1b]));
        root.unmount();
        root.unmount();

        await sleep(60);
        root.writeInput(encoder.encode("x"));
        expect(input).toEqual([]);
    });

    it("reports engine errors for duplicate element ids", async () => {
        let { root, errors } = await session();

        root.render([
            jsx(Box, { id: "same", mix: style({ layout: { width: fixed(2), height: fixed(1) } }) }),
            jsx(Box, { id: "same", mix: style({ layout: { width: fixed(2), height: fixed(1) } }) }),
        ]);

        expect(errors).toHaveLength(1);
        expect(errors[0]).toBeInstanceOf(TerminalRenderError);
        expect(errors[0]).toMatchObject({ type: "DUPLICATE_ID" });

        root.unmount();
    });

    it("reports an element nested inside a text run", async () => {
        let { root, errors } = await session();

        root.render(jsx(Text, { children: jsx(Box, {}) }));

        expect(errors).toHaveLength(1);
        expect(errors[0]).toBeInstanceOf(TerminalRenderError);
        expect(errors[0]).toMatchObject({ type: "UNSUPPORTED_NESTING" });

        root.unmount();
    });

    it("reports a failed input driven redraw instead of throwing at the writer", async () => {
        let { root, errors, input } = await session();

        root.render(jsx(Text, { children: jsx(Box, {}) }));
        expect(errors).toHaveLength(1);

        // The press redraws the same unrenderable tree. Its failure belongs to the
        // same error channel the commit used, and the batch keeps parsing.
        root.writeInput(encoder.encode("\x1b[<0;1;1Mx"));
        expect(errors).toHaveLength(2);
        expect(errors[1]).toBeInstanceOf(TerminalRenderError);
        expect(errors[1]).toMatchObject({ type: "UNSUPPORTED_NESTING" });
        expect(input).toMatchObject([{ type: "mousedown" }, { type: "keydown", key: "x" }]);

        root.unmount();
    });
});

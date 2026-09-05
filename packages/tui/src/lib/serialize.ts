import type { Op } from "@bomb.sh/tty";

import { close, open, text } from "@bomb.sh/tty";

import type { TerminalBox, TerminalElement, TerminalNode, TerminalTextElement } from "./host.ts";

import { TerminalRenderError } from "./error.ts";
import { BOX, TEXT } from "./host.ts";

// A close op carries no data, so every element can share one instance. tty
// only reads ops while packing them into WASM memory.
const CLOSE = close();

/**
 * Serializes a terminal host tree into tty ops for one frame.
 *
 * The container is transparent: only its children are emitted, so the frame
 * lays out inside the implicit root container tty sizes to the terminal.
 *
 * @param container Root of the host tree.
 * @param ops Op array to append to. Cleared by the caller between frames.
 * @param targets Receives every box in the frame, keyed by the id tty reports
 *   pointer events with. Listeners live on the boxes themselves, so the frame
 *   cannot tell which of them anyone is watching.
 * @throws {TerminalRenderError} When an element is nested somewhere the
 *   terminal cannot represent it.
 */
export function serialize(
    container: TerminalElement,
    ops: Op[],
    targets: Map<string, TerminalBox>,
): void {
    for (let child of container.children) {
        serializeNode(child, ops, targets);
    }
}

function serializeNode(node: TerminalNode, ops: Op[], targets: Map<string, TerminalBox>): void {
    switch (node.type) {
        case BOX: {
            ops.push(open(node.id, node.style));
            targets.set(node.id, node);
            for (let child of node.children) {
                serializeNode(child, ops, targets);
            }
            ops.push(CLOSE);
            return;
        }
        case TEXT: {
            let content = collectText(node);
            if (content !== "") ops.push(text(content, node.style));
            return;
        }
        case "string": {
            if (node.value !== "") ops.push(text(node.value));
            return;
        }
        case "anchor": {
            return;
        }
    }
}

function collectText(element: TerminalTextElement): string {
    let content = "";
    for (let child of element.children) {
        if (child.type === "string") {
            content += child.value;
        } else if (child.type !== "anchor") {
            // A terminal text run is a single styled string, so a nested element
            // has nowhere to render. Fail loudly instead of dropping its content.
            throw new TerminalRenderError(
                "UNSUPPORTED_NESTING",
                `<${child.type === BOX ? "Box" : "Text"}> cannot render inside <Text>. Move it into the surrounding <Box> and style each <Text> directly.`,
            );
        }
    }
    return content;
}

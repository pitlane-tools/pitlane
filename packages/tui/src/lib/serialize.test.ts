import type { Op } from "@bomb.sh/tty";

import { createTerm, fixed } from "@bomb.sh/tty";
import { describe, expect, it } from "vitest";

import { BOX, createTerminalHost, TEXT, TerminalBox } from "./host.ts";
import { serialize } from "./serialize.ts";

let decoder = new TextDecoder();

async function paint(container: TerminalBox): Promise<string> {
    let term = await createTerm({ width: 16, height: 2 });
    let ops: Op[] = [];
    serialize(container, ops, new Map());
    return decoder.decode(term.render(ops).output);
}

describe("serialize", () => {
    it("emits the same frame with and without invisible anchors", async () => {
        let host = createTerminalHost(() => {});

        let plain = new TerminalBox("~root");
        let plainBox = host.createElement(BOX, { style: { layout: { height: fixed(1) } } }, plain);
        host.insert(plainBox, plain, null);
        host.insert(host.createText("ab", plainBox), plainBox, null);

        let anchored = new TerminalBox("~root");
        let anchoredBox = host.createElement(
            BOX,
            { style: { layout: { height: fixed(1) } } },
            anchored,
        );
        host.insert(anchoredBox, anchored, null);
        host.insert(host.createComment("before", anchoredBox), anchoredBox, null);
        host.insert(host.createText("a", anchoredBox), anchoredBox, null);
        host.insert(host.createComment("between", anchoredBox), anchoredBox, null);
        host.insert(host.createText("b", anchoredBox), anchoredBox, null);
        host.insert(host.createComment("after", anchoredBox), anchoredBox, null);

        expect(await paint(anchored)).toBe(await paint(plain));
    });

    it("serializes text elements as a single run of their text children", async () => {
        let host = createTerminalHost(() => {});
        let container = new TerminalBox("~root");
        let text = host.createElement(TEXT, {}, container);
        host.insert(text, container, null);
        host.insert(host.createText("one ", text), text, null);
        host.insert(host.createText("two", text), text, null);

        expect(await paint(container)).toContain("one two");
    });
});

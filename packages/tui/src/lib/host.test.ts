import { fixed, rgba } from "@bomb.sh/tty";
import { describe, expect, it } from "vitest";

import { BOX, createTerminalHost, TEXT, TerminalBox } from "./host.ts";

describe("createTerminalHost", () => {
    it("rejects props the terminal has no meaning for", () => {
        let host = createTerminalHost(() => {});
        let container = new TerminalBox("root");

        expect(() => host.createElement(BOX, { className: "card" }, container)).toThrow(
            expect.objectContaining({
                name: "TerminalRenderError",
                type: "UNSUPPORTED_PROP",
            }),
        );
        // tty addresses boxes only, so a text run has no id to report.
        expect(() => host.createElement(TEXT, { id: "label" }, container)).toThrow(
            expect.objectContaining({ type: "UNSUPPORTED_PROP" }),
        );
        expect(() => host.createElement(BOX, { id: "" }, container)).toThrow(
            expect.objectContaining({ type: "UNSUPPORTED_PROP" }),
        );
        expect(() => host.createElement("div", {}, container)).toThrow(
            expect.objectContaining({ type: "UNSUPPORTED_ELEMENT" }),
        );
    });

    it("rejects style fields the element op cannot carry", () => {
        let host = createTerminalHost(() => {});
        let container = new TerminalBox("root");

        // tty packs only the fields its own op declares, so a field meant for the
        // other one would vanish instead of failing.
        expect(() =>
            host.createElement(TEXT, { style: { layout: { width: fixed(2) } } }, container),
        ).toThrow(expect.objectContaining({ type: "UNSUPPORTED_STYLE" }));
        expect(() =>
            host.createElement(BOX, { style: { color: rgba(1, 2, 3) } }, container),
        ).toThrow(expect.objectContaining({ type: "UNSUPPORTED_STYLE" }));
        expect(() => host.createElement(BOX, { style: "bold" }, container)).toThrow(
            expect.objectContaining({ type: "UNSUPPORTED_STYLE" }),
        );
    });
});

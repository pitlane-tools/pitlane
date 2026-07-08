import { describe, expect, it } from "vitest";

import * as theme from "./index.ts";

describe("public surface", () => {
    it("exports exactly the public API", () => {
        expect(Object.keys(theme).sort()).toEqual([
            "ThemeError",
            "combine",
            "createTheme",
            "css",
            "cx",
            "tva",
        ]);
    });

    it("wires the pieces together end to end", () => {
        let { token, raw, Theme } = theme.createTheme({
            color: { $type: "color", white: { $value: "#fff" } },
        });
        expect(token.color.white).toBe("var(--color-white)");
        expect(raw(token.color.white)).toBe("#fff");
        expect(typeof Theme).toBe("function");
        expect(typeof theme.css({ color: token.color.white })).toBe("object");
    });
});

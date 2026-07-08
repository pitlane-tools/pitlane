import { describe, expect, it } from "vitest";

import { createTheme } from "./theme.ts";
import { ThemeError } from "./tokens.ts";

const config = {
    color: {
        $type: "color",
        white: { $value: "#fff" },
        gray: { 900: { $value: "#171717" } },
        bg: { $value: "{color.white}" },
    },
    space: { $type: "dimension", md: { $value: { value: 16, unit: "px" } } },
} as const;

describe("createTheme token accessor", () => {
    it("mirrors the config shape with var() leaves", () => {
        let { token } = createTheme(config);
        expect(token.color.white).toBe("var(--color-white)");
        expect(token.color.gray[900]).toBe("var(--color-gray-900)");
        expect(token.color.bg).toBe("var(--color-bg)");
        expect(token.space.md).toBe("var(--space-md)");
    });
});

describe("raw", () => {
    it("returns serialized base values, chasing aliases", () => {
        let { token, raw } = createTheme(config);
        expect(raw(token.color.white)).toBe("#fff");
        expect(raw(token.color.bg)).toBe("#fff");
        expect(raw(token.space.md)).toBe("16px");
    });

    it("throws on refs not minted by this theme", () => {
        let { raw } = createTheme(config);
        expect(() => raw("var(--other)" as never)).toThrow(ThemeError);
    });

    it("throws on alias value cycles even when types resolve", () => {
        expect(() =>
            createTheme({
                a: { $type: "color", $value: "{b}" },
                b: { $type: "color", $value: "{a}" },
            }),
        ).toThrow(/a → b → a/);
    });
});

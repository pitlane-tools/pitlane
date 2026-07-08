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

import { compileThemeCss } from "./theme.ts";

describe("modes", () => {
    it("emits base :root plus prefers-color-scheme blocks with only overridden vars", () => {
        let css = compileThemeCss(config, {
            modes: { dark: { color: { bg: { $value: "{color.gray.900}" } } } },
        });
        expect(css).toBe(
            [
                ":root {",
                "    --color-white: #fff;",
                "    --color-gray-900: #171717;",
                "    --color-bg: var(--color-white);",
                "    --space-md: 16px;",
                "}",
                "",
                "@media (prefers-color-scheme: dark) {",
                "    :root {",
                "        --color-bg: var(--color-gray-900);",
                "    }",
                "}",
            ].join("\n"),
        );
    });

    it("supports light and dark simultaneously, in light-then-dark order", () => {
        let css = compileThemeCss(config, {
            modes: {
                dark: { color: { white: { $value: "#000" } } },
                light: { color: { white: { $value: "#fefefe" } } },
            },
        });
        let lightIndex = css.indexOf("prefers-color-scheme: light");
        let darkIndex = css.indexOf("prefers-color-scheme: dark");
        expect(lightIndex).toBeGreaterThan(-1);
        expect(darkIndex).toBeGreaterThan(lightIndex);
        expect(css).toContain("        --color-white: #fefefe;");
        expect(css).toContain("        --color-white: #000;");
    });

    it("throws when an override path does not exist in the base document", () => {
        expect(() =>
            compileThemeCss(config, {
                modes: { dark: { color: { nope: { $value: "#000" } } } } as never,
            }),
        ).toThrow(/color\.nope/);
    });

    it("throws when an override sets anything but $value", () => {
        expect(() =>
            compileThemeCss(config, {
                modes: {
                    dark: { color: { bg: { $value: "#000", $type: "color" } } } as never,
                },
            }),
        ).toThrow(/may only set \$value/);
    });

    it("throws when an override aliases a token missing from the base", () => {
        expect(() =>
            compileThemeCss(config, {
                modes: { dark: { color: { bg: { $value: "{color.void}" } } } },
            }),
        ).toThrow(/color\.void/);
    });
});

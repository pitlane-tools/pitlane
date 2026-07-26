import { afterEach, describe, expect, it } from "vitest";

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

describe("token accessor safety", () => {
    afterEach(() => {
        // In case the assertions below ever regress, scrub the globals so one
        // failure doesn't poison unrelated tests.
        delete (Object.prototype as Record<string, unknown>).color;
        delete (Object as unknown as Record<string, unknown>).x;
    });

    it("builds own keys for a JSON __proto__ group without polluting Object.prototype", () => {
        let { token } = createTheme(
            JSON.parse('{"__proto__":{"color":{"$type":"color","$value":"#fff"}}}'),
        );
        expect(({} as Record<string, unknown>).color).toBeUndefined();
        let tree = token as Record<string, Record<string, string>>;
        expect(tree["__proto__"]["color"]).toBe("var(--proto-color)");
    });

    it("builds own keys for a group named constructor without touching built-ins", () => {
        let { token } = createTheme({
            constructor: { x: { $type: "color", $value: "#fff" } },
        } as never);
        expect((Object as unknown as Record<string, unknown>).x).toBeUndefined();
        let tree = token as Record<string, Record<string, string>>;
        expect(tree["constructor"]["x"]).toBe("var(--constructor-x)");
    });
});

describe("raw", () => {
    it("returns serialized base values, chasing aliases", () => {
        let { token, raw } = createTheme(config);
        expect(raw(token.color.white)).toBe("#fff");
        expect(raw(token.color.bg)).toBe("#fff");
        expect(raw(token.space.md)).toBe("16px");
    });

    it("throws on refs whose var name this theme never minted", () => {
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

    it("resolves a same-name ref minted by another theme to this theme's value", () => {
        let a = createTheme({ color: { $type: "color", white: { $value: "#fff" } } });
        let b = createTheme({ color: { $type: "color", white: { $value: "#eee" } } });
        // Tokens are plain branded strings: identical paths mint identical
        // refs, so provenance is undetectable by design (brands interoperate
        // across themes). raw() answers for var names THIS theme minted.
        expect(a.raw(b.token.color.white)).toBe("#fff");
    });

    it("fully resolves composite sub-value aliases to base values", () => {
        let { token, raw } = createTheme({
            color: { $type: "color", ink: { $value: "#171717" } },
            shadow: {
                card: {
                    $type: "shadow",
                    $value: {
                        color: "{color.ink}",
                        offsetX: "0px",
                        offsetY: "1px",
                        blur: "3px",
                        spread: "0px",
                    },
                },
            },
        });
        expect(raw(token.shadow.card)).toBe("0px 1px 3px 0px #171717");
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

    it("throws when an override aliases a token of a different type", () => {
        expect(() =>
            compileThemeCss(
                {
                    color: { $type: "color", bg: { $value: "#fff" } },
                    space: { $type: "dimension", sm: { $value: "8px" } },
                },
                { modes: { dark: { color: { bg: { $value: "{space.sm}" } } } } },
            ),
        ).toThrow(/color\.bg.+dimension/);
    });

    it("emits no media block for a mode with zero overrides", () => {
        let css = compileThemeCss(config, { modes: { dark: {} } });
        expect(css).not.toContain("@media");
    });
});

describe("alias type consistency", () => {
    it("throws when a token's own $type disagrees with its alias target's type", () => {
        // $type sits on the TOKEN: group-inherited types lose to the alias
        // target per DTCG order and are exempt from this check.
        expect(() =>
            compileThemeCss({
                space: { $type: "dimension", sm: { $value: "8px" } },
                weird: { $type: "color", $value: "{space.sm}" },
            }),
        ).toThrow(/weird.+dimension/);
    });

    it("throws when a composite sub-value aliases a token of the wrong type", () => {
        expect(() =>
            compileThemeCss({
                space: { $type: "dimension", sm: { $value: "8px" } },
                shadow: {
                    card: {
                        $type: "shadow",
                        $value: { color: "{space.sm}", offsetX: "0px", offsetY: "1px" },
                    },
                },
            }),
        ).toThrow(/shadow\.card.+dimension/);
    });
});

import { createElement } from "remix/ui";
import { renderToString } from "remix/ui/server";

describe("Theme component", () => {
    it("renders a style tag with the theme CSS", async () => {
        let { Theme } = createTheme(config, {
            modes: { dark: { color: { bg: { $value: "{color.gray.900}" } } } },
        });
        let html = await renderToString(createElement(Theme, {}));
        expect(html).toContain("<style");
        expect(html).toContain("data-pitlane-theme");
        expect(html).toContain("--color-white: #fff;");
        expect(html).toContain("@media (prefers-color-scheme: dark)");
        expect(html).toContain("--color-bg: var(--color-gray-900);");
    });

    it("passes the nonce through", async () => {
        let { Theme } = createTheme(config);
        let html = await renderToString(createElement(Theme, { nonce: "abc123" }));
        expect(html).toContain('nonce="abc123"');
    });

    it("escapes </style in token values", async () => {
        let { Theme } = createTheme({
            font: { $type: "fontFamily", evil: { $value: "</style><script>" } },
        });
        let html = await renderToString(createElement(Theme, {}));
        expect(html).not.toContain("</style><script>");
        expect(html).toContain("<\\/style>");
    });
});

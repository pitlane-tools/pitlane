import { ValidationError } from "remix/data-schema";
import { createElement } from "remix/ui";
import { renderToString } from "remix/ui/server";
import { describe, expect, it } from "vitest";

import { lightDark, scale } from "./scale.ts";
import * as s from "./schema.ts";
import { createTheme } from "./theme.ts";
import { ThemeError } from "./tokens.ts";

let primitives = {
    schema: {
        color: s.color(),
        space: s.dimension(),
        motion: { fast: s.duration(), ease: s.easing() },
        shadow: s.shadow(),
    },
    tokens: {
        color: { white: "#fff", gray: { 50: "#fafafa", 900: "#171717" } },
        space: { sm: "8px", md: "16px" },
        motion: { fast: "150ms", ease: [0.25, 0.1, 0.25, 1] },
        shadow: { card: "0 1px 2px rgb(0 0 0 / 0.07)" },
    },
} as const;

/**
 * A reference is a property access on the layer below, which is the only
 * reference form: there is no string syntax for one.
 */
function themed() {
    return createTheme(primitives).extend(base => ({
        schema: { color: s.color(), motion: { press: s.transition() } },
        tokens: {
            color: { surface: base.color.white, text: base.color.gray[900] },
            motion: { press: `${base.motion.fast} cubic-bezier(0.25, 0.1, 0.25, 1) 0s` },
        },
    }));
}

describe("token accessor", () => {
    it("mirrors the token tree with var() references", () => {
        let { token } = themed();
        expect(token.color.white).toBe("var(--color-white)");
        expect(token.color.gray[900]).toBe("var(--color-gray-900)");
        expect(token.space.md).toBe("var(--space-md)");
        expect(token.motion.ease).toBe("var(--motion-ease)");
    });

    it("kebab-cases camelCase path segments", () => {
        let { token, cssText } = createTheme({
            schema: { fontWeight: s.font.weight() },
            tokens: { fontWeight: { extraBold: 800 } },
        });
        expect(token.fontWeight.extraBold).toBe("var(--font-weight-extra-bold)");
        expect(cssText).toContain("--font-weight-extra-bold: 800;");
    });

    it("builds a null-prototype accessor, so no token name is inherited", () => {
        let { token } = themed();
        expect(Object.getPrototypeOf(token)).toBe(null);
        expect(Object.getPrototypeOf(token.color)).toBe(null);
        expect((token as Record<string, unknown>).toString).toBeUndefined();
        expect((token as Record<string, unknown>).constructor).toBeUndefined();
    });

    it("does not read a schema off Object.prototype for a token named toString", () => {
        // Own properties only: `toString` must resolve to the declared schema,
        // not to `Object.prototype.toString`.
        let schema = Object.create(null) as Record<string, unknown>;
        let tokens = Object.create(null) as Record<string, unknown>;
        let name = "toString";
        schema[name] = s.color();
        tokens[name] = "#fff";
        expect(createTheme({ schema, tokens } as never).cssText).toContain("--to-string: #fff;");

        let bare = Object.create(null) as Record<string, unknown>;
        bare[name] = "#fff";
        expect(() => createTheme({ schema: {}, tokens: bare } as never)).toThrow();
    });
});

describe("emitted CSS", () => {
    it("declares every token in document order", () => {
        expect(themed().cssText).toBe(
            ":root {\n" +
                "    --color-white: #fff;\n" +
                "    --color-gray-50: #fafafa;\n" +
                "    --color-gray-900: #171717;\n" +
                "    --color-surface: var(--color-white);\n" +
                "    --color-text: var(--color-gray-900);\n" +
                "    --space-sm: 8px;\n" +
                "    --space-md: 16px;\n" +
                "    --motion-fast: 150ms;\n" +
                "    --motion-ease: cubic-bezier(0.25, 0.1, 0.25, 1);\n" +
                "    --motion-press: var(--motion-fast) cubic-bezier(0.25, 0.1, 0.25, 1) 0s;\n" +
                "    --shadow-card: 0 1px 2px rgb(0 0 0 / 0.07);\n" +
                "}",
        );
    });

    it("keeps a reference as a var() indirection so overrides cascade", () => {
        expect(themed().cssText).toContain("--color-surface: var(--color-white);");
    });

    it("passes a light-dark() color through as one value", () => {
        let theme = createTheme({
            schema: { surface: s.color() },
            tokens: { surface: { page: lightDark("#fff", "#171717") } },
        });
        expect(theme.cssText).toContain("--surface-page: light-dark(#fff, #171717);");
    });

    it("accepts CSS lengths DTCG cannot express", () => {
        let theme = createTheme({
            schema: { space: s.dimension() },
            tokens: { space: { gutter: "clamp(1rem, 4vw, 2.5rem)", indent: "2em", half: "50%" } },
        });
        expect(theme.cssText).toContain("--space-gutter: clamp(1rem, 4vw, 2.5rem);");
        expect(theme.cssText).toContain("--space-indent: 2em;");
        expect(theme.cssText).toContain("--space-half: 50%;");
    });

    it("accepts an inset shadow, which DTCG has no field for", () => {
        let theme = createTheme({
            schema: { shadow: s.shadow() },
            tokens: { shadow: { well: "inset 0 1px 2px rgb(0 0 0 / 0.2)" } },
        });
        expect(theme.cssText).toContain("--shadow-well: inset 0 1px 2px rgb(0 0 0 / 0.2);");
    });
});

describe("s.group", () => {
    let theme = createTheme({
        schema: {
            control: s.group(s.dimension(), { color: s.color(), opacity: s.number() }),
            text: s.group(s.dimension(), { leading: s.number() }),
            line: s.group(s.color(), { width: s.group(s.dimension(), { default: s.dimension() }) }),
        },
        tokens: {
            control: {
                height: { sm: "28px", md: "32px" },
                radius: "6px",
                color: { border: "#d4d4d8" },
                opacity: { disabled: 0.5 },
            },
            text: { sm: "0.875rem", leading: { sm: 1.5 } },
            line: { subtle: "#e7e7e7", width: { default: "1px", thick: "2px" } },
        },
    });

    it("types a node and its unlabelled descendants", () => {
        expect(theme.cssText).toContain("--control-height-sm: 28px;");
        expect(theme.cssText).toContain("--control-radius: 6px;");
        expect(theme.cssText).toContain("--text-sm: 0.875rem;");
    });

    it("lets a child override the node's own type", () => {
        expect(theme.cssText).toContain("--control-color-border: #d4d4d8;");
        expect(theme.cssText).toContain("--control-opacity-disabled: 0.5;");
        expect(theme.cssText).toContain("--text-leading-sm: 1.5;");
    });

    it("reserves no token name, so `default` can carry its own type", () => {
        expect(theme.cssText).toContain("--line-subtle: #e7e7e7;");
        expect(theme.cssText).toContain("--line-width-default: 1px;");
        expect(theme.cssText).toContain("--line-width-thick: 2px;");
    });
});

describe("s.scale", () => {
    let theme = createTheme({
        schema: { spacing: s.scale(), tracking: s.dimension() },
        tokens: { spacing: "0.25rem", tracking: { tight: "-0.01em" } },
    });

    it("emits its own custom property", () => {
        expect(theme.cssText).toContain("--spacing: 0.25rem;");
    });

    it("multiplies into calc() and exposes its base", () => {
        expect(theme.token.spacing(4)).toBe("calc(var(--spacing) * 4)");
        expect(theme.token.spacing(0.5)).toBe("calc(var(--spacing) * 0.5)");
        expect(theme.token.spacing.token).toBe("var(--spacing)");
    });

    it("resolves through raw() by its base", () => {
        expect(theme.raw(theme.token.spacing.token)).toBe("0.25rem");
    });

    it("works as an authored token value in a later layer", () => {
        let next = theme.extend(t => ({
            schema: { gap: s.dimension() },
            tokens: { gap: { lg: t.spacing(8) } },
        }));
        expect(next.cssText).toContain("--gap-lg: calc(var(--spacing) * 8);");
    });

    it("leaves the module-level scale() for ordinary tokens", () => {
        expect(scale(theme.token.tracking.tight)(2)).toBe("calc(var(--tracking-tight) * 2)");
    });
});

describe("s.any", () => {
    let theme = createTheme({
        schema: { animate: s.any(), aspect: s.any() },
        tokens: { animate: { spin: "spin 1s linear infinite" }, aspect: { video: "16 / 9" } },
    });

    it("emits its value verbatim", () => {
        expect(theme.cssText).toContain("--animate-spin: spin 1s linear infinite;");
        expect(theme.cssText).toContain("--aspect-video: 16 / 9;");
    });

    it("resolves through raw()", () => {
        expect(theme.raw(theme.token.animate.spin)).toBe("spin 1s linear infinite");
    });

    it("refuses a string-or-number value it cannot emit", () => {
        expect(() =>
            createTheme({ schema: { x: s.any() }, tokens: { x: { y: ["a", "b"] } } }),
        ).toThrow(ValidationError);
    });

    it("cannot be the target of a typed reference", () => {
        let untyped = createTheme({
            schema: { animate: s.any() },
            tokens: { animate: { spin: "spin 1s" } },
        });
        expect(() =>
            untyped.extend(base => ({
                schema: { color: s.color() },
                tokens: { color: { x: base.animate.spin as never } },
            })),
        ).toThrow(/references untyped token "animate.spin"/);
    });
});

describe("raw", () => {
    let theme = themed();

    it("returns a concrete value", () => {
        expect(theme.raw(theme.token.color.white)).toBe("#fff");
    });

    it("follows a reference to the end", () => {
        expect(theme.raw(theme.token.color.surface)).toBe("#fff");
        expect(theme.raw(theme.token.color.text)).toBe("#171717");
    });

    it("resolves a reference inside a composite", () => {
        expect(theme.raw(theme.token.motion.press)).toBe(
            "var(--motion-fast) cubic-bezier(0.25, 0.1, 0.25, 1) 0s",
        );
    });

    it("throws for a reference it did not mint", () => {
        expect(() => theme.raw("var(--nope)" as never)).toThrow(ThemeError);
    });

    it("resolves a reference minted by another theme with the same path", () => {
        let other = createTheme({
            schema: { color: s.color() },
            tokens: { color: { white: "#eee" } },
        });
        expect(theme.raw(other.token.color.white)).toBe("#fff");
    });
});

describe("extend", () => {
    let theme = themed();

    it("adds tokens to an existing namespace without a new schema entry", () => {
        let next = theme.extend({ tokens: { color: { black: "#000" } } });
        expect(next.cssText).toContain("--color-black: #000;");
        expect(next.cssText).toContain("--color-white: #fff;");
    });

    it("takes accessor references from the layer below", () => {
        let next = theme.extend(t => ({
            schema: { ink: s.color() },
            tokens: { ink: { body: t.color.gray[900] } },
        }));
        expect(next.cssText).toContain("--ink-body: var(--color-gray-900);");
    });

    it("overrides a leaf without disturbing its siblings", () => {
        let next = theme.extend({ tokens: { color: { white: "#fefefe" } } });
        expect(next.cssText).toContain("--color-white: #fefefe;");
        expect(next.cssText).toContain("--color-gray-900: #171717;");
    });

    it("merges a schema group, keeping its siblings", () => {
        let next = theme.extend({
            schema: { motion: { slow: s.duration() } },
            tokens: { motion: { slow: "400ms" } },
        });
        expect(next.cssText).toContain("--motion-slow: 400ms;");
        expect(next.cssText).toContain("--motion-fast: 150ms;");
    });

    it("chains", () => {
        let next = theme
            .extend({ schema: { z: s.number() }, tokens: { z: { modal: 100 } } })
            .extend({ schema: { z: s.number() }, tokens: { z: { toast: 200 } } });
        expect(next.cssText).toContain("--z-modal: 100;");
        expect(next.cssText).toContain("--z-toast: 200;");
    });
});

describe("select", () => {
    let theme = themed();

    it("replaces the base and re-roots references to their own values", () => {
        let narrowed = theme.select(t => ({
            schema: { color: s.color() },
            tokens: { color: { gray: t.color.gray } },
        }));
        expect(narrowed.cssText).toBe(
            ":root {\n    --color-gray-50: #fafafa;\n    --color-gray-900: #171717;\n}",
        );
    });

    it("reshapes and renames, because the new path names the property", () => {
        let renamed = theme.select(t => ({
            schema: { brand: s.color() },
            tokens: { brand: { light: t.color.gray[50], dark: t.color.gray[900] } },
        }));
        expect(renamed.cssText).toContain("--brand-light: #fafafa;");
        expect(renamed.cssText).toContain("--brand-dark: #171717;");
    });

    it("carries a scale through its base", () => {
        let theme2 = createTheme({ schema: { spacing: s.scale() }, tokens: { spacing: "4px" } });
        let narrowed = theme2.select(t => ({
            schema: { spacing: s.scale() },
            tokens: { spacing: t.spacing.token },
        }));
        expect(narrowed.cssText).toContain("--spacing: 4px;");
        expect(narrowed.token.spacing(3)).toBe("calc(var(--spacing) * 3)");
    });

    it("fails when a selected reference's target was dropped", () => {
        expect(() =>
            theme.select(t => ({
                schema: { color: s.color() },
                tokens: { color: { surface: t.color.surface } },
            })),
        ).toThrow(/references "color.white", which the projection dropped/);
    });

    it("composes with extend", () => {
        let next = theme
            .select(t => ({
                schema: { color: s.color() },
                tokens: { color: { gray: t.color.gray } },
            }))
            .extend(t => ({
                schema: { ink: s.color() },
                tokens: { ink: { body: t.color.gray[900] } },
            }));
        expect(next.cssText).toContain("--ink-body: var(--color-gray-900);");
        expect(next.cssText).not.toContain("--space-md");
    });
});

describe("modes", () => {
    // A mode override that references another token goes in an extend layer,
    // because a reference is a property access on the layer below.
    it("emits a media block per mode", () => {
        let theme = themed().extend(base => ({
            tokens: {},
            modes: { dark: { tokens: { color: { surface: base.color.gray[900] } } } },
        }));
        expect(theme.cssText).toContain(
            "@media (prefers-color-scheme: dark) {\n" +
                "    :root {\n" +
                "        --color-surface: var(--color-gray-900);\n" +
                "    }\n" +
                "}",
        );
    });

    it("emits both blocks when a mode declares a selector too", () => {
        let theme = themed().extend(base => ({
            tokens: {},
            modes: {
                dark: {
                    selector: ':root[data-color-scheme="dark"]',
                    tokens: { color: { surface: base.color.gray[900] } },
                },
            },
        }));
        expect(theme.cssText).toContain(
            ':root[data-color-scheme="dark"] {\n    --color-surface: var(--color-gray-900);\n}',
        );
        expect(theme.cssText).toContain("@media (prefers-color-scheme: dark) {");
    });

    it("takes a custom media query for a mode with a name of its own", () => {
        let theme = themed().extend(base => ({
            tokens: {},
            modes: {
                print: { media: "print", tokens: { color: { surface: base.color.white } } },
            },
        }));
        expect(theme.cssText).toContain("@media print {");
    });

    it("takes a plain value, with no reference involved", () => {
        let theme = themed().extend({
            tokens: {},
            modes: { dark: { tokens: { shadow: { card: "0 1px 2px rgb(0 0 0 / 0.4)" } } } },
        });
        expect(theme.cssText).toContain("--shadow-card: 0 1px 2px rgb(0 0 0 / 0.4);");
    });

    it("throws for an override of a token that does not exist", () => {
        expect(() =>
            themed().extend({
                tokens: {},
                modes: { dark: { tokens: { color: { nope: "#000" } } } },
            } as never),
        ).toThrow(/Mode "dark" overrides unknown token "color.nope"/);
    });

    it("emits no block for a mode that overrides nothing", () => {
        let theme = themed().extend({ tokens: {}, modes: { dark: { tokens: {} } } });
        expect(theme.cssText).not.toContain("@media");
    });
});

describe("validation", () => {
    it("reports every bad value in one pass, each with its path", () => {
        let error: unknown;
        try {
            createTheme({
                schema: { color: s.color(), weight: s.font.weight() },
                tokens: { color: { bad: 42 }, weight: { bad: "chunky" } },
            });
        } catch (caught) {
            error = caught;
        }
        expect(error).toBeInstanceOf(ValidationError);
        let issues = (error as ValidationError).issues;
        expect(issues.map(issue => issue.path?.map(String).join("."))).toEqual([
            "color.bad",
            "weight.bad",
        ]);
        expect(issues[1]!.message).toContain("unknown fontWeight keyword");
    });

    it("reports a leaf with no schema entry", () => {
        let error: unknown;
        try {
            createTheme({
                schema: { color: s.color() },
                tokens: { color: { x: "#fff" }, space: { md: "1rem" } },
            });
        } catch (caught) {
            error = caught;
        }
        expect((error as ValidationError).issues[0]!.message).toContain("has no schema entry");
    });

    it("leaves a var() this theme does not declare as an ordinary value", () => {
        // Not every var() is a reference: an application may define its own
        // custom properties elsewhere.
        let theme = createTheme({
            schema: { color: s.color() },
            tokens: { color: { host: "var(--host-brand)" } },
        });
        expect(theme.cssText).toContain("--color-host: var(--host-brand);");
    });

    it("throws when a reference has the wrong type", () => {
        let dimensions = createTheme({
            schema: { space: s.dimension() },
            tokens: { space: { md: "1rem" } },
        });
        expect(() =>
            dimensions.extend(base => ({
                schema: { color: s.color() },
                tokens: { color: { x: base.space.md as never } },
            })),
        ).toThrow(/of type "dimension" where "color" is required/);
    });

    it("throws when two paths produce the same variable", () => {
        expect(() =>
            createTheme({
                schema: { a: s.group(s.color(), { b: s.color() }), "a-b": s.color() },
                tokens: { a: { b: "#fff" }, "a-b": "#000" },
            }),
        ).toThrow(/both produce the CSS variable --a-b/);
    });

    it("throws for a name containing a reserved character", () => {
        expect(() =>
            createTheme({ schema: { color: s.color() }, tokens: { color: { "a.b": "#fff" } } }),
        ).toThrow(/reserved by references/);
    });
});

describe("the Theme component", () => {
    it("renders a style element with the compiled properties", async () => {
        let { Theme } = themed();
        let html = await renderToString(createElement(Theme, {}));
        expect(html).toContain("data-pitlane-theme");
        expect(html).toContain("--color-white: #fff;");
    });

    it("passes a nonce through", async () => {
        let { Theme } = themed();
        expect(await renderToString(createElement(Theme, { nonce: "abc123" }))).toContain(
            'nonce="abc123"',
        );
    });

    it("escapes a closing style tag in a value", async () => {
        let { Theme } = createTheme({
            schema: { font: s.font.family() },
            tokens: { font: { sneaky: "</style><script>x</script>" } },
        });
        let html = await renderToString(createElement(Theme, {}));
        expect(html).not.toContain("</style><script>");
    });

    it("carries the init it was compiled from, so a theme is re-derivable", () => {
        let theme = themed();
        expect(createTheme(theme.Theme).cssText).toBe(theme.cssText);
    });

    it("re-derives a chain from a published theme", () => {
        let theme = themed();
        let next = createTheme(theme.Theme).extend({
            schema: { ink: s.color() },
            tokens: { ink: { body: "#111" } },
        });
        expect(next.cssText).toContain("--ink-body: #111;");
        expect(next.cssText).toContain("--color-white: #fff;");
    });
});

describe("references written as accessor property access", () => {
    let theme = createTheme({
        schema: { color: s.color(), surface: s.color() },
        tokens: { color: { white: "#fff" }, surface: {} },
    }).extend(t => ({
        schema: { surface: s.color() },
        tokens: { surface: { page: t.color.white } },
    }));

    it("keeps the var() indirection so a mode override cascades", () => {
        expect(theme.cssText).toContain("--surface-page: var(--color-white);");
    });

    it("resolves through raw() to the concrete value", () => {
        expect(theme.raw(theme.token.surface.page)).toBe("#fff");
    });

    it("is type-checked like a braced reference", () => {
        let mistyped = createTheme({
            schema: { space: s.dimension() },
            tokens: { space: { md: "1rem" } },
        });
        expect(() =>
            mistyped.extend(t => ({
                schema: { color: s.color() },
                tokens: { color: { bad: t.space.md as never } },
            })),
        ).toThrow(/of type "dimension" where "color" is required/);
    });

    it("leaves a var() this theme does not declare alone", () => {
        let external = createTheme({
            schema: { color: s.color() },
            tokens: { color: { host: "var(--host-brand)" } },
        });
        expect(external.cssText).toContain("--color-host: var(--host-brand);");
    });

    it("refuses a projection that drops what a kept token references", () => {
        expect(() =>
            theme.select(t => ({
                schema: { surface: s.color() },
                tokens: { surface: { page: t.surface.page } },
            })),
        ).toThrow(/references "color.white", which the projection dropped/);
    });

    it("allows the projection that keeps the target too", () => {
        let narrowed = theme.select(t => ({
            schema: { color: s.color(), surface: s.color() },
            tokens: { color: { white: t.color.white }, surface: { page: t.surface.page } },
        }));
        expect(narrowed.cssText).toContain("--color-white: #fff;");
        expect(narrowed.cssText).toContain("--surface-page: var(--color-white);");
    });
});

describe("color-scheme", () => {
    it("declares light dark when a token uses light-dark()", () => {
        // Without it the function resolves to its light value on every system,
        // verified in Chromium.
        let theme = createTheme({
            schema: { surface: s.color() },
            tokens: { surface: { page: lightDark("#fff", "#111") } },
        });
        expect(theme.cssText).toContain(":root {\n    color-scheme: light dark;\n");
    });

    it("stays out of the way when no token uses it", () => {
        expect(themed().cssText).not.toContain("color-scheme");
    });

    it("sees light-dark() written by hand too", () => {
        let theme = createTheme({
            schema: { surface: s.color() },
            tokens: { surface: { page: "light-dark(#fff, #111)" } },
        });
        expect(theme.cssText).toContain("color-scheme: light dark;");
    });
});

describe("a reference inside composite CSS text", () => {
    let primitive = createTheme({
        schema: { color: s.color(), motion: s.duration() },
        tokens: { color: { highlight: "rgb(255 255 255 / 0.7)" }, motion: { fast: "150ms" } },
    });

    it("keeps the var() indirection so the cascade still reaches it", () => {
        // A composite is CSS text, so a reference goes in by interpolating the
        // accessor leaf, which is already a var() string.
        let theme = primitive.extend(base => ({
            schema: { shadow: s.shadow(), press: s.transition() },
            tokens: {
                shadow: { inset: `inset 0 1px 0 0 ${base.color.highlight}` },
                press: `${base.motion.fast} ease 0s`,
            },
        }));
        expect(theme.cssText).toContain("--shadow-inset: inset 0 1px 0 0 var(--color-highlight);");
        expect(theme.cssText).toContain("--press: var(--motion-fast) ease 0s;");
    });

    it("still cascades a mode override of the referenced token", () => {
        let theme = primitive.extend(base => ({
            schema: { shadow: s.shadow() },
            tokens: { shadow: { inset: `inset 0 1px 0 0 ${base.color.highlight}` } },
            modes: { dark: { tokens: { color: { highlight: "rgb(0 0 0 / 0.4)" } } } },
        }));
        expect(theme.cssText).toContain("--shadow-inset: inset 0 1px 0 0 var(--color-highlight);");
        expect(theme.cssText).toContain("--color-highlight: rgb(0 0 0 / 0.4);");
    });

    it("is seen by select, so dropping the target fails loudly", () => {
        let theme = primitive.extend(base => ({
            schema: { shadow: s.shadow() },
            tokens: { shadow: { inset: `inset 0 1px 0 0 ${base.color.highlight}` } },
        }));
        expect(() =>
            theme.select(base => ({
                schema: { shadow: s.shadow() },
                tokens: { shadow: { inset: base.shadow.inset } },
            })),
        ).toThrow(/references "color.highlight", which the projection dropped/);
    });
});

describe("a reference left over from the string syntax", () => {
    it("is refused rather than emitted as literal braces", () => {
        expect(() =>
            createTheme({
                schema: { color: s.color() },
                tokens: { color: { white: "#fff", surface: "{color.white}" } },
            }),
        ).toThrow(/"color.surface" contains the reference "\{color.white\}"/);
    });

    it("points at the extend layer that replaces it", () => {
        expect(() =>
            createTheme({
                schema: { color: s.color() },
                tokens: { color: { surface: "{color.white}" } },
            }),
        ).toThrow(/base\.color\.white/);
    });

    it("is refused inside composite CSS text too", () => {
        expect(() =>
            createTheme({
                schema: { shadow: s.shadow() },
                tokens: { shadow: { card: "0 1px 2px {color.line}" } },
            }),
        ).toThrow(/contains the reference "\{color.line\}"/);
    });

    it("is refused in a mode override", () => {
        expect(() =>
            createTheme({
                schema: { color: s.color() },
                tokens: { color: { page: "#fff" } },
                modes: { dark: { tokens: { color: { page: "{color.nope}" } } } },
            }),
        ).toThrow(/contains the reference "\{color.nope\}"/);
    });
});

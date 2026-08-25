import { describe, expectTypeOf, it } from "vitest";

import type {
    ColorToken,
    CubicBezierToken,
    DimensionToken,
    DurationToken,
    FontFamilyToken,
    FontWeightToken,
    NumberToken,
    ShadowToken,
    TransitionToken,
    UntypedToken,
} from "./brands.ts";
import type { ThemedCSSProps } from "./props.ts";
import type { DeepPartialTokens } from "./types.ts";

import { lightDark, scale } from "./scale.ts";
import * as s from "./schema.ts";
import { createTheme } from "./theme.ts";

let theme = createTheme({
    schema: {
        color: s.color(),
        spacing: s.scale(),
        radius: s.dimension(),
        font: s.font.family(),
        weight: s.font.weight(),
        shadow: s.shadow(),
        animate: s.any(),
        tracking: s.dimension(),
        motion: { fast: s.duration(), ease: s.easing() },
        control: s.group(s.dimension(), { color: s.color(), opacity: s.number() }),
        line: s.group(s.color(), { width: s.group(s.dimension(), { default: s.dimension() }) }),
        text: s.group(s.dimension(), { leading: s.number() }),
    },
    tokens: {
        color: {
            white: "#fff",
            gray: { 50: "#fafafa", 900: "#171717" },
            surface: "{color.white}",
            page: lightDark("#fff", "#171717"),
        },
        spacing: "0.25rem",
        radius: { md: "8px" },
        font: { sans: ["Inter var", "system-ui"] },
        weight: { regular: 400 },
        shadow: { card: "0 1px 2px rgb(0 0 0 / 0.07)" },
        animate: { spin: "spin 1s linear infinite" },
        tracking: { tight: "-0.01em" },
        motion: { fast: "150ms", ease: [0.25, 0.1, 0.25, 1] },
        control: {
            height: { sm: "28px" },
            radius: "6px",
            color: { border: "#ddd" },
            opacity: { half: 0.5 },
        },
        line: { subtle: "#eee", width: { default: "1px", thick: "2px" } },
        text: { sm: "0.875rem", leading: { sm: 1.5 } },
    },
});

describe("the schema brands every leaf", () => {
    it("names each token type", () => {
        expectTypeOf(theme.token.color.white).toEqualTypeOf<ColorToken>();
        expectTypeOf(theme.token.color.gray[900]).toEqualTypeOf<ColorToken>();
        expectTypeOf(theme.token.radius.md).toEqualTypeOf<DimensionToken>();
        expectTypeOf(theme.token.font.sans).toEqualTypeOf<FontFamilyToken>();
        expectTypeOf(theme.token.weight.regular).toEqualTypeOf<FontWeightToken>();
        expectTypeOf(theme.token.shadow.card).toEqualTypeOf<ShadowToken>();
        expectTypeOf(theme.token.motion.fast).toEqualTypeOf<DurationToken>();
        expectTypeOf(theme.token.motion.ease).toEqualTypeOf<CubicBezierToken>();
    });

    it("resolves a reference and a lightDark() value through the group", () => {
        expectTypeOf(theme.token.color.surface).toEqualTypeOf<ColorToken>();
        expectTypeOf(theme.token.color.page).toEqualTypeOf<ColorToken>();
    });

    it("brands an untyped token nominally", () => {
        expectTypeOf(theme.token.animate.spin).toEqualTypeOf<UntypedToken>();
    });

    it("keeps brands nominal", () => {
        expectTypeOf(theme.token.color.white).not.toEqualTypeOf<DimensionToken>();
        expectTypeOf<string>().not.toEqualTypeOf<ColorToken>();
    });
});

describe("s.group", () => {
    it("types a node and its unlabelled descendants", () => {
        expectTypeOf(theme.token.control.height.sm).toEqualTypeOf<DimensionToken>();
        expectTypeOf(theme.token.control.radius).toEqualTypeOf<DimensionToken>();
        expectTypeOf(theme.token.text.sm).toEqualTypeOf<DimensionToken>();
    });

    it("lets a child override it", () => {
        expectTypeOf(theme.token.control.color.border).toEqualTypeOf<ColorToken>();
        expectTypeOf(theme.token.control.opacity.half).toEqualTypeOf<NumberToken>();
        expectTypeOf(theme.token.text.leading.sm).toEqualTypeOf<NumberToken>();
    });

    it("reserves no token name", () => {
        expectTypeOf(theme.token.line.subtle).toEqualTypeOf<ColorToken>();
        expectTypeOf(theme.token.line.width.default).toEqualTypeOf<DimensionToken>();
    });
});

describe("scales", () => {
    it("makes the accessor leaf a multiplier with its base attached", () => {
        expectTypeOf(theme.token.spacing).toBeCallableWith(4);
        expectTypeOf(theme.token.spacing(4)).toEqualTypeOf<DimensionToken>();
        expectTypeOf(theme.token.spacing.token).toEqualTypeOf<DimensionToken>();
    });

    it("rejects a scale leaf where a value belongs", () => {
        let styles: ThemedCSSProps = {
            // @ts-expect-error a scale leaf is not a dimension until it is called
            padding: theme.token.spacing,
        };
        expectTypeOf(styles).toMatchTypeOf<ThemedCSSProps>();
    });

    it("keeps the brand it was given", () => {
        expectTypeOf(scale(theme.token.tracking.tight)(2)).toEqualTypeOf<DimensionToken>();
        expectTypeOf(scale(theme.token.motion.fast)(2)).toEqualTypeOf<DurationToken>();
        expectTypeOf(scale(theme.token.control.opacity.half)(2)).toEqualTypeOf<NumberToken>();
    });

    it("refuses a base it cannot multiply", () => {
        // @ts-expect-error a shadow is not scalable
        scale(theme.token.shadow.card);
        // @ts-expect-error a scale leaf is already a multiplier
        scale(theme.token.spacing);
    });
});

describe("extend", () => {
    let extended = theme.extend(t => ({
        schema: { ink: s.color(), motion: { press: s.transition() } },
        tokens: {
            color: { black: "#000" },
            ink: { body: t.color.gray[900] },
            motion: { press: `${t.motion.fast} ease 0s` },
        },
    }));

    it("brands what it adds and keeps what it merged onto", () => {
        expectTypeOf(extended.token.ink.body).toEqualTypeOf<ColorToken>();
        expectTypeOf(extended.token.color.black).toEqualTypeOf<ColorToken>();
        expectTypeOf(extended.token.motion.press).toEqualTypeOf<TransitionToken>();
        expectTypeOf(extended.token.motion.fast).toEqualTypeOf<DurationToken>();
        expectTypeOf(extended.token.radius.md).toEqualTypeOf<DimensionToken>();
        expectTypeOf(extended.token.spacing(2)).toEqualTypeOf<DimensionToken>();
    });
});

describe("select", () => {
    let selected = theme.select(t => ({
        schema: { color: s.color(), spacing: s.scale() },
        tokens: { color: { gray: t.color.gray }, spacing: t.spacing.token },
    }));

    it("narrows the accessor to the projection", () => {
        expectTypeOf(selected.token.color.gray[900]).toEqualTypeOf<ColorToken>();
        expectTypeOf(selected.token.spacing(4)).toEqualTypeOf<DimensionToken>();
        expectTypeOf(selected.token).not.toHaveProperty("radius");
        expectTypeOf(selected.token).not.toHaveProperty("control");
    });

    it("renames through the projection's paths", () => {
        let renamed = theme.select(t => ({
            schema: { brand: s.color() },
            tokens: { brand: { light: t.color.gray[50] } },
        }));
        expectTypeOf(renamed.token.brand.light).toEqualTypeOf<ColorToken>();
    });
});

describe("a leaf with no schema entry", () => {
    it("resolves to unknown rather than to every brand", () => {
        let undeclared = createTheme({
            schema: { color: s.color() },
            tokens: { color: { white: "#fff" }, radius: { md: "8px" } },
        });
        expectTypeOf(undeclared.token.radius.md).toEqualTypeOf<unknown>();
        let styles: ThemedCSSProps = {
            // @ts-expect-error an undeclared leaf is unusable
            borderRadius: undeclared.token.radius.md,
        };
        expectTypeOf(styles).toMatchTypeOf<ThemedCSSProps>();
    });
});

describe("modes", () => {
    it("accepts only paths the token tree has", () => {
        type Overrides = DeepPartialTokens<{ color: { white: "#fff"; page: "{color.white}" } }>;
        expectTypeOf<{ color: { page: string } }>().toMatchTypeOf<Overrides>();
        expectTypeOf<{ color: { nope: string } }>().not.toMatchTypeOf<Overrides>();
        expectTypeOf<{ nope: { page: string } }>().not.toMatchTypeOf<Overrides>();
    });

    it("accepts an override of a token that does exist", () => {
        let theme = createTheme({
            schema: { color: s.color() },
            tokens: { color: { white: "#fff", page: "{color.white}" } },
            modes: { dark: { tokens: { color: { page: "#000" } } } },
        });
        expectTypeOf(theme.token.color.page).toEqualTypeOf<ColorToken>();
    });
});

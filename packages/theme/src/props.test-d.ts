import { describe, expectTypeOf, it } from "vitest";

import type { ThemedCSSProps } from "./props.ts";

import * as s from "./schema.ts";
import { createTheme } from "./theme.ts";

let { token: t } = createTheme({
    schema: {
        color: s.color(),
        space: s.dimension(),
        weight: s.font.weight(),
        shadow: s.shadow(),
        motion: s.duration(),
    },
    tokens: {
        color: { white: "#fff" },
        space: { md: "16px" },
        weight: { bold: 700 },
        shadow: { card: "0 1px 0 #000" },
        motion: { fast: "150ms" },
    },
});

describe("ThemedCSSProps enforcement", () => {
    it("accepts branded tokens, keywords, zero, and tuples", () => {
        expectTypeOf({
            color: t.color.white,
            backgroundColor: "transparent" as const,
            fontSize: t.space.md,
            fontWeight: t.weight.bold,
            boxShadow: t.shadow.card,
            transitionDuration: t.motion.fast,
            margin: 0 as const,
            padding: [t.space.md, 0] as const,
            gap: [t.space.md, t.space.md] as const,
            width: "min-content" as const,
            opacity: 0.5,
            display: "flex",
        }).toMatchTypeOf<ThemedCSSProps>();
    });

    it("rejects off-palette and wrong-brand values", () => {
        // @ts-expect-error — off-palette color literal
        let offPalette: ThemedCSSProps = { color: "#ff0000" };
        // @ts-expect-error — dimension token is not a color
        let wrongBrand: ThemedCSSProps = { color: t.space.md };
        // @ts-expect-error — color token is not a dimension
        let wrongBrand2: ThemedCSSProps = { fontSize: t.color.white };
        // @ts-expect-error — arbitrary string is not a shadow
        let looseShadow: ThemedCSSProps = { boxShadow: "0 0 3px red" };
        // @ts-expect-error — durations reject bare numbers
        let bareDuration: ThemedCSSProps = { transitionDuration: 200 };
        void offPalette;
        void wrongBrand;
        void wrongBrand2;
        void looseShadow;
        void bareDuration;
    });

    it("narrows closed-grammar properties to their keywords", () => {
        expectTypeOf({
            display: "flex" as const,
            position: "sticky" as const,
            resize: "vertical" as const,
            overflowY: "auto" as const,
            flexDirection: "column" as const,
        }).toMatchTypeOf<ThemedCSSProps>();

        // @ts-expect-error — not a `resize` keyword
        let badResize: ThemedCSSProps = { resize: "diagonal" };
        // @ts-expect-error — not an `overflow` keyword
        let badOverflow: ThemedCSSProps = { overflowY: "scrollish" };
        // @ts-expect-error — logical padding takes dimension tokens
        let badLogicalPad: ThemedCSSProps = { paddingBlock: "4rem" };
        void badResize;
        void badOverflow;
        void badLogicalPad;
    });

    it("keeps open-grammar properties loose", () => {
        expectTypeOf({
            border: `1px solid ${t.color.white}`,
            background: "canvas",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            "&:hover": { color: t.color.white },
        }).toMatchTypeOf<ThemedCSSProps>();
    });
});

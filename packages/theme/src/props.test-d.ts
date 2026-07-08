import { describe, expectTypeOf, it } from "vitest";

import type { ThemedCSSProps } from "./props.ts";

import { createTheme } from "./theme.ts";

const { token: t } = createTheme({
    color: { $type: "color", white: { $value: "#fff" } },
    space: { $type: "dimension", md: { $value: "16px" } },
    weight: { $type: "fontWeight", bold: { $value: 700 } },
    shadow: {
        card: {
            $type: "shadow",
            $value: { color: "#000", offsetX: "0px", offsetY: "1px" },
        },
    },
    motion: { $type: "duration", fast: { $value: "150ms" } },
} as const);

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

    it("keeps unmapped properties loose", () => {
        expectTypeOf({
            border: `1px solid ${t.color.white}`,
            background: "canvas",
            "&:hover": { color: t.color.white },
        }).toMatchTypeOf<ThemedCSSProps>();
    });
});

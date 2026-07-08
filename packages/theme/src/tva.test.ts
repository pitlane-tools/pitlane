import { describe, expect, it } from "vitest";

import { tva } from "./tva.ts";
import type { ThemedCSSProps } from "./props.ts";

let button = tva({
    base: { margin: 0, "&:hover": { opacity: 0.9 } },
    variants: {
        intent: {
            primary: { color: "currentColor", "&:hover": { opacity: 1 } },
            danger: { color: "transparent" },
        },
        block: {
            true: { width: "auto" },
            false: {},
        },
    },
    compoundVariants: [{ intent: "danger", block: true, css: { opacity: 0.5 } }],
    defaultVariants: { intent: "primary", block: false },
});

describe("tva", () => {
    it("resolves defaults", () => {
        expect(button.resolve()).toEqual({
            margin: 0,
            color: "currentColor",
            "&:hover": { opacity: 1 },
        });
    });

    it("resolves explicit variants and boolean keys", () => {
        expect(button.resolve({ intent: "danger", block: true })).toEqual({
            margin: 0,
            color: "transparent",
            width: "auto",
            "&:hover": { opacity: 0.9 },
            opacity: 0.5,
        });
    });

    it("ignores explicitly-undefined props in favor of defaults", () => {
        expect(button.resolve({ intent: undefined })).toMatchObject({ color: "currentColor" });
    });

    it("deep-merges nested selector objects rather than replacing the whole base", () => {
        let styles = button.resolve({ intent: "primary" });
        expect(styles["&:hover"]).toEqual({ opacity: 1 });
    });

    it("applies compound variants only when every key matches", () => {
        expect(button.resolve({ intent: "danger", block: false })).not.toMatchObject({
            opacity: 0.5,
        });
    });

    it("merges compound variants after variants (last write wins)", () => {
        let chip = tva({
            variants: { tone: { loud: { opacity: 0.9 } } },
            compoundVariants: [{ tone: "loud", css: { opacity: 0.4 } }],
        });
        expect(chip.resolve({ tone: "loud" })).toEqual({ opacity: 0.4 });
    });

    it("returns a mixin descriptor from the callable", () => {
        let descriptor = button({ intent: "danger" });
        expect(descriptor).toBeTruthy();
        expect(typeof descriptor).toBe("object");
    });

    it("works without base or variants", () => {
        let bare = tva({});
        expect(bare.resolve()).toEqual({});
    });
});

// Type-level guard that resolve() returns ThemedCSSProps
let _styles: ThemedCSSProps = button.resolve();
void _styles;

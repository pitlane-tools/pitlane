import type { TVAProps } from "@pitlane/theme";

import { $ } from "#/theme.ts";
import { combine, tva } from "@pitlane/theme";

/**
 * A cva-style variant component. Every style slot is brand-enforced —
 * `backgroundColor: "#ff0000"` would be a type error here.
 */
export let button = tva({
    base: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: $.radius.md,
        fontWeight: $.weight.medium,
        border: "1px solid transparent",
        cursor: "pointer",
        transition: `background-color ${$.motion.press}, color ${$.motion.press}`,
    },
    variants: {
        intent: {
            primary: {
                backgroundColor: $.color.accent,
                color: $.color.white,
                "&:hover": { backgroundColor: $.color.accentHover },
            },
            secondary: {
                backgroundColor: "transparent",
                color: $.color.text,
                border: `1px solid ${$.color.border}`,
                "&:hover": { backgroundColor: $.color.panel },
            },
            link: {
                backgroundColor: "transparent",
                color: $.color.accent,
                "&:hover": { color: $.color.accentHover },
            },
        },
        size: {
            sm: { padding: [$.space.xs, $.space.sm], fontSize: $.text.sm },
            md: { padding: [$.space.sm, $.space.md], fontSize: $.text.md },
        },
    },
    compoundVariants: [{ intent: "link", size: "md", css: { fontSize: $.text.lg } }],
    defaultVariants: { intent: "primary", size: "md" },
});

export type ButtonProps = TVAProps<typeof button>;

let rounded = tva({
    variants: {
        pill: {
            true: { borderRadius: $.radius.full },
        },
    },
});

/** `combine` composes tva components — the props union of both. */
export let pillButton = combine(button, rounded);

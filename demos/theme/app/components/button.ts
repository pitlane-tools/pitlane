import type { TVAProps } from "@pitlane/theme";

import { t } from "#/theme.ts";
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
        borderRadius: t.radius.md,
        fontWeight: t.weight.medium,
        border: "1px solid transparent",
        cursor: "pointer",
        transition: `background-color ${t.motion.press}, color ${t.motion.press}`,
    },
    variants: {
        intent: {
            primary: {
                backgroundColor: t.color.accent,
                color: t.color.white,
                "&:hover": { backgroundColor: t.color.accentHover },
            },
            secondary: {
                backgroundColor: "transparent",
                color: t.color.text,
                border: `1px solid ${t.color.border}`,
                "&:hover": { backgroundColor: t.color.panel },
            },
            link: {
                backgroundColor: "transparent",
                color: t.color.accent,
                "&:hover": { color: t.color.accentHover },
            },
        },
        size: {
            sm: { padding: [t.space.xs, t.space.sm], fontSize: t.text.sm },
            md: { padding: [t.space.sm, t.space.md], fontSize: t.text.md },
        },
    },
    compoundVariants: [{ intent: "link", size: "md", css: { fontSize: t.text.lg } }],
    defaultVariants: { intent: "primary", size: "md" },
});

export type ButtonProps = TVAProps<typeof button>;

let rounded = tva({
    variants: {
        pill: {
            true: { borderRadius: t.radius.full },
        },
    },
});

/** `combine` composes tva components — the props union of both. */
export let pillButton = combine(button, rounded);

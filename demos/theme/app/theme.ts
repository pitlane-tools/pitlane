import { createTheme, lightDark } from "@pitlane/theme";
import * as s from "@pitlane/theme/schema";

/**
 * The design system for this demo.
 *
 * - The schema names each namespace's token type. `s.group` types a node
 *   and lets its children override, which is how `text` carries both a
 *   size and a line height.
 * - Semantic tokens (`color.surface`, `color.text`, …) are references to
 *   the primitive scales. Dark mode overrides only the references, and
 *   the change cascades through every use in pure CSS.
 * - `spacing` is a scale: `t.spacing(4)` is `calc(var(--spacing) * 4)`,
 *   so the ladder does not have to name every step.
 * - Composite tokens are the CSS they compile to, and may interpolate a
 *   reference: `motion.press` uses `t.motion.fast`.
 */
let primitives = createTheme({
    schema: {
        color: s.color(),
        spacing: s.scale(),
        space: s.dimension(),
        radius: s.dimension(),
        size: s.dimension(),
        text: s.group(s.dimension(), { leading: s.number() }),
        weight: s.font.weight(),
        font: s.font.family(),
        motion: { fast: s.duration(), ease: s.easing() },
        shadow: s.shadow(),
    },
    tokens: {
        color: {
            gray: {
                50: "oklch(98.5% 0.002 247.839)",
                200: "oklch(92.8% 0.006 264.531)",
                500: "oklch(55.1% 0.027 264.364)",
                700: "oklch(37.3% 0.034 259.733)",
                900: "oklch(21% 0.034 264.665)",
                950: "oklch(13% 0.028 261.692)",
            },
            blue: {
                400: "oklch(70.7% 0.165 254.624)",
                500: "oklch(62.3% 0.214 259.815)",
                600: "oklch(54.6% 0.245 262.881)",
                700: "oklch(42.4% 0.199 265.638)",
            },
            white: "#fff",
            black: "oklch(0 0 0)",
        },
        spacing: "0.25rem",
        space: { xs: "0.25rem", sm: "0.5rem", md: "1rem", lg: "1.5rem", xl: "2.5rem" },
        radius: { md: "8px", full: "999px" },
        size: { prose: "44rem" },
        text: {
            sm: "0.875rem",
            md: "1rem",
            lg: "1.125rem",
            hero: "2.25rem",
            leading: { tight: 1.15, normal: 1.5 },
        },
        weight: { regular: 400, medium: "medium", bold: 700 },
        font: { sans: ["Inter var", "ui-sans-serif", "system-ui", "sans-serif"] },
        motion: { fast: "150ms", ease: [0.25, 0.1, 0.25, 1] },
        shadow: {
            card:
                "0 1px 2px oklch(21% 0.034 264.665 / 0.08), " +
                "0 4px 12px oklch(21% 0.034 264.665 / 0.06)",
        },
    },
});

export let {
    token: t,
    raw,
    Theme,
} = primitives.extend(base => ({
    schema: {
        color: s.color(),
        motion: { press: s.transition() },
    },
    tokens: {
        color: {
            // A semantic layer over the scales. Dark mode overrides these.
            surface: base.color.white,
            panel: base.color.gray[50],
            text: base.color.gray[900],
            muted: base.color.gray[500],
            border: base.color.gray[200],
            accent: base.color.blue[600],
            accentHover: base.color.blue[700],
            // `light-dark()` needs no mode at all, and beats a media query
            // inside a subtree that sets `color-scheme`.
            code: lightDark(base.color.gray[50], base.color.gray[900]),
        },
        motion: { press: `${base.motion.fast} cubic-bezier(0.25, 0.1, 0.25, 1) 0s` },
    },
    modes: {
        dark: {
            // Both blocks are emitted. The attribute selector outranks the
            // media block on specificity, so the toggle wins over the OS
            // preference while first paint still follows it.
            selector: ':root[data-color-scheme="dark"]',
            tokens: {
                color: {
                    surface: "{color.gray.950}",
                    panel: "{color.gray.900}",
                    text: "{color.gray.50}",
                    border: "{color.gray.700}",
                    accent: "{color.blue.500}",
                    accentHover: "{color.blue.400}",
                },
            },
        },
    },
}));

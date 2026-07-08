import { createTheme } from "@pitlane/theme";

/**
 * The design system for this demo, defined once as a W3C DTCG token document.
 *
 * - Semantic tokens (`color.surface`, `color.text`, …) are aliases of the
 *   primitive scales. Dark mode overrides only the aliases, and the change
 *   cascades through every reference in pure CSS.
 * - Both DTCG value forms work: legacy strings ("1rem") and structured
 *   objects ({ value: 2.5, unit: "rem" }, { colorSpace: "oklch", … }).
 * - Composite tokens (shadow, transition) may alias other tokens in their
 *   sub-values — `motion.press` references `{motion.fast}`.
 */
export let {
    token: $,
    raw,
    Theme,
} = createTheme(
    {
        color: {
            $type: "color",
            gray: {
                50: { $value: "oklch(98.5% 0.002 247.839)" },
                200: { $value: "oklch(92.8% 0.006 264.531)" },
                500: { $value: "oklch(55.1% 0.027 264.364)" },
                700: { $value: "oklch(37.3% 0.034 259.733)" },
                900: { $value: "oklch(21% 0.034 264.665)" },
                950: { $value: "oklch(13% 0.028 261.692)" },
            },
            blue: {
                400: { $value: "oklch(70.7% 0.165 254.624)" },
                500: { $value: "oklch(62.3% 0.214 259.815)" },
                600: { $value: "oklch(54.6% 0.245 262.881)" },
                700: { $value: "oklch(42.4% 0.199 265.638)" },
            },
            white: { $value: "#fff" },
            // Structured color objects serialize through their color space.
            black: { $value: { colorSpace: "oklch", components: [0, 0, 0] } },
            // Semantic aliases — dark mode overrides these, not the scales.
            surface: { $value: "{color.white}" },
            panel: { $value: "{color.gray.50}" },
            text: { $value: "{color.gray.900}" },
            muted: { $value: "{color.gray.500}" },
            border: { $value: "{color.gray.200}" },
            accent: { $value: "{color.blue.600}" },
            accentHover: { $value: "{color.blue.700}" },
        },
        space: {
            $type: "dimension",
            xs: { $value: "0.25rem" },
            sm: { $value: "0.5rem" },
            md: { $value: "1rem" },
            lg: { $value: "1.5rem" },
            xl: { $value: { value: 2.5, unit: "rem" } },
        },
        radius: {
            $type: "dimension",
            md: { $value: "8px" },
            full: { $value: "999px" },
        },
        size: {
            $type: "dimension",
            prose: { $value: "44rem" },
        },
        text: {
            $type: "dimension",
            sm: { $value: "0.875rem" },
            md: { $value: "1rem" },
            lg: { $value: "1.125rem" },
            hero: { $value: "2.25rem" },
        },
        weight: {
            $type: "fontWeight",
            regular: { $value: 400 },
            medium: { $value: "medium" }, // DTCG keywords map to numbers
            bold: { $value: 700 },
        },
        font: {
            $type: "fontFamily",
            sans: { $value: ["Inter var", "ui-sans-serif", "system-ui", "sans-serif"] },
        },
        motion: {
            fast: { $type: "duration", $value: "150ms" },
            ease: { $type: "cubicBezier", $value: [0.25, 0.1, 0.25, 1] },
            press: {
                $type: "transition",
                $value: { duration: "{motion.fast}", timingFunction: [0.25, 0.1, 0.25, 1] },
            },
        },
        shadow: {
            card: {
                $type: "shadow",
                $value: [
                    {
                        color: "oklch(21% 0.034 264.665 / 0.08)",
                        offsetX: "0px",
                        offsetY: "1px",
                        blur: "2px",
                    },
                    {
                        color: "oklch(21% 0.034 264.665 / 0.06)",
                        offsetX: "0px",
                        offsetY: "4px",
                        blur: "12px",
                    },
                ],
            },
        },
    },
    {
        modes: {
            dark: {
                color: {
                    surface: { $value: "{color.gray.950}" },
                    panel: { $value: "{color.gray.900}" },
                    text: { $value: "{color.gray.50}" },
                    border: { $value: "{color.gray.700}" },
                    accent: { $value: "{color.blue.500}" },
                    accentHover: { $value: "{color.blue.400}" },
                },
            },
        },
    },
);

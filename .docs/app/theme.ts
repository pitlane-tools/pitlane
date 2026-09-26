import { createTheme, lightDark } from "@pitlane/theme";
import * as s from "@pitlane/theme/schema";

/**
 * The documentation site's design system. The palette follows the Remix
 * reference docs (blue links, pink metadata, quiet grey chrome) and keeps
 * Pitlane's red for the wordmark. Every semantic color is a `light-dark()`
 * pair, so the operating system's color scheme decides the appearance.
 */
let primitives = createTheme({
    schema: {
        palette: s.color(),
        font: s.font.family(),
        weight: s.font.weight(),
        text: s.group(s.dimension(), { leading: s.number() }),
        tracking: s.dimension(),
        spacing: s.scale(),
        radius: s.dimension(),
        size: s.dimension(),
        shadow: s.shadow(),
        duration: s.duration(),
        ease: s.easing(),
        layer: s.number(),
    },
    tokens: {
        palette: {
            white: "#ffffff",
            black: "#000000",
            ink: { 50: "#e7e7ea", 400: "#a0a6b0", 500: "#5d6470", 900: "#1b1b1f" },
            gray: {
                50: "#f7f7f8",
                100: "#f3f5f7",
                150: "#eef0f3",
                200: "#e5e7eb",
                300: "#d1d5db",
                400: "#9ca3af",
                500: "#6b7280",
                600: "#52525b",
                700: "#3a3a42",
                800: "#26262d",
                850: "#18181d",
                900: "#121216",
                950: "#0b0b0e",
            },
            blue: { 300: "#63c2fb", 400: "#2dacf9", 600: "#0578be", 900: "#022f4b" },
            pink: { 400: "#ff5d7a", 600: "#d81b54" },
            red: { 400: "#f87171", 600: "#eb2027", 700: "#b91c1c" },
            yellow: { 300: "#ffdf5f", 800: "#7a6400" },
        },
        font: {
            sans: [
                "ui-sans-serif",
                "system-ui",
                "Segoe UI",
                "Roboto",
                "Helvetica",
                "Arial",
                "sans-serif",
            ],
            mono: [
                "JetBrains Mono Variable",
                "ui-monospace",
                "SFMono-Regular",
                "SF Mono",
                "Menlo",
                "Consolas",
                "monospace",
            ],
        },
        weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
        text: {
            "2xs": "0.6875rem",
            xs: "0.75rem",
            sm: "0.8125rem",
            md: "0.875rem",
            base: "1rem",
            lg: "1.125rem",
            xl: "1.5rem",
            display: "clamp(2rem, 1.5rem + 2vw, 2.75rem)",
            /** Code set inside running text, relative to it. */
            code: "0.875em",
            leading: { tight: 1.15, snug: 1.3, compact: 1.4, normal: 1.6 },
        },
        tracking: { tight: "-0.015em", tighter: "-0.02em", caps: "0.06em" },
        spacing: "0.25rem",
        radius: { sm: "4px", md: "8px", lg: "10px", xl: "12px", panel: "16px", full: "999px" },
        size: {
            header: "4rem",
            sectionBar: "3rem",
            gutter: "1.5rem",
            sidebar: "15rem",
            toc: "15rem",
            prose: "48rem",
            content: "65rem",
            dialog: "40rem",
            menu: "12rem",
            control: "2rem",
            touch: "2.75rem",
            icon: "1.125em",
            wordmark: "1.125rem",
            hairline: "1px",
            focus: "2px",
            full: "100%",
        },
        shadow: {
            sm: "0 1px 2px rgb(0 0 0 / 0.07)",
            lg: "0 16px 34px rgb(0 0 0 / 0.16)",
        },
        duration: { fast: "150ms", moderate: "300ms" },
        ease: { standard: [0.4, 0, 0.2, 1] },
        layer: { sectionBar: 48, header: 50, skip: 100 },
    },
    modes: {
        // Motion collapses to nothing for readers who ask for less of it.
        reducedMotion: {
            media: "(prefers-reduced-motion: reduce)",
            tokens: { duration: { fast: "0s", moderate: "0s" } },
        },
    },
});

export let { token: t, Theme } = primitives.extend(base => ({
    schema: {
        color: s.color(),
        size: s.dimension(),
    },
    tokens: {
        color: {
            canvas: lightDark(base.palette.gray[100], base.palette.gray[950]),
            surface: lightDark(base.palette.white, base.palette.gray[900]),
            raised: lightDark(base.palette.white, base.palette.gray[850]),
            subtle: lightDark(base.palette.gray[50], base.palette.gray[850]),
            muted: lightDark(base.palette.gray[150], base.palette.gray[800]),
            hover: lightDark("rgb(0 0 0 / 0.05)", "rgb(255 255 255 / 0.06)"),
            selected: lightDark("rgb(0 0 0 / 0.08)", "rgb(255 255 255 / 0.1)"),
            backdrop: lightDark("rgb(0 0 0 / 0.5)", "rgb(0 0 0 / 0.72)"),

            text: lightDark(base.palette.ink[900], base.palette.ink[50]),
            secondary: lightDark(base.palette.ink[500], base.palette.ink[400]),
            faint: lightDark(base.palette.gray[400], base.palette.gray[500]),
            link: lightDark(base.palette.blue[600], base.palette.blue[400]),
            linkHover: lightDark(base.palette.blue[900], base.palette.blue[300]),
            linkUnderline: lightDark(
                `color-mix(in srgb, ${base.palette.blue[600]} 30%, transparent)`,
                `color-mix(in srgb, ${base.palette.blue[400]} 35%, transparent)`,
            ),
            /** Metadata: eyebrows, symbol kinds, module names. */
            accent: lightDark(base.palette.pink[600], base.palette.pink[400]),
            brand: base.palette.red[600],
            danger: lightDark(base.palette.red[700], base.palette.red[400]),
            selection: lightDark(base.palette.yellow[300], base.palette.yellow[800]),
            selectionText: lightDark(base.palette.ink[900], base.palette.white),

            border: lightDark(base.palette.gray[200], base.palette.gray[800]),
            control: lightDark(base.palette.gray[300], base.palette.gray[700]),
            strong: lightDark(base.palette.gray[400], base.palette.gray[600]),

            callout: {
                info: {
                    background: lightDark(base.palette.gray[50], base.palette.gray[850]),
                    border: lightDark(base.palette.gray[200], base.palette.gray[800]),
                    title: lightDark(base.palette.ink[900], base.palette.ink[50]),
                },
                tip: {
                    background: lightDark("#ecfdf3", "#0f2a1c"),
                    border: lightDark("#a7e6c1", "#1f5a3a"),
                    title: lightDark("#067647", "#6ce9a6"),
                },
                warning: {
                    background: lightDark("#fff8e6", "#2d2410"),
                    border: lightDark("#f2d38a", "#6b5320"),
                    title: lightDark("#8a5a00", "#fbd168"),
                },
                danger: {
                    background: lightDark("#fff1f2", "#2d1418"),
                    border: lightDark("#f5b5bd", "#6b2a33"),
                    title: lightDark("#b42318", "#fda4af"),
                },
            },
        },
        size: {
            /** Where the article column starts beside the fixed sidebar. */
            sidebarOffset: `calc(${base.size.sidebar} + ${base.size.gutter} * 2)`,
            /** The sidebar's links begin below the search field that heads its column. */
            sidebarTop: `calc(${base.size.header} + ${base.size.control} + 1rem)`,
            belowHeader: `calc(100dvh - ${base.size.header})`,
            belowBars: `calc(100dvh - ${base.size.header} - ${base.size.sectionBar})`,
            barsHeight: `calc(${base.size.header} + ${base.size.sectionBar})`,
            /** The article panel's top padding while the section bar overlays it. */
            belowSectionBar: `calc(${base.size.sectionBar} + 3.25rem)`,
            /** Fragment targets land clear of the fixed bars above them. */
            anchorOffset: `calc(${base.size.header} + 1.5rem)`,
            anchorOffsetBars: `calc(${base.size.header} + ${base.size.sectionBar} + 1rem)`,
            outlineTop: `calc(${base.size.header} + 3.25rem)`,
            dialogWidth: `min(${base.size.dialog}, calc(100vw - 2rem))`,
            dialogHeight: `min(calc(100dvh - ${base.size.header} - 3rem), 50rem)`,
            disclosureHeight: "min(60dvh, 32rem)",
            viewport: "100dvh",
        },
    },
}));

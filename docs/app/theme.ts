import { createTheme, lightDark } from "@pitlane/theme";
import * as s from "@pitlane/theme/schema";

/**
 * Shared site tokens. Semantic colors use `light-dark()` so the system's
 * appearance preference works before scripts load.
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
            racingRed: lightDark("#eb2027", "#d93d44"),
            indigoVelvet: lightDark("#3d348b", "#8a82b2"),
            mediumSlateBlue: lightDark("#5b5bb6", "#9294ca"),
            amberFlame: lightDark("#b87813", "#c09a58"),
            royalGold: lightDark("#9b8225", "#c2b579"),
        },
        font: {
            sans: [
                "ui-sans-serif",
                "system-ui",
                "-apple-system",
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
            "3xs": "0.625rem",
            "2xs": "0.6875rem",
            xs: "0.75rem",
            sm: "0.8125rem",
            md: "0.875rem",
            base: "1rem",
            lg: "1.125rem",
            xl: "1.5rem",
            display: "clamp(2rem, 1.5rem + 2vw, 2.75rem)",
            /** Code set inside running text, relative to it. */
            code: "0.8125em",
            leading: { tight: 1.15, snug: 1.3, compact: 1.4, normal: 1.6 },
        },
        tracking: {
            tight: "-0.015em",
            tighter: "-0.02em",
            caps: "0.06em",
            /** The looser caps of a navigation heading set at label size. */
            label: "0.05em",
        },
        spacing: "0.25rem",
        radius: { sm: "4px", md: "8px", lg: "10px", xl: "12px", panel: "16px", full: "999px" },
        size: {
            header: "4rem",
            sectionBar: "3rem",
            gutter: "1.5rem",
            sidebar: "15rem",
            toc: "15rem",
            // Both measures grow by the sidebar column while the reader has
            // collapsed it, which sets `--docs-reclaimed`.
            prose: "calc(48rem + var(--docs-reclaimed, 0px))",
            content: "calc(65rem + var(--docs-reclaimed, 0px))",
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
        shadow: s.shadow(),
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
            link: lightDark(
                `color-mix(in srgb, ${base.palette.racingRed} 85%, ${base.palette.black})`,
                `color-mix(in srgb, ${base.palette.racingRed} 80%, ${base.palette.white})`,
            ),
            linkHover: lightDark(
                `color-mix(in srgb, ${base.palette.racingRed} 70%, ${base.palette.black})`,
                `color-mix(in srgb, ${base.palette.racingRed} 65%, ${base.palette.white})`,
            ),
            linkUnderline: lightDark(
                `color-mix(in srgb, ${base.palette.racingRed} 30%, transparent)`,
                `color-mix(in srgb, ${base.palette.racingRed} 35%, transparent)`,
            ),
            /** The fill behind the navigation link to the page being read. */
            linkCurrent: lightDark(
                `color-mix(in srgb, ${base.palette.racingRed} 10%, transparent)`,
                `color-mix(in srgb, ${base.palette.racingRed} 18%, transparent)`,
            ),
            /** Metadata: eyebrows, symbol kinds, module names. */
            accent: base.palette.indigoVelvet,
            brand: base.palette.racingRed,
            action: {
                background: `color-mix(in srgb, ${base.palette.racingRed} 90%, ${base.palette.black})`,
                hover: `color-mix(in srgb, ${base.palette.racingRed} 80%, ${base.palette.black})`,
                text: base.palette.white,
            },
            danger: lightDark(
                `color-mix(in srgb, ${base.palette.racingRed} 85%, ${base.palette.black})`,
                `color-mix(in srgb, ${base.palette.racingRed} 80%, ${base.palette.white})`,
            ),
            selection: lightDark(
                `color-mix(in srgb, ${base.palette.racingRed} 20%, ${base.palette.white})`,
                `color-mix(in srgb, ${base.palette.racingRed} 45%, ${base.palette.gray[950]})`,
            ),
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
                    background: lightDark(
                        `color-mix(in srgb, ${base.palette.mediumSlateBlue} 7%, ${base.palette.white})`,
                        `color-mix(in srgb, ${base.palette.mediumSlateBlue} 8%, ${base.palette.gray[850]})`,
                    ),
                    border: lightDark(
                        `color-mix(in srgb, ${base.palette.mediumSlateBlue} 30%, ${base.palette.white})`,
                        `color-mix(in srgb, ${base.palette.mediumSlateBlue} 40%, ${base.palette.gray[800]})`,
                    ),
                    title: base.palette.mediumSlateBlue,
                },
                warning: {
                    background: lightDark(
                        `color-mix(in srgb, ${base.palette.royalGold} 18%, ${base.palette.white})`,
                        base.palette.gray[850],
                    ),
                    border: base.palette.amberFlame,
                    title: lightDark(base.palette.ink[900], base.palette.royalGold),
                },
                danger: {
                    background: lightDark(
                        `color-mix(in srgb, ${base.palette.racingRed} 5%, ${base.palette.white})`,
                        base.palette.gray[850],
                    ),
                    border: lightDark(
                        `color-mix(in srgb, ${base.palette.racingRed} 25%, ${base.palette.white})`,
                        `color-mix(in srgb, ${base.palette.racingRed} 50%, ${base.palette.gray[800]})`,
                    ),
                    title: lightDark(
                        `color-mix(in srgb, ${base.palette.racingRed} 85%, ${base.palette.black})`,
                        `color-mix(in srgb, ${base.palette.racingRed} 80%, ${base.palette.white})`,
                    ),
                },
            },
            /** Expressive Code's frame colors, for chrome drawn around its blocks. */
            code: {
                frame: "var(--ec-frm-trmBg)",
                border: "var(--ec-brdCol)",
            },
        },
        size: {
            /**
             * Where the article panel starts: beside the sidebar column, or at
             * the gutter while the sidebar is collapsed, which sets the property.
             */
            panelStart: `var(--docs-panel-start, calc(${base.size.sidebar} + ${base.size.gutter} * 2))`,
            /** The P of the wordmark, at the wordmark's height. */
            brandMark: `calc(${base.size.wordmark} * 337 / 148)`,
            /** The sidebar toggle: at the sidebar column's end, or beside the P once collapsed. */
            navToggleStart: `calc(${base.size.gutter} + ${base.size.sidebar} - ${base.size.control})`,
            navToggleCollapsedStart: `calc(${base.size.gutter} + ${base.size.wordmark} * 337 / 148 + 1.25rem)`,
            /** The search button beside the collapsed sidebar's toggle. */
            collapsedSearchStart: `calc(${base.size.gutter} + ${base.size.wordmark} * 337 / 148 + 1.25rem + ${base.size.control} + 0.25rem)`,
            /** A header control centered in the header's height. */
            headerControlTop: `calc((${base.size.header} - ${base.size.control}) / 2)`,
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
            /** The inline size of the nearest size container. */
            container: "100cqi",
            tab: "3rem",
            /** An outline drawn inside its element, clear of a clipping ancestor. */
            focusInset: `calc(-1 * ${base.size.focus})`,
            /** How far a control-height button's hit area reaches to a full touch target. */
            touchOverhang: `calc((${base.size.control} - ${base.size.touch}) / 2)`,
            codeBorder: "var(--ec-brdWd)",
            codeRadius: "calc(var(--ec-brdRad) + var(--ec-brdWd))",
            /** One line of an Expressive Code block. */
            codeLine: "calc(var(--ec-codeLineHt) * var(--ec-codeFontSize))",
            /** An Expressive Code block's padding above and below its lines. */
            codePaddingBlock: "calc(2 * var(--ec-codePadBlk))",
        },
        shadow: {
            /** The rule under a row of tabs, which the open tab's bar covers. */
            tabRule: `inset 0 calc(-1 * ${base.size.hairline}) 0 var(--ec-frm-edTabBarBrdBtmCol)`,
        },
    },
}));

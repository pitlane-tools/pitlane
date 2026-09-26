import { css, scale, type ThemedCSSProps, tva } from "@pitlane/theme";

import { compact, noScript } from "../styles/media.ts";
import { t } from "../theme.ts";
import { SECTORS } from "./lap-sequence.ts";

let mono: ThemedCSSProps = {
    fontFamily: t.font.mono,
    fontVariantNumeric: "tabular-nums",
};

export let label: ThemedCSSProps = {
    ...mono,
    margin: 0,
    color: t.color.accent,
    fontSize: t.text["2xs"],
    fontWeight: t.weight.medium,
    letterSpacing: t.tracking.caps,
    lineHeight: t.text.leading.compact,
    textTransform: "uppercase",
};

let focusRing: ThemedCSSProps = {
    "&:focus-visible": { outline: `${t.size.focus} solid ${t.color.accent}`, outlineOffset: 0 },
};

let hairline = `${t.size.hairline} solid ${t.color.border}`;
let fade = `color ${t.duration.fast} ${t.ease.standard}, background-color ${t.duration.fast} ${t.ease.standard}`;

export let boardStyle = css<HTMLDivElement>({
    border: hairline,
    borderRadius: t.radius.panel,
    overflow: "hidden",
    backgroundColor: t.color.surface,
    color: t.color.text,
    fontFamily: t.font.sans,
});

export let barStyle = css<HTMLDivElement>({
    ...label,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: [t.spacing(1), t.spacing(4)],
    padding: [t.spacing(2), t.spacing(4)],
    borderBottom: hairline,
});

export let readoutStyle = css<HTMLDivElement>({
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    alignItems: "end",
    gap: [t.spacing(4), t.spacing(10)],
    padding: [t.spacing(6), t.spacing(4)],
    borderBottom: hairline,
    [compact]: { gridTemplateColumns: "minmax(0, 1fr)", gap: t.spacing(5) },
});

export let clockStyle = css<HTMLSpanElement>({
    ...mono,
    display: "block",
    color: t.color.accent,
    fontSize: scale(t.text.display)(2.25),
    fontWeight: t.weight.medium,
    letterSpacing: t.tracking.tighter,
    lineHeight: t.text.leading.tight,
    [compact]: { fontSize: scale(t.text.display)(1.6) },
});

export let captionStyle = css<HTMLParagraphElement>({
    margin: [t.spacing(3), 0, 0],
    color: t.color.secondary,
    fontSize: t.text.sm,
    lineHeight: t.text.leading.compact,
});

// Each sector's marker is as wide as its share of the lap.
export let stripStyle = css<HTMLOListElement>({
    display: "grid",
    gridTemplateColumns: SECTORS.map(({ split }) => `${split}fr`).join(" "),
    gap: t.spacing(1),
    margin: 0,
    padding: 0,
    listStyle: "none",
});

export let marker = tva({
    base: {
        display: "block",
        height: t.spacing(1),
        marginTop: t.spacing(1.5),
        backgroundColor: t.color.border,
        transition: fade,
    },
    variants: {
        state: {
            done: { backgroundColor: t.color.callout.tip.title },
            live: { backgroundColor: t.color.link },
            paused: { backgroundColor: t.color.secondary },
            pending: {},
        },
    },
});

export let rowsStyle = css<HTMLOListElement>({ margin: 0, padding: 0, listStyle: "none" });

export let row = tva({
    base: {
        display: "grid",
        gridTemplateColumns: "3rem 5rem minmax(0, 1fr) 8.5rem",
        gridTemplateAreas: '"sector split command state"',
        alignItems: "center",
        columnGap: t.spacing(4),
        rowGap: t.spacing(1),
        padding: [t.spacing(2.5), t.spacing(4)],
        borderBottom: hairline,
        // The running sector carries the selected-signal rule on its edge.
        borderInlineStart: `${t.size.focus} solid transparent`,
        [compact]: {
            gridTemplateColumns: "3rem minmax(0, 1fr) auto",
            gridTemplateAreas: '"sector split state" "command command command"',
        },
    },
    variants: {
        state: {
            done: {},
            live: { borderInlineStartColor: t.color.link },
            paused: { borderInlineStartColor: t.color.secondary },
            pending: {},
        },
    },
});

export let sectorStyle = css<HTMLSpanElement>({ ...label, gridArea: "sector" });

export let split = tva({
    base: {
        ...mono,
        gridArea: "split",
        color: t.color.accent,
        fontSize: t.text.md,
        textAlign: "end",
        transition: fade,
        [compact]: { textAlign: "start" },
    },
    variants: {
        state: {
            done: {},
            live: { color: t.color.link },
            paused: { color: t.color.secondary },
            pending: { color: t.color.secondary },
        },
    },
});

// Only the command scrolls when a narrow column cannot hold it. Focusable, as
// Expressive Code's blocks are, so a keyboard can scroll it too.
export let commandStyle = css<HTMLPreElement>({
    ...focusRing,
    gridArea: "command",
    minWidth: 0,
    margin: 0,
    overflowX: "auto",
    color: t.color.text,
    fontFamily: t.font.mono,
    fontSize: t.text.sm,
    lineHeight: t.text.leading.normal,
    whiteSpace: "pre",
    scrollbarWidth: "thin",
});

export let status = tva({
    base: {
        ...mono,
        gridArea: "state",
        color: t.color.secondary,
        fontSize: t.text.xs,
        letterSpacing: t.tracking.caps,
        textAlign: "end",
        textTransform: "uppercase",
        transition: fade,
    },
    variants: {
        state: {
            done: { color: t.color.callout.tip.title },
            live: { color: t.color.link },
            paused: { color: t.color.secondary },
            pending: {},
        },
    },
});

export let footStyle = css<HTMLDivElement>({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: t.spacing(3),
    padding: [t.spacing(3), t.spacing(4)],
});

export let controlsStyle = css<HTMLDivElement>({
    display: "flex",
    gap: t.spacing(2),
    [noScript]: { display: "none" },
});

export let buttonStyle = css<HTMLButtonElement>({
    ...label,
    ...focusRing,
    minWidth: t.spacing(26),
    minHeight: t.size.touch,
    padding: [0, t.spacing(4)],
    border: hairline,
    borderRadius: t.radius.md,
    backgroundColor: "transparent",
    color: t.color.text,
    cursor: "pointer",
    transition: fade,
    "&:hover": { backgroundColor: t.color.canvas },
    "&[aria-disabled='true']": {
        color: t.color.secondary,
        cursor: "default",
        "&:hover": { backgroundColor: "transparent" },
    },
});

export let linkStyle = css<HTMLAnchorElement>({
    ...focusRing,
    display: "inline-flex",
    alignItems: "center",
    minHeight: t.size.touch,
    color: t.color.text,
    fontSize: t.text.md,
    textDecorationColor: t.color.link,
    textDecorationThickness: t.size.hairline,
    textUnderlineOffset: "0.25em",
    "&:hover": { color: t.color.linkHover },
});

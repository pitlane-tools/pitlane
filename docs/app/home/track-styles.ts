import { css } from "@pitlane/theme";

import { t } from "../theme.ts";

let hairline = `${t.size.hairline} solid ${t.color.border}`;

/**
 * The monitor: a bar with the map's name and its one control, the map, then
 * the legend and the caption side by side where they fit and stacked where
 * they do not.
 */
export let figure = css({
    containerType: "inline-size",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))",
    margin: 0,
    border: hairline,
    borderRadius: t.radius.panel,
    overflow: "hidden",
    backgroundColor: t.color.surface,
    color: t.color.text,
    fontFamily: t.font.mono,
    fontSize: t.text.xs,
    lineHeight: t.text.leading.compact,
    "& > :not(ul, figcaption)": { gridColumn: "1 / -1" },
    "& [data-track-bar]": {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: t.size.touch,
        borderBottom: hairline,
        paddingInlineStart: t.spacing(4),
        color: t.color.accent,
        letterSpacing: t.tracking.caps,
        textTransform: "uppercase",
    },
    "& ul": {
        display: "flex",
        flexWrap: "wrap",
        gap: [t.spacing(1), t.spacing(4)],
        margin: 0,
        padding: [t.spacing(3), t.spacing(4)],
        borderTop: hairline,
        listStyle: "none",
    },
    "& li": { display: "inline-flex", alignItems: "center", gap: t.spacing(2) },
    "& li::before": {
        content: "''",
        width: t.spacing(2.5),
        height: t.spacing(2.5),
        borderRadius: t.radius.full,
    },
    "& [data-runner='lead']": { color: t.color.text },
    "& [data-runner='lead']::before": { backgroundColor: t.color.brand },
    "& [data-runner='field']": { color: t.color.secondary },
    "& [data-runner='field']::before": { backgroundColor: t.color.secondary },
    "& figcaption": {
        padding: [t.spacing(3), t.spacing(4)],
        borderTop: hairline,
        color: t.color.secondary,
    },
});

/** The Pause and Play button, the full height of the bar and ruled off from its name. */
export let controlStyle = css<HTMLButtonElement>({
    display: "inline-flex",
    alignItems: "center",
    gap: t.spacing(2),
    minWidth: t.size.touch,
    minHeight: t.size.touch,
    margin: 0,
    padding: [0, t.spacing(4)],
    border: 0,
    borderInlineStart: hairline,
    borderRadius: 0,
    backgroundColor: "transparent",
    color: t.color.text,
    font: "inherit",
    letterSpacing: t.tracking.caps,
    textTransform: "uppercase",
    cursor: "pointer",
    "&:hover": { backgroundColor: t.color.canvas },
    "&:focus-visible": {
        outline: `${t.size.focus} solid ${t.color.link}`,
        outlineOffset: t.size.focusInset,
    },
    "& svg": { width: t.spacing(3), height: t.spacing(3), fill: "currentColor" },
    // Only a script moves the cars, so only a script offers to stop them.
    "@media (scripting: none)": { display: "none" },
});

export let map = css<SVGSVGElement>({
    display: "block",
    width: t.size.full,
    height: "auto",
    backgroundColor: t.color.canvas,
});

/** The circuit, drawn as a band with a centre line, the way a GPS trace plots it. */
export let track = css<SVGPathElement>({
    fill: "transparent",
    stroke: t.color.secondary,
    strokeWidth: 6,
    strokeLinejoin: "round",
});

export let centreLine = css<SVGPathElement>({
    fill: "transparent",
    stroke: t.color.surface,
    strokeWidth: 1,
});

export let pitLane = css<SVGPathElement>({
    fill: "transparent",
    stroke: t.color.secondary,
    strokeWidth: 1.5,
    strokeLinecap: "round",
});

export let mark = css<SVGElement>({
    fill: "transparent",
    strokeLinecap: "square",
    "&[data-mark='start']": { stroke: t.palette.royalGold, strokeWidth: 3 },
    "&[data-mark='direction']": {
        stroke: t.palette.amberFlame,
        strokeWidth: 1.5,
        strokeLinejoin: "miter",
    },
});

export let turnLabel = css<SVGTextElement>({
    fill: t.color.accent,
    fontFamily: t.font.mono,
    fontSize: t.text.base,
    fontWeight: t.weight.semibold,
    textAnchor: "middle",
    dominantBaseline: "central",
    // The map scales down with its column; its labels keep a readable size.
    "@container (width < 30rem)": { fontSize: t.text.xl },
});

let runner = {
    // `--distance` places the car still; the running animation takes over.
    offsetDistance: "var(--distance)",
    offsetRotate: "0deg",
    offsetAnchor: "0 0",
    stroke: t.color.surface,
    strokeWidth: 2,
} as const;

export let car = css<SVGGElement>({ ...runner, fill: t.color.secondary });

/** The Pitlane car, ringed as the selected signal on a monitor is. */
export let lead = css<SVGGElement>({
    ...runner,
    fill: t.color.brand,
    "& circle:first-child": { fill: "transparent", stroke: t.color.brand, strokeWidth: 1.5 },
});

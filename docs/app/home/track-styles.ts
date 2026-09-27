import { css } from "@pitlane/theme";

import { t } from "../theme.ts";

let hairline = `${t.size.hairline} solid ${t.color.border}`;

/** The monitor: a bar with the map's name, the map, then the legend. */
export let figure = css({
    containerType: "inline-size",
    margin: 0,
    border: hairline,
    borderRadius: t.radius.panel,
    overflow: "hidden",
    backgroundColor: t.color.surface,
    color: t.color.text,
    fontFamily: t.font.mono,
    fontSize: t.text.xs,
    lineHeight: t.text.leading.compact,
    "& [data-track-bar]": {
        display: "flex",
        alignItems: "center",
        minHeight: t.size.touch,
        borderBottom: hairline,
        paddingInline: t.spacing(4),
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

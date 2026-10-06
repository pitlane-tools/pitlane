import type { Handle, RemixNode } from "remix/component";

import { css } from "@pitlane/theme";

import { t } from "../theme.ts";

// Semantic lists also render as readable lists in the installed Markdown guides.
let tiles = css<HTMLDivElement>({
    margin: [0, 0, t.spacing(6)],
    "& > ul": {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 13rem), 1fr))",
        gap: t.spacing(1),
        margin: 0,
        padding: 0,
        listStyle: "none",
    },
    "& > ul > li": {
        position: "relative",
        margin: 0,
        padding: t.spacing(6),
        borderRadius: t.radius.xl,
        backgroundColor: t.color.subtle,
        transition: `background-color ${t.duration.fast} ${t.ease.standard}`,
        "&:hover": { backgroundColor: t.color.muted },
        "&:has(a:focus-visible)": {
            outline: `${t.size.focus} solid ${t.color.link}`,
            outlineOffset: t.size.focus,
        },
    },
    "& > ul > li > p": { margin: [t.spacing(2), 0, 0], color: t.color.secondary },
    "& > ul > li > p:first-child": {
        margin: 0,
        fontSize: t.text.lg,
        fontWeight: t.weight.semibold,
        lineHeight: t.text.leading.snug,
        color: t.color.text,
    },
    "& > ul > li > p:first-child > a": {
        color: "inherit",
        textDecorationLine: "none",
        "@supports selector(:has(a))": { outline: "none" },
        "&::after": { content: '""', position: "absolute", inset: 0 },
        "&:hover": { color: t.color.linkHover },
    },
});

/** Expects a loose Markdown list with one linked title followed by a description per item. */
export function GuideTiles(handle: Handle<{ children?: RemixNode }>) {
    return () => <div mix={tiles}>{handle.props.children}</div>;
}

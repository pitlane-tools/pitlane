import { type ThemedCSSProps, tva } from "@pitlane/theme";

import { t } from "../theme.ts";

/** Present to assistive technology, absent from the layout. */
export const visuallyHidden: ThemedCSSProps = {
    position: "absolute",
    width: t.size.hairline,
    height: t.size.hairline,
    margin: 0,
    padding: 0,
    border: 0,
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
};

/** The small uppercase label over a group of links or options. */
export const eyebrow: ThemedCSSProps = {
    margin: 0,
    color: t.color.secondary,
    fontSize: t.text["2xs"],
    fontWeight: t.weight.bold,
    letterSpacing: t.tracking.caps,
    lineHeight: "normal",
    textTransform: "uppercase",
};

let stateTransition = `background-color ${t.duration.fast} ${t.ease.standard}, color ${t.duration.fast} ${t.ease.standard}, border-color ${t.duration.fast} ${t.ease.standard}`;

/**
 * A chrome button or link: the header's icon buttons, disclosure toggles, and
 * the build-mode switch.
 */
export const control = tva({
    base: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: t.spacing(2),
        minWidth: t.size.control,
        minHeight: t.size.control,
        margin: 0,
        padding: [0, t.spacing(1.5)],
        border: `${t.size.hairline} solid transparent`,
        borderRadius: t.radius.md,
        background: "transparent",
        color: t.color.secondary,
        font: "inherit",
        lineHeight: t.text.leading.compact,
        whiteSpace: "nowrap",
        textDecoration: "none",
        cursor: "pointer",
        transition: stateTransition,
        "&:hover": { backgroundColor: t.color.hover, color: t.color.text },
    },
    variants: {
        tone: {
            ghost: {},
            link: { color: t.color.link, "&:hover": { color: t.color.linkHover } },
            field: {
                justifyContent: "flex-start",
                padding: [0, t.spacing(2.5)],
                borderColor: t.color.control,
                backgroundColor: t.color.raised,
                fontSize: t.text.md,
                "&:hover": { borderColor: t.color.strong, backgroundColor: t.color.raised },
            },
        },
        /** One of a set of alternatives, marked like the sidebar's current page while it is the page being read. */
        option: {
            true: {
                fontSize: t.text.sm,
                fontWeight: t.weight.medium,
                "&[aria-current='page']": {
                    backgroundColor: t.color.selected,
                    color: t.color.text,
                },
            },
        },
    },
    defaultVariants: { tone: "ghost" },
});

/** A panel floating over the page: menus and narrow-width disclosures. */
export const floatingPanel: ThemedCSSProps = {
    margin: 0,
    padding: t.spacing(1.5),
    border: `${t.size.hairline} solid ${t.color.border}`,
    borderRadius: t.radius.lg,
    backgroundColor: t.color.raised,
    color: t.color.text,
    boxShadow: t.shadow.lg,
};

/**
 * Undoes the user-agent box of a `popover` element that the wide layout shows
 * in place. The narrow layout keeps the popover behavior, which needs no
 * script to open, close, or dismiss.
 */
export const inPlacePopover: ThemedCSSProps = {
    display: "block",
    position: "static",
    inset: "auto",
    width: "auto",
    height: "auto",
    margin: 0,
    padding: 0,
    border: 0,
    overflow: "visible",
    color: "inherit",
    backgroundColor: "transparent",
};

/** A row of the document navigation or the page outline. */
export const navLink = tva({
    base: {
        display: "flex",
        alignItems: "center",
        width: t.size.full,
        minHeight: t.size.control,
        padding: [t.spacing(1.75), t.spacing(3)],
        borderRadius: t.radius.md,
        color: t.color.navLink,
        fontSize: t.text.md,
        lineHeight: t.text.leading.compact,
        textDecoration: "none",
        overflowWrap: "anywhere",
        transition: stateTransition,
        "&:hover": { color: t.color.linkHover, backgroundColor: t.color.hover },
        "&[aria-current]": { color: t.color.text, backgroundColor: t.color.selected },
    },
    variants: {
        /** Outline rows indent by heading level below the page's sections. */
        depth: {
            section: {},
            subsection: { paddingInlineStart: t.spacing(7) },
            deeper: { paddingInlineStart: t.spacing(11) },
        },
        size: {
            md: {},
            sm: { fontSize: t.text.xs, padding: [t.spacing(2), t.spacing(3)] },
        },
    },
    defaultVariants: { depth: "section", size: "md" },
});

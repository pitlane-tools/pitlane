import { css } from "@pitlane/theme";
import { clientEntry, type Handle } from "remix/ui";

import { eyebrow, floatingPanel, inPlacePopover, navLink } from "../styles/controls.ts";
import { belowOutlineColumn, narrow, outlineColumn } from "../styles/media.ts";
import { t } from "../theme.ts";

export const OUTLINE_ID = "doc-outline";

/** A heading the outline links to; a type alias, as hydrated props must be. */
export type OutlineHeading = { id: string; text: string; level: number };

export type OutlineProps = {
    headings: OutlineHeading[];
};

/**
 * The page outline: a sticky column beside the article on wide screens and a
 * native popover, disclosed from the section bar, below that. Its links are
 * plain fragment links. Once hydrated it marks the section being read with
 * `aria-current="location"`.
 */
export let Outline = clientEntry(import.meta.url, (handle: Handle<OutlineProps>) => {
    let targets: (HTMLElement | null)[] = [];
    let located: OutlineHeading[] | undefined;
    let active = -1;
    let frame = 0;

    // A heading counts as read once it reaches the fixed bars' edge, which is
    // the root's scroll padding; the last one counts at the bottom of the page.
    function track() {
        frame = 0;
        let root = document.documentElement;
        let edge = Number.parseFloat(getComputedStyle(root).scrollPaddingTop) + 1 || 1;
        let atBottom = window.innerHeight + window.scrollY >= root.scrollHeight - 2;
        let next = -1;
        for (let [index, target] of targets.entries()) {
            if (!target) continue;
            if (!atBottom && target.getBoundingClientRect().top > edge) break;
            next = index;
        }
        if (next === active) return;
        active = next;
        void handle.update();
    }

    function schedule() {
        frame ||= window.requestAnimationFrame(track);
    }

    handle.queueTask(() => {
        window.addEventListener("scroll", schedule, { passive: true, signal: handle.signal });
        window.addEventListener("resize", schedule, { passive: true, signal: handle.signal });
        handle.signal.addEventListener("abort", () => window.cancelAnimationFrame(frame));
    });

    return () => {
        let { headings } = handle.props;
        // A navigation brings the next page's headings; find their targets once it has rendered.
        if (headings !== located) {
            located = headings;
            active = -1;
            handle.queueTask(() => {
                targets = headings.map(heading => document.getElementById(heading.id));
                track();
            });
        }
        return (
            <nav
                aria-labelledby={`${OUTLINE_ID}-title`}
                id={OUTLINE_ID}
                mix={css({
                    ...inPlacePopover,
                    [outlineColumn]: {
                        gridArea: "outline",
                        position: "sticky",
                        insetBlockStart: t.size.outlineTop,
                        alignSelf: "start",
                        maxHeight: t.size.belowBars,
                        overflowY: "auto",
                        overscrollBehavior: "contain",
                    },
                    [belowOutlineColumn]: {
                        "&:not(:popover-open)": { display: "none" },
                        "&:popover-open": {
                            ...floatingPanel,
                            position: "fixed",
                            inset: [t.size.barsHeight, 0, "auto", t.size.sidebarOffset],
                            width: "auto",
                            maxHeight: t.size.disclosureHeight,
                            padding: [t.spacing(2), t.spacing(4), t.spacing(4)],
                            borderRadius: [0, 0, t.radius.lg, t.radius.lg],
                            overflowY: "auto",
                        },
                    },
                    [narrow]: {
                        "&:popover-open": {
                            insetInline: 0,
                            borderRadius: 0,
                            backgroundColor: t.color.canvas,
                        },
                    },
                })}
                popover
            >
                <p
                    id={`${OUTLINE_ID}-title`}
                    mix={css({
                        ...eyebrow,
                        display: "flex",
                        alignItems: "center",
                        minHeight: t.size.control,
                        padding: t.spacing(2),
                        color: t.color.text,
                        fontSize: t.text.xs,
                    })}
                >
                    On this page
                </p>
                <ol
                    mix={css({
                        display: "flex",
                        flexDirection: "column",
                        gap: t.spacing(1),
                        margin: [t.spacing(1), 0, 0],
                        padding: 0,
                        listStyle: "none",
                    })}
                >
                    {headings.map((heading, index) => (
                        <li key={heading.id}>
                            <a
                                aria-current={index === active ? "location" : undefined}
                                href={`#${heading.id}`}
                                mix={navLink({
                                    size: "sm",
                                    depth:
                                        heading.level <= 2
                                            ? "section"
                                            : heading.level === 3
                                              ? "subsection"
                                              : "deeper",
                                })}
                            >
                                {heading.text}
                            </a>
                        </li>
                    ))}
                </ol>
            </nav>
        );
    };
});

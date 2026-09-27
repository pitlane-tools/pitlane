import { combine, tva } from "@pitlane/theme";
import { clientEntry, type Handle, on } from "remix/ui";

import { control } from "../styles/controls.ts";
import { narrow, navCollapsed, noScript } from "../styles/media.ts";
import { t } from "../theme.ts";
import { SidebarIcon } from "./icons.tsx";

/** The root attribute every collapsed-sidebar style keys on; see `navCollapsed`. */
const COLLAPSED = "data-nav-collapsed";
/** Set while the panel slides; see `navSliding`. */
const SLIDING = "data-nav-sliding";

let toggle = combine(
    control,
    tva({
        base: {
            position: "fixed",
            insetBlockStart: t.size.headerControlTop,
            insetInlineStart: t.size.navToggleStart,
            [navCollapsed]: { insetInlineStart: t.size.navToggleCollapsedStart },
            [narrow]: { display: "none" },
            [noScript]: { display: "none" },
        },
    }),
);

let toggleStyle = toggle<HTMLButtonElement>();

const SLIDE: KeyframeAnimationOptions = { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" };

/**
 * Plays a layout change that has already happened as a slide from where each
 * element was. Only `transform` animates, so the browser lays the page out
 * once for the change instead of on every frame. The article panel is
 * transformed, so the fixed corner it draws travels with it.
 */
function slideFrom(starts: Map<HTMLElement, number>) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let root = document.documentElement;
    // A panel sliding in from the right would otherwise widen the page.
    root.style.overflowX = "clip";
    root.toggleAttribute(SLIDING, true);
    let slides = [...starts].flatMap(([element, start]) => {
        let offset = start - element.getBoundingClientRect().left;
        if (offset === 0) return [];
        // Sliding right into a narrower box, the panel trails its own
        // background so no gap opens at the page's edge.
        let trail =
            offset < 0 ? `${-offset}px 0 0 ${getComputedStyle(element).backgroundColor}` : "none";
        return element.animate(
            [
                { transform: `translateX(${offset}px)`, boxShadow: trail },
                { transform: "none", boxShadow: trail },
            ],
            SLIDE,
        );
    });
    void Promise.allSettled(slides.map(slide => slide.finished)).then(() => {
        root.style.removeProperty("overflow-x");
        root.removeAttribute(SLIDING);
    });
}

/**
 * Collapses the wide layout's sidebar, as the Remix guides do: the column
 * slides away, the article panel slides over and widens, the wordmark narrows
 * to its P, and search folds into an icon beside this button. The choice
 * lasts for the visit's soft navigations, not across reloads, so no stored
 * preference has to be restored before the first paint.
 */
export let SidebarToggle = clientEntry(import.meta.url, (handle: Handle<{ controls: string }>) => {
    let collapsed = false;

    // A navigation reconciles the root element and drops an attribute the
    // server never rendered. The observer puts it back in the same task,
    // before a frame could paint the sidebar sliding back in.
    function apply() {
        let root = document.documentElement;
        if (root.hasAttribute(COLLAPSED) !== collapsed) root.toggleAttribute(COLLAPSED, collapsed);
    }

    handle.queueTask(() => {
        collapsed = document.documentElement.hasAttribute(COLLAPSED);
        let observer = new MutationObserver(apply);
        observer.observe(document.documentElement, { attributeFilter: [COLLAPSED] });
        handle.signal.addEventListener("abort", () => observer.disconnect());
    });

    return () => (
        <button
            aria-controls={handle.props.controls}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            mix={[
                toggleStyle,
                on("click", event => {
                    let moving = [event.currentTarget, document.getElementById("main-content")];
                    let starts = new Map(
                        moving.flatMap(element =>
                            element
                                ? [[element, element.getBoundingClientRect().left] as const]
                                : [],
                        ),
                    );
                    collapsed = !collapsed;
                    apply();
                    slideFrom(starts);
                    void handle.update();
                }),
            ]}
            type="button"
        >
            <SidebarIcon />
        </button>
    );
});

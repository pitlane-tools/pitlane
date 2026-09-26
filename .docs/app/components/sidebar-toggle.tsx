import { combine, tva } from "@pitlane/theme";
import { clientEntry, type Handle, on } from "remix/ui";

import { control } from "../styles/controls.ts";
import { narrow, navCollapsed, noScript } from "../styles/media.ts";
import { t } from "../theme.ts";
import { SidebarIcon } from "./icons.tsx";

/** The root attribute every collapsed-sidebar style keys on; see `navCollapsed`. */
const COLLAPSED = "data-nav-collapsed";

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

/**
 * Collapses the wide layout's sidebar, as the Remix guides do: the column
 * fades away, the article panel widens, the wordmark narrows to its P, and
 * search folds into an icon beside this button. The choice lasts for the
 * visit's soft navigations, not across reloads, so no stored preference has
 * to be restored before the first paint.
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
                on("click", () => {
                    collapsed = !collapsed;
                    apply();
                    void handle.update();
                }),
            ]}
            type="button"
        >
            <SidebarIcon />
        </button>
    );
});

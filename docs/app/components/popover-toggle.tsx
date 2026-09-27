import { combine, tva } from "@pitlane/theme";
import { clientEntry, type Handle } from "remix/ui";

import { control, joinedSegment } from "../styles/controls.ts";
import { compact } from "../styles/media.ts";
import { t } from "../theme.ts";
import { ChevronIcon, MenuIcon } from "./icons.tsx";

const ICONS = { menu: MenuIcon, chevron: ChevronIcon };

export type PopoverToggleProps =
    | {
          /** The `id` of the `popover` element this button discloses. */
          controls: string;
          /** An icon-only button, named by `label`. */
          icon: keyof typeof ICONS;
          label: string;
          /** Shown only while the primary navigation is folded into a menu. */
          compactOnly?: boolean;
          /** One segment of a bordered group that clips its corners. */
          joined?: boolean;
      }
    | {
          controls: string;
          /** A text button with a disclosure chevron. */
          text: string;
      };

// One class per button: separately generated classes sit in cascade layers
// ordered by first use, which is not an order to rely on.
let toggle = combine(
    control,
    tva({
        base: {
            flex: "none",
            "& svg": { transition: `transform ${t.duration.fast} ${t.ease.standard}` },
        },
        variants: {
            layout: {
                icon: {},
                chevron: { "&[aria-expanded='true'] svg": { transform: "rotate(180deg)" } },
                text: {
                    gap: t.spacing(1),
                    minHeight: t.size.touch,
                    padding: [0, t.spacing(2)],
                    "&[aria-expanded='true'] svg": { transform: "rotate(180deg)" },
                },
            },
            compactOnly: {
                true: { display: "none", [compact]: { display: "inline-flex" } },
            },
            joined: { true: joinedSegment },
        },
    }),
);

/**
 * The button that opens and closes a native popover: the compact site menu,
 * the narrow-width document navigation and outline, and the Markdown menu.
 *
 * `popovertarget` does the disclosing, with or without a script. Once
 * hydrated, the button also reports the state as `aria-expanded` and closes
 * its popover when a link inside it is followed or the document navigates:
 * a soft navigation keeps the popover element, and so its open state, in place.
 */
export let PopoverToggle = clientEntry(import.meta.url, (handle: Handle<PopoverToggleProps>) => {
    let expanded: boolean | undefined;
    let binding: AbortController | undefined;

    function target(): HTMLElement | null {
        return "popover" in HTMLElement.prototype
            ? document.getElementById(handle.props.controls)
            : null;
    }

    function hide() {
        let popover = target();
        if (popover?.matches(":popover-open")) popover.hidePopover();
    }

    function report(next: boolean | undefined) {
        if (next === expanded) return;
        expanded = next;
        void handle.update();
    }

    // A navigation can replace the popover element along with the page around
    // it, so listeners follow whichever element is current.
    function bind() {
        binding?.abort();
        let popover = target();
        if (!popover) return report(undefined);
        binding = new AbortController();
        let signal = AbortSignal.any([binding.signal, handle.signal]);
        popover.addEventListener("toggle", event => report(event.newState === "open"), { signal });
        popover.addEventListener(
            "click",
            event => {
                if (event.target instanceof Element && event.target.closest("a[href]")) hide();
            },
            { signal },
        );
        report(popover.matches(":popover-open"));
    }

    handle.queueTask(() => {
        bind();
        let top = handle.frames.top;
        top.addEventListener("reloadStart", hide, { signal: handle.signal });
        top.addEventListener("reloadComplete", bind, { signal: handle.signal });
        handle.signal.addEventListener("abort", () => binding?.abort());
    });

    return () => {
        let props = handle.props;
        if ("text" in props) {
            return (
                <button
                    aria-controls={props.controls}
                    aria-expanded={expanded}
                    mix={toggle({ tone: "link", layout: "text" })}
                    popovertarget={props.controls}
                    type="button"
                >
                    {props.text}
                    <ChevronIcon />
                </button>
            );
        }
        let Icon = ICONS[props.icon];
        return (
            <button
                aria-controls={props.controls}
                aria-expanded={expanded}
                aria-label={props.label}
                mix={toggle({
                    layout: props.icon === "chevron" ? "chevron" : "icon",
                    compactOnly: props.compactOnly,
                    joined: props.joined,
                })}
                popovertarget={props.controls}
                type="button"
            >
                <Icon />
            </button>
        );
    };
});

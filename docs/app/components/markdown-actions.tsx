import { css, type ThemedCSSProps } from "@pitlane/theme";
import { clientEntry, type Handle, on } from "remix/ui";

import { markdownPath } from "../document.ts";
import { control, floatingPanel, joinedSegment, visuallyHidden } from "../styles/controls.ts";
import { noScript, scripted } from "../styles/media.ts";
import { t } from "../theme.ts";
import { CheckIcon, CloseIcon, CopyIcon, DocumentIcon, DownloadIcon } from "./icons.tsx";
import { PopoverToggle } from "./popover-toggle.tsx";

const MENU_ID = "markdown-actions-menu";
const ANCHOR = "--markdown-actions";

let segment: ThemedCSSProps = { ...control.resolve({}), ...joinedSegment };

let groupStyle = css<HTMLDivElement>({
    display: "inline-flex",
    alignItems: "stretch",
    border: `${t.size.hairline} solid ${t.color.control}`,
    borderRadius: t.radius.md,
    overflow: "hidden",
    fontSize: t.text.sm,
    anchorName: ANCHOR,
});

let dividerStyle = css<HTMLSpanElement>({
    width: t.size.hairline,
    backgroundColor: t.color.control,
});

// Without a script there is nothing to copy with, so the page's Markdown
// takes the button's place.
let viewStandInStyle = css<HTMLAnchorElement>({ ...segment, [scripted]: { display: "none" } });

let menuStyle = css<HTMLDivElement>({
    ...floatingPanel,
    inset: "auto",
    marginTop: t.spacing(1),
    minWidth: t.size.menu,
    positionAnchor: ANCHOR,
    positionArea: "bottom span-left",
    positionTryFallbacks: "flip-block",
    fontSize: t.text.sm,
    "&:popover-open": { display: "flex", flexDirection: "column", gap: t.spacing(0.5) },
});

let menuItemStyle = css<HTMLAnchorElement>({
    ...control.resolve({}),
    justifyContent: "flex-start",
    width: t.size.full,
    padding: [0, t.spacing(2)],
    color: t.color.text,
});

/**
 * One control for the page's Markdown: copying it, with a menu that views or
 * downloads it.
 */
export function MarkdownActions(handle: Handle<{ url: string }>) {
    return () => {
        let source = markdownPath(handle.props.url);
        return (
            <div data-pagefind-ignore mix={groupStyle}>
                <CopyMarkdown source={source} />
                <a href={source} mix={viewStandInStyle}>
                    <DocumentIcon />
                    View as Markdown
                </a>
                <span aria-hidden="true" mix={dividerStyle} />
                <PopoverToggle
                    controls={MENU_ID}
                    icon="chevron"
                    joined
                    label="More Markdown actions"
                />
                <div id={MENU_ID} mix={menuStyle} popover>
                    <a href={source} mix={menuItemStyle}>
                        <DocumentIcon />
                        View as Markdown
                    </a>
                    <a download href={source} mix={menuItemStyle}>
                        <DownloadIcon />
                        Download Markdown
                    </a>
                </div>
            </div>
        );
    };
}

type CopyState = "idle" | "copied" | "failed";

const CONFIRMATION_MS = 2000;
const ANNOUNCEMENTS: Record<CopyState, string> = {
    idle: "",
    copied: "Markdown copied to clipboard",
    failed: "Copy failed",
};

/**
 * Copies the page's Markdown. The text is fetched on the click and handed to
 * the clipboard as a promise, which keeps the click's user activation in
 * browsers that would refuse a write made after the fetch.
 *
 * A soft navigation keeps this instance and swaps its `source`, so feedback
 * remembers which document it describes and shows only beside that one. A new
 * copy cancels one still in flight, so an older document's text cannot land
 * on the clipboard, or in the feedback, after the newer copy.
 */
export let CopyMarkdown = clientEntry(import.meta.url, (handle: Handle<{ source: string }>) => {
    let feedback: { state: CopyState; source: string } | undefined;
    let reset = 0;
    let pending: AbortController | undefined;

    handle.queueTask(() =>
        handle.signal.addEventListener("abort", () => window.clearTimeout(reset)),
    );

    function settle(state: CopyState, source: string) {
        feedback = { state, source };
        window.clearTimeout(reset);
        reset = window.setTimeout(() => {
            feedback = undefined;
            void handle.update();
        }, CONFIRMATION_MS);
        void handle.update();
    }

    async function copy() {
        pending?.abort();
        let current = new AbortController();
        pending = current;
        let source = handle.props.source;
        let text = fetch(source, { signal: current.signal }).then(response => {
            if (!response.ok) throw new Error(`${source} answered ${response.status}`);
            return response.text();
        });
        try {
            if (typeof ClipboardItem === "undefined") {
                await navigator.clipboard.writeText(await text);
            } else {
                let blob = text.then(value => new Blob([value], { type: "text/plain" }));
                await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
            }
            if (!current.signal.aborted) settle("copied", source);
        } catch (error) {
            if (current.signal.aborted) return;
            console.error(error);
            settle("failed", source);
        }
    }

    return () => {
        let state = feedback?.source === handle.props.source ? feedback.state : "idle";
        return (
            <>
                <button
                    data-state={state === "idle" ? undefined : state}
                    mix={[css({ ...segment, [noScript]: { display: "none" } }), on("click", copy)]}
                    type="button"
                >
                    {state === "copied" ? (
                        <CheckIcon />
                    ) : state === "failed" ? (
                        <CloseIcon />
                    ) : (
                        <CopyIcon />
                    )}
                    Copy Markdown
                </button>
                <span mix={css(visuallyHidden)} role="status">
                    {ANNOUNCEMENTS[state]}
                </span>
            </>
        );
    };
});

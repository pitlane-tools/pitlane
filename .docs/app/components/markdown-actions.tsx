import { css, type ThemedCSSProps } from "@pitlane/theme";
import { clientEntry, type Handle, on } from "remix/ui";

import { markdownPath } from "../document.ts";
import { control, floatingPanel, visuallyHidden } from "../styles/controls.ts";
import { noScript, scripted } from "../styles/media.ts";
import { t } from "../theme.ts";
import { CheckIcon, CloseIcon, CopyIcon, DocumentIcon, DownloadIcon } from "./icons.tsx";
import { PopoverToggle } from "./popover-toggle.tsx";

const MENU_ID = "markdown-actions-menu";
const ANCHOR = "--markdown-actions";

let segment: ThemedCSSProps = control.resolve({});

let groupStyle = css<HTMLDivElement>({
    display: "inline-flex",
    alignItems: "stretch",
    border: `${t.size.hairline} solid ${t.color.control}`,
    borderRadius: t.radius.md,
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
    ...segment,
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
                <PopoverToggle controls={MENU_ID} icon="chevron" label="More Markdown actions" />
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
 */
export let CopyMarkdown = clientEntry(import.meta.url, (handle: Handle<{ source: string }>) => {
    let state: CopyState = "idle";
    let reset = 0;

    handle.queueTask(() =>
        handle.signal.addEventListener("abort", () => window.clearTimeout(reset)),
    );

    function settle(next: CopyState) {
        state = next;
        window.clearTimeout(reset);
        reset = window.setTimeout(() => {
            state = "idle";
            void handle.update();
        }, CONFIRMATION_MS);
        void handle.update();
    }

    async function copy() {
        let text = fetch(handle.props.source).then(response => {
            if (!response.ok) throw new Error(`${handle.props.source} answered ${response.status}`);
            return response.text();
        });
        try {
            if (typeof ClipboardItem === "undefined") {
                await navigator.clipboard.writeText(await text);
            } else {
                let blob = text.then(value => new Blob([value], { type: "text/plain" }));
                await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
            }
            settle("copied");
        } catch (error) {
            console.error(error);
            settle("failed");
        }
    }

    return () => (
        <>
            <button
                data-state={state === "idle" ? undefined : state}
                mix={[
                    css({ ...control.resolve({}), [noScript]: { display: "none" } }),
                    on("click", copy),
                ]}
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
});

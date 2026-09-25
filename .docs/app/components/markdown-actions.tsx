import { css } from "@pitlane/theme";
import { clientEntry, type Handle, on } from "remix/ui";

import { markdownPath } from "../document.ts";
import { control, visuallyHidden } from "../styles/controls.ts";
import { noScript } from "../styles/media.ts";
import { t } from "../theme.ts";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon } from "./icons.tsx";

export function MarkdownActions(handle: Handle<{ url: string }>) {
    return () => {
        let source = markdownPath(handle.props.url);
        return (
            <div
                data-pagefind-ignore
                mix={css({
                    display: "flex",
                    alignItems: "center",
                    gap: t.spacing(1),
                    fontSize: t.text.sm,
                })}
            >
                <CopyMarkdown source={source} />
                <a download href={source} mix={control({ tone: "link" })}>
                    <DownloadIcon />
                    Download Markdown
                </a>
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
                    css({ ...control.resolve({ tone: "link" }), [noScript]: { display: "none" } }),
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

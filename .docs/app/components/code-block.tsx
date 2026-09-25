import { css, type ThemedCSSProps } from "@pitlane/theme";
import { clientEntry, type Handle, on, css as unthemedCss } from "remix/ui";

import { visuallyHidden } from "../styles/controls.ts";
import { canHover, noScript } from "../styles/media.ts";
import { t } from "../theme.ts";
import { CheckIcon, CloseIcon, CopyIcon } from "./icons.tsx";

export const codeSurface: ThemedCSSProps = {
    margin: 0,
    padding: [t.spacing(4), t.spacing(12), t.spacing(4), t.spacing(4)],
    border: `${t.size.hairline} solid ${t.color.border}`,
    borderRadius: t.radius.md,
    backgroundColor: t.color.code.background,
    fontFamily: t.font.mono,
    fontSize: t.text.md,
    lineHeight: t.text.leading.normal,
    overflowX: "auto",
    overscrollBehaviorX: "contain",
    tabSize: 4,
    "& code": { display: "block", fontFamily: "inherit", fontSize: "inherit", whiteSpace: "pre" },
};

export interface CodeBlockProps {
    /** Build-generated Shiki `<pre>` markup. */
    html: string;
    code: string;
    language?: string;
}

let blockStyle = css<HTMLDivElement>({
    position: "relative",
    margin: [0, 0, t.spacing(4)],
    "& pre": codeSurface,
});

// Shiki's per-token custom properties are not theme tokens.
let highlightingStyle = unthemedCss<HTMLDivElement>({
    "& .shiki, & .shiki span": {
        color: "light-dark(var(--shiki-light), var(--shiki-dark))",
    },
});

export function CodeBlock(handle: Handle<CodeBlockProps>) {
    return () => (
        <div mix={blockStyle}>
            <div innerHTML={handle.props.html} mix={highlightingStyle} />
            <CopyButton code={handle.props.code} />
        </div>
    );
}

type CopyState = "idle" | "copied" | "failed";

const CONFIRMATION_MS = 2000;
const ANNOUNCEMENTS: Record<CopyState, string> = {
    idle: "",
    copied: "Copied to clipboard",
    failed: "Copy failed",
};

let copyButtonStyle = css<HTMLButtonElement>({
    position: "absolute",
    insetBlockStart: t.spacing(2.5),
    insetInlineEnd: t.spacing(2.5),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: t.size.copy,
    height: t.size.copy,
    padding: 0,
    border: `${t.size.hairline} solid transparent`,
    borderRadius: t.radius.md,
    backgroundColor: "transparent",
    color: t.color.secondary,
    font: "inherit",
    cursor: "pointer",
    transition: `opacity ${t.duration.fast} ${t.ease.standard}, background-color ${t.duration.fast} ${t.ease.standard}, color ${t.duration.fast} ${t.ease.standard}`,
    "&:hover, &:focus-visible": {
        borderColor: t.color.border,
        backgroundColor: t.color.raised,
        color: t.color.text,
    },
    "&[data-state='copied']": { color: t.color.link },
    "&[data-state='failed']": { color: t.color.danger },
    [canHover]: { opacity: 0, ":hover > &, &:focus-visible, &[data-state]": { opacity: 1 } },
    [noScript]: { display: "none" },
});

let announcementStyle = css<HTMLSpanElement>(visuallyHidden);

export let CopyButton = clientEntry(import.meta.url, (handle: Handle<{ code: string }>) => {
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
        try {
            await navigator.clipboard.writeText(handle.props.code);
            settle("copied");
        } catch {
            settle("failed");
        }
    }

    return () => (
        <>
            <button
                aria-label="Copy code"
                data-pagefind-ignore
                data-state={state === "idle" ? undefined : state}
                mix={[copyButtonStyle, on("click", copy)]}
                type="button"
            >
                {state === "copied" ? (
                    <CheckIcon />
                ) : state === "failed" ? (
                    <CloseIcon />
                ) : (
                    <CopyIcon />
                )}
            </button>
            <span data-pagefind-ignore mix={announcementStyle} role="status">
                {ANNOUNCEMENTS[state]}
            </span>
        </>
    );
});

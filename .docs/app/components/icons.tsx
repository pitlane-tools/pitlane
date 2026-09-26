import type { Handle, RemixNode } from "remix/ui";

import { css } from "@pitlane/theme";

import { t } from "../theme.ts";

let iconStyle = css<SVGSVGElement>({ flex: "none", width: t.size.icon, height: t.size.icon });

/** A decorative stroke icon sized to the text around it; its control carries the name. */
function Icon(handle: Handle<{ children: RemixNode }>) {
    return () => (
        <svg
            aria-hidden="true"
            fill="none"
            focusable="false"
            mix={iconStyle}
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.75"
            viewBox="0 0 24 24"
        >
            {handle.props.children}
        </svg>
    );
}

export function SearchIcon() {
    return () => (
        <Icon>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </Icon>
    );
}

export function MenuIcon() {
    return () => (
        <Icon>
            <path d="M4 7h16M4 12h16M4 17h16" />
        </Icon>
    );
}

export function CloseIcon() {
    return () => (
        <Icon>
            <path d="m6 6 12 12M18 6 6 18" />
        </Icon>
    );
}

export function ChevronIcon() {
    return () => (
        <Icon>
            <path d="m6 9 6 6 6-6" />
        </Icon>
    );
}

export function CopyIcon() {
    return () => (
        <Icon>
            <rect height="12" rx="2" width="12" x="9" y="9" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </Icon>
    );
}

export function CheckIcon() {
    return () => (
        <Icon>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
        </Icon>
    );
}

export function DownloadIcon() {
    return () => (
        <Icon>
            <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
        </Icon>
    );
}

export function DocumentIcon() {
    return () => (
        <Icon>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5M9 13h6M9 17h6" />
        </Icon>
    );
}

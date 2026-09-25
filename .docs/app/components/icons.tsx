import type { Handle, RemixNode } from "remix/ui";

import { css } from "@pitlane/theme";

import { t } from "../theme.ts";

/** A decorative stroke icon sized to the text around it; its control carries the name. */
function Icon(handle: Handle<{ children: RemixNode }>) {
    return () => (
        <svg
            aria-hidden="true"
            fill="none"
            focusable="false"
            mix={css({ flex: "none", width: t.size.icon, height: t.size.icon })}
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

export function SunIcon() {
    return () => (
        <Icon>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </Icon>
    );
}

export function MoonIcon() {
    return () => (
        <Icon>
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </Icon>
    );
}

export function SystemIcon() {
    return () => (
        <Icon>
            <rect height="12" rx="2" width="18" x="3" y="5" />
            <path d="M8 20h8M12 17v3" />
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

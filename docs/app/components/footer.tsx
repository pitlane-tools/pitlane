import { css, type Handle } from "remix/ui";

import { narrow } from "../styles/media.ts";
import { t } from "../theme.ts";
import { BrandIcon } from "./brand-icon.tsx";
import { Wordmark } from "./logo.tsx";

export function SiteFooter(handle: Handle<{ docs?: boolean }>) {
    return () => (
        <footer
            data-site-footer
            mix={css({
                padding: "2.5rem clamp(1rem, 4vw, 4.5rem)",
                color: t.color.secondary,
                fontSize: "0.75rem",
                ...(handle.props.docs
                    ? { marginInlineStart: t.size.panelStart, [narrow]: { marginInlineStart: 0 } }
                    : {}),
                "& a": { color: "inherit", textUnderlineOffset: "0.25em" },
                "& [data-wordmark]": { width: "auto" },
                "& [data-wordmark] [data-wordmark-letters]": {
                    visibility: "visible",
                    opacity: 1,
                    pointerEvents: "auto",
                },
                "& [data-wordmark-flag]": { fill: "currentColor", opacity: 0.5 },
                "& [data-footer-links]": { display: "flex", gap: "1.5rem", flexWrap: "wrap" },
                "& [data-footer-links] > a": {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                },
                "@media (max-width: 820px)": {
                    "& [data-footer-credit]": { flexBasis: "100%", order: 1 },
                },
            })}
        >
            <div
                mix={css({
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "1.5rem",
                    maxWidth: "1360px",
                    marginInline: "auto",
                })}
            >
                <a aria-label="Pitlane home" href="/">
                    <Wordmark />
                </a>
                <span data-footer-credit>
                    Built with Pitlane, <a href="https://remix.run">Remix</a>,{" "}
                    <a href="https://viteplus.dev">Vite+</a>, &{" "}
                    <a href="https://www.cloudflare.com/products/workers">Cloudflare Workers</a>.
                </span>
                <div data-footer-links>
                    <a href="https://github.com/pitlane-tools/pitlane" target="_blank">
                        <BrandIcon name="github" /> GitHub ↗
                    </a>
                    <a href="https://bsky.app/profile/pitlane.tools" target="_blank">
                        <BrandIcon name="bluesky" /> Bluesky ↗
                    </a>
                    <a
                        href="https://github.com/pitlane-tools/pitlane/blob/main/LICENSE"
                        target="_blank"
                    >
                        MIT License
                    </a>
                    <a href="/llms.txt">llms.txt</a>
                </div>
            </div>
        </footer>
    );
}

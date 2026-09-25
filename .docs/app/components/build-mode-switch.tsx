import type { Handle } from "remix/ui";

import { css } from "@pitlane/theme";

import type { BuildMode, DocumentPage } from "../document.ts";

import { control } from "../styles/controls.ts";
import { t } from "../theme.ts";

const BUILD_MODE_LABELS: Record<BuildMode, string> = { vite: "Vite", "no-build": "No Build" };

/**
 * Chooses between the Vite and No Build renditions of a two-setup guide. The
 * choice persists, and the server answers with the counterpart page, so this
 * is an ordinary form; Remix submits it as a document navigation.
 */
export function BuildModeSwitch(handle: Handle<{ page: DocumentPage }>) {
    return () => {
        let { page } = handle.props;
        if (!page.buildMode || !page.counterpart) return null;
        return (
            <form
                action="/preferences"
                method="post"
                mix={css({
                    gridArea: "switch",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: t.spacing(3),
                    maxWidth: t.size.prose,
                    margin: [0, 0, t.spacing(6)],
                })}
            >
                <input name="preference" type="hidden" value="buildMode" />
                <input name="returnTo" type="hidden" value={page.url} />
                <span
                    id="build-mode-label"
                    mix={css({ color: t.color.secondary, fontSize: t.text.sm })}
                >
                    This guide for
                </span>
                <span
                    aria-labelledby="build-mode-label"
                    mix={css({
                        display: "inline-flex",
                        padding: t.spacing(0.75),
                        border: `${t.size.hairline} solid ${t.color.border}`,
                        borderRadius: t.radius.md,
                        backgroundColor: t.color.subtle,
                    })}
                    role="group"
                >
                    {(Object.keys(BUILD_MODE_LABELS) as BuildMode[]).map(mode => (
                        <button
                            aria-pressed={page.buildMode === mode ? "true" : "false"}
                            mix={control({ option: true })}
                            name="value"
                            type="submit"
                            value={mode}
                        >
                            {BUILD_MODE_LABELS[mode]}
                        </button>
                    ))}
                </span>
            </form>
        );
    };
}

import { css } from "@pitlane/theme";
import { clientEntry, type Handle, on } from "remix/ui";

import type { BuildMode } from "../document.ts";

import { rememberPreference } from "../browser/preferences.ts";
import { control } from "../styles/controls.ts";
import { t } from "../theme.ts";

const BUILD_MODE_LABELS: Record<BuildMode, string> = { vite: "Vite", "no-build": "No Build" };

let optionStyle = control<HTMLAnchorElement>({ option: true });

export type BuildModeSwitchProps = {
    /** The build mode of the page being read. */
    current: BuildMode;
    /** The guide's page for each build mode. */
    variants: Record<BuildMode, string>;
};

/**
 * Links between the Vite and No Build pages of a two-setup guide. The URL
 * decides which setup a page shows; following one of these links also
 * remembers the choice, so the navigation offers that setup's guides from then on.
 */
export let BuildModeSwitch = clientEntry(
    import.meta.url,
    (handle: Handle<BuildModeSwitchProps>) => () => {
        let { current, variants } = handle.props;
        return (
            <div
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
                        <a
                            aria-current={mode === current ? "page" : undefined}
                            href={variants[mode]}
                            mix={[
                                optionStyle,
                                on("click", () => rememberPreference("buildMode", mode)),
                            ]}
                        >
                            {BUILD_MODE_LABELS[mode]}
                        </a>
                    ))}
                </span>
            </div>
        );
    },
);

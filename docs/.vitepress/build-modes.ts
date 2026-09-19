/**
 * The vocabulary of the build-mode toggle, shared by the Vite plugin that
 * resolves `::: vite` / `::: no-build` sections and by the component that
 * renders the control.
 *
 * Free of Node built-ins on purpose: the component ships to the browser, and
 * anything this module imports goes with it.
 */

/**
 * The two setups a guide can describe: an application built with Vite, and one
 * that runs from source with no bundler at all.
 */
export const BUILD_MODES = ["vite", "no-build"] as const;

export type BuildMode = (typeof BUILD_MODES)[number];

/** How each mode names itself to a reader. */
export const BUILD_MODE_LABELS: Record<BuildMode, string> = {
    "no-build": "No Build",
    vite: "Vite",
};

/** Whether `value` names one of the modes. */
export function isBuildMode(value: string): value is BuildMode {
    return BUILD_MODES.some(mode => mode === value);
}

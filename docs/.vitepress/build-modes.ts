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

/**
 * Every guide written in both setups, and the URL of each mode's page.
 *
 * The one place the pairs live. The sidebar reads it to keep a row pointing at
 * the mode in view, the control reads it to find its counterpart, and the
 * inline head script reads it to apply a stored choice — three readers that
 * would otherwise each carry their own copy and drift.
 */
export const BUILD_MODE_GUIDES: Record<string, Record<BuildMode, string>> = {
    content: {
        "no-build": "/guides/content-no-build",
        vite: "/guides/content",
    },
    prerendering: {
        "no-build": "/guides/prerendering-no-build",
        vite: "/guides/prerendering",
    },
};

/** The same pairs as a flat list, which is what a lookup by URL wants. */
export const BUILD_MODE_PAIRS: Record<BuildMode, string>[] = Object.values(BUILD_MODE_GUIDES);

/**
 * The URL of `path`'s guide in `mode`, or `undefined` when `path` is not a
 * guide written in both setups.
 */
export function counterpart(path: string, mode: BuildMode): string | undefined {
    let clean = path
        .replace(/\.(md|html)$/, "")
        .replace(/\/index$/, "")
        .replace(/\/$/, "");
    if (!clean.startsWith("/")) clean = `/${clean}`;
    let pair = BUILD_MODE_PAIRS.find(pages => BUILD_MODES.some(m => pages[m] === clean));
    return pair?.[mode];
}

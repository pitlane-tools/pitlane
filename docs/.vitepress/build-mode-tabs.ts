import { BUILD_MODE_PAIRS, BUILD_MODES } from "./build-modes.ts";

/**
 * Inline `<head>` script that carries the reader's build-mode choice across
 * pages and sessions, the way `pm-tabs.ts` carries their package manager.
 *
 * A build mode is a URL rather than a tab within a page, so "apply the stored
 * choice" means three things:
 *
 * 1. **On arrival**, if this page is a two-mode guide showing the other mode,
 *    replace the location with the stored one. Parser-blocking and before the
 *    body streams, so the wrong mode never paints and no history entry is left
 *    behind.
 * 2. **On every link** into a two-mode guide, rewrite the href to the stored
 *    mode. That is what makes a client-side navigation land on the right page
 *    instead of relying on the redirect above, which only runs on a full load.
 * 3. **On a click** in the control, record the new choice — before the
 *    navigation, which `localStorage` being synchronous makes safe.
 *
 * Kept dependency-free and self-contained because it executes outside the app
 * bundle. The pairs are injected from `build-modes.ts` so this file holds no
 * second copy of them.
 */
export const buildModeTabsInlineScript = `(() => {
    const KEY = "pitlane-build-mode";
    const MODES = new Set(${JSON.stringify(BUILD_MODES)});
    const PAIRS = ${JSON.stringify(BUILD_MODE_PAIRS)};

    const stored = () => {
        try {
            const mode = localStorage.getItem(KEY);
            return mode && MODES.has(mode) ? mode : null;
        } catch {
            return null;
        }
    };

    const remember = (mode) => {
        try {
            localStorage.setItem(KEY, mode);
        } catch {
            // Storage unavailable - the click still navigates.
        }
    };

    /** The pair a path belongs to, or null when it is not a two-mode guide. */
    const pairOf = (path) => {
        const clean = path.replace(/\\.html$/, "").replace(/\\/$/, "") || "/";
        return PAIRS.find((pair) => [...MODES].some((mode) => pair[mode] === clean)) ?? null;
    };

    // 1. Arrive in the stored mode. Before anything paints, and a replace so
    //    Back does not bounce between the two halves of one guide.
    const mode = stored();
    if (mode) {
        const pair = pairOf(location.pathname);
        if (pair && pair[mode] !== location.pathname.replace(/\\/$/, "")) {
            location.replace(pair[mode] + location.hash);
            return;
        }
    }

    // 2. Point every link into a two-mode guide at the stored mode. Two kinds
    //    are exempt. The control's own options, because choosing a mode has to
    //    be able to disagree with the stored one or the toggle cannot change
    //    anything. And any link carrying a fragment, because a section is not
    //    guaranteed to exist in both modes — "#reloading-a-content-file-while-
    //    the-app-runs" is on one page only — and a deep link that lands on a
    //    page without its anchor is worse than one that shows the other setup.
    const retarget = () => {
        const pinned = stored();
        if (!pinned) return;
        for (const link of document.querySelectorAll("a[href^='/guides/']")) {
            if (link.dataset.buildMode) continue;
            const href = link.getAttribute("href") ?? "";
            if (href.includes("#")) continue;
            const pair = pairOf(new URL(link.href, location.origin).pathname);
            if (pair && pair[pinned] !== href) link.setAttribute("href", pair[pinned]);
        }
    };

    new MutationObserver(retarget).observe(document.documentElement, {
        childList: true,
        subtree: true,
    });

    // 3. Record a choice the reader makes, before its navigation runs.
    window.addEventListener("click", (event) => {
        const option = event.target instanceof Element && event.target.closest("[data-build-mode]");
        if (!(option instanceof HTMLElement)) return;
        const chosen = option.dataset.buildMode;
        if (chosen && MODES.has(chosen)) remember(chosen);
    });

    // Cross-tab: follow a choice made in another tab of the site.
    window.addEventListener("storage", (event) => {
        if (event.key === KEY) retarget();
    });
})();`;

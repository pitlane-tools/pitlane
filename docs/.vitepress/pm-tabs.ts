/**
 * Inline <head> script that pins code-group tabs to the reader's stored
 * package-manager choice with zero flicker.
 *
 * Injected as a parser-blocking script so it runs before the body streams
 * in: a MutationObserver activates the stored manager's tab in each
 * `.vp-code-group` the moment its nodes land in the DOM - before first
 * paint, before hydration, and before VitePress's own click handler
 * attaches. The same observer covers client-side navigations (content
 * swaps are childList mutations), and a click listener records new
 * choices and syncs the page's other groups.
 *
 * Kept dependency-free and self-contained because it must execute outside
 * the app bundle.
 */
export const pmTabsInlineScript = `(() => {
    const KEY = "pitlane-package-manager";
    const MANAGERS = new Set(["npm", "yarn", "pnpm", "bun", "deno", "vp", "vlt", "nub"]);

    const stored = () => {
        try {
            const name = localStorage.getItem(KEY);
            return name && MANAGERS.has(name) ? name : null;
        } catch {
            return null;
        }
    };

    const managerOf = (label) => {
        const name = (label.textContent || "").trim().toLowerCase();
        return MANAGERS.has(name) ? name : null;
    };

    /** Activate the stored manager's tab in every code group that offers it. Idempotent. */
    const fix = () => {
        const pm = stored();
        if (!pm) return;
        for (const group of document.querySelectorAll(".vp-code-group")) {
            const labels = [...group.querySelectorAll(".tabs label")];
            const label = labels.find((candidate) => managerOf(candidate) === pm);
            if (!label) continue;
            const input = document.getElementById(label.htmlFor);
            if (!input) continue;
            input.checked = true;
            const blocks = group.querySelector(".blocks");
            if (!blocks) continue; // still streaming; a later mutation completes it
            const next = blocks.children[[...group.querySelectorAll("input")].indexOf(input)];
            if (!next || next.classList.contains("active")) continue;
            for (const block of blocks.children) block.classList.remove("active");
            next.classList.add("active");
        }
    };

    new MutationObserver(fix).observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener("click", (event) => {
        const label = event.target;
        if (!(label instanceof HTMLLabelElement)) return;
        if (!label.matches(".vp-code-group .tabs label")) return;
        const pm = managerOf(label);
        if (!pm) return;
        try {
            localStorage.setItem(KEY, pm);
        } catch {
            // Storage unavailable - the click still switches this group natively.
        }
        fix(); // sync the page's other code groups
    });
})();`;

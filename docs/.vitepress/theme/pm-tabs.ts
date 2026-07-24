import type { Router } from "vitepress";

import { nextTick } from "vue";

/**
 * Persists the reader's package-manager choice across code groups and
 * navigations: clicking an install tab (npm, pnpm, vp, ...) records the
 * choice in localStorage, syncs every other code group on the page, and
 * re-applies the choice after each route change and on first load.
 */
const STORAGE_KEY = "pitlane-package-manager";
const MANAGERS = new Set(["npm", "yarn", "pnpm", "bun", "deno", "vp", "vlt", "nub"]);

function readStored(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function store(manager: string): void {
    try {
        localStorage.setItem(STORAGE_KEY, manager);
    } catch {
        // Storage unavailable (private mode, disabled) - selection still applies per page.
    }
}

function managerOf(label: HTMLLabelElement): string | null {
    const name = label.textContent?.trim().toLowerCase() ?? "";
    return MANAGERS.has(name) ? name : null;
}

/**
 * Check `label`'s radio and switch the group's visible block, mirroring
 * VitePress's own code-group click handler. Done directly (not via
 * `label.click()`) so it works before that handler attaches on first load.
 */
function activate(group: Element, label: HTMLLabelElement): void {
    const input = document.getElementById(label.htmlFor);
    if (!(input instanceof HTMLInputElement) || input.checked) return;
    input.checked = true;
    const blocks = group.querySelector(".blocks");
    if (!blocks) return;
    const index = Array.from(group.querySelectorAll("input")).indexOf(input);
    const next = blocks.children[index];
    if (!next) return;
    for (const block of Array.from(blocks.children)) block.classList.remove("active");
    next.classList.add("active");
}

/** Activate `manager`'s tab in every code group on the page that offers it. */
function apply(manager: string | null): void {
    if (!manager) return;
    for (const group of document.querySelectorAll(".vp-code-group")) {
        for (const label of group.querySelectorAll<HTMLLabelElement>(".tabs label")) {
            if (managerOf(label) !== manager) continue;
            activate(group, label);
            break;
        }
    }
}

/** Re-apply the stored choice to the current page. */
export function applyStoredPackageManager(): void {
    apply(readStored());
}

/** Record tab clicks and re-apply the stored choice after client-side navs. */
export function setupPackageManagerTabs(router: Router): void {
    window.addEventListener("click", (event) => {
        const label = event.target;
        if (!(label instanceof HTMLLabelElement)) return;
        if (!label.matches(".vp-code-group .tabs label")) return;
        const manager = managerOf(label);
        if (!manager) return;
        store(manager);
        apply(manager); // sync the page's other code groups
    });

    const previous = router.onAfterRouteChange;
    router.onAfterRouteChange = async (to) => {
        await previous?.(to);
        await nextTick();
        applyStoredPackageManager();
    };
}

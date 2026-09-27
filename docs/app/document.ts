import type { Heading as ContentHeading } from "@pitlane/content";

/** A heading the outline lists, as the page shows it. */
export interface Heading {
    id: string;
    text: string;
    level: number;
}

/**
 * A heading as `entry.render()` lists it, keeping its variant context until
 * a page resolves it.
 */
export interface CompiledHeading extends ContentHeading {
    buildMode?: BuildMode;
}

export interface DocumentPage {
    url: string;
    title: string;
    description: string;
    section: "guides" | "deploy" | "api";
    /** The outline: the headings below the title, in document order, as this page's variant shows them. */
    headings: Heading[];
    module?: string;
    kind?: string;
    buildMode?: BuildMode;
    /** The same guide's page for the other build mode. */
    counterpart?: string;
}

export const PREFERENCE_CHOICES = {
    packageManager: ["npm", "yarn", "pnpm", "bun", "deno", "vp", "vlt", "nub"],
    buildMode: ["vite", "no-build"],
} as const;

export type Preferences = {
    [Key in keyof typeof PREFERENCE_CHOICES]: (typeof PREFERENCE_CHOICES)[Key][number];
};

export type BuildMode = Preferences["buildMode"];

export type PackageManager = Preferences["packageManager"];

/** What a page shows before, or without, a remembered choice. */
export const DEFAULT_PREFERENCES: Preferences = {
    packageManager: "npm",
    buildMode: "vite",
};

/**
 * The localStorage key remembering each choice. The VitePress site used the
 * same keys, and the server-rendered reader named its preference cookies after
 * them.
 */
export const PREFERENCE_STORAGE_KEYS: Record<keyof Preferences, string> = {
    packageManager: "pitlane-package-manager",
    buildMode: "pitlane-build-mode",
};

export function markdownPath(url: string): string {
    return url.endsWith("/") ? `${url}index.md` : `${url}.md`;
}

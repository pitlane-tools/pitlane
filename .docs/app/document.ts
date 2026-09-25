export interface Heading {
    id: string;
    text: string;
    level: number;
}

/** Build-time headings retain their variant context until a page resolves it. */
export interface CompiledHeading extends Heading {
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
    theme: ["system", "light", "dark"],
} as const;

export type Preferences = {
    [Key in keyof typeof PREFERENCE_CHOICES]: (typeof PREFERENCE_CHOICES)[Key][number];
};

export type BuildMode = Preferences["buildMode"];

export const DEFAULT_PREFERENCES: Preferences = {
    packageManager: "npm",
    buildMode: "vite",
    theme: "system",
};

export const PREFERENCE_COOKIES: Record<keyof Preferences, string> = {
    packageManager: "pitlane-package-manager",
    buildMode: "pitlane-build-mode",
    theme: "pitlane-theme",
};

export const PREFERENCE_MAX_AGE = 31_536_000;

export function markdownPath(url: string): string {
    return url.endsWith("/") ? `${url}index.md` : `${url}.md`;
}

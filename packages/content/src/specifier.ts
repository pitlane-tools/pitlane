/**
 * Each module of the `pitlane` umbrella adds the package it re-exports to
 * this set when it loads, so a package can name itself the way the app
 * imports it. An app that installed only `pitlane` cannot import
 * `@pitlane/content/vite-plugin` under a strict package manager.
 */
const UMBRELLA_PACKAGES = Symbol.for("pitlane.umbrella.packages");

/** The specifier the app imports `subpath` of this package by, for error messages. */
export function contentSpecifier(subpath: string): string {
    let reached = (globalThis as Record<symbol, Set<string> | undefined>)[UMBRELLA_PACKAGES];
    let name = reached?.has("@pitlane/content") ? "pitlane/content" : "@pitlane/content";
    return `${name}/${subpath}`;
}

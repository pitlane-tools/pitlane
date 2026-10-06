/**
 * Each module of the `pitlane` umbrella adds the package it re-exports to
 * this set when it loads, so a package can name itself the way the app
 * imports it. An app that installed only `pitlane` cannot import
 * `@pitlane/assets/vite-plugin` under a strict package manager.
 */
const UMBRELLA_PACKAGES = Symbol.for("pitlane.umbrella.packages");

/** The specifier the app imports `subpath` of this package by, for error messages. */
export function assetsSpecifier(subpath: string): string {
    let reached = (globalThis as Record<symbol, Set<string> | undefined>)[UMBRELLA_PACKAGES];
    let name = reached?.has("@pitlane/assets") ? "pitlane/assets" : "@pitlane/assets";
    return `${name}/${subpath}`;
}

/** Quotes and joins names for a message: `"a"`, `"a" and "b"`, `"a", "b", and "c"`. */
export function quotedList(names: readonly string[], type: "conjunction" | "disjunction"): string {
    let quoted = names.map(name => `"${name}"`);
    return new Intl.ListFormat("en", { type }).format(quoted);
}

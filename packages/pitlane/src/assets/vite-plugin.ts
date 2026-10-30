// Generated from manifest.json by `mise run pitlane:generate`. Do not edit.
export * from "@pitlane/assets/vite-plugin";

let reached = Symbol.for("pitlane.umbrella.packages");
let globals = globalThis as Record<symbol, Set<string> | undefined>;
(globals[reached] ??= new Set()).add("@pitlane/assets");

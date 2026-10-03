// Generated from manifest.json by `vp run generate`. Do not edit.
export * from "@pitlane/dev/runtime";

let reached = Symbol.for("pitlane.umbrella.packages");
let globals = globalThis as Record<symbol, Set<string> | undefined>;
(globals[reached] ??= new Set()).add("@pitlane/dev");

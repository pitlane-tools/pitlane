import type { PrebuiltCollections } from "./types.ts";

/**
 * The module `content()` replaces with the collections it resolved.
 *
 * It ships declaring that nothing prebuilt them, which is what makes the plugin
 * optional: with no plugin installed every collection falls through to its
 * loader.
 *
 * Two things here look indirect and are not. The manifest is **assigned to a
 * global** rather than exported, because a bundler that can see an exported
 * value folds it into whatever reads it — `vp pack` does — so a published build
 * would carry `null` forever and leave `content()` with nothing to replace. And
 * the assignment is what keeps this module in the graph at all: a module with no
 * exports and no side effects is elided, and an elided module is one the plugin
 * never gets to load.
 */
let manifest: PrebuiltCollections | null = null;

(globalThis as Record<symbol, unknown>)[Symbol.for("pitlane.content.manifest")] ??= manifest;

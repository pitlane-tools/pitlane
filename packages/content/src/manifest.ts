import type { PrebuiltCollections } from "./types.ts";

/**
 * The module `contentLayer()` replaces with the collections it resolved.
 *
 * It ships declaring that nothing prebuilt them, which is what makes the plugin
 * optional: with no plugin installed every collection falls through to its
 * loader.
 *
 * Three things here look indirect and are not.
 *
 * The manifest is **assigned to a global** rather than exported, because a
 * bundler that can see an exported value folds it into whatever reads it —
 * `vp pack` does — so a published build would carry `null` forever and leave
 * `contentLayer()` with nothing to replace.
 *
 * The assignment is what keeps this module in the graph at all: a module with
 * no exports and no side effects is elided, and an elided module is one the
 * plugin never gets to load.
 *
 * And the symbol is **spelled literally** rather than imported from
 * `symbols.ts`, even though `prebuild.ts` and `vite.ts` share it from there.
 * Whatever this module imports gets hoisted into its chunk, and the plugin
 * replaces the whole chunk: importing the constant made a published build fail
 * with `"t" is not exported by manifest.mjs`, because the reader's own import
 * of the symbols had been hoisted into the module that just disappeared. This
 * module therefore imports nothing but a type. `content.test.ts` pins the two
 * spellings together.
 */
let manifest: PrebuiltCollections | null = null;

(globalThis as Record<symbol, unknown>)[Symbol.for("pitlane.content.manifest")] ??= manifest;

/**
 * The two globals `contentLayer()` and the runtime use to find each other.
 *
 * They are named here rather than at each site because a drifted spelling fails
 * in the quietest possible way: the emitted manifest assigns one symbol,
 * `prebuiltManifest()` reads another, every collection silently falls back to
 * its loader, and that works on Node — so the mistake only surfaces on a host
 * with no filesystem, in production.
 *
 * `manifest.ts` cannot import these through `prebuild.ts`, which imports it
 * back for its side effect, so this module holds nothing but the names.
 */

/** Set by `contentLayer()` before it runs the content entry; read to decide whether to prebuild. */
export const PREBUILD_CHANNEL = Symbol.for("pitlane.content.prebuild");

/** Assigned by the module `contentLayer()` emits in place of `manifest.ts`. */
export const PREBUILT_MANIFEST = Symbol.for("pitlane.content.manifest");

/** The spelling the emitted module writes, which has to match {@link PREBUILT_MANIFEST}. */
export const PREBUILT_MANIFEST_KEY = "pitlane.content.manifest";

/**
 * Hangs the development watcher's handle off a collection.
 *
 * A symbol rather than a method because `invalidate()` on the public
 * `Collection` would let any caller empty a collection someone else is
 * reading. `@pitlane/content/hot` is the only intended reader.
 */
export const HOT_COLLECTION = Symbol.for("pitlane.content.hot");

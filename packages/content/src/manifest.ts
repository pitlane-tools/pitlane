import type { PrebuiltCollections } from "./types.ts";

/**
 * The prebuilt manifest, or `null` when nothing prebuilt the collections.
 *
 * `content()` from `@pitlane/content/vite` replaces this module with one
 * carrying the collections it resolved during the build. Shipping `null` is
 * what makes the plugin optional: without it every collection falls through to
 * its loader.
 */
let manifest: PrebuiltCollections | null = null;

export default manifest;

import type { AssetsManifest } from "./types.ts";

/**
 * The manifest `@pitlane/assets/manifest` exports when no build integration
 * replaced the module. A resolver constructed from it works, and every lookup
 * explains how to supply a real manifest.
 *
 * `assets()` from `@pitlane/assets/vite-plugin` replaces this module with the
 * manifest of the current dev server or build. A graph Vite did not build can
 * alias the module to its own, or pass a manifest to `createAssetResolver`
 * directly.
 *
 * @module @pitlane/assets/manifest
 */
/** `{ mode: "unavailable" }`, until `assets()` or an alias replaces this module. */
let manifest: AssetsManifest = { mode: "unavailable" };

export default manifest;

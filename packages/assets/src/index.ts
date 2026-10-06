/**
 * Framework-neutral asset resolution: construct a resolver from the manifest
 * a build integration supplies, and read browser-entry URLs, preloads,
 * stylesheets, and import maps from it.
 *
 * @see {@link https://pitlane.tools/guides/assets | Asset resolution guide}
 *
 * @module @pitlane/assets
 */
export { createAssetResolver } from "./resolver.ts";
export type { AssetResolver, StylesheetOptions } from "./resolver.ts";
export { renderImportMap } from "./import-map.ts";
export type { RenderImportMapOptions } from "./import-map.ts";
export type {
    AssetEnvironment,
    AssetMetadata,
    AssetsManifest,
    BuildAssetsManifest,
    DevAssetsManifest,
    ImportMap,
    ScriptEntry,
} from "./types.ts";

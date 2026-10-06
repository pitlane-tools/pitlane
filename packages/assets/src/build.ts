/**
 * Bundler-neutral manifest generation for integration authors: describe what
 * a bundler emitted as an {@link AssetBuild}, and {@link createAssetManifest}
 * returns the manifest `createAssetResolver` reads.
 *
 * @see {@link https://pitlane.tools/guides/asset-build | Manifest integrations guide}
 *
 * @module @pitlane/assets/build
 */
export { createAssetManifest } from "./generate.ts";
export type {
    AssetBuild,
    AssetBuildChunk,
    AssetBuildEnvironment,
    AssetEnvironment,
    AssetMetadata,
    BuildAssetsManifest,
    ImportMap,
} from "./types.ts";

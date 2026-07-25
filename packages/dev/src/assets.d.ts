/**
 * Type declarations for Pitlane's `?assets=` import convention.
 *
 * Add to an app's tsconfig to type `?assets=` imports:
 *
 * ```jsonc
 * { "compilerOptions": { "types": ["@pitlane/dev/assets"] } }
 * ```
 *
 * Ambient by necessity: these wildcard module declarations must stay global,
 * so types are referenced with inline `import()` instead of top-level
 * `import type` (which would turn this file into a module).
 */

declare module "*?assets" {
    const assets: import("@pitlane/dev/runtime").ImportedAssets;
    export default assets;
}

declare module "*?assets=client" {
    const assets: import("@pitlane/dev/runtime").ImportedAssets;
    export default assets;
}

declare module "*?assets=ssr" {
    const assets: import("@pitlane/dev/runtime").ImportedAssets;
    export default assets;
}

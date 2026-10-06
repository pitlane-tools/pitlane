// Ambient by necessity: these wildcard module declarations must stay global,
// so types are referenced with inline `import()` instead of top-level
// `import type` (which would turn this file into a module).

/**
 * Type declarations for Pitlane's `?assets=` import convention. Nothing here is
 * imported directly: list `@pitlane/dev/assets` in an app's tsconfig `types`
 * and every `?assets` import is typed.
 *
 * ```jsonc
 * { "compilerOptions": { "types": ["@pitlane/dev/assets"] } }
 * ```
 *
 * @see {@link https://pitlane.tools/guides/vite-plugin#the-asset-runtime | The asset runtime}
 *
 * @module
 */

declare module "*?assets" {
    /**
     * The scripts and styles the module reaches in the environment doing the
     * importing, as {@link https://pitlane.tools/package/dev/runtime/interface/ImportedAssets | ImportedAssets}. Name the environment with `?assets=client` or
     * `?assets=ssr` when it matters.
     */
    let assets: import("@pitlane/dev/runtime").ImportedAssets;
    export default assets;
}

declare module "*?assets=client" {
    /**
     * The module's client-environment {@link https://pitlane.tools/package/dev/runtime/interface/ImportedAssets | ImportedAssets}, including its entry URL. Read it
     * in server-rendered code; in the browser it resolves to an empty result.
     */
    let assets: import("@pitlane/dev/runtime").ImportedAssets;
    export default assets;
}

declare module "*?assets=ssr" {
    /**
     * The module's server-environment {@link https://pitlane.tools/package/dev/runtime/interface/ImportedAssets | ImportedAssets}, such as the CSS a server-rendered
     * page needs.
     */
    let assets: import("@pitlane/dev/runtime").ImportedAssets;
    export default assets;
}

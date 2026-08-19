/**
 * Type declarations for Pitlane's `?assets=` import convention and the
 * `pitlane:dev` module.
 *
 * Add to an app's tsconfig to type both:
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

declare module "pitlane:dev" {
    /**
     * Revalidates the page when a server-only module changes during `vite dev`,
     * keeping hydrated island state. Render it once, anywhere in the document:
     *
     * ```tsx
     * import { HMR } from "pitlane:dev";
     * // ...
     * <HMR />
     * ```
     *
     * Renders nothing, and carries no client code in a production build, so it
     * needs no environment guard.
     */
    export const HMR: () => () => null;
}

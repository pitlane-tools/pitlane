import { mergeAssets as mergeAssetsImpl } from "@hiogawa/vite-plugin-fullstack/runtime";

/**
 * The result shape of a `?assets=` import: the resolved entry URL (client
 * environment only), plus the JS and CSS assets reachable from the imported
 * module in that environment.
 *
 * During dev, `js` is always empty (no chunk graph exists yet) and
 * `?assets=client` carries no CSS — Vite injects dev styles itself; the
 * server-environment results carry `data-vite-dev-id` stylesheet links.
 */
export interface ImportedAssets {
    entry?: string;
    js: Array<{ href: string }>;
    css: Array<{ href: string; "data-vite-dev-id"?: string }>;
    merge(...results: ImportedAssets[]): ImportedAssets;
}

/**
 * Merges multiple `?assets=` results, deduplicating `js` and `css` entries by
 * href. Typical use: combining the client entry's assets with the SSR
 * module's CSS inside a `<Document>` component.
 *
 * The annotation re-types the delegated implementation against Pitlane-owned
 * shapes so the dependency never appears in this package's public types.
 */
export const mergeAssets: (...results: ImportedAssets[]) => ImportedAssets = mergeAssetsImpl;

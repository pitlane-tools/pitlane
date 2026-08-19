/**
 * The dev-only contract between the `serverDataHmr` plugin and the browser code
 * that revalidates. Shared so the plugin and the `@pitlane/dev/runtime` helper
 * cannot drift apart.
 */

/** Custom Vite HMR event that asks the browser to revalidate server-rendered data. */
export const SERVER_UPDATE_EVENT = "pitlane:server-update";

/**
 * Global set by {@link acceptServerUpdates} when an app drives revalidation
 * through a frame handle. The plugin's injected fallback checks it and stands
 * down, so a server update is never fetched twice.
 */
export const REVALIDATION_CLAIM = "__pitlaneServerUpdateClaimed";

/**
 * The dev-only contract between the `serverDataHmr` plugin and the island that
 * revalidates. Shared so the two cannot drift apart.
 */

/** Custom Vite HMR event that asks the browser to revalidate server-rendered data. */
export const SERVER_UPDATE_EVENT = "pitlane:server-update";

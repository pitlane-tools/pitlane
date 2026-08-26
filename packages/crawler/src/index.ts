/**
 * `crawl()` — spider a Remix 3 fetch router in memory. Requests go straight
 * into `router.fetch`, so an app can be walked and written to disk without a
 * socket, a server, or a browser. `staticPaths()` answers the question that
 * comes first: which paths a route map can serve with no params.
 *
 * @module @pitlane/crawler
 */
export { crawl } from "./crawl.ts";
export type { CrawlOptions, CrawlResult, CrawlTarget } from "./crawl.ts";
export { staticPaths } from "./static-paths.ts";

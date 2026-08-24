/**
 * A Cloudflare D1 driver for Remix 3's `data-table`.
 *
 * D1 is SQLite, so the SQL is SQLite's, but the execution model is not:
 * statements are prepared and awaited over an RPC binding, and the transaction
 * verbs are rejected outright. `@remix-run/data-table-sqlite` builds on a
 * synchronous client and cannot bridge that gap, so this package pairs the
 * SQLite SQL compiler with a driver written against D1's async API.
 *
 * @module @pitlane/data-table-d1
 */
export type { D1Binding, D1Meta, D1PreparedStatement, D1Result } from "./d1.ts";
export { createD1Database, D1Database, type D1DatabaseOptions } from "./database.ts";
export {
    type D1BatchResult,
    D1DatabaseDriver,
    type D1DriverOptions,
    type D1TransactionMode,
} from "./driver.ts";
export type { D1StatementObserver, D1StatementReport } from "./observer.ts";

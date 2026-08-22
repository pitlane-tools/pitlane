import type { DatabaseOptions } from "remix/data-table";

import { Database } from "remix/data-table";

import type { D1Binding } from "./d1.ts";

import { D1DatabaseDriver } from "./driver.ts";

/**
 * A `Database` bound to Cloudflare D1.
 *
 * The same shape `SqliteDatabase` and `PostgresDatabase` have: a `Database`
 * subclass that supplies its own driver, so every query, persistence and
 * migration method comes from `remix/data-table` unchanged.
 */
export class D1Database extends Database<"sqlite"> {
    constructor(binding: D1Binding, options?: DatabaseOptions) {
        super(new D1DatabaseDriver(binding), options);
    }
}

/**
 * Wraps a D1 binding in a `Database`.
 *
 * ```ts
 * import { createD1Database } from "@pitlane/data-table-d1";
 * import { env } from "cloudflare:workers";
 *
 * let db = createD1Database(env.DB);
 * let posts = await db.query(Post).all();
 * ```
 *
 * @param binding The D1 binding, e.g. `env.DB`.
 * @param options Forwarded to `Database`.
 */
export function createD1Database(binding: D1Binding, options?: DatabaseOptions): D1Database {
    return new D1Database(binding, options);
}

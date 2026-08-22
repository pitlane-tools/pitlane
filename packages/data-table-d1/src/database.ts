import type { DatabaseOptions } from "remix/data-table";

import { Database } from "remix/data-table";

import type { D1Binding } from "./d1.ts";
import type { D1StatementObserver } from "./observer.ts";

import { D1DatabaseDriver } from "./driver.ts";

export interface D1DatabaseOptions extends DatabaseOptions {
    /**
     * Called after each statement, with the rows read, rows written, and
     * duration D1 reported for it. See {@link D1StatementObserver}.
     */
    onStatement?: D1StatementObserver;
}

/**
 * A `Database` bound to Cloudflare D1.
 *
 * The same shape `SqliteDatabase` and `PostgresDatabase` have: a `Database`
 * subclass that supplies its own driver, so every query, persistence and
 * migration method comes from `remix/data-table` unchanged.
 */
export class D1Database extends Database<"sqlite"> {
    constructor(binding: D1Binding, options?: D1DatabaseOptions) {
        let { onStatement, ...databaseOptions } = options ?? {};
        super(new D1DatabaseDriver(binding, onStatement), databaseOptions);
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
 * @param options `Database` options, plus `onStatement`.
 */
export function createD1Database(binding: D1Binding, options?: D1DatabaseOptions): D1Database {
    return new D1Database(binding, options);
}

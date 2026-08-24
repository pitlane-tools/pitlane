import type { DatabaseOptions, SqlStatement } from "remix/data-table";

import { Database } from "remix/data-table";

import type { D1Binding } from "./d1.ts";
import type { D1BatchResult, D1TransactionMode } from "./driver.ts";
import type { D1StatementObserver } from "./observer.ts";

import { D1DatabaseDriver } from "./driver.ts";

export interface D1DatabaseOptions extends DatabaseOptions {
    /**
     * Called after each statement, with the rows read, rows written, and
     * duration D1 reported for it. See {@link D1StatementObserver}.
     */
    onStatement?: D1StatementObserver;
    /**
     * What `transaction()` does. Defaults to `throw`, because D1 has no
     * transactions; `unsafe-nonatomic` accepts the call and gives up
     * atomicity. See {@link D1TransactionMode}.
     */
    transactions?: D1TransactionMode;
}

/**
 * A `Database` bound to Cloudflare D1.
 *
 * The same shape `SqliteDatabase` and `PostgresDatabase` have: a `Database`
 * subclass that supplies its own driver, so every query, persistence and
 * migration method comes from `remix/data-table` unchanged.
 */
export class D1Database extends Database<"sqlite"> {
    #driver: D1DatabaseDriver;

    constructor(binding: D1Binding, options?: D1DatabaseOptions) {
        let { onStatement, transactions, ...databaseOptions } = options ?? {};
        let driver = new D1DatabaseDriver(binding, { onStatement, transactions });
        super(driver, databaseOptions);
        this.#driver = driver;
    }

    /**
     * Runs statements together, atomically.
     *
     * D1 has no transactions, so `transaction()` refuses. `batch()` is what it
     * offers instead, and this is it without reaching for the raw binding:
     *
     * ```ts
     * import { sql } from "remix/data-table";
     *
     * await db.batch([
     *     sql`insert into post (title) values (${title})`,
     *     sql`update counter set posts = posts + 1`,
     * ]);
     * ```
     *
     * The statements are `SqlStatement`s rather than query-builder calls,
     * because `data-table` exposes no way to build an operation without
     * running it. `sql` still parameterises the values.
     */
    batch(statements: SqlStatement[]): Promise<D1BatchResult[]> {
        return this.#driver.batch(statements);
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
 * @param options `Database` options, plus `onStatement` and `transactions`.
 */
export function createD1Database(binding: D1Binding, options?: D1DatabaseOptions): D1Database {
    return new D1Database(binding, options);
}

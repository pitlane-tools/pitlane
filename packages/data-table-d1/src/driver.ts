import type {
    DataManipulationRequest,
    DataManipulationResult,
    DatabaseDriver,
    TableRef,
    TransactionOptions,
    TransactionToken,
} from "remix/data-table";

import { getTablePrimaryKey } from "remix/data-table";

import type { D1Binding, D1Meta, D1Result } from "./d1.ts";

import { compileSqliteOperation } from "./sql-compiler.ts";

type Operation = DataManipulationRequest["operation"];

/**
 * D1 speaks SQLite, so the query surface is the SQLite one. What it does not
 * have is transactions: `BEGIN`, `COMMIT`, `SAVEPOINT` and friends are
 * rejected at the SQL layer, and `batch()` is offered instead. `batch()` takes
 * a prepared array up front, which cannot express the interleaved
 * begin/execute/commit a `Database` transaction drives, so the capability is
 * reported as absent rather than faked.
 */
const CAPABILITIES = Object.freeze({
    returning: true,
    savepoints: false,
    upsert: true,
    transactionalDdl: false,
    migrationLock: false,
});

const NO_TRANSACTIONS =
    "[@pitlane/data-table-d1] D1 rejects SQL transactions and savepoints. Group writes with " +
    "`d1.batch()`, which is atomic, or model the operation so it does not need one.";

/**
 * A `DatabaseDriver` backed by a Cloudflare D1 binding.
 *
 * Statements are compiled by the same SQLite compiler `@remix-run/data-table`
 * uses, then executed through D1's async prepared-statement API. Pass it to
 * `Database`, or use {@link createD1Database} to get one already wired.
 */
export class D1DatabaseDriver implements DatabaseDriver<"sqlite"> {
    #d1: D1Binding;

    constructor(d1: D1Binding) {
        this.#d1 = d1;
    }

    get dialect(): "sqlite" {
        return "sqlite";
    }

    get capabilities(): typeof CAPABILITIES {
        return CAPABILITIES;
    }

    async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
        let { operation } = request;

        // Nothing to compile, and D1 would reject the empty VALUES list.
        if (operation.kind === "insertMany" && operation.values.length === 0) {
            return {
                affectedRows: 0,
                insertId: undefined,
                rows: operation.returning ? [] : undefined,
            };
        }

        let statement = compileSqliteOperation(operation);
        let values = statement.values.map(value => (value === undefined ? null : value));
        let result = await this.#d1
            .prepare(statement.text)
            .bind(...values)
            .all();

        // One `all()` covers both shapes. The SQLite driver picks between
        // `all()` and `run()` by asking the prepared statement whether it
        // returns columns; D1 exposes no such introspection, and its `all()`
        // carries `meta` for writes and `results` for reads either way.
        return readsRows(operation)
            ? readerResult(operation, result)
            : writerResult(operation, result.meta);
    }

    async executeScript(sql: string, _transaction?: TransactionToken): Promise<void> {
        await this.#d1.exec(sql);
    }

    async hasTable(table: TableRef, _transaction?: TransactionToken): Promise<boolean> {
        let master = table.schema
            ? `${quoteIdentifier(table.schema)}.sqlite_master`
            : "sqlite_master";
        let result = await this.#d1
            .prepare(`select 1 from ${master} where type = ? and name = ? limit 1`)
            .bind("table", table.name)
            .all();

        return result.results.length > 0;
    }

    async hasColumn(
        table: TableRef,
        column: string,
        _transaction?: TransactionToken,
    ): Promise<boolean> {
        let result = await this.#d1
            .prepare("select name from pragma_table_info(?)")
            .bind(table.name)
            .all();

        return result.results.some(row => row.name === column);
    }

    /**
     * Drops every table the application owns.
     *
     * D1 keeps its own bookkeeping in `_cf_*` tables and SQLite keeps
     * `sqlite_*`; dropping either breaks the binding, so both are left alone.
     * There is no file to delete the way the SQLite driver deletes one.
     */
    async wipe(): Promise<void> {
        let result = await this.#d1
            .prepare(
                "select name from sqlite_master where type = 'table' " +
                    "and name not like 'sqlite\\_%' escape '\\' " +
                    "and name not like '\\_cf\\_%' escape '\\'",
            )
            .all();

        let names = result.results.map(row => String(row.name));
        if (names.length === 0) return;

        // Foreign keys are per-session in SQLite, and D1 runs each statement in
        // its own session, so the pragma has to ride in the same batch as the
        // drops it is there to permit.
        await this.#d1.batch([
            this.#d1.prepare("pragma defer_foreign_keys = true"),
            ...names.map(name => this.#d1.prepare(`drop table if exists ${quoteIdentifier(name)}`)),
        ]);
    }

    /** A binding is owned by the runtime; there is no connection to release. */
    close(): void {}

    async beginTransaction(_options?: TransactionOptions): Promise<TransactionToken> {
        throw new Error(NO_TRANSACTIONS);
    }

    async commitTransaction(_token: TransactionToken): Promise<void> {
        throw new Error(NO_TRANSACTIONS);
    }

    async rollbackTransaction(_token: TransactionToken): Promise<void> {
        throw new Error(NO_TRANSACTIONS);
    }

    async createSavepoint(_token: TransactionToken, _name: string): Promise<void> {
        throw new Error(NO_TRANSACTIONS);
    }

    async rollbackToSavepoint(_token: TransactionToken, _name: string): Promise<void> {
        throw new Error(NO_TRANSACTIONS);
    }

    async releaseSavepoint(_token: TransactionToken, _name: string): Promise<void> {
        throw new Error(NO_TRANSACTIONS);
    }
}

/**
 * Whether the operation's response carries rows.
 *
 * `raw` is the awkward one: the caller's SQL may or may not select anything,
 * and D1 will not say which. Reporting rows costs nothing when there are none,
 * so raw statements always come back with an array.
 */
function readsRows(operation: Operation): boolean {
    if (operation.kind === "select" || operation.kind === "count" || operation.kind === "exists") {
        return true;
    }
    if (operation.kind === "raw") return true;
    return operation.returning !== undefined;
}

function readerResult(operation: Operation, result: D1Result): DataManipulationResult {
    let rows = result.results.map(row => ({ ...row }));

    if (operation.kind === "count" || operation.kind === "exists") {
        rows = rows.map(normalizeCount);
    }

    return {
        rows,
        affectedRows: isWrite(operation.kind) ? rows.length : undefined,
        insertId: lastPrimaryKey(operation, rows),
    };
}

function writerResult(operation: Operation, meta: D1Meta): DataManipulationResult {
    return {
        affectedRows: isWrite(operation.kind) ? Number(meta.changes) : undefined,
        insertId: isInsert(operation) && singlePrimaryKey(operation) ? meta.last_row_id : undefined,
    };
}

/**
 * `count(*)` arrives as a string or bigint depending on magnitude and driver;
 * callers expect a number.
 */
function normalizeCount(row: Record<string, unknown>): Record<string, unknown> {
    let { count } = row;

    if (typeof count === "bigint") return { ...row, count: Number(count) };

    if (typeof count === "string") {
        let numeric = Number(count);
        if (!Number.isNaN(numeric)) return { ...row, count: numeric };
    }

    return row;
}

/** The generated key of the last inserted row, read back out of RETURNING. */
function lastPrimaryKey(operation: Operation, rows: Record<string, unknown>[]): unknown {
    if (!isInsert(operation)) return undefined;

    let key = singlePrimaryKey(operation);
    if (!key) return undefined;

    return rows[rows.length - 1]?.[key];
}

/** A composite key has no single insert id to report. */
function singlePrimaryKey(operation: Extract<Operation, { kind: InsertKind }>): string | undefined {
    let primaryKey = getTablePrimaryKey(operation.table);
    return primaryKey.length === 1 ? primaryKey[0] : undefined;
}

type InsertKind = "insert" | "insertMany" | "upsert";

function isInsert(operation: Operation): operation is Extract<Operation, { kind: InsertKind }> {
    return (
        operation.kind === "insert" ||
        operation.kind === "insertMany" ||
        operation.kind === "upsert"
    );
}

function isWrite(kind: Operation["kind"]): boolean {
    return (
        kind === "insert" ||
        kind === "insertMany" ||
        kind === "update" ||
        kind === "delete" ||
        kind === "upsert"
    );
}

function quoteIdentifier(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
}

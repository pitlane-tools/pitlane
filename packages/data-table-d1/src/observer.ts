import type { D1Meta } from "./d1.ts";

/** What one executed statement cost, as D1 reported it. */
export interface D1StatementReport {
    /** The operation that produced it: `select`, `insert`, `update`, and so on. */
    kind: string;
    /** The table it targeted, absent for a raw statement. */
    table: string | undefined;
    /** Rows D1 scanned. `0` when D1 omits the figure, never estimated. */
    rowsRead: number;
    /** Rows D1 persisted. `0` when D1 omits the figure, never estimated. */
    rowsWritten: number;
    /** Wall time D1 spent, in milliseconds. `0` when D1 omits it. */
    durationMs: number;
}

/**
 * Called after each statement the driver executes.
 *
 * D1 bills on rows read and written, and its analytics report per database
 * rather than per query, so these numbers are the only way to attribute cost
 * to the query or the request that caused it. They ride along on responses the
 * driver already reads, so observing them costs no extra statement and no
 * extra billable operation.
 *
 * It runs on the hot path, once per statement, so keep it cheap.
 */
export type D1StatementObserver = (report: D1StatementReport) => void;

/**
 * Reports a statement, absorbing anything the observer throws.
 *
 * Measurement must not be able to fail the thing it measures: a broken
 * observer should cost its own numbers, not the caller's write.
 */
export function report(
    observer: D1StatementObserver | undefined,
    kind: string,
    table: string | undefined,
    meta: D1Meta,
): void {
    if (!observer) return;

    try {
        observer({
            kind,
            table,
            rowsRead: meta.rows_read ?? 0,
            rowsWritten: meta.rows_written ?? 0,
            durationMs: meta.duration ?? 0,
        });
    } catch {
        // Intentionally swallowed; see above.
    }
}

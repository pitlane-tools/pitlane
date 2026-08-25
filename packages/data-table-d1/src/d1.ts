/**
 * The slice of Cloudflare's D1 API this driver uses.
 *
 * Declared structurally rather than imported from `@cloudflare/workers-types`,
 * so the package adds no dependency and no ambient global types to a consumer
 * that does not already have them. A real `D1Database` binding satisfies it;
 * so does a test double.
 */
export interface D1Binding {
    prepare(query: string): D1PreparedStatement;
    batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
    exec(query: string): Promise<unknown>;
}

export interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    all(): Promise<D1Result>;
}

export interface D1Result {
    results: Record<string, unknown>[];
    meta: D1Meta;
}

export interface D1Meta {
    /** Rows written by the statement. D1 reports 0 for reads. */
    changes: number;
    /** Rowid of the last inserted row, meaningful only after an insert. */
    last_row_id: number;
    /** Rows D1 scanned. Billed, and absent on some responses. */
    rows_read?: number;
    /** Rows D1 persisted. Billed, and absent on some responses. */
    rows_written?: number;
    /** Wall time D1 spent on the statement, in milliseconds. */
    duration?: number;
}

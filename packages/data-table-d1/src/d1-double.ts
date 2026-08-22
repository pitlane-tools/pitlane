import type { D1Binding, D1PreparedStatement, D1Result } from "./d1.ts";

/** One statement the driver sent, as D1 would have received it. */
export interface RecordedStatement {
    sql: string;
    values: unknown[];
}

export interface D1DoubleOptions {
    /** Rows to answer `all()` with, in call order. Missing entries answer none. */
    rows?: Record<string, unknown>[][];
    changes?: number;
    lastRowId?: number;
}

/**
 * A D1 binding that records what it was asked and answers from a script.
 *
 * The driver's job is to turn an operation into SQL plus bindings and to shape
 * what comes back, so the assertions worth making are about the statement it
 * sent and the result it built. Neither needs a database.
 */
export class D1Double implements D1Binding {
    statements: RecordedStatement[] = [];
    batches: RecordedStatement[][] = [];

    #options: D1DoubleOptions;
    #calls = 0;

    constructor(options: D1DoubleOptions = {}) {
        this.#options = options;
    }

    prepare(query: string): D1PreparedStatement {
        let recorded: RecordedStatement = { sql: query, values: [] };
        this.statements.push(recorded);
        return this.#statement(recorded);
    }

    async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
        // Statements reach `batch` already recorded by `prepare`; move that tail
        // into a batch so a test can tell "sent together" from "sent in turn".
        this.batches.push(this.statements.splice(-statements.length));
        return statements.map(() => this.#result([]));
    }

    async exec(query: string): Promise<unknown> {
        this.statements.push({ sql: query, values: [] });
        return undefined;
    }

    #statement(recorded: RecordedStatement): D1PreparedStatement {
        return {
            bind: (...values: unknown[]) => {
                recorded.values = values;
                return this.#statement(recorded);
            },
            all: async () => this.#result(this.#options.rows?.[this.#calls++] ?? []),
        };
    }

    #result(results: Record<string, unknown>[]): D1Result {
        return {
            results,
            meta: {
                changes: this.#options.changes ?? 0,
                last_row_id: this.#options.lastRowId ?? 0,
            },
        };
    }
}

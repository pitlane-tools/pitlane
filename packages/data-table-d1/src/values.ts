import type { ColumnDefinition } from "remix/data-table";

/**
 * Prepares statement values for D1's `bind()`, which rejects `undefined` and
 * every object except an `ArrayBuffer` or a typed array.
 *
 * Dates become UTC text in SQLite's own `current_timestamp` format, the text
 * Remix's SQLite driver writes, so they compare and sort with timestamps
 * SQLite generated itself.
 */
export function bindValues(values: readonly unknown[]): unknown[] {
    return values.map(value => {
        if (value === undefined) return null;
        if (!(value instanceof Date)) return value;
        if (Number.isNaN(value.getTime())) {
            throw new TypeError("[@pitlane/data-table-d1] Date parameters must be valid dates.");
        }
        return formatTimestamp(value);
    });
}

/**
 * Decodes what SQLite stores in another form: JSON as text, booleans as
 * integers, and timestamps as text. Remix's SQLite driver decodes the same
 * way, so a row reads the same through either.
 */
export function decodeSqliteValue(value: unknown, column: ColumnDefinition): unknown {
    if (column.type === "boolean" && (typeof value === "number" || typeof value === "bigint")) {
        return Number(value) !== 0;
    }

    if (column.type === "json" && typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            // Text that is not JSON, such as a bare string written before
            // Remix 3.3 encoded these columns, reads back as stored.
            return value;
        }
    }

    if (column.type === "timestamp" && typeof value === "string") {
        // Only text in the form `bindValues` writes, so a Date read back binds
        // to the same text and still matches its row in a filter.
        let date = new Date(value.replace(" ", "T") + "Z");
        return !Number.isNaN(date.getTime()) && formatTimestamp(date) === value ? date : value;
    }

    return value;
}

// Whole seconds omit `.000`, which would otherwise sort after the same second.
function formatTimestamp(date: Date): string {
    let text = date.toISOString().replace("T", " ").replace("Z", "");
    return date.getUTCMilliseconds() === 0 ? text.slice(0, -4) : text;
}

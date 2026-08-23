import { column as c, table } from "remix/data-table";
import { describe, expect, it } from "vitest";

import type { D1StatementReport } from "./observer.ts";

import { D1Double } from "./d1-double.ts";
import { createD1Database } from "./database.ts";

let Post = table({
    name: "post",
    columns: {
        id: c.integer().primaryKey(),
        title: c.text().notNull(),
    },
});

let Tag = table({
    name: "tag",
    primaryKey: ["postId", "label"],
    columns: {
        postId: c.integer(),
        label: c.text(),
    },
});

describe("statement compilation", () => {
    it("sends SQLite SQL with the values bound out of line", async () => {
        let d1 = new D1Double({ rows: [[{ id: 1, title: "hello" }]] });

        await createD1Database(d1).query(Post).where({ title: "hello" }).all();

        expect(d1.statements).toHaveLength(1);
        expect(d1.statements[0]?.sql).toContain('from "post"');
        // Bound, not interpolated: the compiler is doing the work and the value
        // never reaches the SQL text.
        expect(d1.statements[0]?.sql).not.toContain("hello");
        expect(d1.statements[0]?.values).toEqual(["hello"]);
    });
});

describe("writes", () => {
    it("reports affected rows and the generated key from D1 metadata", async () => {
        let d1 = new D1Double({ changes: 1, lastRowId: 42 });

        let result = await createD1Database(d1).create(Post, { title: "hello" });

        expect(result.affectedRows).toBe(1);
        expect(result.insertId).toBe(42);
    });

    it("reads the generated key back out of RETURNING when asked for the row", async () => {
        let d1 = new D1Double({ rows: [[{ id: 7, title: "hello" }]], lastRowId: 999 });

        let row = await createD1Database(d1).create(Post, { title: "hello" }, { returnRow: true });

        // The row won, not the metadata: RETURNING is authoritative for the
        // value the caller actually gets back.
        expect(row).toEqual({ id: 7, title: "hello" });
        expect(d1.statements[0]?.sql).toContain("returning");
    });

    it("sends nothing for an empty bulk insert", async () => {
        let d1 = new D1Double();

        let result = await createD1Database(d1).createMany(Post, []);

        // D1 rejects an empty VALUES list, so the driver must not ask.
        expect(d1.statements).toEqual([]);
        expect(result.affectedRows).toBe(0);
    });

    it("reports no insert id for a composite primary key", async () => {
        let d1 = new D1Double({ changes: 1, lastRowId: 5 });

        let result = await createD1Database(d1).create(Tag, { postId: 1, label: "x" });

        // last_row_id is a rowid, which says nothing about a two-column key.
        expect(result.affectedRows).toBe(1);
        expect(result.insertId).toBeUndefined();
    });
});

describe("counts", () => {
    it("returns a number when D1 answers with a bigint", async () => {
        let d1 = new D1Double({ rows: [[{ count: 9n }]] });

        expect(await createD1Database(d1).query(Post).count()).toBe(9);
    });

    it("returns a number when D1 answers with a string", async () => {
        let d1 = new D1Double({ rows: [[{ count: "9" }]] });

        expect(await createD1Database(d1).query(Post).count()).toBe(9);
    });
});

describe("transactions", () => {
    it("refuses by default, and says what to use instead", async () => {
        let db = createD1Database(new D1Double());

        // D1 rejects BEGIN/COMMIT at the SQL layer, so failing here beats
        // failing halfway through a write that cannot be rolled back.
        await expect(db.transaction(async () => {})).rejects.toThrow(/d1\.batch\(\)/);
    });

    it("points at the opt-in when it refuses", async () => {
        let db = createD1Database(new D1Double());

        await expect(db.transaction(async () => {})).rejects.toThrow(/unsafe-nonatomic/);
    });

    it("runs the callback when the caller opted in", async () => {
        let d1 = new D1Double({ changes: 1 });
        let db = createD1Database(d1, { transactions: "unsafe-nonatomic" });

        let result = await db.transaction(async tx => {
            await tx.create(Post, { title: "inside" });
            return "done";
        });

        expect(result).toBe("done");
        // No BEGIN or COMMIT went to D1, because D1 would reject them. The
        // insert is the only statement.
        expect(d1.statements.map(statement => statement.sql.split(" ")[0])).toEqual(["insert"]);
    });

    it("keeps writes made before a failure, which is the whole hazard", async () => {
        let d1 = new D1Double({ changes: 1 });
        let db = createD1Database(d1, { transactions: "unsafe-nonatomic" });

        await expect(
            db.transaction(async tx => {
                await tx.create(Post, { title: "kept" });
                throw new Error("callback failed");
            }),
        ).rejects.toThrow("callback failed");

        // The write is still there. Rolling it back is not possible, and this
        // test exists so that is a documented property rather than a surprise.
        expect(d1.statements).toHaveLength(1);
        expect(d1.statements[0]?.values).toContain("kept");
    });

    it("surfaces the callback's error rather than a rollback failure", async () => {
        let db = createD1Database(new D1Double(), { transactions: "unsafe-nonatomic" });

        // `Database` wraps both in an AggregateError if rollback throws, which
        // would bury the real cause. Rollback stays silent for that reason.
        await expect(
            db.transaction(async () => {
                throw new Error("the actual problem");
            }),
        ).rejects.toThrow("the actual problem");
    });

    it("still refuses to nest, in either mode", async () => {
        let db = createD1Database(new D1Double(), { transactions: "unsafe-nonatomic" });

        // `savepoints: false` makes Database itself reject this, so the
        // driver's savepoint methods stay unreachable.
        await expect(
            db.transaction(async tx => {
                await tx.transaction(async () => {});
            }),
        ).rejects.toThrow(/savepoint/i);
    });
});

// `hasTable`/`hasColumn` take a `TableRef` — a plain `{ name }` — not a table
// definition. Schema inspection runs before the table exists, during a
// migration, when there may be no definition to hand.
describe("schema inspection", () => {
    it("finds a table through sqlite_master", async () => {
        let d1 = new D1Double({ rows: [[{ 1: 1 }]] });

        expect(await createD1Database(d1).hasTable({ name: "post" })).toBe(true);
        expect(d1.statements[0]?.values).toEqual(["table", "post"]);
    });

    it("reports a missing table as absent rather than throwing", async () => {
        let d1 = new D1Double({ rows: [[]] });

        expect(await createD1Database(d1).hasTable({ name: "post" })).toBe(false);
    });

    it("finds a column through pragma_table_info", async () => {
        let d1 = new D1Double({ rows: [[{ name: "id" }, { name: "title" }]] });
        let db = createD1Database(d1);

        expect(await db.hasColumn({ name: "post" }, "title")).toBe(true);
        expect(await db.hasColumn({ name: "post" }, "absent")).toBe(false);
    });
});

describe("wipe", () => {
    it("drops application tables and leaves D1 and SQLite bookkeeping alone", async () => {
        let d1 = new D1Double({ rows: [[{ name: "post" }, { name: "tag" }]] });

        await createD1Database(d1).wipe();

        // The exclusions live in the query, so assert the query carries them.
        let [listing] = d1.statements;
        expect(listing?.sql).toContain("sqlite\\_%");
        expect(listing?.sql).toContain("\\_cf\\_%");

        // One batch: the pragma is per-session, so it has to travel with the
        // drops rather than in a statement of its own.
        expect(d1.batches).toHaveLength(1);
        expect(d1.batches[0]?.map(statement => statement.sql)).toEqual([
            "pragma defer_foreign_keys = true",
            'drop table if exists "post"',
            'drop table if exists "tag"',
        ]);
    });

    it("does nothing when there is nothing to drop", async () => {
        let d1 = new D1Double({ rows: [[]] });

        await createD1Database(d1).wipe();

        expect(d1.batches).toEqual([]);
    });
});

describe("statement reporting", () => {
    it("hands the caller what D1 says the statement cost", async () => {
        let d1 = new D1Double({ rows: [[{ id: 1, title: "x" }]], rowsRead: 4, durationMs: 2.5 });
        let seen: D1StatementReport[] = [];

        await createD1Database(d1, { onStatement: report => seen.push(report) })
            .query(Post)
            .all();

        // Attribution per query, which D1's own per-database analytics cannot
        // give, off metadata the driver already reads.
        expect(seen).toEqual([
            { kind: "select", table: "post", rowsRead: 4, rowsWritten: 0, durationMs: 2.5 },
        ]);
    });

    it("reports zero rather than guessing when D1 omits the figures", async () => {
        let d1 = new D1Double({ changes: 1 });
        let seen: D1StatementReport[] = [];

        await createD1Database(d1, { onStatement: report => seen.push(report) }).create(Post, {
            title: "x",
        });

        expect(seen[0]).toMatchObject({ kind: "insert", rowsRead: 0, rowsWritten: 0 });
    });

    it("names no table for a raw statement", async () => {
        let d1 = new D1Double();
        let seen: D1StatementReport[] = [];

        await createD1Database(d1, { onStatement: report => seen.push(report) }).exec("select 1");

        expect(seen[0]?.table).toBeUndefined();
        expect(seen[0]?.kind).toBe("raw");
    });

    it("survives an observer that throws", async () => {
        let d1 = new D1Double({ rows: [[{ id: 1, title: "x" }]] });
        let db = createD1Database(d1, {
            onStatement: () => {
                throw new Error("observer is broken");
            },
        });

        // Measuring a write must never be able to fail it.
        await expect(db.query(Post).all()).resolves.toHaveLength(1);
    });

    it("says nothing about a statement that never ran", async () => {
        let d1 = new D1Double();
        let seen: D1StatementReport[] = [];

        await createD1Database(d1, { onStatement: report => seen.push(report) }).createMany(
            Post,
            [],
        );

        // The empty bulk insert short-circuits, so there is no cost to report
        // and a zeroed entry would read as a statement that was free.
        expect(seen).toEqual([]);
    });
});

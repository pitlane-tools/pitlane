import { Miniflare } from "miniflare";
import { column as c, sql, table } from "remix/data-table";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { D1Binding } from "./d1.ts";
import type { D1StatementReport } from "./observer.ts";

import { createD1Database, type D1Database } from "./database.ts";

// The unit tests pin how the driver shapes what it sends and receives against
// a double. They cannot tell whether D1 accepts the SQL. This runs the real
// thing in workerd, which is the only way to find out that, say, `returning`
// or a batched pragma is rejected.
let Post = table({
    name: "post",
    columns: {
        id: c.integer().primaryKey(),
        title: c.text().notNull(),
        views: c.integer(),
    },
});

let Post2 = table({
    name: "metered",
    columns: {
        id: c.integer().primaryKey(),
        title: c.text().notNull(),
    },
});

let Ledger = table({
    name: "ledger",
    columns: {
        id: c.integer().primaryKey(),
        note: c.text().notNull(),
    },
});

let mf: Miniflare;
let db: D1Database;

beforeAll(async () => {
    mf = new Miniflare({
        modules: true,
        script: "export default { fetch: () => new Response() };",
        d1Databases: { DB: "data-table-d1-test" },
    });

    db = createD1Database((await mf.getD1Database("DB")) as unknown as D1Binding);

    await db.executeScript(
        "create table post (id integer primary key autoincrement, title text not null, views integer)",
    );
});

afterAll(async () => {
    await mf?.dispose();
});

describe("against real workerd", () => {
    it("round-trips a row through insert and query", async () => {
        let created = await db.create(Post, { title: "hello", views: 1 }, { returnRow: true });

        expect(created.id).toBeTypeOf("number");
        expect(created.title).toBe("hello");

        let found = await db.query(Post).where({ title: "hello" }).first();
        expect(found?.id).toBe(created.id);
    });

    it("reports the generated key without RETURNING", async () => {
        let result = await db.create(Post, { title: "no-returning", views: 0 });

        expect(result.affectedRows).toBe(1);
        // D1's meta.last_row_id, which is the whole reason the write path reads
        // metadata instead of rows.
        expect(result.insertId).toBeTypeOf("number");
    });

    it("counts as a number", async () => {
        let count = await db.query(Post).count();

        expect(count).toBeTypeOf("number");
        expect(count).toBeGreaterThan(0);
    });

    it("updates and deletes by predicate", async () => {
        await db.create(Post, { title: "doomed", views: 5 });

        let updated = await db.updateMany(Post, { views: 6 }, { where: { title: "doomed" } });
        expect(updated.affectedRows).toBe(1);

        let deleted = await db.deleteMany(Post, { where: { title: "doomed" } });
        expect(deleted.affectedRows).toBe(1);
        expect(await db.query(Post).where({ title: "doomed" }).first()).toBeNull();
    });

    it("inserts many in one statement", async () => {
        let result = await db.createMany(Post, [
            { title: "bulk-a", views: 1 },
            { title: "bulk-b", views: 2 },
        ]);

        expect(result.affectedRows).toBe(2);
    });

    it("answers schema inspection out of the live database", async () => {
        expect(await db.hasTable({ name: "post" })).toBe(true);
        expect(await db.hasTable({ name: "absent" })).toBe(false);
        expect(await db.hasColumn({ name: "post" }, "title")).toBe(true);
        expect(await db.hasColumn({ name: "post" }, "absent")).toBe(false);
    });

    it("wipes application tables, and D1 still works afterwards", async () => {
        await db.executeScript("create table scratch (id integer primary key)");
        expect(await db.hasTable({ name: "scratch" })).toBe(true);

        await db.wipe();

        // Both application tables are gone, and the binding is still usable —
        // which is what proves the batched `pragma defer_foreign_keys` was
        // accepted rather than silently poisoning the session.
        expect(await db.hasTable({ name: "post" })).toBe(false);
        expect(await db.hasTable({ name: "scratch" })).toBe(false);

        await db.executeScript("create table post (id integer primary key, title text not null)");
        expect(await db.hasTable({ name: "post" })).toBe(true);
    });
});

// The guide tells people to run migrations and multi-statement scripts through
// the driver. Both were claims until this suite made them assertions.
describe("migrations against real workerd", () => {
    it("runs a multi-statement script", async () => {
        await db.executeScript(
            "create table alpha (id integer primary key);\ncreate table beta (id integer primary key);",
        );

        expect(await db.hasTable({ name: "alpha" })).toBe(true);
        expect(await db.hasTable({ name: "beta" })).toBe(true);
    });

    it("applies migrations and records them as applied", async () => {
        let result = await db.migrate([
            {
                id: "0001",
                name: "create_widget",
                up: "create table widget (id integer primary key)",
            },
        ]);

        expect(result.applied.map(entry => entry.id)).toEqual(["0001"]);
        expect(await db.hasTable({ name: "widget" })).toBe(true);

        // Re-running is a no-op, which is the whole point of journalling.
        let again = await db.migrate([
            {
                id: "0001",
                name: "create_widget",
                up: "create table widget (id integer primary key)",
            },
        ]);
        expect(again.applied).toEqual([]);
    });
});

describe("statement cost against real workerd", () => {
    it("reports the rows D1 actually read and wrote", async () => {
        let seen: D1StatementReport[] = [];
        let observed = createD1Database((await mf.getD1Database("DB")) as unknown as D1Binding, {
            onStatement: report => seen.push(report),
        });

        await observed.executeScript("create table metered (id integer primary key, title text)");
        await observed.create(Post2, { title: "counted" });

        // Real figures off D1's own meta, not the double's script.
        expect(seen).toHaveLength(1);
        expect(seen[0]?.kind).toBe("insert");
        expect(seen[0]?.table).toBe("metered");
        expect(seen[0]?.rowsWritten).toBeGreaterThan(0);
    });
});

describe("unsafe-nonatomic transactions against real workerd", () => {
    it("leaves earlier writes committed when a later one fails", async () => {
        let binding = (await mf.getD1Database("DB")) as unknown as D1Binding;
        let unsafe = createD1Database(binding, { transactions: "unsafe-nonatomic" });

        await unsafe.executeScript(
            "create table ledger (id integer primary key autoincrement, note text not null)",
        );

        await expect(
            unsafe.transaction(async tx => {
                await tx.create(Ledger, { note: "first" });
                await tx.create(Ledger, { note: "second" });
                throw new Error("third step failed");
            }),
        ).rejects.toThrow("third step failed");

        // Real D1, real rows, still there. A driver that pretended to roll back
        // would leave this assertion failing; the option is named for exactly
        // this outcome.
        let rows = await unsafe.query(Ledger).all();
        expect(rows.map(row => row.note)).toEqual(["first", "second"]);
    });
});

// `transaction()` refuses because D1 cannot honour it. `batch()` is the thing
// it can honour, and the escape hatch the guide points at.
describe("batch against real workerd", () => {
    it("commits every statement together", async () => {
        await db.executeScript("create table batched (id integer primary key, note text not null)");

        let results = await db.batch([
            sql`insert into batched (note) values (${"one"})`,
            sql`insert into batched (note) values (${"two"})`,
        ]);

        expect(results).toHaveLength(2);
        expect(results[0]?.affectedRows).toBe(1);
        expect(results[1]?.insertId).toBeGreaterThan(0);

        let rows = await db.exec("select note from batched order by id");
        expect(rows.rows?.map(row => row.note)).toEqual(["one", "two"]);
    });

    it("rolls the whole batch back when one statement fails", async () => {
        await db.executeScript(
            "create table guarded (id integer primary key, note text not null unique)",
        );
        await db.batch([sql`insert into guarded (note) values (${"first"})`]);

        await expect(
            db.batch([
                sql`insert into guarded (note) values (${"second"})`,
                // Violates the unique constraint, so the batch must fail.
                sql`insert into guarded (note) values (${"first"})`,
            ]),
        ).rejects.toThrow();

        // This is the property `transaction()` cannot offer on D1: "second"
        // must not survive a batch that failed after it.
        let rows = await db.exec("select note from guarded");
        expect(rows.rows?.map(row => row.note)).toEqual(["first"]);
    });

    it("reads back through the same batch", async () => {
        let results = await db.batch([sql`select 1 as answer`]);

        expect(results[0]?.rows).toEqual([{ answer: 1 }]);
    });

    it("does nothing for an empty batch", async () => {
        expect(await db.batch([])).toEqual([]);
    });
});

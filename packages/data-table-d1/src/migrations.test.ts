import { mkdtemp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { generateD1Migrations } from "./migrations.ts";

let root: string;
let from: string;
let to: string;

beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "d1-migrations-"));
    from = path.join(root, "migrations");
    to = path.join(root, "d1-migrations");
    await mkdir(from, { recursive: true });
});

/** Writes a `data-table` migration in the on-disk shape `loadMigrations` reads. */
async function migration(id: string, name: string, up: string): Promise<void> {
    let directory = path.join(from, `${id}_${name}`);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "up.sql"), up);
}

describe("generateD1Migrations", () => {
    it("names files the way Wrangler's runner expects", async () => {
        await migration("20260101000000", "create_post", "create table post (id integer);");

        let generated = await generateD1Migrations({ from, to });

        expect(generated).toEqual([
            {
                id: "20260101000000",
                name: "create_post",
                file: path.relative(process.cwd(), path.join(to, "20260101000000_create_post.sql")),
            },
        ]);
    });

    it("copies SQL verbatim, so a semicolon inside a trigger body survives", async () => {
        // A splitter naive enough to break on `;` would cut this in half and
        // emit two files' worth of invalid SQL.
        let trigger = [
            "create trigger bump after insert on post",
            "begin",
            "  update counter set n = n + 1;",
            "end;",
        ].join("\n");
        await migration("20260101000000", "add_trigger", trigger);

        await generateD1Migrations({ from, to });

        let sql = await readFile(path.join(to, "20260101000000_add_trigger.sql"), "utf8");
        expect(sql).toContain(trigger);
    });

    it("removes generated files whose migration is gone", async () => {
        await mkdir(to, { recursive: true });
        await writeFile(path.join(to, "20259999000000_deleted.sql"), "select 1;");
        await migration("20260101000000", "kept", "select 1;");

        await generateD1Migrations({ from, to });

        expect(await readdir(to)).toEqual(["20260101000000_kept.sql"]);
    });

    it("leaves files it did not generate alone", async () => {
        await mkdir(to, { recursive: true });
        await writeFile(path.join(to, "README.md"), "hand-written");
        await migration("20260101000000", "kept", "select 1;");

        await generateD1Migrations({ from, to });

        expect((await readdir(to)).sort()).toEqual(["20260101000000_kept.sql", "README.md"]);
    });

    it("refuses an empty source directory rather than emptying the output", async () => {
        await expect(generateD1Migrations({ from, to })).rejects.toThrow(/no migrations found/);
    });

    it("refuses a migration with nothing in it", async () => {
        await migration("20260101000000", "blank", "   \n");

        await expect(generateD1Migrations({ from, to })).rejects.toThrow(/empty `up`/);
    });
});

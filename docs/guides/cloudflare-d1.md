---
title: Cloudflare D1
description: "How @pitlane/data-table-d1 runs Remix 3's data-table on Cloudflare D1, and which parts of D1 the driver cannot paper over."
---

# Cloudflare D1

[`@pitlane/data-table-d1`](/package/data-table-d1/) enables you to use the Cloudflare Workers [D1](https://developers.cloudflare.com/d1/) SQLite database with Remix in the same way you'd use `remix/data-table` in a Node app.

```ts
// app/middleware/database.ts
import { createD1Database } from "@pitlane/data-table-d1";
import { env } from "cloudflare:workers";

export let db = createD1Database(env.DB);
```

That is an ordinary `Database`. Queries, writes, migrations, and schema inspection all come from `remix/data-table` unchanged:

```ts
let post = await db.create(Post, { title: "Hello" }, { returnRow: true });
let recent = await db.query(Post).orderBy({ createdAt: "desc" }).limit(10).all();
```

## Setup

Declare the binding in `wrangler.jsonc`:

```jsonc
{
    "d1_databases": [
        {
            "binding": "DB",
            "database_name": "my-app",
            "database_id": "…",
        },
    ],
}
```

Install the driver alongside the Vite plugin:

::: code-group

```sh [npm]
npm add -D @pitlane/data-table-d1
```

```sh [yarn]
yarn add -D @pitlane/data-table-d1
```

```sh [pnpm]
pnpm add -D @pitlane/data-table-d1
```

```sh [bun]
bun add -D @pitlane/data-table-d1
```

```sh [deno]
deno add -D npm:@pitlane/data-table-d1
```

```sh [vp]
vp add -D @pitlane/data-table-d1
```

```sh [vlt]
vlt add -D @pitlane/data-table-d1
```

```sh [nub]
nub add -D @pitlane/data-table-d1
```

:::

Nothing else is required. Now you can start using the D1 database in your Cloudflare Workers Remix app!

## Migrations

Author migrations as `data-table` migrations, compile them to `.sql`, and let Wrangler apply them. The same generated files go to the local and the deployed database, so production runs what you tested.

`generateD1Migrations` does the compiling:

```ts
// db/generate-migrations.ts
import { generateD1Migrations } from "@pitlane/data-table-d1/migrations";

let migrations = await generateD1Migrations({
    to: "db/d1-migrations",
});

console.log(`Generated ${migrations.length} migration(s).`);
```

It reads `db/migrations` by default and writes one `<id>_<name>.sql` per migration into `to`, which is the directory Wrangler reads:

```jsonc
{
    "d1_databases": [
        {
            "binding": "DB",
            "database_name": "my-app",
            "database_id": "…",
            "migrations_dir": "db/d1-migrations",
        },
    ],
}
```

Then the loop is three commands:

```sh
node db/generate-migrations.ts             # TypeScript migrations -> .sql
wrangler d1 migrations apply DB --local    # dev
wrangler d1 migrations apply DB --remote   # production
```

Wrangler records what it has applied in a `d1_migrations` table, so re-running is a no-op and `--remote` picks up only what production has not seen.

Two details worth knowing about the generated directory. Files are written verbatim, so a semicolon inside a trigger body or a string literal survives. Splitting the SQL into statements is Wrangler's job, not the generator's. And the directory is a pure function of the source: a generated `.sql` file whose migration you deleted is removed on the next run, while anything that is not a generated file, such as a `README.md`, is left alone.

`generateD1Migrations` reads the filesystem, so it is build tooling and imports from a separate entry point. It never enters your Worker bundle.

## Knowing what a query cost

D1 bills on rows read and rows written, and its analytics report per database. That tells you the app got expensive, not which query did it. Every D1 response already carries the numbers per statement, and the driver already reads that metadata, so `onStatement` hands them over instead of discarding them:

```ts
let usage = { rowsRead: 0, rowsWritten: 0 };

let db = createD1Database(env.DB, {
    onStatement({ kind, table, rowsRead, rowsWritten, durationMs }) {
        usage.rowsRead += rowsRead;
        usage.rowsWritten += rowsWritten;
    },
});
```

## Limitations

There are two limitations to the D1 `data-table` driver due to limitations in D1's SQLite dialect itself:

### Transactions throw

D1 rejects `BEGIN`, `COMMIT`, `ROLLBACK`, and `SAVEPOINT` at the SQL layer. Its answer is `d1.batch()`, which is atomic but takes every statement up front, and that cannot express the interleaved begin/execute/commit a `Database` transaction drives.

So `db.transaction()` throws, with a message naming `batch()`. The capabilities say the same thing, which is what stops `data-table` from planning a transactional path in the first place:

```ts
({
    returning: true,
    savepoints: false,
    upsert: true,
    transactionalDdl: false,
    migrationLock: false,
});
```

Failing at the call is the point. The alternative is failing halfway through a write that cannot be rolled back.

#### When several writes must commit together

Use `db.batch()`. `batch()` is D1's one atomic primitive: it takes every statement up front and commits them as a unit, which is exactly why it cannot back `transaction()` and exactly why it can back this.

```ts
import { sql } from "remix/data-table";

await db.batch([
    sql`insert into post (title) values (${title})`,
    sql`update counter set posts = posts + 1`,
]);
```

If any statement fails the whole batch rolls back, which is the guarantee `transaction()` cannot give you here. Each result comes back in order, carrying `rows`, `affectedRows`, and `insertId`.

These are `SqlStatement`s rather than query-builder calls, because `data-table` exposes no way to build an operation without running it: `create` and `updateMany` execute on call, and a `Query` has no `toSql()`. `sql` still parameterises the values, so nothing is interpolated by hand and the raw binding stays out of your application code.

#### Opting out of the refusal

`data-table-d1` allows the user to opt into unsafe non-atomic transactions if you need to support shared code across multiple types of SQL databases; a repository layer used by both a Worker and a Postgres service, say.

```ts
let db = createD1Database(env.DB, {
    transactions: "unsafe-nonatomic",
});
```

In this mode, `transaction()` will run the callback and each statement commits on its own. The `unsafe` in the name means one specific thing: **a failure part-way through leaves the earlier writes in place**, because there is nothing to roll back.

```ts
await db.transaction(async tx => {
    await tx.create(Ledger, { note: "first" }); // committed
    await tx.create(Ledger, { note: "second" }); // committed
    throw new Error("boom"); // both rows are still there
});
```

Rollback stays silent rather than throwing, so the error you catch is your own rather than an `AggregateError` about a rollback that was never possible. Nested transactions still fail either way, because `savepoints: false` makes `data-table` reject them before the driver sees them.

Reach for it when portability is worth more than atomicity, and prefer a single statement whenever one will do.

### `wipe()` drops tables

There is no database file to delete, so `wipe()` enumerates the application's tables and drops them. D1's own `_cf_*` bookkeeping and SQLite's `sqlite_*` tables are excluded, because dropping either breaks the binding.

Everything else behaves: `returning`, upserts, bulk inserts, counts, and schema inspection are all exercised against real workerd in the package's test suite.

## Deploying

The [Cloudflare deploy guide](/deploy/cloudflare) covers the rest of the picture, including reading bindings through `cloudflare:workers` and why the preview server steps aside for Miniflare.

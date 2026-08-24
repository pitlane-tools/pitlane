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

<!-- TODO: Add `pitlane` CLI to enable guided migrations like the `remix` CLI or drizzle-kit do -->

`data-table` migrations run against D1 the same way they run anywhere. Load the descriptors and hand them to the database:

```ts
import { loadMigrations } from "remix/data-table/migrations/node";

let migrations = await loadMigrations("db/migrations");
let result = await db.migrate(migrations);

console.log(result.applied.map(entry => entry.id));
```

For a deployed database this runs through `wrangler d1 execute`, because the binding only exists inside the runtime.

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
{
    returning: true,
    savepoints: false,
    upsert: true,
    transactionalDdl: false
}
```

Failing at the call is the point. The alternative is failing halfway through a write that cannot be rolled back.

When you need several statements to land together, reach past the driver:

<!-- TODO: we need a better escape hatch in `data-table-d1` itself for this rather than dropping down to the raw DB binding -->

```ts
await env.DB.batch([
    env.DB.prepare("insert into post (title) values (?)").bind("one"),
    env.DB.prepare("insert into post (title) values (?)").bind("two"),
]);
```

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

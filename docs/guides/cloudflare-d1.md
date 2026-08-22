---
title: Cloudflare D1
description: "How @pitlane/data-table-d1 runs Remix 3's data-table on Cloudflare D1, and which parts of D1 the driver cannot paper over."
---

# Cloudflare D1

[D1](https://developers.cloudflare.com/d1/) is SQLite, so a Remix 3 app running
on Workers should be able to use `remix/data-table` the way a Node app uses it.
[`@pitlane/data-table-d1`](/package/data-table-d1/) is what makes that true.

```ts
// app/middleware/database.ts
import { createD1Database } from "@pitlane/data-table-d1";
import { env } from "cloudflare:workers";

export let db = createD1Database(env.DB);
```

That is an ordinary `Database`. Queries, writes, migrations, and schema
inspection all come from `remix/data-table` unchanged:

```ts
let post = await db.create(Post, { title: "Hello" }, { returnRow: true });
let recent = await db.query(Post).orderBy({ createdAt: "desc" }).limit(10).all();
```

## Why a separate driver

D1 speaks SQLite's SQL, so half the work is already done upstream. The other
half does not transfer.

`@remix-run/data-table-sqlite` is built on a **synchronous** client:

```ts
interface SqliteDatabaseClient {
    prepare(sql: string): SqliteStatement;
}

interface SqliteStatement {
    all(...values: unknown[]): unknown[]; // rows, not a promise
}
```

That is the shape `better-sqlite3` and `node:sqlite` have, and D1 does not have
it. Every D1 call is an awaited RPC into the binding. No wrapper turns an async
API into a synchronous one, so the SQLite driver is not adaptable to D1 at any
price.

What is reusable is the SQL generation, which is pure. This package pairs that
compiler with a driver written against D1's prepared-statement API.

## Setup

Declare the binding in `wrangler.jsonc`:

```jsonc
{
    "d1_databases": [{ "binding": "DB", "database_name": "my-app", "database_id": "…" }],
}
```

Install the driver alongside the [Vite plugin](/guides/vite-plugin):

::: code-group

```sh [npm]
npm install @pitlane/data-table-d1
```

```sh [pnpm]
pnpm add @pitlane/data-table-d1
```

```sh [vp]
vp add @pitlane/data-table-d1
```

:::

Nothing else is required. The D1 API is described structurally inside the
package, so it pulls in no Cloudflare types and no ambient globals; if your own
code already has `@cloudflare/workers-types`, `env.DB` satisfies the driver as
it is.

## Migrations

`data-table` migrations run against D1 the same way they run anywhere. Load the
descriptors and hand them to the database:

```ts
import { loadMigrations } from "remix/data-table/migrations/node";

let migrations = await loadMigrations("db/migrations");
let result = await db.migrate(migrations);

console.log(result.applied.map(entry => entry.id));
```

For a deployed database this runs through `wrangler d1 execute` or a one-off
Worker, because the binding only exists inside the runtime.

## What D1 will not do

Two things the driver reports rather than emulates.

### Transactions and savepoints throw

D1 rejects `BEGIN`, `COMMIT`, `ROLLBACK`, and `SAVEPOINT` at the SQL layer. Its
answer is `d1.batch()`, which is atomic but takes every statement up front, and
that cannot express the interleaved begin/execute/commit a `Database`
transaction drives.

So `db.transaction()` throws, with a message naming `batch()`. The capabilities
say the same thing, which is what stops `data-table` from planning a
transactional path in the first place:

```ts
{ returning: true, savepoints: false, upsert: true, transactionalDdl: false }
```

Failing at the call is the point. The alternative is failing halfway through a
write that cannot be rolled back.

When you need several statements to land together, reach past the driver:

```ts
await env.DB.batch([
    env.DB.prepare("insert into post (title) values (?)").bind("one"),
    env.DB.prepare("insert into post (title) values (?)").bind("two"),
]);
```

### `wipe()` drops tables

There is no database file to delete, so `wipe()` enumerates the application's
tables and drops them. D1's own `_cf_*` bookkeeping and SQLite's `sqlite_*`
tables are excluded, because dropping either breaks the binding.

Everything else behaves: `returning`, upserts, bulk inserts, counts, and schema
inspection are all exercised against real workerd in the package's test suite.

## Deploying

The [Cloudflare deploy guide](/deploy/cloudflare) covers the rest of the
picture, including reading bindings through `cloudflare:workers` and why the
preview server steps aside for Miniflare.

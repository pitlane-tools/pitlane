# @pitlane/data-table-d1

A [Cloudflare D1](https://developers.cloudflare.com/d1/) driver for [Remix 3](https://remix.run)'s `data-table`.

```ts
import { createD1Database } from "@pitlane/data-table-d1";
import { env } from "cloudflare:workers";

let db = createD1Database(env.DB);

let post = await db.create(Post, { title: "Hello" }, { returnRow: true });
let recent = await db.query(Post).orderBy({ createdAt: "desc" }).limit(10).all();
```

`db` is a `Database` from `remix/data-table`, so queries, persistence, migrations, and schema inspection use the same API as the SQLite and Postgres drivers. `transaction()` is the exception: D1 has no interactive transactions, so it throws unless you opt into the non-atomic mode described in [What D1 cannot do](#what-d1-cannot-do).

## Install

```sh
npm install @pitlane/data-table-d1
# or
vp add @pitlane/data-table-d1
```

Requires `remix@^3.0.0-rc.1` as a peer. The D1 binding is typed structurally, so `@cloudflare/workers-types` is optional.

## Why this package exists

Remix's SQLite driver expects a synchronous client, such as `better-sqlite3` or `node:sqlite`. Cloudflare D1 exposes asynchronous prepared statements over RPC.

This package reuses Remix's SQLite SQL compiler with a driver for D1's API.

## API

### `createD1Database(binding, options?)`

Wraps a D1 binding in a `Database`. `binding` is `env.DB`; `options` takes everything `Database` takes, plus `onStatement` and `transactions`.

### `D1Database`

The `Database` subclass, if you would rather construct it yourself. Same shape as `SqliteDatabase` and `PostgresDatabase`, with `batch(statements)` added.

### `D1DatabaseDriver`

The bare `DatabaseDriver<"sqlite">`, for handing to `Database` directly or wrapping.

### `D1Binding`

The slice of D1 this package uses: `prepare`, `batch`, `exec`. A real binding satisfies it, and so does a test double.

### `generateD1Migrations(options)`

Compiles `data-table` migrations into the flat `.sql` files Wrangler's D1 migration runner reads, so production migrations go through Wrangler's own workflow instead of a hand-rolled script:

```ts
import { generateD1Migrations } from "@pitlane/data-table-d1/migrations";

await generateD1Migrations({ to: "db/d1-migrations" });
```

Reads `db/migrations` unless told otherwise, writes one `<id>_<name>.sql` per migration, and deletes generated files whose migration is gone. SQL is copied verbatim, so semicolons inside trigger bodies survive.

Node-only build tooling, which is why it is a separate entry point. It never enters a Worker bundle.

### `onStatement`

Called after each executed statement with what it cost:

```ts
let usage = { rowsRead: 0, rowsWritten: 0 };

let db = createD1Database(env.DB, {
    onStatement({ rowsRead, rowsWritten }) {
        usage.rowsRead += rowsRead;
        usage.rowsWritten += rowsWritten;
    },
});
```

D1 reports rows read and written per statement. Use these values to attribute usage to a query or request without running an extra statement.

The report is `{ kind, table, rowsRead, rowsWritten, durationMs }`. It runs once per statement on the hot path, so keep it cheap. Anything it throws is swallowed rather than failing the statement it was measuring. A statement that throws is not reported, because D1 returns no metadata for one and a zeroed entry would read as free. Figures D1 omits come through as `0`, never estimated.

### Reuse the database

A binding is stable for the isolate, so build the database once rather than per request:

```ts
import { createD1Database, type D1Database } from "@pitlane/data-table-d1";

let db: D1Database | null = null;

export default {
    fetch(request, env) {
        db ??= createD1Database(env.DB);
        // …
    },
};
```

## What D1 cannot do

Several writes that must commit together go through `db.batch()`, which is D1's one atomic primitive and the reason it cannot back `transaction()`:

```ts
import { sql } from "remix/data-table";

await db.batch([
    sql`insert into post (title) values (${title})`,
    sql`update counter set posts = posts + 1`,
]);
```

If any statement fails the whole batch rolls back. They are `SqlStatement`s rather than query-builder calls because `data-table` exposes no way to build an operation without running it; `sql` still parameterises the values, so the raw binding stays out of your application code.

Transactions throw by default. D1 rejects `BEGIN`, `COMMIT`, `ROLLBACK`, and `SAVEPOINT` at the SQL layer and offers `d1.batch()` instead, which takes every statement up front. That cannot express the interleaved begin/execute/commit a `Database` transaction drives, so the driver reports `savepoints: false` and `transactionalDdl: false` and throws a message pointing at `batch()`. Failing at the call beats failing halfway through a write that cannot be rolled back.

When the caller is shared with a backend that does have transactions, and running without atomicity beats not running at all, opt in:

```ts
let db = createD1Database(env.DB, { transactions: "unsafe-nonatomic" });
```

`transaction()` runs the callback and each statement commits on its own. **A failure part-way leaves the earlier writes persisted.** The original error propagates. Nested transactions remain unsupported in both modes.

`wipe()` drops tables rather than deleting a file, because there is no file. D1's own `_cf_*` bookkeeping and SQLite's `sqlite_*` tables are left alone; dropping either breaks the binding.

The driver supports `returning`, upserts, bulk inserts, counts, migrations, and schema inspection. Savepoints, transactional DDL, and migration locks are unsupported.

## Prior art

[`@pkg/data-table-d1`](https://github.com/sergiodxa/monorepo/tree/main/packages/data-table-d1) by Sergio Xalambrí solves the same problem, and `onStatement` is its idea. It also takes the other side of the transaction question, running them non-atomically so shared code keeps working; this package makes that the opt-in above rather than the default, on the grounds that a silent loss of atomicity should be something you asked for. It reports `transactionalDdl: true`, where this one keeps it `false` in both modes, since a non-transaction cannot make DDL transactional.

Its sibling [`@pkg/data-table-sqlstorage`](https://github.com/sergiodxa/monorepo/tree/main/packages/data-table-sqlstorage) covers Durable Object SQLite, which is synchronous and does support real transactions.

## Provenance

`src/sql-compiler.ts` is vendored verbatim from [`@remix-run/data-table-sqlite@0.6.0`](https://www.npmjs.com/package/@remix-run/data-table-sqlite) (MIT, Copyright (c) 2025 Shopify Inc.; the licence is in `LICENSE.remix`). Only its two import specifiers changed, from the private `@remix-run/data-table*` package names to the public `remix/*` subpaths, so a future upstream revision diffs cleanly against it.

It is vendored because `@remix-run/data-table-sqlite` exports exactly `createSqliteDatabase` and `SqliteDatabase`. `compileSqliteOperation` is internal, reached by its own driver through a relative import, and there is no `@remix-run/data-table-d1`. If upstream exposes the compiler or ships a D1 dialect, this file goes away.

## Documentation

- [Cloudflare D1 guide](https://pitlane.tools/guides/cloudflare-d1)
- [API reference](https://pitlane.tools/package/data-table-d1/)
- [`@pitlane/data-table-d1/migrations` reference](https://pitlane.tools/package/data-table-d1/migrations)

## License

MIT

# @pitlane/data-table-d1

A [Cloudflare D1](https://developers.cloudflare.com/d1/) driver for [Remix 3](https://remix.run)'s `data-table`.

```ts
import { createD1Database } from "@pitlane/data-table-d1";
import { env } from "cloudflare:workers";

let db = createD1Database(env.DB);

let post = await db.create(Post, { title: "Hello" }, { returnRow: true });
let recent = await db.query(Post).orderBy({ createdAt: "desc" }).limit(10).all();
```

That is a `Database` from `remix/data-table`, so every query, persistence, and migration method behaves exactly as it does on SQLite or Postgres.

## Install

```sh
npm install @pitlane/data-table-d1
# or
vp add @pitlane/data-table-d1
```

Requires `remix@^3.0.0-beta.10` as a peer. Nothing else: the D1 API is described structurally, so you do not need `@cloudflare/workers-types` unless your own code already does.

## Why this package exists

D1 is SQLite, so the SQL is SQLite's. The execution model is not.

`@remix-run/data-table-sqlite` drives a **synchronous** client — `prepare(sql).all()` returns rows, not a promise, because that is the shape `better-sqlite3` and `node:sqlite` have. D1 is an RPC binding: every call is awaited. No adapter closes that gap, so a D1 app cannot use the SQLite driver at all.

What it can reuse is the SQL. This package pairs the SQLite SQL compiler with a driver written against D1's async prepared-statement API.

## API

### `createD1Database(binding, options?)`

Wraps a D1 binding in a `Database`. `binding` is `env.DB`; `options` is forwarded to `Database`.

### `D1Database`

The `Database` subclass, if you would rather construct it yourself. Same shape as `SqliteDatabase` and `PostgresDatabase`.

### `D1DatabaseDriver`

The bare `DatabaseDriver<"sqlite">`, for handing to `Database` directly or wrapping.

### `D1Binding`

The slice of D1 this package uses: `prepare`, `batch`, `exec`. A real binding satisfies it, and so does a test double.

## What D1 cannot do

**Transactions and savepoints throw.** D1 rejects `BEGIN`, `COMMIT`, and `SAVEPOINT` at the SQL layer and offers `d1.batch()` instead, which takes every statement up front. That cannot express the interleaved begin/execute/commit a `Database` transaction drives, so the driver reports `savepoints: false` and `transactionalDdl: false` and throws a message pointing at `batch()`. Failing at the call beats failing halfway through a write that cannot be rolled back.

**`wipe()` drops tables rather than deleting a file.** There is no file. D1's own `_cf_*` bookkeeping and SQLite's `sqlite_*` tables are left alone; dropping either breaks the binding.

Everything else — `returning`, upserts, bulk inserts, migrations, schema inspection — works.

## Provenance

`src/sql-compiler.ts` is vendored verbatim from [`@remix-run/data-table-sqlite@0.6.0`](https://www.npmjs.com/package/@remix-run/data-table-sqlite) (MIT, Copyright (c) 2025 Shopify Inc.; the licence is in `LICENSE.remix`). Only its two import specifiers changed, from the private `@remix-run/data-table*` package names to the public `remix/*` subpaths, so a future upstream revision diffs cleanly against it.

It is vendored because `@remix-run/data-table-sqlite` exports exactly `createSqliteDatabase` and `SqliteDatabase`. `compileSqliteOperation` is internal, reached by its own driver through a relative import, and there is no `@remix-run/data-table-d1`. If upstream exposes the compiler or ships a D1 dialect, this file goes away.

## License

MIT

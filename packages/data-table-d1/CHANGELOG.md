# @pitlane/data-table-d1

## 0.1.0

Initial release.

- `createD1Database(binding, options?)` wraps a Cloudflare D1 binding in a
  `Database` from `remix/data-table`. `D1Database` is the subclass it returns
  and `D1DatabaseDriver` the bare `DatabaseDriver<"sqlite">`, matching the shape
  of `SqliteDatabase` and `PostgresDatabase`.
- Exists because `@remix-run/data-table-sqlite` drives a synchronous client —
  `prepare(sql).all()` returns rows rather than a promise, as `better-sqlite3`
  and `node:sqlite` do — and D1 is an awaited RPC binding. No adapter bridges
  that, so a D1 app could not use the SQLite driver at all. The SQL is still
  SQLite's, so this pairs that compiler with an async driver.
- Transactions and savepoints throw, naming `d1.batch()` in the message. D1
  rejects `BEGIN`, `COMMIT`, and `SAVEPOINT` at the SQL layer, and `batch()`
  wants every statement up front, which cannot express the interleaved
  begin/execute/commit a `Database` transaction drives. Capabilities report
  `savepoints: false` and `transactionalDdl: false` rather than failing
  mid-write.
- `wipe()` drops the application's tables, leaving D1's `_cf_*` and SQLite's
  `sqlite_*` bookkeeping in place. The pragma that permits the drops travels in
  the same `batch()` as the drops, because it is per-session and D1 gives each
  statement its own session.
- Raw statements always come back with a rows array. The SQLite driver asks a
  prepared statement whether it returns columns; D1 exposes no equivalent, and
  its `all()` carries both `results` and `meta` regardless.
- The D1 API is declared structurally, so the package pulls in no Cloudflare
  types and no ambient globals.
- `src/sql-compiler.ts` is vendored verbatim from
  `@remix-run/data-table-sqlite@0.6.0` (MIT, Copyright (c) 2025 Shopify Inc.),
  with only its import specifiers repointed at the public `remix/*` subpaths.
  Upstream keeps `compileSqliteOperation` internal and publishes no D1 dialect;
  the file goes away if either changes.
- Tested against `remix@3.0.0-beta.10`, with the query, write, count, schema and
  wipe paths exercised inside real workerd through Miniflare.

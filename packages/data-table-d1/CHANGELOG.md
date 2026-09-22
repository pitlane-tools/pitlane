# @pitlane/data-table-d1

## 0.2.2

Published 2026-09-21. [npm](https://www.npmjs.com/package/@pitlane/data-table-d1/v/0.2.2) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/data-table-d1%400.2.2) · [Source](https://github.com/pitlane-tools/pitlane/commit/b725843491ad0c36c61c83d44466134f76dbd615).

Documentation only. `createD1Database`, `D1Database`, and `D1DatabaseDriver` behave as they did in 0.2.1.

- The npm description is now "Cloudflare D1 database driver for Remix."
- The README's opening said every query, persistence, and migration method behaves exactly as it does on SQLite or Postgres. `transaction()` does not, and the same paragraph now says so and links the section covering the opt-in.
- `ROLLBACK` joins `BEGIN`, `COMMIT`, and `SAVEPOINT` in the list of statements D1 rejects. The `createD1Database` entry names its `transactions` option, and `D1Database` is introduced as the subclass that adds `batch(statements)`.
- The isolate-reuse snippet imports `createD1Database` and the `D1Database` type it annotates, so it compiles as written.
- What the driver cannot do is listed rather than implied: savepoints, transactional DDL, and migration locks are unsupported. `returning`, upserts, bulk inserts, counts, migrations, and schema inspection work.
- A Documentation section links the Cloudflare D1 guide, the API reference, and the reference for the `migrations` entry point.

## 0.2.1

Published 2026-09-10. [npm](https://www.npmjs.com/package/@pitlane/data-table-d1/v/0.2.1) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/data-table-d1%400.2.1) · [Source](https://github.com/pitlane-tools/pitlane/commit/dc4844ff683fb1eb6b61f6ab9fe960b8a6c93b44).

Target Remix `3.0.0-rc.2`.

- No driver code changed. `createD1Database`, `D1Database`, and `D1DatabaseDriver` behave as they did in 0.2.0.
- rc.2 raises `@remix-run/data-table` to 0.5.1. This driver is described structurally against the `DatabaseDriver` contract, which the bump leaves alone.
- The `remix` peer stays at `^3.0.0-rc.1`, which already admits rc.2.
- Declarations now come from `typescript@7.0.2`. The pack step reached `@typescript/native-preview` through `dts: { tsgo: true }` until [19d9558](https://github.com/pitlane-tools/pitlane/commit/19d95585aa54078425cccb20414998bf5175fa79) dropped that opt-in. The published `dist/index.d.mts` and `dist/migrations.d.mts` are byte-identical between 0.2.0 and 0.2.1.
- Tested against `remix@3.0.0-rc.2`, including the workerd suite that drives a real Miniflare D1 binding.

## 0.2.0

Published 2026-09-01. [npm](https://www.npmjs.com/package/@pitlane/data-table-d1/v/0.2.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/data-table-d1%400.2.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/2617cd3d0e4c074878f34a96c6175116f926cf05).

Target Remix `3.0.0-rc.1`.

- Raised the `remix` peer dependency to `^3.0.0-rc.1` (from `^3.0.0-beta.10`). `createD1Database`, `D1Database`, and `D1DatabaseDriver` are unchanged, and both published bundles and their declarations are byte-identical to 0.1.0's.
- rc.1 ships `@remix-run/data-table@0.5.0`, which is what this driver is now built and tested against. The `DatabaseDriver<"sqlite">` contract did not move: `wipe()` and an idempotent `close()` are still the required members, and `withMigrationLock` is still optional and still not implemented here.
- `and()` and `or()` compose object shorthand filters in 0.5.0, so `where: or({ status: "pending" }, { status: "processing" })` works through this driver with no change on its side.
- Tested against `remix@3.0.0-rc.1`, including the workerd suite that drives a real Miniflare D1 binding.

## 0.1.0

Published 2026-08-24. [npm](https://www.npmjs.com/package/@pitlane/data-table-d1/v/0.1.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/data-table-d1%400.1.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/01359eaef837235ce930ff112e78ab04d93d03d1).

Initial release.

- `createD1Database(binding, options?)` wraps a Cloudflare D1 binding in a `Database` from `remix/data-table`. `D1Database` is the subclass it returns and `D1DatabaseDriver` the bare `DatabaseDriver<"sqlite">`, matching the shape of `SqliteDatabase` and `PostgresDatabase`.
- Exists because `@remix-run/data-table-sqlite` drives a synchronous client — `prepare(sql).all()` returns rows rather than a promise, as `better-sqlite3` and `node:sqlite` do — and D1 is an awaited RPC binding. No adapter bridges that, so a D1 app could not use the SQLite driver at all. The SQL is still SQLite's, so this pairs that compiler with an async driver.
- Transactions throw by default, naming `d1.batch()` and the opt-in below. D1 rejects `BEGIN`, `COMMIT`, and `SAVEPOINT` at the SQL layer, and `batch()` wants every statement up front, which cannot express the interleaved begin/execute/commit a `Database` transaction drives. Capabilities report `savepoints: false` and `transactionalDdl: false` rather than failing mid-write.
- `transactions: "unsafe-nonatomic"` opts out of that refusal, for callers shared with a backend that does have transactions where running without atomicity beats not running. `transaction()` then runs the callback with each statement committing on its own, so a failure part-way leaves the earlier writes persisted — asserted against real D1, not just described. Rollback stays silent so the callback's own error surfaces instead of an `AggregateError` about an impossible rollback, and nesting still fails in both modes because `savepoints: false` stops it upstream of the driver.
- `db.batch(statements)` runs statements atomically through D1's `batch()`, which is its one atomic primitive and the reason it cannot back `transaction()`. A failing statement rolls the whole batch back, asserted against real D1. Inputs are `SqlStatement`s from `remix/data-table`'s `sql` tag rather than query-builder calls, because `data-table` exposes no way to build an operation without running it — `create` and `updateMany` execute on call and `Query` has no `toSql()`. The point is that reaching for atomicity no longer means reaching for the raw binding.
- `wipe()` drops the application's tables, leaving D1's `_cf_*` and SQLite's `sqlite_*` bookkeeping in place. The pragma that permits the drops travels in the same `batch()` as the drops, because it is per-session and D1 gives each statement its own session.
- `generateD1Migrations()`, from the `@pitlane/data-table-d1/migrations` entry point, compiles `data-table` migrations into the flat `.sql` files Wrangler's D1 migration runner reads. Production migrations then go through Wrangler's own workflow, which is what four apps in the wild had each hand-rolled: two byte-identical copies of one generator, and two more that drifted to 74 and 101 lines from a common ancestor. SQL is copied verbatim rather than split into statements, so a semicolon inside a trigger body survives; the output directory is pruned to match the source; and files that are not generated artifacts are left alone. Node-only, and a separate entry point so it stays out of Worker bundles.
- Raw statements always come back with a rows array. The SQLite driver asks a prepared statement whether it returns columns; D1 exposes no equivalent, and its `all()` carries both `results` and `meta` regardless.
- `onStatement` reports what each statement cost — `{ kind, table, rowsRead, rowsWritten, durationMs }` — off the `meta` D1 already returns. D1 bills on rows read and written and reports analytics per database, so this is the only per-query attribution available, and it costs no extra statement. Observer throws are swallowed, statements that throw are not reported, and figures D1 omits come through as `0` rather than estimated. The idea is [`@pkg/data-table-d1`](https://github.com/sergiodxa/monorepo/tree/main/packages/data-table-d1)'s.
- The D1 API is declared structurally, so the package pulls in no Cloudflare types and no ambient globals.
- `src/sql-compiler.ts` is vendored verbatim from `@remix-run/data-table-sqlite@0.6.0` (MIT, Copyright (c) 2025 Shopify Inc.), with only its import specifiers repointed at the public `remix/*` subpaths. Upstream keeps `compileSqliteOperation` internal and publishes no D1 dialect; the file goes away if either changes.
- Two ESM entry points, `.` and `./migrations`, with no runtime dependencies. `remix@^3.0.0-beta.10` is the only peer: the driver imports `remix/data-table` and `remix/data-table/sql-helpers`, and the migrations entry adds `remix/data-table/migrations/node` plus `node:fs/promises` and `node:path`. Node `^20.19.0 || >=22.12.0`.
- Tested against `remix@3.0.0-beta.10`, with the query, write, count, schema and wipe paths exercised inside real workerd through Miniflare.

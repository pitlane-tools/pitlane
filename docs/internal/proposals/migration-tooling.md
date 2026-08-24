# Migration tooling proposals

Status: draft, unscheduled. Nothing here is committed to a release.

`remix/data-table` can author a migration and apply one. What it has no opinion
about is the part between them: turning TypeScript migrations into artifacts a
platform's own migration runner will accept, and knowing which of them a given
deployment has already seen. Every app that has needed that has written it
again.

This proposes a `pitlane` CLI that owns the generate/apply/status loop, the way
`drizzle-kit` and the `remix` CLI do for their ecosystems.

## Evidence

Counts below come from the current tree, not from memory.

Four apps in this account run `data-table` migrations against Cloudflare D1, and
all four hand-rolled the same pipeline:

| App                            | Generator                                 | Applier                               | Task names                                                                    |
| ------------------------------ | ----------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| `templates/pitlane/cloudflare` | `db/generate-migrations.ts`, 20 lines     | wrangler direct                       | `db:generate`, `db:migrate`, `db:migrate:remote`                              |
| `Templates/remix/cloudflare`   | `db/generate-migrations.ts`, 20 lines     | wrangler direct                       | `db:generate`, `db:migrate:local`, `db:migrate:remote`                        |
| `remix-3-contacts`             | `db/generate-d1-migrations.ts`, 74 lines  | `db/apply-d1-migrations.ts`, 47 lines | `db:migrations:generate`, `db:migrations:apply:local`                         |
| `maitre-d`                     | `db/generate-d1-migrations.ts`, 101 lines | `db/apply-d1-migrations.ts`, 47 lines | `db:migrations:generate`, `db:migrations:apply:local`, `db:migrations:deploy` |

What that table hides is more useful than what it shows.

- The two template generators are **byte-identical**. Copy, not convergence.
- The two application generators started as one file and drifted: 74 versus 101
  lines, 108 lines of diff. Both still open with the same four imports.
- Both appliers are 47 lines and no longer identical; one extracted a
  `db/lib/wrangler-cli.ts` and `db/lib/wrangler-config.ts` that the other
  inlines.
- No two of the four agree on task names. `db:migrate`, `db:migrate:local`, and
  `db:migrations:apply:local` are the same operation in three projects.
- `maitre-d` grew guard tests for this pipeline — including one asserting that
  no file under `db/` imports the remote D1 helper — which is what a project
  does when a workflow has an edge sharp enough to cut twice.

## The hazard worth naming first

There are two migration journals, and nothing warns you when both are in play.

| Mechanism                      | Journal table           |
| ------------------------------ | ----------------------- |
| `db.migrate(migrations)`       | `data_table_migrations` |
| `wrangler d1 migrations apply` | `d1_migrations`         |

Verified against real D1: `db.migrate()` creates and maintains
`data_table_migrations`, and a second run is correctly a no-op. Wrangler keeps
its own state in `d1_migrations` and cannot see the other table.

Use `db.migrate()` locally and wrangler in CI and the two disagree about what
has been applied, silently, until a migration runs twice or not at all. Nothing
in either tool detects the split. Every one of the four apps avoids this by
using the wrangler path exclusively — a convention transmitted by copying, not
by any check.

A second, smaller trap: `loadMigrations` imports `node:fs` and `node:path`, so
it cannot run inside a Worker. The obvious-looking
`db.migrate(await loadMigrations(...))` is Node tooling only. The docs now say
so; nothing enforces it.

## What a CLI would own

In the order each unblocks the next.

1. **Generate** — compile migrations to the platform's artifact format. This is
   the byte-identical file. **Shipped for D1** in 0.1.0 as
   `generateD1Migrations()`, a library call rather than a command, because a
   two-line script needs no binary and naming one would prejudge the questions
   below. A CLI would wrap it, not replace it. Still open: the same step for
   Postgres and SQLite targets.
2. **`apply --local|--remote`** — dispatch to the platform runner, parsing
   whatever config names the database. That is the 47-line applier plus the
   `db/lib` config parsing two apps already extracted. For D1 this is
   `wrangler d1 migrations apply`, so the CLI's value here is config discovery
   and a task name that does not differ per project.
3. **`status`** — which migrations a given deployment has applied. None of the
   four apps has this. It is also the natural place to detect the two-journal
   split and refuse rather than diverge.
4. **`seed`** — three of the four have a seed script, all with different
   idempotency rules. Lowest value; listed for completeness rather than as a
   recommendation.

With step 1 shipped, the remaining case for a binary rests on 2 and 3. That is
a weaker case than this document originally made, which is the correct outcome:
the duplicated code is gone, and what is left is a naming and discovery problem.

## Scope questions this does not settle

- **Where it lives.** A `pitlane` binary implies an umbrella package, which the
  repo has so far avoided (`docs/internal/VISION.md` covers that tension). A
  `@pitlane/db` CLI with no umbrella is the smaller move.
- **Which platforms.** D1 is the case with four data points. Postgres templates
  use `db/migrate.ts` and a different shape entirely; whether one CLI covers
  both is unproven.
- **Whether generation belongs upstream.** Steps 1 and 3 are arguably
  `data-table`'s, not Pitlane's. Worth asking remix before building a parallel
  implementation, alongside the two existing upstream asks: exposing
  `compileSqliteOperation`, and exposing operation construction so a typed
  `batch()` is possible.

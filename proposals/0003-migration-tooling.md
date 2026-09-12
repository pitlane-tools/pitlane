---
id: proposal.0003
title: Migration Tooling
authors: [markmals]
status: draft
pull-request: https://github.com/pitlane-tools/pitlane/pull/17
issues: []
supersedes: []
---

# Migration Tooling

<!--
Adopted into the record from docs/internal/proposals/migration-tooling.md, which predated the
Workbench process. The evidence, the hazard, and the open questions are as they were written; the
sections around them are new, and the counts have not been re-verified since.
-->

## Summary

A CLI that owns the generate, apply, and status loop for `remix/data-table` migrations, the way
`drizzle-kit` does for Drizzle. Four applications have hand-rolled the same pipeline, and two
migration journals can silently disagree about what has been applied.

## Motivation

`remix/data-table` can author a migration and apply one. What it has no opinion about is the part
between them: turning TypeScript migrations into artifacts a platform's own migration runner will
accept, and knowing which of them a given deployment has already seen. Every app that has needed
that has written it again.

Counts below come from the tree as it stood when this was written, and have not been re-verified
since. Four apps in this account run `data-table` migrations against Cloudflare D1, and all four
hand-rolled the same pipeline:

| App                            | Generator                                 | Applier                               | Task names                                                                    |
| ------------------------------ | ----------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| `templates/pitlane/cloudflare` | `db/generate-migrations.ts`, 20 lines     | wrangler direct                       | `db:generate`, `db:migrate`, `db:migrate:remote`                              |
| `Templates/remix/cloudflare`   | `db/generate-migrations.ts`, 20 lines     | wrangler direct                       | `db:generate`, `db:migrate:local`, `db:migrate:remote`                        |
| `remix-3-contacts`             | `db/generate-d1-migrations.ts`, 74 lines  | `db/apply-d1-migrations.ts`, 47 lines | `db:migrations:generate`, `db:migrations:apply:local`                         |
| `maitre-d`                     | `db/generate-d1-migrations.ts`, 101 lines | `db/apply-d1-migrations.ts`, 47 lines | `db:migrations:generate`, `db:migrations:apply:local`, `db:migrations:deploy` |

What that table hides is more useful than what it shows.

- The two template generators are **byte-identical**. Copy, not convergence.
- The two application generators started as one file and drifted: 74 versus 101 lines, 108 lines of
  diff. Both still open with the same four imports.
- Both appliers are 47 lines and no longer identical; one extracted a `db/lib/wrangler-cli.ts` and
  `db/lib/wrangler-config.ts` that the other inlines.
- No two of the four agree on task names. `db:migrate`, `db:migrate:local`, and
  `db:migrations:apply:local` are the same operation in three projects.
- `maitre-d` grew guard tests for this pipeline — including one asserting that no file under `db/`
  imports the remote D1 helper — which is what a project does when a workflow has an edge sharp
  enough to cut twice.

### The hazard worth naming first

There are two migration journals, and nothing warns you when both are in play.

| Mechanism                      | Journal table           |
| ------------------------------ | ----------------------- |
| `db.migrate(migrations)`       | `data_table_migrations` |
| `wrangler d1 migrations apply` | `d1_migrations`         |

Verified against real D1: `db.migrate()` creates and maintains `data_table_migrations`, and a second
run is correctly a no-op. Wrangler keeps its own state in `d1_migrations` and cannot see the other
table.

Use `db.migrate()` locally and wrangler in CI and the two disagree about what has been applied,
silently, until a migration runs twice or not at all. Nothing in either tool detects the split.
Every one of the four apps avoids this by using the wrangler path exclusively — a convention
transmitted by copying, not by any check.

A second, smaller trap: `loadMigrations` imports `node:fs` and `node:path`, so it cannot run inside
a Worker. The obvious-looking `db.migrate(await loadMigrations(...))` is Node tooling only. The docs
now say so; nothing enforces it.

## Proposed solution

A CLI owning the loop, in the order each step unblocks the next.

1. **Generate** — compile migrations to the platform's artifact format. This is the byte-identical
   file. **Shipped for D1** in 0.1.0 as `generateD1Migrations()`, a library call rather than a
   command, because a two-line script needs no binary and naming one would prejudge the questions
   below. A CLI would wrap it, not replace it. Still open: the same step for Postgres and SQLite
   targets.
2. **`apply --local|--remote`** — dispatch to the platform runner, parsing whatever config names the
   database. That is the 47-line applier plus the `db/lib` config parsing two apps already
   extracted. For D1 this is `wrangler d1 migrations apply`, so the CLI's value here is config
   discovery and a task name that does not differ per project.
3. **`status`** — which migrations a given deployment has applied. None of the four apps has this.
   It is also the natural place to detect the two-journal split and refuse rather than diverge.
4. **`seed`** — three of the four have a seed script, all with different idempotency rules. Lowest
   value; listed for completeness rather than as a recommendation.

With step 1 shipped, the remaining case for a binary rests on 2 and 3. That is a weaker case than
this document originally made, which is the correct outcome: the duplicated code is gone, and what
is left is a naming and discovery problem.

## Detailed design

Not written. This proposal is at the stage where the problem is evidenced and the shape is sketched;
the questions under **Open questions** decide the surface, and answering them is what a detailed
design would be derived from.

Implementation must not begin against this section as it stands. A draft without a detailed design
cannot reach `awaiting-implementation`.

## Compatibility

Undetermined until the surface is settled. Step 1 already shipped as `generateD1Migrations()`, so
whatever lands has to keep that library call working or supersede it deliberately.

## Implications on adoption

Undetermined. If the answer is a binary, it carries the umbrella-package question below; if it is a
library, adoption is an import.

## Scope

Undetermined pending **Open questions**.

### Out of scope

- **Replacing `generateD1Migrations()`.** It shipped and works. A CLI wraps it.
- **Changing `remix/data-table`'s own migration authoring or `db.migrate()`.** Upstream's.

## Preview

- Artifact: undetermined. A CLI's preview is the pkg.pr.new build of whichever package ships it,
  exercised against a real D1 database.
- Reason: the hazard this addresses is two journals disagreeing, which only a real database shows.

## Policies and decisions checked

- `policies/` and `decisions/` — empty apart from their READMEs. Neither constrains this proposal.
- `VISION.md`, [Deployment boundary](../VISION.md#deployment-boundary) — **conflict, unresolved.**
  The vision states that Pitlane "deliberately has no platform package, target schema, generated
  `.pitlane/` configuration, deployment CLI, or universal deploy action", and that "provider tools
  generate their own binding types and manage login, secrets, resource creation, logs, preview, and
  deployment". A `pitlane migrate --remote` that shells out to wrangler sits close enough to that
  line to need an explicit ruling before any of this is built. The narrower reading — that the
  boundary is about _deployment_, and migrations are a data concern — is available but has not been
  taken.
- `VISION.md`, [Reserved names](../VISION.md#reserved-names) — `pitlane` is published at `0.0.0` to
  hold the name and its entry throws. A `pitlane` binary would be that package's first real
  content, which the vision says the umbrella earns "once the set is large enough to be worth
  learning as a whole".

## Future directions

- A check that fails when both journal tables exist in one database, independent of whether a CLI
  ever ships. It is the part of step 3 with value on its own.
- Postgres and SQLite generation, once there is more than one data point for either.

## Alternatives considered

- **Leave it to each application.** What happens today. Rejected as the motivation: four copies,
  three names for one operation, and a silent-corruption hazard nobody is checking for.
- **A `@pitlane/db` CLI with no umbrella.** The smaller move, and it sidesteps the reserved-name
  question. Listed under **Open questions** rather than chosen.
- **Ask remix to own it.** Steps 1 and 3 are arguably `data-table`'s. Genuinely preferable if
  upstream wants them; it is a question to put to them, not a decision this repo can make alone.

## Open questions

- [NEEDS CLARIFICATION: Does the Deployment boundary section of VISION.md forbid this, or is a
  migrations CLI a data concern outside it? Nothing else can be settled until this is.]
- [NEEDS CLARIFICATION: Where does it live — a `pitlane` binary, which implies the umbrella package
  the repo has so far avoided, or a `@pitlane/db` CLI with no umbrella?]
- [NEEDS CLARIFICATION: Which platforms does it cover? D1 is the case with four data points.
  Postgres templates use `db/migrate.ts` and a different shape entirely; whether one CLI covers both
  is unproven.]
- [NEEDS CLARIFICATION: Does generation belong upstream? Worth asking remix before building a
  parallel implementation, alongside the two existing upstream asks: exposing
  `compileSqliteOperation`, and exposing operation construction so a typed `batch()` is possible.]
- [NEEDS CLARIFICATION: Are the four applications' counts in Motivation still accurate? They were
  taken from the tree in August 2026 and have not been re-verified.]

# Pitlane

![Pitlane logo](https://i.imgur.com/3QRfNfi.png)

## Overview

Pitlane is a set of packages that give Remix 3 apps first-class platform integration. It replaces hand-written infrastructure code (adapters, config files, migration runners, type generation) with maintained libraries and a CLI that wraps platform tooling.

The goal is to bring the developer experience of Void (auto-provisioned platform primitives, one-command deploy, zero infrastructure boilerplate) to Remix 3 — without hiding the underlying platform, without building a multi-tenant system, and without breaking Remix's explicit composition patterns.

**Key principle**: Pitlane follows Remix 3 idioms. Platform primitives are middleware you add and context keys you read, not magic globals. Configuration is explicit. The `platform()` Vite plugin is the canonical source of the project's Cloudflare configuration, and all other tools (CLI, deploy action, type generation) read from it.

**Supported platform**: Cloudflare. The `platform()` Vite plugin is imported from `pitlane/dev`. All runtime exports (middleware, context keys, helpers) come from `pitlane/dev`.

**Name and distribution:**

- npm packages: `pitlane`, `@pitlane/*`
- GitHub org: `pitlane-tools`
- CLI command: `pitlane`
- Docs site: `platform.pitlane.tools/docs`
- Scaffolding: `vp create pitlane` (via `create-pitlane` package)

## Package architecture

Five packages in a monorepo. Each has one job and can be used independently, but they compose into a cohesive experience when used together.

| Package                       | Purpose                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| `pitlane/dev`                 | Vite plugin — Remix 3 framework build integration                      |
| `pitlane/dev`                 | Vite plugin + platform adapters, middleware, context keys, and helpers |
| `pitlane/cli`                 | CLI wrapping platform tooling — database, secrets, resources, deploy   |
| `pitlane-tools/deploy-action` | GitHub Action for CI/CD deployment                                     |
| `pitlane/mcp`                 | MCP server for AI-assisted development (post-MVP)                      |

The adapter/middleware code lives inside `pitlane/*`. The Vite plugin is imported from `pitlane/dev`; all runtime exports come from the package root. One install gives you everything.

## `pitlane/dev` — framework Vite plugin

Generalizes the `remix.plugin.ts` that currently lives as hand-rolled application code in every Remix 3 project. Handles four concerns:

**1. Build orchestration** — Configures SSR and client Vite environments, sets output directories (`dist/ssr`, `dist/client`), and sequences the build (SSR first, then client). Wraps `@hiogawa/vite-plugin-fullstack` internally.

**2. Client entry transforms** — Finds `clientEntry(import.meta.url, ...)` calls and rewrites the first argument. On the server, resolves to the client asset URL with a `#ExportName` fragment. On the client, appends the fragment to `import.meta.url`. Uses `oxc-parser` for AST analysis.

**3. Preview server** — Adds a `configurePreviewServer` hook that loads the built SSR entry and wires it up via `remix/node-fetch-server` so `vp preview` works out of the box.

**4. Abort error suppression** — Swallows `"aborted"` errors from client disconnects (search-as-you-type) so they don't trigger Vite's error overlay.

**API:**

```ts
import { remix } from "pitlane/dev";

export default defineConfig({
    plugins: [
        remix({
            // All optional, sensible defaults
            clientEntry: "app/entry.browser", // false to disable
            serverEntry: "app/entry.server",
            serverEnvironments: ["ssr"],
            serverHandler: false, // true if not using pitlane/dev
        }),
    ],
});
```

## `pitlane/dev` — platform Vite plugin

The `platform()` plugin is the canonical source of the project's Cloudflare configuration. Every other tool — the CLI, the deploy action, type generation — reads this config to know what to do.

### What it does

Replaces `@cloudflare/vite-plugin` + manual `wrangler.jsonc` + the `typegen` run task:

- **Dev time**: generates `wrangler.jsonc` in `.pitlane/` (gitignored) from conventions + config, runs `wrangler types` and outputs `worker-configuration.d.ts` into `.pitlane/`, delegates to `@cloudflare/vite-plugin` internally for Miniflare/workerd dev integration.
- **Build time**: regenerates wrangler config if needed, lets Cloudflare's plugin handle Worker bundling.

### Config shape

```ts
// Single binding shorthand
platform({
    d1: { binding: "DB", database: "contacts" },
    kv: { binding: "CACHE" },
    r2: { binding: "FILES" },
    queues: { binding: "TASKS", queue: "task-queue" },
    cron: "0 * * * *",
});

// Multiple bindings
platform({
    name: "my-app",
    compatibilityDate: "2026-04-08",
    d1: [
        { binding: "DB", database: "primary" },
        { binding: "ANALYTICS_DB", database: "analytics" },
    ],
    kv: [{ binding: "CACHE" }, { binding: "SESSIONS" }],
    r2: [{ binding: "UPLOADS" }, { binding: "ASSETS" }],
    queues: [
        { binding: "TASKS", queue: "task-queue" },
        { binding: "EMAILS", queue: "email-queue" },
    ],
    cron: ["0 * * * *", "0 0 * * *"],
});
```

Every Cloudflare resource type (`d1`, `kv`, `r2`, `queues`) accepts either a single object or an array of objects. A single object is sugar for a one-element array. When using multiple bindings of the same type, add multiple middleware calls with custom context keys created via `createContextKey()`.

### What it generates

`.pitlane/wrangler.jsonc` — a complete Wrangler config derived from the plugin options. Includes `main`, `assets`, `compatibility_date`, `d1_databases`, `kv_namespaces`, `r2_buckets`, `queues`, `triggers`. The user can inspect it for debugging but never edits it.

### What it does NOT do

- No import scanning. Resource detection is based on plugin config.
- No auto-provisioning of remote resources. That's the CLI's job.
- No hiding platform concepts. The generated configs and types are inspectable in `.pitlane/`.

## `pitlane/dev` — runtime exports

All Cloudflare platform primitives are imported from `pitlane/dev`.

### Middleware and context keys

Platform bindings are accessed through individual middleware functions that wrap raw Cloudflare bindings (from `env` via `cloudflare:workers`) and inject typed values into request context. Each middleware has a corresponding context key.

#### Database

The `database()` middleware wraps a D1 binding as a `Database` instance (from `remix/data-table`, backed by `D1DatabaseAdapter`) and injects it into request context under the `Database` key.

```ts
import { env } from "cloudflare:workers";
import { database, Database } from "pitlane/dev";

// In the middleware stack
database(env.DB);

// In a route handler
let db = ctx.get(Database);
let contacts = await db.findMany(Contacts);
```

If you need a second database, create an additional context key and add another `database()` call:

```ts
import { createContextKey } from "remix/context";
import { database, Database, D1DatabaseAdapter } from "pitlane/dev";

let AnalyticsDB = createContextKey<Database>();

// In the middleware stack
database(env.DB),
database(env.ANALYTICS_DB, AnalyticsDB),

// Usage
let db = ctx.get(Database);
let analytics = ctx.get(AnalyticsDB);
```

#### File Storage

The `fileStorage()` middleware wraps R2 bindings as `FileStorage` instances (from `remix/file-storage`, backed by `R2FileStorage`).

```ts
import { env } from "cloudflare:workers";
import { fileStorage, FileStorage } from "pitlane/dev";

// In the middleware stack
fileStorage(env.FILES);

// In a route handler
let files = ctx.get(FileStorage);
await files.set("avatar", file);
```

#### Generated types

The platform plugin runs `wrangler types` and outputs `worker-configuration.d.ts` into `.pitlane/`, typing the `env` object from `cloudflare:workers`:

```ts
// .pitlane/worker-configuration.d.ts (generated — do not edit)
interface Env {
    DB: D1Database;
    ANALYTICS_DB: D1Database;
    CACHE: KVNamespace;
    FILES: R2Bucket;
    EMAIL_QUEUE: Queue;
}
```

The middleware functions (`database()`, `fileStorage()`) wrap these raw bindings in higher-level Remix abstractions before injecting them into request context.

### D1DatabaseAdapter

The `D1DatabaseAdapter` implements `remix/data-table`'s `DatabaseAdapter` interface — the contacts demo's 222-line adapter, cleaned up and maintained as a library. It is not something the user interacts with directly; `database()` uses it internally to wrap D1 bindings as `Database` instances.

### R2FileStorage

The `R2FileStorage` class implements `remix/file-storage`'s `FileStorage` interface (similar to [remix-run/remix#10816](https://github.com/remix-run/remix/pull/10816)). Like the D1 adapter, it is used internally by `fileStorage()` to wrap R2 bindings.

### Session Storage

```ts
import { env } from "cloudflare:workers";
import { createKvSessionStorage } from "pitlane/dev";
import { createRouter } from "remix/fetch-router";
import { createCookie } from "remix/cookie";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";

let sessionCookie = createCookie("__session", {
    secrets: ["s3cr3t"], // session cookies must be signed!
    httpOnly: true,
    secure: true,
    sameSite: "lax",
});

let sessionStorage = createKvSessionStorage(env.SESSION, {
    keyPrefix: "session:",
    ttl: 60 * 60 * 24,
});

let router = createRouter({
    middleware: [session(sessionCookie, sessionStorage)],
});

router.get("/", context => {
    let session = context.get(Session);
    session.set("count", Number(session.get("count") ?? 0) + 1);
    return new Response(`Count: ${session.get("count")}`);
});
```

### Jobs

Background jobs are powered by Cloudflare Queues with a typed, schema-validated API modeled after `remix/job`. Jobs are defined once and shared between the producer (scheduler) and consumer (queue).

#### Defining jobs

Each job declares its queue `binding`, a `schema` for payload validation, and a `handle` function. The binding is the raw CF Queue producer from `env`.

```ts
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createJobs } from "pitlane/job";

let jobs = createJobs({
    sendEmail: {
        binding: env.EMAIL_QUEUE,
        schema: s.object({ to: s.string(), subject: s.string() }),
        async handle(payload) {
            await sendEmail(payload.to, payload.subject);
        },
    },
});
```

#### Scheduling jobs

The `scheduler()` middleware creates a typed job scheduler from job definitions and injects it into request context via the `Scheduler` key.

```ts
import { scheduler } from "pitlane/job-middleware";
import { Scheduler } from "pitlane/job";

// In the middleware stack
scheduler(jobs);

// In a route handler
let scheduler = ctx.get(Scheduler);

await scheduler.enqueue(jobs.sendEmail, {
    to: "a@example.com",
    subject: "Hello",
});
```

#### Retrying jobs

Use `retry` to control retry behavior after failures.

- `retry.maxAttempts`: Total attempts before the message is sent to the dead-letter queue (includes the first attempt). Defaults to `5`.
- `retry.strategy`: Backoff strategy, either `'fixed'` or `'exponential'`. Defaults to `'exponential'`.
- `retry.baseDelayMs`: Base retry delay in milliseconds. Defaults to `1000`.
- `retry.maxDelayMs`: Maximum retry delay cap in milliseconds. Defaults to `300000`.
- `retry.jitter`: Delay randomization strategy (`'none'` or `'full'`). Defaults to `'full'`.

```ts
await scheduler.enqueue(
    jobs.sendEmail,
    { to: "vip@example.com", subject: "Important update" },
    {
        retry: {
            maxAttempts: 5,
            strategy: "exponential",
            baseDelayMs: 1000,
            maxDelayMs: 60_000,
            jitter: "full",
        },
    },
);
```

Retry config is stored as message metadata and respected by the queue consumer. When a handler throws, the consumer delays the retry according to the strategy before allowing the message to be re-delivered.

#### Observability hooks

Scheduler and queue hooks let you emit logs/metrics without changing job logic.

```ts
scheduler(jobs, {
    onEnqueue(event) {
        metrics.count("job.enqueue", 1, { job: event.jobName });
    },
});

let queue = createJobQueue(jobs, {
    onJobComplete(event) {
        metrics.timing("job.duration", event.durationMs, {
            job: event.job.name,
        });
    },
    onJobFailed(event) {
        logger.error("failed job", event.job.id, event.error);
    },
});
```

#### Job queue

The queue consumer dispatches incoming messages to the correct job handler based on message metadata. Returns a `.handler` property for the Worker export.

```ts
import { createJobQueue } from "pitlane/job";

let queue = createJobQueue(jobs);
```

### Cron

Explicit handler registration, no file-system conventions.

```ts
import { createCron } from "pitlane/dev";

let cron = createCron({
    "0 * * * *": {
        async handle(event) {
            // hourly work
        },
    },
    "0 0 * * *": {
        async handle(event) {
            // daily work
        },
    },
});
```

Returns an object with a `.handler` property for the Worker export.

### Full entry.server.tsx example

```ts
// entry.server.tsx
import { env } from "cloudflare:workers";
import { EmailMessage } from "cloudflare:email";

import { createRouter } from "remix/fetch-router";
import { asyncContext } from "remix/async-context-middleware";
import { createCookie } from "remix/cookie";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";
import { staticFiles } from "remix/static-middleware";
import { Database } from "remix/data-table";

import * as s from "remix/data-schema";

import { database } from "pitlane/data-table-middleware";
import { fileStorage } from "pitlane/file-storage-middleware";
import { R2FileStorage } from "pitlane/file-storage";
import { Scheduler, createJobs, createJobQueue } from "pitlane/jobs";
import { scheduler } from "pitlane/jobs-middleware";
import { createCron } from "pitlane/cron";
import { createKvSessionStorage } from "pitlane/session-storage";

import { routes } from "~/routes.ts";
import contacts from "~/contacts.tsx";

let sessionCookie = createCookie("__session", {
    secrets: ["s3cr3t"],
    httpOnly: true,
    secure: true,
    sameSite: "lax",
});

let sessionStorage = createKvSessionStorage(env.SESSION, {
    keyPrefix: "session:",
    ttl: 60 * 60 * 24,
});

let jobs = createJobs({
    sendEmail: {
        binding: env.EMAIL_QUEUE,
        schema: s.object({ to: s.string(), subject: s.string() }),
        async handle(payload) {
            let message = new EmailMessage(payload.to, EMAIL_ADDRESS, payload.subject);
            await env.EMAIL.send(message);
        },
    },
});

let router = createRouter({
    middleware: [
        staticFiles("./public"),
        staticFiles("./dist/client"),
        formData(),
        methodOverride(),
        asyncContext(),
        database(env.DB),
        fileStorage(env.FILES),
        scheduler(jobs),
        session(sessionCookie, sessionStorage),
    ],
});

router.map(routes.home, async ctx => {
    let db = ctx.get(Database);
    let files = ctx.get(FileStorage);
    let scheduler = ctx.get(Scheduler);
    let session = ctx.get(Session);

    await scheduler.enqueue(jobs.sendEmail, {
        to: "mark@example.com",
        subject: "Hello",
    });
});

router.map(routes.contacts, contacts);

let queue = createJobQueue(jobs);

let cron = createCron({
    "0 * * * *": {
        async handle(event) {
            // hourly work
        },
    },
});

export default {
    fetch: router.fetch,
    queue: queue.handler,
    scheduled: cron.handler,
} satisfies ExportedHandler<Env>;
```

### Full vite.config.ts example

```ts
import { remix } from "pitlane/dev";
import { platform } from "pitlane/dev";
import { defineConfig } from "vite-plus";

export default defineConfig({
    plugins: [
        remix(),
        platform({
            d1: { binding: "DB", database: "contacts" },
            kv: { binding: "CACHE" },
            r2: { binding: "FILES" },
            queues: { binding: "TASKS", queue: "task-queue" },
            cron: "0 * * * *",
        }),
    ],
});
```

## `pitlane/cli` — the `pitlane` CLI

Wraps Wrangler and provides Remix 3-aware commands. Reads configuration from the `platform()` plugin options in `vite.config.ts` — no separate CLI config file.

The CLI does NOT shim any commands already provided by Vite+ (`dev`, `build`, `check`, `test`, etc.). It focuses exclusively on platform operations.

### Database commands

Wraps `remix/data-table` and D1.

```
pitlane db generate          — generate migration file from schema diff
pitlane db push              — apply schema directly to local D1 (prototyping)
pitlane db migrate           — run pending migrations locally
pitlane db migrate --remote  — run pending migrations against remote D1
pitlane db reset             — wipe local D1 state
pitlane db seed              — run seed file
```

### Secrets

```
pitlane secrets push         — sync .env to Cloudflare Worker secrets
pitlane secrets list         — list remote secret names (values are write-only)
```

`pitlane secrets push` reads `.env`, diffs against deployed secret names, and pushes changes. Warns before overwriting.

### Resources

```
pitlane resources list       — show project's CF resources and their status
pitlane resources create     — provision D1/KV/R2/queues from platform config
pitlane resources link       — link existing CF resources
```

Resource provisioning is an explicit step, not auto-provisioned on deploy. Reads the `platform()` config to know what to create.

### Deploy

```
pitlane deploy               — build + migrate + deploy
pitlane deploy --dry-run     — show plan without executing
```

`pitlane deploy` in detail:

1. Build the project (`vp build`)
2. Run `pitlane db migrate --remote` if there are pending migrations
3. Abort if migration fails
4. Run `wrangler deploy` using the generated `.pitlane/wrangler.jsonc`
5. Log the live URL

### Setup

```
pitlane setup             — generate .github/workflows/deploy.yml
```

Writes a ready-to-use GitHub Actions workflow using `pitlane-tools/deploy-action`. Prompts for any needed values (environment name, production URL).

When `gh` is available and authenticated, the command detects the full repository state and offers to handle each missing step:

1. **No git repo** — offers to run `git init` and create an initial commit
2. **No GitHub remote** — offers to create a GitHub repo via `gh repo create` and push
3. **Missing platform secrets** — if logged in via `pitlane login`, offers to create a scoped API token via the Cloudflare API and set `CLOUDFLARE_API_TOKEN` as a repository secret via `gh secret set`.
4. **Writes the workflow file** — `.github/workflows/deploy.yml`

When everything is available, the full flow is: init repo, create remote, create platform token, set secret, write workflow — zero manual steps from fresh project to CI pipeline.

### Auth

```
pitlane login                — delegates to `wrangler login`
pitlane whoami               — show Cloudflare identity
```

## `pitlane-tools/deploy-action` — GitHub Action

A GitHub Action for CI/CD deployment. The user handles building and Vite+ setup themselves, since those choices vary across projects (Mise, the official Vite+ action, Homebrew, etc.).

The action assumes the project is already built (`dist/` exists) and takes care of the platform-specific steps.

**Usage:**

```yaml
name: Build & Deploy

on:
    push:
        branches: [main]

permissions:
    contents: read
    deployments: write

jobs:
    deploy:
        runs-on: ubuntu-latest
        environment:
            name: production
            url: https://my-app.example.com
        steps:
            - uses: actions/checkout@v4

            - uses: voidzero-dev/setup-vp@v1
              with:
                  node-version: "24"
                  cache: true

            - run: vp build

            - uses: pitlane-tools/deploy-action@v1
              with:
                  cloudflareApiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**What the action does:**

1. Runs `pitlane db migrate --remote` if there are pending migrations
2. Aborts if migration fails
3. Runs `pitlane deploy` using the generated `.pitlane/wrangler.jsonc`

**What the action does NOT do:**

- Install dependencies or set up Vite+ — the user's responsibility
- Build the project — the user runs `vp build` before calling the action
- Provision resources — `pitlane resources create` is a one-time step, not part of CI

This means `pitlane deploy` from the local CLI and the GitHub Action do the same thing, but the action is the primary deploy path for most teams. The CLI command exists for local one-offs and debugging.

## `pitlane/mcp` — MCP server (post-MVP)

Not part of the MVP. Documented here for direction.

### Developer-facing (docs + project introspection)

- Ships Remix 3 and Pitlane docs inside the package, searchable via MCP
- Introspects project structure — reads platform plugin config, knows what resources are configured, what middleware is wired up, what the migration state is
- Answers "how do I add KV to this project" or "what's my current schema" from context

### Operations-facing

- Talks to the `gh` CLI and Cloudflare API to answer "why did my last deploy fail", "what migrations have been applied remotely", "how many messages are in the task queue"
- Uses the same auth as `pitlane login`

### Distribution

- Auto-injected `CLAUDE.md` in the platform package (version-tagged, like Void's `<!--injected-by-void-v0.2.6-->`)
- MCP server started via `pitlane mcp` or added to IDE MCP config

## MVP boundaries

### In MVP

- `pitlane/dev` — Vite plugin (extraction of `remix.plugin.ts`)
- `pitlane/dev` — Vite plugin + `platform()` config (canonical source of Cloudflare configuration)
- `pitlane/dev` — `database`, `Database`, `fileStorage`, `FileStorage`, `scheduler`, `Scheduler`, `createJobs`, `createJobQueue`, `createCron`, `createKvSessionStorage`, `D1DatabaseAdapter`, `R2FileStorage`
- `pitlane/cli` — database commands, secrets sync, resource provisioning, deploy
- `pitlane-tools/deploy-action` — GitHub Action for CI/CD deployment
- Auto-injected `CLAUDE.md` in the platform package

### Post-MVP

- `pitlane/mcp` — MCP server (docs, introspection, operations)
- Log streaming (covered by `wrangler tail` for now)
- Dashboard / web UI

## What a new project looks like

### Scaffolding

```
vp create pitlane my-app
cd my-app
vp install
```

### First deploy

```
pitlane login
pitlane resources create
pitlane deploy
```

### Day-to-day development

```
vp dev                         — local dev with Miniflare/workerd
pitlane db generate          — after schema changes
pitlane db migrate           — apply locally
pitlane secrets push         — sync .env to CF
pitlane deploy               — ship it
```

## Updating `create-pitlane`

The existing `create-pitlane` package offers three project kinds: React Router SPA, SSR, and RSC. A new **Remix** option is added alongside these as a fourth top-level template choice — the primary way to get started with Pitlane Platform.

The existing React Router templates are unchanged. They continue to use `@cloudflare/vite-plugin` and hand-written `wrangler.jsonc` directly. The new Remix template is the opinionated Pitlane path.

### New project kind: Remix

```
vp create pitlane

? Project kind:
❯ Remix
  React Router — SPA
  React Router — SSR
  React Router — RSC
```

Selecting "Remix" scaffolds a Remix 3 project on Cloudflare using `pitlane/dev`, `pitlane/dev`, and `pitlane/cli`. The base template includes:

- `vite.config.ts` with `remix()` and `platform()` plugins
- `entry.server.tsx` with the Remix middleware stack
- Tailwind CSS, React Compiler, devtools JSON (same baseline as the React Router templates)
- `pitlane/cli` as a dev dependency
- `.pitlane/` in `.gitignore`
- No `wrangler.jsonc` — the platform plugin generates it

### Optional features

After selecting "Remix", the interactive prompts present optional features in two groups — platform features (Cloudflare bindings and Workers) and project features (framework-level concerns):

```
? Platform features:
  ☐ Database (D1)
  ☐ File Storage (R2)
  ☐ Session Storage (KV)
  ☐ Queues
  ☐ Cron Jobs

? Project features:
  ☐ Authentication
  ☐ Testing
  ☐ Prerendering
  ☐ Content Layer (MDX)
  ☐ Tailwind (CSS)
  ☐ CI/CD (GitHub Actions)

? Authentication:
  ● Remix (remix/auth)
  ○ Clerk

? Testing:
  ● Remix (remix/test)
  ○ Vitest
```

#### Platform features

**Database (D1)** — Prompts for a database name (defaults to the project name), adds `d1: { binding: "DB", database: "<name>" }` to `platform()` config, a sample schema file, a seed file, and a `pitlane db migrate && pitlane db seed` postinstall step.

**File Storage (R2)** — Adds `r2: { binding: "FILES" }` to `platform()` config, adds `fileStorage(env.FILES)` middleware to the stack, typed as `FileStorage` via context key.

**Session Storage (KV)** — Adds `kv: { binding: "SESSIONS" }` to `platform()` config and scaffolds a KV-backed session storage module.

**Queues** — Prompts for a queue name (defaults to `"tasks"`), adds `queues: { binding: "TASKS", queue: "<name>" }` to `platform()` config, scaffolds a `jobs.ts` module with a sample job definition using `createJobs`, and wires up `scheduler(jobs)` middleware, `createJobQueue(jobs)`, and the `queue` handler into `entry.server.tsx`.

**Cron Jobs** — Prompts for a cron expression (defaults to `"0 * * * *"`), adds `cron` to `platform()` config, a `createCron` handler stub in `entry.server.tsx`, and wires the `scheduled` handler into the Worker export.

#### Project features

**Authentication** — Follow-up prompt asks which provider. _Remix (`remix/auth`)_: scaffolds the built-in Remix auth middleware with session handling. _Clerk_: adds `@clerk/remix` with provider wiring and middleware setup.

**Testing** — Follow-up prompt asks which framework. _Remix (`remix/test`)_: scaffolds the built-in Remix test utilities with a sample route test. _Vitest_: adds `vitest` with a standard config and sample test file.

**Prerendering** — Configures static prerendering for selected routes. Adds a `prerender` export to the Remix config and scaffolds a sample statically-rendered route.

**Content Layer (MDX)** — Adds `pitlane/content-layer` and `@mdx-js/rollup` as dependencies, wires `contentLayer()` and `mdx()` into the Vite plugin array, and scaffolds a sample `content/` directory with an example MDX file.

**Tailwind (CSS)** — Adds `@tailwindcss/vite`, wires `tailwindcss()` into the Vite plugins, and creates a `tailwind.css` stylesheet imported from the root route. Enabled by default but can be deselected.

**CI/CD (GitHub Actions)** — Adds `.github/workflows/deploy.yml`. Uses `pitlane-tools/deploy-action`.

### What the scaffolded project looks like

Example with Cloudflare platform, Database, Jobs, Cron, CI/CD, and Tailwind selected:

```
my-app/
├── .github/workflows/deploy.yml    ← CI/CD
├── .vscode/
├── app/
│   ├── entry.server.tsx             ← middleware stack, bindings, queue + cron handlers
│   ├── home.tsx
│   ├── jobs.ts                      ← job definitions + scheduler setup
│   ├── root.tsx
│   ├── routes.ts
│   ├── schema.ts                    ← D1 schema
│   └── styles/tailwind.css
├── seed.ts                          ← database seed
├── package.json
├── tsconfig.json
└── vite.config.ts                   ← remix() + platform({ d1, queues, cron })
```

With no features selected, it's the minimal Remix 3 on Cloudflare starting point — `remix()` + `platform()` plugins and nothing else.

## How this compares to Void

| Concern               | Void                                        | Pitlane                                                       |
| --------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Platform primitives   | Magic global imports (`void/db`)            | Explicit middleware + `ctx.get()`                             |
| Resource provisioning | Auto on deploy                              | Explicit `pitlane resources create`                           |
| CF account            | Hidden, not required                        | Required, user's own account                                  |
| Wrangler config       | None, fully hidden                          | Generated in `.pitlane/`, inspectable                         |
| Framework             | Multi-framework (React, Vue, Svelte, Solid) | Remix 3 only                                                  |
| Component model       | Framework-delegated                         | Remix's own component system                                  |
| Build tool            | Vite 8 beta                                 | Vite+ (Rolldown-based)                                        |
| Scaffolding           | `void init`                                 | `vp create pitlane`                                           |
| Dev server            | `void dev` / `vp dev`                       | `vp dev`                                                      |
| Deploy                | `void deploy`                               | `pitlane-tools/deploy-action` (CI) / `pitlane deploy` (local) |
| MCP                   | Built-in                                    | Post-MVP                                                      |
| Philosophy            | Platform SDK — hides Cloudflare Workers     | DX layer — makes Cloudflare Workers easier to use             |

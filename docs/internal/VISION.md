# Pitlane Vision

![Pitlane logo](https://i.imgur.com/3QRfNfi.png)

## Overview

Pitlane is a **meta-framework** for Remix 3. It provides the framework-adjacent packages, capability adapters, target templates, and deployment guidance needed to take a Remix application from development to production across Cloudflare, Netlify, Vercel, Railway, Deno Deploy, and plain Node, Bun, or Deno runtimes.

The portable boundary is the application, not a synthesized hosting layer. Controllers, job definitions, and capability usage depend on Remix or Pitlane-owned contracts; the server entry exposes a standard fetch handler. Hosting then composes explicitly around that handler through a provider's Vite plugin, native configuration, CLI, or a small runtime launcher.

That boundary covers what an application paints as well as where it runs: `@remix-run/ui` owns the component model and the `RendererHost` interface from its `renderer` subpath, and a Pitlane package binds that interface to a substrate, the way an adapter binds a capability to a provider. `@pitlane/tui` is the first one, for the terminal, and it is experimental until Remix publishes that subpath.

The goal is to make Remix 3 production-ready without becoming a deployment platform, hiding the host, building a multi-tenant control plane, or breaking Remix's explicit composition patterns.

**Key principles:**

- **Remix idioms.** Platform primitives are adapters you construct and controllers you register — request-scoped state flows through controller middleware and context, not magic globals. Configuration is explicit.
- **Adapters, not lock-in.** Each provider-backed capability (database, file storage, sessions, jobs, cache, email, images, flags, local-store persistence and sync) exposes a stable application interface with swappable adapter packages. Application code depends on the interface; the adapter binds it to a provider or runtime.
- **Composable hosting, not a hosting engine.** Provider plugins compose beside `remix()`; native deployment configuration is checked in; and provider CLIs own emulation, provisioning, secrets, and deployment. Pitlane keeps application code portable while leaving the deployment edge explicit.

### Development principles

Pitlane follows Remix 3's development principles so the framework and meta-framework remain aligned:

1. **Model-First Development.** AI fundamentally shifts the human-computer interaction model for both user experience and developer workflows. Optimize source code, documentation, tooling, and abstractions for LLMs. Additionally, develop abstractions for applications to use models in the product itself, not just as a development tool.
2. **Build on Web APIs.** Sharing abstractions across the stack greatly reduces context switching for both humans and machines. Build on the foundation of Web APIs and JavaScript because it is the only full-stack ecosystem.
3. **Runtime When Possible.** Prefer runtime APIs whenever the package's purpose permits it. Starting from bundler, compiler, type-generation, or other pre-runtime static-analysis assumptions can distort APIs and pollute the wider system. Runtime-oriented packages should work and run their core tests without bundling as the first design pass, with static integrations added later as optional optimizations. A package whose stated purpose intrinsically requires build-time integration — such as a Vite plugin, asset generator, or provider type generator — may use it directly rather than maintain an artificial runtime-only version.
4. **Avoid Dependencies.** Treat dependencies as strategic liabilities, not as prohibited tools. Choose them wisely, wrap them completely behind Pitlane-owned APIs, and expect to replace most of them with Pitlane packages over time. The long-term goal is Remix as the only foundational dependency where practical; necessary provider, runtime, and tooling dependencies are acceptable along the way.
5. **Demand Composition.** Abstractions should be single-purpose and replaceable. A composable abstraction is easy to add to and remove from an existing program. Every package must be useful and documented when installed directly, without requiring the `pitlane` umbrella; explicit dependencies on Remix, a Pitlane capability contract, or a provider SDK are allowed and documented. Attempt new features as new packages first. If that is impossible, attempt to break up the existing package to make it more composable. However, tightly coupled modules that almost always change together in both directions should live in the same package.
6. **Distribute Cohesively.** Extremely composable ecosystems are difficult to learn and use. Each concern ships as an independent `@pitlane/*` package, while the `pitlane` umbrella vendors those packages under matching `pitlane/*` subpaths and presents them through one cohesive documentation surface. Users can install only the scoped packages they need or install `pitlane` for the complete, convenient namespace.

## The stack

Pitlane assumes a specific, opinionated stack. Each layer owns a set of concerns; Pitlane itself is the meta-framework layer.

### Tooling

| Concern           | Provided by |
| ----------------- | ----------- |
| Dev runtime       | Node        |
| Toolchain manager | Vite+       |
| Task runner       | Vite+       |
| Package manager   | Vite+       |
| Dev server        | Vite+       |
| App bundler       | Vite+       |
| Library bundler   | Vite+       |
| Test runner       | Vite+       |
| Formatter         | Vite+       |
| Linter            | Vite+       |
| Type checker      | Vite+       |
| CI/CD             | GitHub      |

### Framework

Remix 3 owns every framework-level concern. Pitlane never reimplements these.

| Concern           | Provided by |
| ----------------- | ----------- |
| Server router     | Remix       |
| Components        | Remix       |
| HMR               | Remix       |
| Client navigation | Remix       |
| State             | Remix       |
| Styles            | Remix       |
| Design system     | Remix       |
| Animations        | Remix       |
| Validation        | Remix       |
| Database          | Remix       |
| File uploads      | Remix       |
| Cookies           | Remix       |
| Sessions          | Remix       |
| Authentication    | Remix       |
| Test runner       | Remix       |
| Project CLI       | Remix       |

### Meta-Framework

This is Pitlane. Each capability is either an interface with provider **adapters**, or a Pitlane-native feature (some built on an upstream source such as Gist or OpenAPI Router).

| Capability               | Adapters / source                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Database adapters        | Cloudflare D1 • Netlify Database                                                      |
| File storage adapters    | Cloudflare R2 • Netlify Blobs • Vercel Blob                                           |
| Session storage adapters | Cloudflare KV • Netlify Blobs                                                         |
| Authentication adapters  | Clerk Auth                                                                            |
| Image optimization       | Cloudflare Images • Netlify Image CDN • Vercel Image Optimization                     |
| Feature flags            | Cloudflare • Netlify • Vercel • PostHog                                               |
| Scheduled jobs           | Cloudflare Cron Triggers • Netlify Scheduled Functions • Vercel Cron Jobs             |
| Background jobs          | Cloudflare Queues • Netlify Background Functions • Vercel Queues                      |
| Route caching            | Cloudflare Workers Cache • Netlify Durable Cache • Vercel CDN Cache                   |
| Preview Deployments      | Cloudflare Preview Deployments • Netlify Deploy Previews • Vercel Preview Deployments |
| Realtime                 | Pitlane-native                                                                        |
| Email delivery           | Cloudflare Email Service • Resend                                                     |
| Font providers           | Local • Fontsource • Google Fonts • Adobe Fonts                                       |
| Content layer            | Pitlane-native                                                                        |
| Head metadata            | Pitlane-native                                                                        |
| Localization             | Pitlane-native                                                                        |
| Type-safe env/secrets    | Pitlane-native                                                                        |
| Type-safe styling        | [Pitlane-native](https://gist.github.com/markmals/85f9d3d9e9bec810ba74f334e096cb42)   |
| Sprite sheet generator   | Pitlane-native                                                                        |
| Router RPC               | Pitlane-native                                                                        |
| Prerendering             | Pitlane-native                                                                        |
| Crawling                 | Pitlane-native                                                                        |
| Render targets           | Pitlane-native (terminal, experimental)                                               |

**Name and distribution:**

- npm packages: `pitlane`, `@pitlane/*`
- GitHub org: `pitlane-tools`
- Site and documentation: `https://pitlane.tools`
- Target templates: `https://github.com/pitlane-tools/templates`
- Scaffolding: `npx giget github:pitlane-tools/templates/<template> my-app`
- Agent interface: source, documentation, target templates, and Pitlane-maintained skills

## Package architecture

Pitlane is a monorepo of small, single-purpose packages. Each scoped package can be installed directly without the `pitlane` umbrella and has standalone documentation. Packages may depend on an explicit Remix or Pitlane capability contract, and provider adapters may depend on their provider SDK; those relationships are part of their documented API.

`pitlane` is the optional meta-package that will re-vend scoped packages under matching subpaths, including the `remix()` framework plugin from `@pitlane/dev` as `pitlane/dev`; the name is reserved and the package is empty today ([Reserved names](#reserved-names)). The remaining scoped `@pitlane/*` packages provide capability interfaces, provider adapters, and framework-adjacent features. Neither the umbrella nor a separate Pitlane package owns provider configuration or deployment.

### Packaging strategy

Pitlane mirrors Remix's packaging. Every capability, adapter, and feature ships as an individual scoped package under the `@pitlane/*` namespace, and the optional `pitlane` package may vendor implementations under matching subpaths. Installing scoped packages directly gives a project only the concerns it selects and is the primary form used by package documentation. Installing `pitlane` provides the cohesive `pitlane/<name>` namespace without changing runtime behavior or deployment ownership.

### Reserved names

`pitlane` and `create-pitlane` are published at `0.0.0` to hold their names, and neither ships working code. The umbrella's entry throws and points at `@pitlane/dev`; `create-pitlane` prints the `giget` command from the distribution list above and exits non-zero. Both were published by hand: they have no build, no tests, and no job in `publish.yml`.

The umbrella vends no subpaths yet, `pitlane/theme` included. An umbrella over four packages is a second specifier for something a reader can already install; the namespace earns its place once the set is large enough to be worth learning as a whole. Code samples in this document follow the same line — a package that exists is imported as `@pitlane/<name>`, and a planned one keeps the `pitlane/<name>` specifier it will have once the umbrella ships.

### Runtime and build-time packages

Runtime-first is evaluated per package, not imposed on capabilities whose purpose is build-time integration. Runtime-oriented packages such as `@pitlane/theme`, adapters, and controller middleware must expose a core API that works directly in a JavaScript runtime and whose core tests run without bundling. A later bundler plugin may optimize that API but cannot become a prerequisite for it.

`@pitlane/dev` is the explicit tooling exception: build orchestration and module transforms intrinsically require Vite. It keeps that dependency behind its public plugin API and composes with provider-owned Vite plugins rather than wrapping or replacing them.

### The adapter pattern

Remix owns the capability interface (e.g. `Database` from `remix/data-table`, the `FileStorage` interface from `remix/file-storage`). A Pitlane adapter package supplies the concrete implementation for a provider: the driver, and the factory that binds it to a provider resource. Application code holds the Remix interface and nothing provider-specific past that construction — swapping the adapter import is the only change needed to move providers.

Pitlane-native capabilities follow the same rule when Remix does not own the interface. For example, `@pitlane/job` owns the job contract while its storage and scheduler adapters supply runtime-specific implementations without leaking provider APIs into job definitions.

```ts
import { createD1Database } from "@pitlane/data-table-d1";
import { env } from "cloudflare:workers";

// Swap the adapter import to change providers — every route that reads
// `db` stays identical.
let db = createD1Database(env.DB);
```

### Released baseline

Four packages are on npm: `@pitlane/dev`, the provider-agnostic `remix()` Vite plugin; `@pitlane/theme`, type-safe styling; `@pitlane/data-table-d1`, the Cloudflare D1 driver; and `@pitlane/crawler`, which walks an app by dispatching requests into its router and is what `remix({ prerender })` runs. Every package below is independently sequenced work rather than part of a larger bundled release, and each ships on its own tag.

### Planned package sequence

Implementation follows this order. Within a capability family, the neutral package is implemented first, followed immediately by its adapters in the order shown. Shipped packages stay listed so the ordering keeps its shape.

1. `@pitlane/theme` — shipped. Its authoring format settled at 0.3.0; see below.
2. `@pitlane/content`
3. `@pitlane/meta`
4. `@pitlane/sprites`
5. `@pitlane/image`
    1. `@pitlane/image-cloudflare`
    2. `@pitlane/image-netlify`
    3. `@pitlane/image-vercel`
6. `@pitlane/fonts`
    1. `@pitlane/fonts-fontsource`
    2. `@pitlane/fonts-google`
    3. `@pitlane/fonts-adobe`
7. `@pitlane/cache`
    1. `@pitlane/cache-cloudflare`
    2. `@pitlane/cache-netlify`
    3. `@pitlane/cache-vercel`
8. `@pitlane/crawler` — shipped at 0.2.0. Prerendering itself ships as `remix({ prerender })` in `@pitlane/dev`, which runs the crawler, so there is no separate `@pitlane/prerender` package.
9. Remix capability adapters
    1. `@pitlane/data-table-d1` — shipped at 0.2.0.
    2. `@pitlane/data-table-netlify-database`
    3. `@pitlane/file-storage-cloudflare-r2`
    4. `@pitlane/file-storage-netlify-blobs`
    5. `@pitlane/file-storage-vercel-blob`
    6. `@pitlane/session-storage-cloudflare-kv`
    7. `@pitlane/session-storage-netlify-blobs`
    8. `@pitlane/auth-clerk`
10. `@pitlane/typed-routes`
11. `@pitlane/env`
12. `@pitlane/job`
    1. `@pitlane/job-storage-data-table`
    2. `@pitlane/job-storage-cloudflare-kv`
    3. `@pitlane/job-storage-redis`
    4. `@pitlane/job-scheduler-cloudflare`
    5. `@pitlane/job-scheduler-netlify`
    6. `@pitlane/job-scheduler-vercel`
13. `@pitlane/flags`
    1. `@pitlane/flags-cloudflare`
    2. `@pitlane/flags-netlify`
    3. `@pitlane/flags-vercel`
    4. `@pitlane/flags-posthog`
14. `@pitlane/email`
    1. `@pitlane/email-cloudflare`
    2. `@pitlane/email-resend`
15. `@pitlane/i18n`

## `@pitlane/dev` — framework Vite plugin

The `remix()` plugin generalizes the `remix.plugin.ts` that currently lives as hand-rolled application code in every Remix 3 project. It is provider-agnostic. Handles five concerns:

**1. Build orchestration** — Configures SSR and client Vite environments, sets output directories (`dist/ssr`, `dist/client`), and sequences the build (SSR first, then client). Wraps `@hiogawa/vite-plugin-fullstack` internally.

`@pitlane/dev` exposes the shared transforms and build hooks that future additional runtime environments can compose. Those environments retain ownership of their runtime policy and registration.

**2. Client entry transforms** — Finds `clientEntry(import.meta.url, ...)` calls and rewrites the first argument. On the server, resolves to the client asset URL with a `#ExportName` fragment. On the client, appends the fragment to `import.meta.url`. Uses `oxc-parser` for AST analysis.

**3. Preview server** — Adds a `configurePreviewServer` hook that loads the built SSR entry and wires it up via `remix/node-fetch-server` so `vp preview` works out of the box.

**4. Abort error suppression** — Swallows `"aborted"` errors from client disconnects (search-as-you-type) so they don't trigger Vite's error overlay.

**5. Build-time prerendering** — `remix({ prerender })` renders paths to static HTML during `vite build` and writes them into the client output, so a host answers those URLs and the server never sees them. There is no second rendering path: the build sends a `Request` through the built server entry, the same handler production runs. `@pitlane/crawler` does the walking.

**API:**

```ts
import { remix } from "@pitlane/dev";

export default defineConfig({
    plugins: [
        remix({
            // All optional, sensible defaults
            prerender: undefined, // true, a path array, a function, or a config object
            clientEntry: "app/entry.browser", // false to disable
            serverEntry: "app/entry.server",
            serverEnvironments: ["ssr"],
            serverHandler: true, // false when a provider plugin serves dev requests
        }),
    ],
});
```

## Deployment boundary

Pitlane deliberately has no platform package, target schema, generated `.pitlane/` configuration, deployment CLI, or universal deploy action. Those abstractions would have to flatten provider concepts, lag provider releases, and reimplement authentication, local emulation, resource lifecycle, and deployment behavior that each platform already owns.

The stable contract is the server entry's default-exported `.fetch(Request)` handler. `@pitlane/dev` builds that handler and the client assets; hosting integrations consume the output in their native way:

| Target                      | Composition                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Cloudflare Workers          | `@cloudflare/vite-plugin`, checked-in `wrangler.jsonc`, workerd/Miniflare, and Wrangler      |
| Netlify                     | `@netlify/vite-plugin`, checked-in `netlify.toml`, and a thin Function or Edge Function      |
| Vercel                      | `nitro/vite`, Vercel's Build Output API, and prebuilt deployments through the Vercel CLI     |
| Railway / container hosts   | `dist/ssr/index.js`, a small Node/Bun/Deno launcher, and a checked-in Dockerfile             |
| Deno Deploy                 | the built fetch handler behind a small Deno entrypoint and the `deno deploy` CLI             |
| Static hosts / GitHub Pages | a client-only Vite build; `@pitlane/dev` is unnecessary when there is no server or hydration |

Provider configuration remains checked in at the paths the provider documents. It is the source of truth for bindings, compatibility flags, asset rules, schedules, redirects, and runtime settings. Provider tools generate their own binding types and manage login, secrets, resource creation, logs, preview, and deployment.

Pitlane owns the seams where shared application code needs stability:

- `@pitlane/dev` produces the Remix server and client environments and composes with another plugin when that plugin owns the target runtime.
- Capability adapters translate provider resources into Remix or Pitlane-owned interfaces.
- Target templates contain the small amount of explicit hosting glue and are exercised as complete applications.
- Deployment guides document native CLI and GitHub Actions workflows, including which tool builds the artifact and which tool uploads it.

Portability therefore does not mean that `wrangler.jsonc`, `netlify.toml`, a Nitro plugin, and a Dockerfile become interchangeable data structures. It means those target-specific edges stay thin and visible while controllers, schemas, commands, and components remain unchanged. A platform swap normally changes the provider plugin or launcher, native config, and adapter construction—not the application.

## Runtime — adapters and controllers

Platform primitives are constructed from a raw binding (from `env`) plus a Pitlane adapter, then used inside controllers registered with the Remix router. Adapters that need to be request-scoped (sessions, flags, local-store transactions) are added as controller middleware and read from the action context; stateless singletons (database, file storage, schedulers) are constructed once at module scope.

Swapping providers means swapping the adapter import — controllers are unchanged.

### Database

`Database` comes from `remix/data-table`; the adapter binds it to a provider. Construct it once and use it inside a controller action.

```ts
import { createD1Database } from "@pitlane/data-table-d1";
import { env } from "cloudflare:workers";
import { createController } from "remix/router";

let db = createD1Database(env.DB);

export default createController(routes.contacts, {
    actions: {
        async index({ render }) {
            let contacts = await db.findMany(Contacts);
            return await render(<ContactsList contacts={contacts} />);
        },
    },
});
```

Available database adapters and their exports:

| Adapter package                        | Export                   |
| -------------------------------------- | ------------------------ |
| `@pitlane/data-table-d1`               | `createD1Database`       |
| `@pitlane/data-table-netlify-database` | `NetlifyDatabaseAdapter` |

### File storage

The `FileStorage` interface comes from `remix/file-storage`; the adapter implements it against a provider bucket. Adapters: `@pitlane/file-storage-cloudflare-r2` (`R2FileStorage`), `@pitlane/file-storage-netlify-blobs` (`NetlifyBlobsFileStorage`), `@pitlane/file-storage-vercel-blob` (`VercelBlobFileStorage`).

```ts
import { env } from "cloudflare:workers";
import { R2FileStorage } from "pitlane/file-storage-cloudflare-r2";
import { createController } from "remix/router";

let files = new R2FileStorage(env.FILES);

export default createController(routes.avatar, {
    actions: {
        async upload({ request }) {
            await files.set("avatar", await request.blob());
        },
    },
});
```

### Session storage

Session handling is a Remix concern (`remix/session`, `remix/session-middleware`); Pitlane supplies the storage backend. Adapters: `@pitlane/session-storage-cloudflare-kv` (`createKVSessionStorage`) and `@pitlane/session-storage-netlify-blobs` (`createBlobsSessionStorage`).

Add the `session()` middleware to a controller and read the session from the action context.

```ts
import { env } from "cloudflare:workers";
import { createKVSessionStorage } from "pitlane/session-storage-cloudflare-kv";
import { createController } from "remix/router";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";

let storage = createKVSessionStorage(env.SESSIONS, {
    keyPrefix: "session:",
    ttl: 60 * 60 * 24,
});

export default createController(routes, {
    middleware: [session(cookie, storage)],
    actions: {
        async index({ session }) {
            return Response.json({ count: session.get("count") ?? 0 });
        },
    },
});
```

### Authentication

Remix provides the auth primitives (`remix/auth`). `@pitlane/auth-clerk` wires Clerk into the Remix auth middleware and exposes the authenticated user through the action context.

## Background jobs — `@pitlane/job`

Background jobs use a typed, schema-validated API. Jobs are defined once with `createJobs` and shared between the producer (a `Scheduler`) and the consumer (`createJobQueue`). The scheduler's `queue` backend and, optionally, job-state storage are chosen via adapters, so the same job definitions run on Cloudflare Queues, Netlify Background Functions, or Vercel Queues.

- Queue adapters: `@pitlane/job-scheduler-cloudflare` (`CloudflareQueueAdapter`), `@pitlane/job-scheduler-netlify`, `@pitlane/job-scheduler-vercel`. A raw provider binding is passed only to its adapter; `Scheduler` receives the provider-neutral queue adapter.
- Storage adapters (job state / results): `@pitlane/job-storage-data-table`, `@pitlane/job-storage-cloudflare-kv`, `@pitlane/job-storage-redis`.

### Defining and scheduling jobs

Each job declares a `schema` for payload validation and a `handle` function. Job definitions know nothing about the provider; a `Scheduler` receives the selected queue adapter.

```ts
import { env } from "cloudflare:workers";
import { createJobs, Scheduler, createJobQueue } from "pitlane/job";
import { CloudflareQueueAdapter } from "pitlane/job-scheduler-cloudflare";
import * as s from "remix/data-schema";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

let jobs = createJobs({
    sendEmail: {
        schema: s.object({ to: s.string(), subject: s.string() }),
        async handle(payload) {
            await sendEmail(payload.to, payload.subject);
        },
    },
});

let scheduler = new Scheduler(jobs, {
    queue: new CloudflareQueueAdapter(env.TASKS),
});

let emailController = createController(routes.email, {
    actions: {
        async create({ formData }) {
            let email = s.parse(EmailSchema, formData);

            await scheduler.enqueue(jobs.sendEmail, {
                to: email.address,
                subject: "Welcome to Pitlane",
            });

            return redirect(routes.home.href());
        },
    },
});

router.map(routes.email, emailController);

let queue = createJobQueue(scheduler);

export default {
    fetch: router.fetch,
    queue: queue.handler,
};
```

### Retrying jobs

Pass `retry` to `enqueue` to control retry behavior after failures.

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

### Observability hooks

`Scheduler` and `createJobQueue` accept hooks so you can emit logs/metrics without changing job logic.

```ts
let scheduler = new Scheduler(jobs, {
    queue: new CloudflareQueueAdapter(env.TASKS),
    onEnqueue(event) {
        metrics.count("job.enqueue", 1, { job: event.jobName });
    },
});

let queue = createJobQueue(scheduler, {
    onJobComplete(event) {
        metrics.timing("job.duration", event.durationMs, { job: event.job.name });
    },
    onJobFailed(event) {
        logger.error("failed job", event.job.id, event.error);
    },
});
```

The consumer returned by `createJobQueue` dispatches incoming messages to the correct job handler based on message metadata and exposes a `.handler` property for the runtime export.

## Scheduled jobs (cron)

Scheduled jobs reuse the same job definitions and `Scheduler`. `createScheduledJobs` maps cron expressions to jobs and exposes a `.handler` for the runtime export. Backed by the target's native scheduler (Cloudflare Cron Triggers, Netlify Scheduled Functions, Vercel Cron Jobs).

```ts
import { env } from "cloudflare:workers";
import { createJobs, Scheduler, createScheduledJobs } from "pitlane/job";
import { CloudflareQueueAdapter } from "pitlane/job-scheduler-cloudflare";

let jobs = createJobs({
    dailyDigest: {
        async handle() {
            await sendDailyDigest();
        },
    },
});

let scheduler = new Scheduler(jobs, {
    queue: new CloudflareQueueAdapter(env.TASKS),
});

let scheduled = createScheduledJobs(scheduler, {
    "0 0 * * *": jobs.dailyDigest,
});

export default {
    fetch: router.fetch,
    scheduled: scheduled.handler,
};
```

## Other feature packages

Each of these is a provider-neutral package; the ones with backends install a per-provider sub-package.

### Feature flags — `@pitlane/flags`

Declare features with `createFeatures`, add the `flags()` middleware bound to a provider-neutral flag store, and read flags from the action context. Flag inputs are described with the schema helpers in `pitlane/flags/schema`. Provider packages create the store: `@pitlane/flags-cloudflare` exports `createCloudflareFlagStore`, with corresponding adapters from `@pitlane/flags-netlify`, `@pitlane/flags-vercel`, and `@pitlane/flags-posthog`.

```ts
import { env } from "cloudflare:workers";
import { createFeatures, flags } from "pitlane/flags";
import { createCloudflareFlagStore } from "pitlane/flags-cloudflare";
import * as flag from "pitlane/flags/schema";
import * as s from "remix/data-schema";
import { createController } from "remix/router";

let features = createFeatures({
    newCheckout: {
        name: "new-checkout",
        input: {
            userId: flag.header("x-user-id", s.defaulted(s.string(), "anonymous")),
            plan: flag.header("x-plan", s.defaulted(s.string(), "free")),
        },
        output: s.defaulted(s.boolean(), false),
    },
});

let flagStore = createCloudflareFlagStore(env.FLAGS);

export default createController(routes.shop, {
    middleware: [flags(flagStore)],
    actions: {
        async checkout({ flags, render }) {
            let useNewCheckout = await flags.get(features.newCheckout);
            return await render(useNewCheckout ? <NewCheckout /> : <Checkout />);
        },
    },
});
```

### Content layer — `@pitlane/content`

Define collections with `createContent` and loaders from `pitlane/content/loaders`; collections are typed by schema and support references between collections.

```ts
import { createContent } from "pitlane/content";
import * as loaders from "pitlane/content/loaders";
import * as s from "remix/data-schema";

export let content = await createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({ pattern: "app/content/**/*.{md,mdx}", base: "blog" }),
        schema: s.object({
            title: s.string(),
            summary: s.string(),
            publishedOn: s.date(),
            author: c.reference("authors"),
        }),
    }),
    authors: c.collection({
        loader: loaders.file("app/content/authors.jsonc"),
        schema: s.object({ name: s.string(), avatar: s.string() }),
    }),
}));
```

Read collections and entries inside a controller; `entry.render()` returns the rendered `Content` component and its `headings`.

```ts
let posts = await content.blog.getCollection();
let post = await content.blog.getEntry(params.slug);
let { Content, headings } = await post.render();
let author = await content.authors.getEntry(post.data.author);
```

### Head metadata — `@pitlane/meta`

The `Head` component collects and dedupes document head tags from anywhere in the tree.

```tsx
import { Head } from "pitlane/meta";

function Component() {
    return () => (
        <>
            <Head>
                <title>{`${title} | ${SITE.title}`}</title>
                <link data-precedence="route" href={styles} rel="stylesheet" />
            </Head>
            {/* ... */}
        </>
    );
}
```

### Images — `@pitlane/image`

The `Image` and `Picture` components emit optimized, correctly-sized markup and defer transformation to the configured image adapter. Adapters: `@pitlane/image-cloudflare` (Cloudflare Images), `@pitlane/image-netlify` (Netlify Image CDN), `@pitlane/image-vercel` (Vercel Image Optimization).

```tsx
import robinImage from "#/assets/images/robin.png?url";
import parrotImage from "#/assets/images/parrot.png?url";
import { Image, Picture } from "pitlane/image";

<Image src={robinImage} width={400} height={300} alt="A robin on a nest." />;
<Picture
    src={parrotImage}
    width={400}
    height={300}
    formats={["avif", "webp"]}
    alt="A parrot on a nest."
/>;
```

### Router crawling — `@pitlane/crawler`

`crawl(router)` dispatches requests straight into a router's `fetch` and yields every response it gets back, following the links each page contains. No socket, no server, no browser: the router is the whole transport, so an app can be walked wherever the app itself runs.

```ts
import { crawl } from "@pitlane/crawler";

import router from "./app/entry.server.ts";

for await (let { pathname, filepath, response } of crawl(router)) {
    // HTML gets `<pathname>/index.html`, so a static host serves it back
    // for the path it was requested at.
    console.log(`${pathname} -> ${filepath} (${response.status})`);
}
```

`staticPaths(routes)` answers the question that comes before a crawl — which paths a route map can serve with no params — by reading the ordinary object an app builds its router from.

Prerendering is the first thing that walk is for, and `remix({ prerender })` runs it during `vite build`, so an application using the plugin never installs this package. It stands on its own for the rest: static exports, sitemaps, link checks, and render smoke tests. The `crawl` API comes from [remix-run/remix#11150](https://github.com/remix-run/remix/pull/11150), which proposed it for `fetch-router` and was closed with the implementation kept beside the Remix docs site.

### Local-first application data exploration

This section records unsequenced local-first research; it does not add packages to the current implementation plan. The candidate `@pitlane/local-store` is an IndexedDB-first data engine for applications that read and write locally, synchronize in the background, and progressively enhance server-rendered HTML. It is a scoped projection of the useful behavior in [TanStack DB](https://tanstack.com/db/latest) and Convex's [local-store experiment](https://github.com/get-convex/curvilinear/tree/main/local-store), built around Remix controllers and runtime primitives rather than wrapped around either dependency.

Application code uses Pitlane-owned **collections**, **queries**, and **commands**. The same controller runs against replica storage in the browser or service worker and server storage on Cloudflare, Node, or another target. Swapping either storage adapter does not change controllers or expose provider types.

```ts
import { collection, command } from "pitlane/local-store";
import * as s from "remix/data-schema";

export let Tasks = collection({
    name: "tasks",
    schema: s.object({
        id: s.string(),
        projectId: s.string(),
        title: s.string(),
        completed: s.boolean(),
        position: s.number(),
    }),
    indexes: {
        byProject: ["projectId", "position"],
    },
});

export let CreateTask = command({
    name: "tasks.create",
    version: 1,
    input: s.object({
        id: s.string(),
        projectId: s.string(),
        title: s.string(),
        position: s.number(),
    }),
    apply({ tasks }, task) {
        tasks.insert({ ...task, completed: false });
    },
});
```

Command reducers are deterministic, versioned, and free of network or platform I/O so they can be replayed after restart or reconciliation. Server handlers are registered separately and remain outside the service-worker bundle.

The `localStore()` middleware adds the local store and command dispatcher to the controller context:

```tsx
export default createController(routes.tasks, {
    actions: {
        async index({ localStore, params, render }) {
            let tasks = await localStore.query(
                Tasks.byProject.where({ projectId: params.projectId }).orderBy("position"),
            );

            return render(
                <TaskList pending={tasks.status === "loading"} tasks={tasks.data ?? []} />,
            );
        },
        async action({ commands, formData }) {
            await commands.invoke(CreateTask, {
                id: crypto.randomUUID(),
                projectId: String(formData.get("projectId")),
                title: String(formData.get("title")),
                position: Number(formData.get("position")),
            });

            return redirect(routes.tasks.index.href());
        },
    },
});
```

#### Adapter families

The local-store capability has two complementary storage contracts and one optional transport contract. They are different seams, not interchangeable implementations of one interface:

| Contract                | Runs in                     | Responsibility                                                                                                                                           |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ReplicaStorageAdapter` | Browser or device runtime   | Visible records and indexes, synchronized base, pending commands, failures, coverage, checkpoints, and local metadata                                    |
| `ServerStorageAdapter`  | Trusted server runtime      | Authoritative records, command idempotency and outcomes, ordered change log, tombstones, checkpoints, compaction, and scoped query execution             |
| `SyncTransportAdapter`  | Replica and server boundary | Moves commands and changes and optionally wakes connected replicas; it does not define persistence, query, command, authorization, or conflict semantics |

The controller-facing API composes the appropriate contracts for each runtime:

```ts
// Browser and service worker
let replicaStore = createReplicaStore({
    storage: new IndexedDBReplicaStorage({ name: "my-app" }),
    transport: createFetchSyncTransport({ endpoint: "/_pitlane/local-store" }),
});

// Server
let serverStore = createServerStore({
    storage: new DataTableServerStorage(db),
    commands,
    authorize,
});
```

Both objects satisfy the `LocalStore` context contract used by application controllers. Their low-level storage adapters do not satisfy each other's contracts.

##### Replica storage

`@pitlane/local-store-replica-indexeddb` is the canonical browser replica adapter. It uses native IndexedDB directly: no SQLite or WASM payload, no mandatory worker bridge, and no third-party database wrapper. A memory replica adapter under `pitlane/local-store/testing` runs the same behavioral contract in deterministic tests.

The IndexedDB implementation maintains a small fixed set of physical stores for metadata, records, materialized indexes, commands, failures, and synchronized range coverage. Application indexes are encoded into the materialized index store rather than requiring an IndexedDB structural migration for every schema change. Every visible mutation commits its records, indexes, command envelope, and change metadata in one transaction before notifying the UI or network.

The service worker is disposable and never owns critical in-memory state. IndexedDB remains the durable source of truth across windows, workers, restarts, and browser process termination.

The runtime requests persistent storage after the application first writes meaningful user data and reports whether the browser granted it. A denial does not break the store, but status remains `best-effort` rather than implying durability the browser did not promise. Quota, transaction, migration, and eviction-recovery failures are observable events rather than silent fallbacks.

##### Server storage

`@pitlane/local-store-server-data-table` is the canonical server adapter. It composes with a provider-neutral `Database` from `remix/data-table`; changing D1, Durable Object SQL, Neon, or another database adapter does not change the local-store server contract.

The adapter executes an accepted command and writes its authoritative records, idempotency result, ordered change entries, and tombstones in the same database transaction. Pull requests read scoped changes after a checkpoint and may use the same Pitlane query plan for initial data. Synchronized collections must be mutated through the command pipeline or an explicit ingestion adapter so every server change has a durable log entry.

##### Sync transport

The core package includes fetch-compatible push and pull controllers as the portable baseline. `@pitlane/local-store-sync-cloudflare-durable-objects` is an optional low-latency transport that uses Durable Objects to notify connected replicas that new durable changes are available. The server storage remains authoritative; notifications may be dropped and recovered by pulling from the last checkpoint.

A future server-sequenced implementation belongs to the server-storage family—for example, a Durable Object SQL server adapter whose operation log is canonical—not to the transport adapter. Cloudflare types never enter collection, query, command, controller, or storage contracts.

#### Queries and coverage

The initial query vocabulary is intentionally bounded: record lookup, indexed equality and ranges, ordering, limits, projection, and narrowly specified includes. Each query produces a serializable plan and records the indexed ranges it reads. Those dependencies drive local invalidation and partial replication without requiring a general SQL engine or differential-dataflow runtime.

Query results distinguish missing data from an empty result:

```ts
type QueryResult<T> =
    | { status: "loading"; data?: T }
    | { status: "ready"; data: T; checkpoint: string }
    | { status: "error"; error: unknown; data?: T };
```

An affected indexed query may initially rerun in full. Incremental query operators are added only where profiling demonstrates that they improve real applications.

#### Commands and synchronization

The first synchronization profile is server-authoritative:

1. Persist a named command locally.
2. Apply its deterministic local reducer.
3. Enqueue it for upload only after the IndexedDB transaction completes.
4. Authenticate and execute its authoritative handler on the server.
5. Receive canonical record changes plus the IDs of reflected commands.
6. Install the new synchronized base and replay every command that remains pending.

The visible store is always the synchronized base plus the ordered replay of pending commands. A permanent server rejection moves the complete command envelope and user input into a recoverable failure queue; user work never silently disappears.

Command envelopes include a stable command ID, replica ID, command name and version, input, local sequence, creation time, and optional base checkpoint. This protocol leaves a deliberate path toward server-sequenced replicas: a future server may authenticate and globally order operations while every replica applies the same reducer. CRDTs are deferred until a domain requires automatic merging without central ordering or application conflict rules.

#### Evolution and ownership

Application schema and command versions evolve independently from the fixed physical IndexedDB schema. Migrations coordinate across tabs and the staged service-worker lifecycle; an unknown command version is preserved and blocked rather than dropped or reinterpreted. Clearing and resynchronizing is allowed only for explicitly recoverable server-derived data, never as a migration strategy for local user work.

The engine provides a native backup for disaster recovery, while applications define portable domain export and import. Export does not require a network connection and includes enough schema and attachment metadata to reopen the user's data if the sync service is unavailable.

#### Runtime events and HTML

The store is a typed `EventTarget`. A window-global runtime subscribes with `addEventListener(type, listener, { signal })` under one lifetime signal to observe commits, synchronization status, storage failures, and query invalidations. It can re-resolve affected Remix Frames without hydrating the components that rendered them.

Native links and forms remain the primary interaction model. A server or service worker executes the same fetch-compatible controller and returns HTML or a redirect; client entries are reserved for interactions that genuinely need persistent client-side state.

The package ships one deterministic trace suite for every adapter. It exercises restart-safe local writes, range coverage, command replay, rejection, multi-tab commits, old-schema reconnects, and reordered or duplicated network transitions against the memory reference model and IndexedDB implementation.

#### Authentication

Server authentication uses `remix/auth`, `remix/middleware/auth`, and `requireAuth()`. Login, logout completion, OAuth callbacks, token refresh, and other credential operations are server-only routes. Every synchronization scope and uploaded command is authorized again on the server.

The service-worker runtime may install a local auth scheme that projects the last verified principal from IndexedDB into Remix's `Auth` context. This permits shared controllers to render already-replicated data offline, but it is not a server authorization boundary. Local databases are partitioned by application and stable principal ID so a new login never opens another user's data.

### Type-safe styling — `@pitlane/theme`

`createTheme({ schema, tokens, modes })` returns `{ token, raw, Theme }` plus the `extend` and `select` derivations. Token values are the CSS they become: a leaf is a string, a number, or an array, and a plain object is a group. The schema tree, built from the `s.*` factories in `@pitlane/theme/schema`, names each token's type. `token` is a typed mirror of the token tree whose leaves are CSS `var()` references; `raw(ref)` resolves a token's base value; and `<Theme />` renders the compiled variables in a `<style data-pitlane-theme>` element. The module separately exports `css`, `tva`, `combine`, `cx`, `scale`, and `lightDark`.

Each token reference carries its type as a compile-time brand, read from the schema. The themed `css()` wrapper maps CSS longhands to the brands they accept, so `color` rejects a dimension token and palette-controlled properties reject arbitrary literals. Brands erase to strings at runtime. Unmapped CSS properties remain loosely typed, and `remix/ui`'s unthemed `css()` remains the explicit escape hatch.

The schema factories are `remix/data-schema` schemas carrying a type tag, so the token tree composes into one `object()` and a single `parse` reports every invalid value with its own path. `s.group(self, children)` types a node and lets its children override it. `s.scale()` declares a base whose accessor leaf multiplies, which is how `t.spacing(4)` works. `s.any()` covers CSS values with no token type. `extend` deep-merges a patch; `select` replaces a theme with a projection of it, which may also reshape and rename. `<Theme />` carries the init it was compiled from as `$theme`, so `createTheme(SomeTheme)` re-derives a published theme.

Three subpaths sit beside the root. `@pitlane/theme/schema` holds the factories. `@pitlane/theme/default` ships Tailwind v4's primitives with no semantic layer, which `select` narrows to what an application uses. `@pitlane/theme/dtcg` reads and writes W3C DTCG documents: DTCG is an interchange format at the edges rather than the authoring surface.

`tva` is a variant resolver modeled on `cva`, but it composes branded style objects and returns a `mix`-ready descriptor. `combine` merges multiple `tva` components, while `cx` joins ordinary class names for stylesheet interop. All are module-level exports rather than values returned by `createTheme`.

```tsx
import { createTheme, css, tva } from "@pitlane/theme";
import * as s from "@pitlane/theme/schema";

export let {
    token: t,
    raw,
    Theme,
} = createTheme({
    schema: { color: s.color(), spacing: s.scale(), space: s.dimension() },
    tokens: {
        color: { white: "#fff", gray: { 900: "#171717" } },
        spacing: "0.25rem",
        space: { sm: "8px", md: "16px" },
    },
}).extend(base => ({
    schema: { color: s.color() },
    tokens: { color: { text: base.color.gray[900] } },
    modes: {
        dark: {
            selector: ':root[data-color-scheme="dark"]',
            tokens: { color: { text: base.color.white } },
        },
    },
}));

t.color.white; // "var(--color-white)"
raw(t.color.text); // "#171717"
t.spacing(4); // "calc(var(--spacing) * 4)"

let panel = tva({
    base: { color: t.color.text, padding: t.space.md },
    variants: { compact: { true: { padding: t.space.sm } } },
});

function Component() {
    return () => (
        <>
            <Theme />
            <section mix={panel({ compact: true })}>
                <span mix={css({ color: t.color.text })}>Content</span>
            </section>
        </>
    );
}
```

A token's type comes from its own schema entry, then from the nearest ancestor that declares one. A reference is a property access on the layer below, so it needs an `extend`; there is no string syntax for one, and a leftover `"{a.b.c}"` raises `ThemeError` rather than reaching the stylesheet. The accessor leaf is a `var()` string, so a reference keeps its indirection and mode overrides cascade through it. A mode overrides values only, and declares its own condition: `media` defaults to `prefers-color-scheme` and `selector` emits a second block for a user-selectable toggle, which outranks the media block on specificity. `<Theme />` accepts a CSP `nonce`, and emits `color-scheme: light dark` when a token uses `light-dark()`, without which the function would resolve light everywhere. Invalid values raise `ValidationError` from `remix/data-schema`, one issue per token with its path; unknown or wrongly-typed references, references to untyped tokens, cycles, name collisions, and invalid mode overrides raise `ThemeError`. Typography composites remain unsupported.

`@pitlane/theme` is runtime-first and has no runtime dependencies beyond its Remix peer. A future build integration may optimize CSS output or extraction, but using it remains optional.

### Service-worker execution exploration

The candidate `@pitlane/service-worker` belongs to the same unsequenced local-first research. It would compile fetch-compatible Remix routes into a separately emitted service-worker environment and own worker registration, route execution policy, asset caching, window/worker messaging, and safe update activation. It describes a concrete runtime mechanism; "offline" remains a behavioral guarantee that also depends on local data coverage and storage durability.

```ts
import { remix } from "pitlane/dev";
import { serviceWorker } from "pitlane/service-worker";
import { defineConfig } from "vite-plus";

export default defineConfig({
    plugins: [
        remix({
            clientEntry: "app/entry.browser",
            serverEntry: "app/entry.server",
        }),
        serviceWorker({
            entry: "app/entry.worker",
            register: "after-load",
        }),
    ],
});
```

Application controllers are registered once and compiled into both router entries. Runtime-specific middleware supplies the same context contracts:

```ts
// app/router.ts
export function createAppRouter(middleware) {
    let router = createRouter({ middleware });
    router.map(routes.tasks, tasksController);
    return router;
}

// app/entry.server.ts
export default createAppRouter([
    session(sessionCookie, sessionStorage),
    auth({ schemes: [sessionAuth] }),
    localStore(serverStore),
    render(),
]);

// app/entry.worker.ts
export default createAppRouter([localAuth(indexedDBStore), localStore(indexedDBStore), render()]);
```

The route manifest assigns each controller one execution policy:

- **Server** — authentication flows, payments, uploads, irreversible side effects, and routes that require secrets. The worker passes these requests through.
- **Local** — device-only data and utility routes.
- **Server and local** — application routes whose controller can render against either server-storage or replica-storage adapters.

Server-only modules are excluded from the worker graph at build time rather than guarded by runtime checks.

#### Native navigation and forms

Once the worker controls the page, ordinary HTML requires no component hydration:

```html
<a href="/projects/123/tasks">Tasks</a>

<form action="/projects/123/tasks" method="post">
    <input name="title" />
    <button>Add task</button>
</form>
```

The browser sends the navigation or submission to the service worker, the Remix router executes the shared controller against IndexedDB, and the resulting document or redirect follows normal browser semantics. Without a controlling worker, the same request reaches the server and executes the same controller against server adapters.

The small window runtime may intercept navigations for Remix Frame morphing and pending UI, but the route remains correct as a native document navigation. It also listens for local-store invalidations and re-resolves only affected Frames. Client entries remain available for editors, drag and drop, gestures, and other interactions that require component-local state.

The client-routing work in [remix-run/remix#11629](https://github.com/remix-run/remix/pull/11629) is the optional in-memory SPA path; Pitlane does not build a competing routing package. Both execution styles can use `@pitlane/local-store`, but the service-worker path is the default when an application wants server rendering, native navigation, and later offline takeover.

#### Background installation

The worker bundle is separate from the initial page bundle and registers after the initial `load`, optionally during an idle period. Registration downloads and installs its statically imported route graph in the background, so worker route code neither increases the initial page JavaScript payload nor executes on the main thread.

Dynamic `import()` is [not available inside service workers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import#description), so the active worker cannot lazily import a route implementation on first use. Deferred registration—not runtime code splitting inside the worker—is the loading strategy.

The initial server-rendered page remains usable while the worker installs; registration does not force a reload. New versions stage until the page and worker coordinate activation. The package never applies unconditional `skipWaiting()` across an application or local-store schema change.

#### Process lifetime and synchronization

A service worker may be terminated whenever it has no active event, so it cannot own the only query cache, command queue, or synchronization connection. It reads durable state from IndexedDB for each request and may perform opportunistic synchronization while handling requests or Background Sync events.

The window-global local-store runtime owns the foreground connection. One window becomes transport leader through Web Locks and broadcasts committed changes through `BroadcastChannel`; another window takes over when the leader closes. Ordinary IndexedDB writes do not pass through that leader because IndexedDB already serializes overlapping read/write transactions.

### The rest

- **`@pitlane/cache`** — route caching. Adapters: `@pitlane/cache-cloudflare` (Workers Cache), `@pitlane/cache-netlify` (Durable Cache), `@pitlane/cache-vercel` (CDN Cache).
- **`@pitlane/email`** — email delivery. Adapters: `@pitlane/email-cloudflare` (Email Service), `@pitlane/email-resend`.
- **`@pitlane/fonts`** — font providers. Adapters: `@pitlane/fonts-fontsource`, `@pitlane/fonts-google`, `@pitlane/fonts-adobe`; a local provider ships in the core package.
- **`@pitlane/i18n`** — localization.
- **`@pitlane/env`** — type-safe env / secrets.
- **`@pitlane/sprites`** — sprite sheet generator.
- **`@pitlane/typed-routes`** — type-safe / RPC routes (built on OpenAPI Router).

## Full entry.server.tsx example (Cloudflare target)

```ts
// entry.server.tsx
import { env } from "cloudflare:workers";

import { createRouter } from "remix/router";
import { asyncContext } from "remix/async-context-middleware";
import { createCookie } from "remix/cookie";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";
import { staticFiles } from "remix/static-middleware";

import { createD1Database } from "@pitlane/data-table-d1";
import { R2FileStorage } from "pitlane/file-storage-cloudflare-r2";
import { createKVSessionStorage } from "pitlane/session-storage-cloudflare-kv";
import { createJobs, Scheduler, createJobQueue, createScheduledJobs } from "pitlane/job";
import { CloudflareQueueAdapter } from "pitlane/job-scheduler-cloudflare";

import { routes } from "~/routes.ts";
import home from "~/home.tsx";
import contacts from "~/contacts.tsx";
import { jobs } from "~/jobs.ts";

let cookie = createCookie("__session", {
    secrets: ["s3cr3t"],
    httpOnly: true,
    secure: true,
    sameSite: "lax",
});

let storage = createKVSessionStorage(env.SESSIONS, {
    keyPrefix: "session:",
    ttl: 60 * 60 * 24,
});

let db = createD1Database(env.DB);
let files = new R2FileStorage(env.FILES);
let scheduler = new Scheduler(jobs, {
    queue: new CloudflareQueueAdapter(env.TASKS),
});

let router = createRouter({
    middleware: [
        staticFiles("./public"),
        staticFiles("./dist/client"),
        formData(),
        methodOverride(),
        asyncContext(),
    ],
});

router.map(routes.home, home);
router.map(routes.contacts, contacts);

let queue = createJobQueue(scheduler);

let scheduled = createScheduledJobs(scheduler, {
    "0 * * * *": jobs.hourlyCleanup,
});

export default {
    fetch: router.fetch,
    queue: queue.handler,
    scheduled: scheduled.handler,
} satisfies ExportedHandler<Env>;
```

Route controllers close over `db`, `files`, `storage`, and `scheduler`, or import them from a shared module; each is defined with `createController` (see the capability sections above).

## Full Cloudflare deployment example

The provider integration composes beside Pitlane rather than through it:

```ts
// vite.config.ts
import { cloudflare } from "@cloudflare/vite-plugin";
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite-plus";

export default defineConfig({
    plugins: [remix({ serverHandler: false }), cloudflare({ viteEnvironment: { name: "ssr" } })],
});
```

Cloudflare's checked-in config owns the runtime and resource declarations:

```jsonc
// wrangler.jsonc
{
    "name": "contacts",
    "main": "app/entry.server.tsx",
    "assets": { "directory": "dist/client" },
    "compatibility_date": "2026-04-08",
    "compatibility_flags": ["nodejs_compat"],
    "d1_databases": [
        {
            "binding": "DB",
            "database_name": "contacts",
            "database_id": "<database-id>",
        },
    ],
    "kv_namespaces": [{ "binding": "SESSIONS", "id": "<namespace-id>" }],
    "r2_buckets": [{ "binding": "FILES", "bucket_name": "contacts-files" }],
    "queues": {
        "producers": [{ "binding": "TASKS", "queue": "task-queue" }],
        "consumers": [{ "queue": "task-queue" }],
    },
    "triggers": { "crons": ["0 * * * *"] },
}
```

That file is edited directly, reviewed with the application, and read by Wrangler in development, preview, CI, and production. Cloudflare generates binding types and manages resources and secrets:

```sh
vpx wrangler types
vpx wrangler d1 migrations apply DB --remote
vpx wrangler secret put SESSION_SECRET
```

Pitlane does not mirror those operations. Netlify, Vercel, Railway, and Deno keep their equivalent native config and commands.

## Deployment workflows

The build happens in the developer's shell or CI, under application control. The provider then receives the tested artifact through its native deployment path:

| Target       | Production path                                                               |
| ------------ | ----------------------------------------------------------------------------- |
| Cloudflare   | `vp build && vpx wrangler deploy`                                             |
| Netlify      | `vp build && vpx netlify-cli deploy --no-build --prod`                        |
| Vercel       | `vpx vercel build --prod && vpx vercel deploy --prebuilt --prod`              |
| Railway      | build and push the Docker image, then `vpx railway redeploy --service <name>` |
| Deno Deploy  | `vp build && deno deploy --app <name> --prod`                                 |
| GitHub Pages | upload `dist/` and deploy it with the official GitHub Pages actions           |

Migration execution is an explicit application step rather than an implicit side effect of every deploy. A workflow that needs migrations runs the adapter or provider's migration command before uploading the new artifact and aborts on failure.

There is no universal Pitlane deploy action. Each target template includes a native GitHub Actions workflow whose credentials, build point, artifact, and deploy command are visible. For Cloudflare:

```yaml
name: Deploy

on:
    push:
        branches: [main]

permissions:
    contents: read
    deployments: write

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: voidzero-dev/setup-vp@v1
              with:
                  cache: true

            - run: vp install --frozen-lockfile
            - run: vp build
            - run: vpx wrangler deploy
              env:
                  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Model-first interface

Pitlane's model-facing surface is its source, documentation, target templates, and maintained skills—not a hidden deployment control plane. Skills teach agents which checked-in files define the target and direct them to the same deterministic provider commands used by humans and CI. Changes remain inspectable as ordinary code and configuration.

## Release status

`@pitlane/dev` was the initial Pitlane release: the provider-agnostic `remix()` Vite plugin. `@pitlane/theme`, `@pitlane/data-table-d1`, and `@pitlane/crawler` followed it on their own tags, and the rest ship independently in the [planned package sequence](#planned-package-sequence); no later package is required to make an earlier one complete.

### Explicit non-goals

- A Pitlane platform Vite plugin or generated provider configuration
- A universal provider login, provisioning, secrets, logs, or deployment CLI
- A universal deploy action or hosted deployment dashboard
- Source uploads that delegate the authoritative production build to a provider

## What a new project looks like

### Scaffolding

Choose a tested target template:

```sh
npx giget github:pitlane-tools/templates/cloudflare my-app
cd my-app
vp install
vp dev
```

The template repository carries the same guest-book application across Cloudflare, Netlify, Vercel, Railway on Node/Bun/Deno, Deno Deploy, and GitHub Pages. Diffing two templates shows the portability boundary directly.

### First deploy

The template's deployment guide uses the provider's native authentication and prebuilt deployment path. For Cloudflare:

```sh
vpx wrangler login
vp build
vpx wrangler deploy
```

### Day-to-day development

```sh
vp dev       # provider emulation when the target plugin supplies it
vp build     # build the application under local or CI control
vp preview   # exercise the production artifact
```

Resource, secret, migration, log, and deploy commands remain target-specific and are documented beside each template.

## Target templates and capability recipes

A target template is a complete, ordinary Remix project rather than the output of a hidden platform model. Its base contains:

- `@pitlane/dev` for server-rendered targets that use `clientEntry()`
- the provider's Vite plugin when one exists, or a small runtime launcher when it does not
- `app/entry.server.tsx` with the router and target handler export
- checked-in native provider configuration
- provider adapters constructed at the application boundary
- a native GitHub Actions workflow that builds and deploys the artifact

Client-only templates omit `@pitlane/dev` when there is no server build or hydration transform to perform.

Capability documentation provides additive recipes for existing projects. A future interactive scaffolder — `create-pitlane`, whose name is reserved — may automate those recipes, but its output must be the same reviewable package imports, application modules, and native provider config a developer would write by hand. It may not introduce a Pitlane target manifest or hidden generated state.

For a Cloudflare application:

- **Database** installs `@pitlane/data-table-d1`, adds the D1 declaration to `wrangler.jsonc`, constructs `createD1Database(env.DB)`, and adds schema, migration, and seed modules.
- **File storage** installs `@pitlane/file-storage-cloudflare-r2`, adds the R2 bucket declaration to `wrangler.jsonc`, and constructs `new R2FileStorage(env.FILES)`.
- **Session storage** installs `@pitlane/session-storage-cloudflare-kv`, adds the KV declaration to `wrangler.jsonc`, and scaffolds `createKVSessionStorage` plus the `session()` controller middleware.
- **Background and scheduled jobs** install `@pitlane/job` and `@pitlane/job-scheduler-cloudflare`, add queue and cron declarations to `wrangler.jsonc`, scaffold the job registry, and compose `queue` and `scheduled` handlers with the server entry.
- **Other provider-backed capabilities** install their neutral package and matching adapter, then make the provider-native config change required by that resource.

Project-only recipes do not mutate deployment config unless the feature actually requires a target resource:

- **Local-first execution** is not currently scaffolded. The local-store and service-worker designs above remain unsequenced research rather than tracked package commitments.
- **Theme** installs `@pitlane/theme`, adds a schema and token tree (or narrows `@pitlane/theme/default` with `select`), renders `<Theme />` at the document root, and demonstrates branded `css()` and `tva`.
- **Authentication, content, localization, and testing** install and wire only their focused package or Remix primitive.
- **Prerendering** adds paths rather than a package: `remix({ prerender })` is an option on the plugin the template already installs.
- **CI/CD** adds the target's native workflow; it never adds a Pitlane deploy action.

An illustrative Cloudflare project remains explicit at every target seam:

```text
my-app/
├── .github/workflows/deploy.yml    # Wrangler deployment
├── app/
│   ├── entry.server.tsx            # router, adapters, queue + cron handlers
│   ├── home.tsx                    # createController
│   ├── jobs.ts                     # createJobs + Scheduler
│   ├── root.tsx
│   ├── routes.ts
│   └── schema.ts                   # database schema
├── package.json
├── tsconfig.json
├── vite.config.ts                  # remix() + cloudflare()
└── wrangler.jsonc                  # bindings, assets, queues, and cron
```

## How this compares to Void

| Concern               | Void                                                        | Pitlane                                                           |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Platform primitives   | Magic global imports (e.g. `void/db`)                       | Explicit adapters and controllers                                 |
| Provider model        | Single hidden platform                                      | Multi-provider capability adapters                                |
| Resource provisioning | Automatic during deployment                                 | Automated via CI/CD                                               |
| Provider account      | Hidden behind Void                                          | Managed directly by the developer                                 |
| Deploy config         | None; fully hidden                                          | Checked-in native provider configuration                          |
| Framework             | React, Vue, Svelte, Solid, or any Vite-based meta-framework | Remix                                                             |
| Build tool            | Vite or Vite+                                               | Vite or Vite+, through `@pitlane/dev`                             |
| Scaffolding           | `void init`                                                 | Target templates through `giget`                                  |
| Dev server            | `void dev`                                                  | `vp dev`, composed with the provider's runtime plugin             |
| Deploy                | `void deploy`                                               | GitHub Actions workflow                                           |
| Model interface       | Built-in MCP                                                | CLI, source code, documentation, templates, and maintained skills |
| Philosophy            | Platform SDK that hides the platform                        | Composable hosting around a portable runtime contract             |

# Pitlane Vision

![Pitlane logo](https://i.imgur.com/3QRfNfi.png)

## Overview

Pitlane is a **meta-framework** for Remix 3. It sits between the Remix framework and the platforms you deploy to, giving Remix apps first-class, **portable** platform integration across Cloudflare, Netlify, Vercel, Neon, Upstash, Clerk, Resend, and more.

It replaces hand-written infrastructure code (adapters, config files, migration runners, type generation) with maintained libraries and a CLI that wraps platform tooling. The same application code — controllers, adapters, job definitions — runs against any supported provider; only the adapter you install and the deploy target you configure change.

The goal is to bring the developer experience of Void (auto-provisioned platform primitives, one-command deploy, zero infrastructure boilerplate) to Remix 3 — without hiding the underlying platform, without building a multi-tenant system, and without breaking Remix's explicit composition patterns.

**Key principles:**

- **Remix idioms.** Platform primitives are adapters you construct and controllers you register — request-scoped state flows through controller middleware and context, not magic globals. Configuration is explicit.
- **Adapters, not lock-in.** Each capability (database, file storage, sessions, jobs, cache, email, images, flags, realtime) is a provider-neutral interface with swappable adapter packages. Application code depends on the interface; the adapter binds it to a provider.
- **One canonical config.** The `platform()` Vite plugin is the source of truth for the project's deploy target and bindings. Every other tool (CLI, deploy action, type generation) reads from it.

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

| Capability | Adapters / source |
| --- | --- |
| Database adapters | Cloudflare D1 • Cloudflare Durable Object Storage • Netlify Database • Neon Postgres |
| File storage adapters | Cloudflare R2 • Netlify Blobs • Vercel Blob |
| Session storage adapters | Cloudflare KV • Netlify Blobs • Upstash Redis |
| Authentication adapters | Netlify Identity • Clerk Auth |
| Image optimization | Cloudflare Images • Netlify Image CDN • Vercel Image Optimization |
| Feature flags | Cloudflare Flagship • Vercel Edge Config |
| Scheduled jobs | Cloudflare Cron Triggers • Netlify Scheduled Functions • Vercel Cron Jobs |
| Background jobs | Cloudflare Queues • Netlify Background Functions • Vercel Queues |
| Route caching | Cloudflare Workers Cache • Netlify Durable Cache • Vercel CDN Cache |
| Preview Deployments | Cloudflare Preview Deployments • Netlify Deploy Previews • Vercel Preview Deployments |
| Realtime data | Cloudflare Durable Objects |
| Email delivery | Cloudflare Email Service • Resend |
| Font providers | Local • Fontsource • Google Fonts • Adobe Fonts |
| Content layer | Pitlane-native |
| Head metadata | Pitlane-native |
| Localization | Pitlane-native |
| Type-safe env/secrets | Pitlane-native |
| Type-safe styling | [Pitlane-native](https://gist.github.com/markmals/85f9d3d9e9bec810ba74f334e096cb42) |
| Sprite sheet generator | Pitlane-native |
| Browser router | [Gist](https://gist.github.com/sergiodxa/0e921c1f47f3bb1af496cc0c142011f6) |
| View transitions | Pitlane-native |
| Logging | Pitlane-native |
| Router RPC | Pitlane-native |
| Prerendering | Pitlane-native |

**Name and distribution:**

- npm packages: `pitlane`, `@pitlane/*`
- GitHub org: `pitlane-tools`
- CLI command: `pitlane`
- Marketing site: `https://pitlane.tools`
- Docs site: `https://docs.pitlane.tools`
- Scaffolding: `vp create pitlane` (via `create-pitlane` package)

## Package architecture

Pitlane is a monorepo of small, single-purpose packages. Each can be used independently, but they compose into a cohesive experience.

`pitlane` is the meta-package: it ships the `pitlane` CLI and the `pitlane/dev` Vite plugins (`remix()` and `platform()`). The scoped `@pitlane/*` packages provide the capability interfaces, their provider adapters, and the framework-adjacent feature packages.

### Packaging strategy

Pitlane mirrors Remix's packaging. Every capability, adapter, and feature ships as an individual scoped package under the `@pitlane/*` namespace, and a single umbrella `pitlane` package on npm re-vends all of them under subpath imports. Installing `pitlane` gives you the whole surface via `pitlane/<name>` — for example, `pitlane/data-table-cloudflare-d1` re-exports `@pitlane/data-table-cloudflare-d1` — and you can still depend on any `@pitlane/*` package directly. Examples throughout this document import from the `pitlane/*` umbrella.

### The adapter pattern

Remix owns the capability interface (e.g. `Database` from `remix/data-table`, the `FileStorage` interface from `remix/file-storage`). A Pitlane adapter package supplies the concrete implementation for a provider. Application code constructs the Remix object with a Pitlane adapter and uses it directly — swapping the adapter import is the only change needed to move providers.

```ts
import { env } from "cloudflare:workers";
import { D1DatabaseAdapter } from "pitlane/data-table-cloudflare-d1";
import { Database } from "remix/data-table";

// Swap the adapter import to change providers — every route that reads
// `db` stays identical.
let db = new Database(new D1DatabaseAdapter(env.DB));
```

### Package tree

**Adapters** — provider bindings for the core Remix capabilities:

```
@pitlane/data-table-cloudflare-d1
@pitlane/data-table-cloudflare-durable-object-sql
@pitlane/data-table-netlify-database
@pitlane/data-table-neon
@pitlane/file-storage-cloudflare-r2
@pitlane/file-storage-netlify-blobs
@pitlane/file-storage-vercel-blob
@pitlane/session-storage-cloudflare-kv
@pitlane/session-storage-netlify-blobs
@pitlane/session-storage-redis
@pitlane/auth-netlify-identity
@pitlane/auth-clerk
```

**Feature packages** — Pitlane-native capabilities (some backed by an upstream source):

| Package                   | Capability                                                  |
| ------------------------- | ----------------------------------------------------------- |
| `@pitlane/content`        | Content layer (`md`, `mdx`, `json`, CMS, etc.)              |
| `@pitlane/meta`           | `<head>` metadata                                           |
| `@pitlane/i18n`           | Internationalization                                        |
| `@pitlane/env`            | Type-safe environment variables & secrets                   |
| `@pitlane/theme`          | Type-safe styling with design tokens                        |
| `@pitlane/sprites`        | Sprite sheet and sprite component generator                 |
| `@pitlane/logger`         | Structured logging, á la Evlog                              |
| `@pitlane/browser-router` | Browser-only router                                         |
| `@pitlane/typed-routes`   | Type-safe RPC routes via `remix/data-schema` and/or OpenAPI |

**Capability packages with per-provider adapters** — a neutral core plus one sub-package per provider:

```
@pitlane/image
  @pitlane/image-cloudflare
  @pitlane/image-netlify
  @pitlane/image-vercel

@pitlane/flags
  @pitlane/flags-cloudflare
  @pitlane/flags-netlify
  @pitlane/flags-vercel

@pitlane/job
  @pitlane/job-storage-data-table
  @pitlane/job-storage-cloudflare-kv
  @pitlane/job-storage-redis
  @pitlane/job-scheduler-cloudflare
  @pitlane/job-scheduler-netlify
  @pitlane/job-scheduler-vercel

@pitlane/cache
  @pitlane/cache-cloudflare
  @pitlane/cache-netlify
  @pitlane/cache-vercel

@pitlane/realtime
  @pitlane/realtime-cloudflare-durable-objects

@pitlane/email
  @pitlane/email-cloudflare
  @pitlane/email-resend

@pitlane/fonts
  @pitlane/fonts-fontsource
  @pitlane/fonts-google
  @pitlane/fonts-adobe
```

### Tooling packages

| Package | Purpose |
| --- | --- |
| `@pitlane/dev` | Vite plugins — `remix()` (framework build) and `platform()` (target config) |
| `pitlane` (CLI) | CLI wrapping platform tooling — database, secrets, resources, deploy |
| `pitlane-tools/deploy-action` | GitHub Action for CI/CD deployment |

## `pitlane/dev` — framework Vite plugin

The `remix()` plugin generalizes the `remix.plugin.ts` that currently lives as hand-rolled application code in every Remix 3 project. It is provider-agnostic. Handles four concerns:

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

The `platform()` plugin is the canonical source of the project's deploy target and its bindings. Every other tool — the CLI, the deploy action, type generation — reads this config to know what to do.

### What it does

Replaces the per-provider glue (`@cloudflare/vite-plugin` + `wrangler.jsonc`, `netlify.toml`, `vercel.json`) and the manual `typegen` run task:

- **Dev time**: generates the target's native config into `.pitlane/` (gitignored) from conventions + config, runs the provider's type generation, outputs binding types into `.pitlane/`, and delegates to the provider's dev integration (e.g. Miniflare/workerd for Cloudflare) for local emulation.
- **Build time**: regenerates the target config if needed, then lets the provider's own tooling handle bundling.

The plugin's `target` selects the deploy platform. The option shape for bindings is target-specific — each target emits its own native config format — but the runtime code your app imports (adapters, controllers) stays identical because it depends on adapters, not on the target.

### Config shape (Cloudflare target)

```ts
// Single binding shorthand
platform({
    target: "cloudflare",
    d1: { binding: "DB", database: "contacts" },
    kv: { binding: "SESSIONS" },
    r2: { binding: "FILES" },
    queues: { binding: "TASKS", queue: "task-queue" },
    cron: "0 * * * *",
});

// Multiple bindings
platform({
    target: "cloudflare",
    name: "my-app",
    compatibilityDate: "2026-04-08",
    d1: [
        { binding: "DB", database: "primary" },
        { binding: "ANALYTICS_DB", database: "analytics" },
    ],
    kv: [{ binding: "SESSIONS" }, { binding: "FLAGS" }],
    r2: [{ binding: "UPLOADS" }, { binding: "ASSETS" }],
    queues: [
        { binding: "TASKS", queue: "task-queue" },
        { binding: "EMAILS", queue: "email-queue" },
    ],
    cron: ["0 * * * *", "0 0 * * *"],
});
```

Each resource type accepts either a single object or an array of objects; a single object is sugar for a one-element array. When using multiple bindings of the same type, construct one adapter per binding.

The `netlify` and `vercel` targets accept analogous option shapes and emit their own native config (`netlify.toml`, `vercel.json`) into `.pitlane/`.

### What it generates

For the Cloudflare target: `.pitlane/wrangler.jsonc` — a complete Wrangler config derived from the plugin options, including `main`, `assets`, `compatibility_date`, `d1_databases`, `kv_namespaces`, `r2_buckets`, `queues`, `triggers`. For other targets, the equivalent native config. The user can inspect it for debugging but never edits it.

### What it does NOT do

- No import scanning. Resource detection is based on plugin config.
- No auto-provisioning of remote resources. That's the CLI's job.
- No hiding platform concepts. The generated configs and types are inspectable in `.pitlane/`.

## Runtime — adapters and controllers

Platform primitives are constructed from a raw binding (from `env`) plus a Pitlane adapter, then used inside controllers registered with the Remix router. Adapters that need to be request-scoped (sessions, flags, realtime) are added as controller middleware and read from the action context; stateless singletons (database, file storage, schedulers) are constructed once at module scope.

Swapping providers means swapping the adapter import — controllers are unchanged.

### Database

`Database` comes from `remix/data-table`; the adapter binds it to a provider. Construct it once and use it inside a controller action.

```ts
import { env } from "cloudflare:workers";
import { D1DatabaseAdapter } from "pitlane/data-table-cloudflare-d1";
import { Database } from "remix/data-table";
import { createController } from "remix/router";

let db = new Database(new D1DatabaseAdapter(env.DB));

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

| Adapter package                                     | Export                    |
| --------------------------------------------------- | ------------------------- |
| `@pitlane/data-table-cloudflare-d1`                 | `D1DatabaseAdapter`       |
| `@pitlane/data-table-cloudflare-durable-object-sql` | `DurableObjectSqlAdapter` |
| `@pitlane/data-table-netlify-database`              | `NetlifyDatabaseAdapter`  |
| `@pitlane/data-table-neon`                          | `NeonDatabaseAdapter`     |

For example, on Neon:

```ts
import { NeonDatabaseAdapter } from "pitlane/data-table-neon";
import { Database } from "remix/data-table";

let db = new Database(new NeonDatabaseAdapter(process.env.DATABASE_URL));
```

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

Session handling is a Remix concern (`remix/session`, `remix/session-middleware`); Pitlane supplies the storage backend. Adapters: `@pitlane/session-storage-cloudflare-kv` (`createKVSessionStorage`), `@pitlane/session-storage-netlify-blobs` (`createBlobsSessionStorage`), `@pitlane/session-storage-redis` (`createRedisSessionStorage`).

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

Remix provides the auth primitives (`remix/auth`). Pitlane supplies adapters for hosted identity: `@pitlane/auth-netlify-identity` and `@pitlane/auth-clerk`. Each adapter wires its provider into the Remix auth middleware and exposes the authenticated user through the action context.

## Background jobs — `@pitlane/job`

Background jobs use a typed, schema-validated API. Jobs are defined once with `createJobs` and shared between the producer (a `Scheduler`) and the consumer (`createJobQueue`). The scheduler's `queue` backend and, optionally, job-state storage are chosen via adapters, so the same job definitions run on Cloudflare Queues, Netlify Background Functions, or Vercel Queues.

- Scheduler adapters: `@pitlane/job-scheduler-cloudflare`, `@pitlane/job-scheduler-netlify`, `@pitlane/job-scheduler-vercel`. On Cloudflare the raw queue binding (`env.TASKS`) is passed directly.
- Storage adapters (job state / results): `@pitlane/job-storage-data-table`, `@pitlane/job-storage-cloudflare-kv`, `@pitlane/job-storage-redis`.

### Defining and scheduling jobs

Each job declares a `schema` for payload validation and a `handle` function. The queue binding lives on the `Scheduler`, not the job definition.

```ts
import { env } from "cloudflare:workers";
import { createJobs, Scheduler, createJobQueue } from "pitlane/job";
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

let scheduler = new Scheduler(jobs, { queue: env.TASKS });

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
    queue: env.TASKS,
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

let jobs = createJobs({
    dailyDigest: {
        async handle() {
            await sendDailyDigest();
        },
    },
});

let scheduler = new Scheduler(jobs, { queue: env.TASKS });

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

Declare features with `createFeatures`, add the `flags()` middleware bound to the flags store, and read them from the action context. Flag inputs are described with the schema helpers in `pitlane/flags/schema`. Adapters: `@pitlane/flags-cloudflare` (Flagship), `@pitlane/flags-vercel` (Edge Config), `@pitlane/flags-netlify`.

```ts
import { env } from "cloudflare:workers";
import { createFeatures, flags } from "pitlane/flags";
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

export default createController(routes.shop, {
    middleware: [flags(env.FLAGS)],
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

### Realtime — `@pitlane/realtime`

The `Realtime` context key exposes a live-updating store inside a client entry. Adapter: `@pitlane/realtime-cloudflare-durable-objects`.

```tsx
import { Realtime } from "pitlane/realtime";
import { addEventListeners, clientEntry } from "remix/ui";

let ChatPanel = clientEntry(import.meta.url, handle => {
    let realtime = handle.context.get(Realtime);

    addEventListeners(realtime, handle.signal, {
        chatmessage() {
            handle.update();
        },
        statuschange() {
            handle.update();
        },
    });

    return () => (
        <ul>
            {realtime.messages.map(message => (
                <li key={message.id}>{JSON.stringify(message)}</li>
            ))}
        </ul>
    );
});
```

### Type-safe styling — `@pitlane/theme`

`createTheme` takes a [W3C design-token](https://www.w3.org/community/design-tokens/) config and returns a token accessor (`token`, conventionally aliased to `$`), a `<Theme />` component, and class/variant helpers — `tva` ("Theme Variance Authority", modeled on `cva`) plus `cx` and `combine`. `<Theme />` injects the design-token CSS onto the page via `remix/ui`'s theme manager. Token paths are type-safe: `$(path)` yields a CSS `var()` reference, `$.raw(path)` the underlying value, and `$.css({...})` a `remix/ui` `css()` mixin with token paths resolved to vars, applied through the `mix` prop. Built on Gist.

```tsx
import { createTheme } from "pitlane/theme";

let {
    token: $,
    Theme,
    // Theme Variance Authority — API like `cva`
    tva,
    cx,
    combine,
} = createTheme({
    // W3C design token config
    color: {
        white: { $type: "color", $value: "#fff" },
        // ...
    },
    // ...
});

$("colors.white"); // "var(--colors-white)"
$.raw("colors.white"); // "#fff"

// $.css() resolves token paths to vars and returns a remix/ui css() mixin
let mixin = $.css({ color: "colors.white", backgroundColor: "colors.white" });
// remix/ui css({ color: "var(--colors-white)", backgroundColor: "var(--colors-white)" })

function Component() {
    return () => (
        <>
            {/* <Theme /> adds the design-token CSS via remix/ui's theme manager */}
            <Theme />
            <div mix={$.css({ color: "colors.white" })} />
            {/*                     ^ type-safe token path */}
        </>
    );
}
```

### Browser router — `@pitlane/browser-router`

Client-side routing for Remix UI components that mirrors the `remix/router` shape on the client (the `ui-router` experiment). It reuses `remix/routes` as the source of truth for URL patterns — the same contracts the server controllers use — matches with `remix/route-pattern`, and renders through `remix/ui`'s `createRoot`. Route actions may be async, so a handler can load the data it needs before returning Remix UI JSX. Mounted routers use the browser Navigation API when available, with a History API + same-origin link-interception fallback. Built on Gist.

Define the route contract once and share it between the server (`remix/router`, returning `Response`) and the browser (`@pitlane/browser-router`, rendering Remix UI):

```tsx
// routes.ts — shared contract
import { route } from "remix/routes";

export let routes = route({
    home: "/",
    post: "/posts/:id",
});
```

```tsx
import type { Handle } from "remix/ui";
import { createAction, createRouter } from "pitlane/browser-router";
import { routes } from "./routes.ts";

function PostPage(handle: Handle<{ post: Post }>) {
    return () => <article>{handle.props.post.title}</article>;
}

let router = createRouter();

router.map(
    routes.home,
    createAction(routes.home, () => <HomePage />),
);
router.map(
    routes.post,
    createAction(routes.post, async ctx => {
        let post = await fetchPost(ctx.params.id);
        return <PostPage post={post} />;
    }),
);

let mounted = router.mount(document.body);
```

Controllers map the direct leaves of a route map, mirroring the server-side `createController`:

```tsx
import { createController, createRouter } from "pitlane/browser-router";

let router = createRouter();

router.map(
    routes.posts,
    createController(routes.posts, {
        actions: {
            index() {
                return <h1>Posts</h1>;
            },
            show(ctx) {
                return <h1>Post {ctx.params.id}</h1>;
            },
        },
    }),
);
```

The rest of the surface mirrors Remix's server router on the client:

- **Mutations & fetchers** — `router.submit()` and `router.getFetcher()` run route actions and then navigate/revalidate like a form submission; `fetcher.form()` / `router.form()` return `mix` form mixins, and `router.revalidate()` re-runs the current action across mounted roots.
- **Middleware** — global (on `createRouter`), per-controller, or per-action `(ctx, next)` middleware sharing the same mutable `ctx`; return a result to short-circuit or `next()` to continue. `createContextKey()` stores request-scoped values.
- **Context** — every render is wrapped in `RouterProvider`; descendants read the router plus the current `match`, `url`, `params`, and `route` via `handle.context.get(RouterProvider)`.
- **Frames** — mounted routers wire Remix UI's `<Frame>` resolver so a frame `src` renders through the same action pipeline (middleware, params, actions); reload with `handle.frame.reload()` or `handle.frames.get(name)?.reload()`.
- **Navigation** — `router.navigate(to, { mask, replace, state })` uses the Navigation API with a History fallback; `mask` supports modal-style routes.

### The rest

- **`@pitlane/cache`** — route caching. Adapters: `@pitlane/cache-cloudflare` (Workers Cache), `@pitlane/cache-netlify` (Durable Cache), `@pitlane/cache-vercel` (CDN Cache).
- **`@pitlane/email`** — email delivery. Adapters: `@pitlane/email-cloudflare` (Email Service), `@pitlane/email-resend`.
- **`@pitlane/fonts`** — font providers. Adapters: `@pitlane/fonts-fontsource`, `@pitlane/fonts-google`, `@pitlane/fonts-adobe`; a local provider ships in the core package.
- **`@pitlane/i18n`** — localization.
- **`@pitlane/env`** — type-safe env / secrets.
- **`@pitlane/sprites`** — sprite sheet generator.
- **`@pitlane/logger`** — logging.
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
import { Database } from "remix/data-table";

import { D1DatabaseAdapter } from "pitlane/data-table-cloudflare-d1";
import { R2FileStorage } from "pitlane/file-storage-cloudflare-r2";
import { createKVSessionStorage } from "pitlane/session-storage-cloudflare-kv";
import { createJobs, Scheduler, createJobQueue, createScheduledJobs } from "pitlane/job";

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

let db = new Database(new D1DatabaseAdapter(env.DB));
let files = new R2FileStorage(env.FILES);
let scheduler = new Scheduler(jobs, { queue: env.TASKS });

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

## Full vite.config.ts example

```ts
import { remix, platform } from "pitlane/dev";
import { defineConfig } from "vite-plus";

export default defineConfig({
    plugins: [
        remix(),
        platform({
            target: "cloudflare",
            d1: { binding: "DB", database: "contacts" },
            kv: { binding: "SESSIONS" },
            r2: { binding: "FILES" },
            queues: { binding: "TASKS", queue: "task-queue" },
            cron: "0 * * * *",
        }),
    ],
});
```

## `pitlane` — the CLI

Wraps each target's platform tooling and provides Remix 3-aware commands. Reads configuration from the `platform()` plugin options in `vite.config.ts` — no separate CLI config file. It dispatches to the right provider tool based on `target` (Wrangler for Cloudflare, the Netlify CLI, the Vercel CLI).

The CLI does NOT shim any commands already provided by Vite+ (`dev`, `build`, `check`, `test`, etc.). It focuses exclusively on platform operations.

### Database commands

Wraps `remix/data-table` and the configured database adapter.

```
pitlane db generate          — generate migration file from schema diff
pitlane db push              — apply schema directly to local database (prototyping)
pitlane db migrate           — run pending migrations locally
pitlane db migrate --remote  — run pending migrations against the remote database
pitlane db reset             — wipe local database state
pitlane db seed              — run seed file
```

### Secrets

```
pitlane secrets push         — sync .env to the target's secret store
pitlane secrets list         — list remote secret names (values are write-only)
```

`pitlane secrets push` reads `.env`, diffs against deployed secret names, and pushes changes. Warns before overwriting.

### Resources

```
pitlane resources list       — show the project's provider resources and their status
pitlane resources create     — provision resources from platform config
pitlane resources link       — link existing resources
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
4. Deploy using the generated target config in `.pitlane/`
5. Log the live URL

### Setup

```
pitlane setup             — generate .github/workflows/deploy.yml
```

Writes a ready-to-use GitHub Actions workflow using `pitlane-tools/deploy-action`. Prompts for any needed values (environment name, production URL).

When `gh` is available and authenticated, the command detects the full repository state and offers to handle each missing step:

1. **No git repo** — offers to run `git init` and create an initial commit
2. **No GitHub remote** — offers to create a GitHub repo via `gh repo create` and push
3. **Missing platform secrets** — if logged in via `pitlane login`, offers to create a scoped API token via the provider's API and set the corresponding repository secret via `gh secret set`.
4. **Writes the workflow file** — `.github/workflows/deploy.yml`

When everything is available, the full flow is: init repo, create remote, create platform token, set secret, write workflow — zero manual steps from fresh project to CI pipeline.

### Auth

```
pitlane login                — delegates to the target provider's login flow
pitlane whoami               — show the provider identity
```

## `pitlane-tools/deploy-action` — GitHub Action

A GitHub Action for CI/CD deployment. The user handles building and Vite+ setup themselves, since those choices vary across projects (Mise, the official Vite+ action, Homebrew, etc.).

The action assumes the project is already built (`dist/` exists) and takes care of the platform-specific steps for the configured target.

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
                  # provider token — name depends on the configured target
                  apiToken: ${{ secrets.PLATFORM_API_TOKEN }}
```

**What the action does:**

1. Runs `pitlane db migrate --remote` if there are pending migrations
2. Aborts if migration fails
3. Runs `pitlane deploy` using the generated target config in `.pitlane/`

**What the action does NOT do:**

- Install dependencies or set up Vite+ — the user's responsibility
- Build the project — the user runs `vp build` before calling the action
- Provision resources — `pitlane resources create` is a one-time step, not part of CI

This means `pitlane deploy` from the local CLI and the GitHub Action do the same thing, but the action is the primary deploy path for most teams. The CLI command exists for local one-offs and debugging.

## MVP boundaries

### In MVP

- `pitlane/dev` — `remix()` Vite plugin (extraction of `remix.plugin.ts`)
- `pitlane/dev` — `platform()` Vite plugin (canonical target + binding config), Cloudflare target first
- Core adapters — `@pitlane/data-table-cloudflare-d1` (`D1DatabaseAdapter`), `@pitlane/file-storage-cloudflare-r2` (`R2FileStorage`), `@pitlane/session-storage-cloudflare-kv` (`createKVSessionStorage`)
- `@pitlane/job` — `createJobs`, `Scheduler`, `createJobQueue`, `createScheduledJobs` (Cloudflare Queues backend)
- `pitlane` CLI — database commands, secrets sync, resource provisioning, deploy
- `pitlane-tools/deploy-action` — GitHub Action for CI/CD deployment
- Auto-injected `CLAUDE.md` in the meta-package

### Post-MVP

- Additional targets — Netlify and Vercel adapters across every capability
- Remaining feature packages — `@pitlane/content`, `@pitlane/meta`, `@pitlane/i18n`, `@pitlane/env`, `@pitlane/theme`, `@pitlane/sprites`, `@pitlane/logger`, `@pitlane/browser-router`, `@pitlane/typed-routes`, `@pitlane/image`, `@pitlane/flags`, `@pitlane/cache`, `@pitlane/realtime`, `@pitlane/email`, `@pitlane/fonts`
- Log streaming (covered by the provider's own log tail for now)
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
vp dev                       — local dev with the target's emulator
pitlane db generate          — after schema changes
pitlane db migrate           — apply locally
pitlane secrets push         — sync .env to the provider
pitlane deploy               — ship it
```

## Updating `create-pitlane`

The existing `create-pitlane` package offers three project kinds: React Router SPA, SSR, and RSC. A new **Remix** option is added alongside these as a fourth top-level template choice — the primary way to get started with Pitlane.

The existing React Router templates are unchanged. The new Remix template is the opinionated Pitlane path.

### New project kind: Remix

```
vp create pitlane

? Deploy target:
❯ Cloudflare
  Netlify
  Vercel
```

This package scaffolds a Remix 3 project using `pitlane/dev` and the `pitlane` CLI. It first asks for a deploy target, which determines the default adapters:

The base template includes:

- `vite.config.ts` with `remix()` and `platform({ target })` plugins
- `entry.server.tsx` with the router, adapters, and worker export
- `pitlane` CLI as a dev dependency
- `.pitlane/` in `.gitignore`
- No hand-written target config — the platform plugin generates it

### Optional features

After selecting the target, the interactive prompts present optional features in two groups — platform features (provider-backed capabilities) and project features (framework-level concerns). Each platform feature installs the adapter matching the chosen target.

```
? Platform features:
  ☐ Database
  ☐ File Storage
  ☐ Session Storage
  ☐ Background Jobs
  ☐ Scheduled Jobs
  ☐ Email Delivery
  ☐ Image Optimization
  ☐ Feature Flags
  ☐ Route Caching
  ☐ Realtime

? Project features:
  ☐ Authentication
  ☐ Testing
  ☐ Prerendering
  ☐ Content Layer (MDX)
  ☐ Internationalization
  ☐ Tailwind (CSS)
  ☐ GitHub Actions (CI/CD)

? Testing:
  ● Vitest
  ○ Remix (remix/test)
```

#### Platform features

Each platform feature adds the relevant `platform()` config, installs the target-matched adapter, and wires the construction/handlers into `entry.server.tsx`. For example, on the Cloudflare target:

**Database** — Prompts for a database name (defaults to the project name), adds the D1 binding to `platform()` config, installs `@pitlane/data-table-cloudflare-d1`, constructs `new Database(new D1DatabaseAdapter(env.DB))`, and adds a sample schema, a seed file, and a `pitlane db migrate && pitlane db seed` postinstall step.

**File Storage** — Adds the R2 binding, installs `@pitlane/file-storage-cloudflare-r2`, and constructs `new R2FileStorage(env.FILES)`.

**Session Storage** — Adds the KV binding, installs `@pitlane/session-storage-cloudflare-kv`, and scaffolds a session storage module with `createKVSessionStorage` plus the `session()` controller middleware.

**Background Jobs** — Prompts for a queue name (defaults to `"tasks"`), adds the queue binding, installs `@pitlane/job` + `@pitlane/job-scheduler-cloudflare`, scaffolds a `jobs.ts` module with `createJobs` and a `Scheduler`, and wires `createJobQueue(scheduler)` and the `queue` handler.

**Scheduled Jobs** — Prompts for a cron expression (defaults to `"0 * * * *"`), adds `cron` to config, scaffolds a `createScheduledJobs(scheduler, {...})` mapping, and wires the `scheduled` handler.

Other platform features (Email, Image Optimization, Feature Flags, Route Caching, Realtime) install their capability package plus the target-matched adapter and scaffold a minimal wiring stub.

#### Project features

**Authentication** — Follow-up prompt asks which provider. _Remix (`remix/auth`)_: built-in auth middleware with session handling. _Clerk_: adds `@pitlane/auth-clerk`. _Netlify Identity_: adds `@pitlane/auth-netlify-identity`.

**Testing** — Follow-up prompt asks which framework. _Remix (`remix/test`)_ or _Vitest_.

**Prerendering** — Configures static prerendering for selected routes.

**Content Layer (MDX)** — Adds `@pitlane/content` and `@mdx-js/rollup`, wires the content layer into the Vite plugin array, and scaffolds a sample `app/content/` directory with a `createContent` module.

**Localization** — Adds `@pitlane/i18n` and scaffolds a sample locale setup.

**Tailwind (CSS)** — Adds `@tailwindcss/vite`, wires `tailwindcss()` into the Vite plugins, and creates a `tailwind.css` stylesheet imported from the root route. Enabled by default but can be deselected.

**CI/CD (GitHub Actions)** — Adds `.github/workflows/deploy.yml` using `pitlane-tools/deploy-action`.

### What the scaffolded project looks like

Example with Cloudflare target, Database, Background Jobs, Scheduled Jobs, CI/CD, and Tailwind selected:

```
my-app/
├── .github/workflows/deploy.yml    ← CI/CD
├── .vscode/
├── app/
│   ├── entry.server.tsx             ← router, adapters, queue + cron handlers
│   ├── home.tsx                     ← createController
│   ├── jobs.ts                      ← createJobs + Scheduler
│   ├── root.tsx
│   ├── routes.ts
│   ├── schema.ts                    ← database schema
│   └── styles/tailwind.css
├── seed.ts                          ← database seed
├── package.json
├── tsconfig.json
└── vite.config.ts                   ← remix() + platform({ target, d1, queues, cron })
```

With no features selected, it's the minimal Remix 3 starting point for the chosen target — `remix()` + `platform({ target })` plugins and nothing else.

## How this compares to Void

| Concern | Void | Pitlane |
| --- | --- | --- |
| Platform primitives | Magic global imports (`void/db`) | Explicit adapters + controllers |
| Provider model | Single hidden platform | Multi-provider via adapters (Cloudflare, Netlify, Vercel, …) |
| Resource provisioning | Auto on deploy | Explicit `pitlane resources create` |
| Cloud account | Hidden, not required | Required, user's own account |
| Deploy config | None, fully hidden | Generated in `.pitlane/`, inspectable |
| Framework | Multi-framework (React, Vue, Svelte, Solid) | Remix 3 only |
| Component model | Framework-delegated | Remix's own component system |
| Build tool | Vite 8 beta | Vite+ (Rolldown-based) |
| Scaffolding | `void init` | `vp create pitlane` |
| Dev server | `void dev` / `vp dev` | `vp dev` |
| Deploy | `void deploy` | `pitlane-tools/deploy-action` (CI) / `pitlane deploy` (local) |
| MCP | Built-in | Skills + CLI instead |
| Philosophy | Platform SDK — hides the platform | DX layer — portable platform integration you can inspect |

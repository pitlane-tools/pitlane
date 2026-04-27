---
title: Platform Primitives
description: Access Cloudflare bindings through Remix middleware and typed context keys.
---

# Platform Primitives

Pitlane exposes Cloudflare bindings through Remix middleware and context keys. Raw bindings come from `cloudflare:workers`; route code reads typed abstractions from context.

## Database

```ts
import { env } from "cloudflare:workers";
import { createRouter } from "remix/fetch-router";
import { Database } from "remix/data-table";
import { database } from "pitlane/data-table-middleware";

let router = createRouter({
    middleware: [database(env.DB)],
});

router.get("/contacts", async ctx => {
    let db = ctx.get(Database);
    let contacts = await db.findMany(Contacts);
    return Response.json(contacts);
});
```

`database()` wraps a D1 binding with Pitlane's `D1DatabaseAdapter` and exposes a `Database` instance.

## File Storage

```ts
import { env } from "cloudflare:workers";
import { createRouter } from "remix/fetch-router";
import { FileStorage } from "pitlane/file-storage";
import { fileStorage } from "pitlane/file-storage-middleware";

let router = createRouter({
    middleware: [fileStorage(env.FILES)],
});

router.post("/avatar", async ctx => {
    let files = ctx.get(FileStorage);
    await files.set("avatar", await ctx.request.blob());
    return new Response(null, { status: 204 });
});
```

`fileStorage()` wraps R2 with `R2FileStorage`.

## Sessions

```ts
import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";
import { createRouter } from "remix/fetch-router";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";
import { createKvSessionStorage } from "pitlane/session-storage";

let sessionCookie = createCookie("__session", {
    secrets: ["s3cr3t"],
    httpOnly: true,
    secure: true,
    sameSite: "lax",
});

let sessionStorage = createKvSessionStorage(env.SESSIONS, {
    keyPrefix: "session:",
    ttl: 60 * 60 * 24,
});

let router = createRouter({
    middleware: [session(sessionCookie, sessionStorage)],
});

router.get("/", ctx => {
    let userSession = ctx.get(Session);
    return Response.json({ count: userSession.get("count") ?? 0 });
});
```

## Jobs And Queues

```ts
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createRouter } from "remix/fetch-router";
import { createJobs, createJobHandler, Scheduler } from "pitlane/jobs";
import { scheduler } from "pitlane/jobs-middleware";

let jobs = createJobs({
    sendEmail: {
        binding: env.TASKS,
        schema: s.object({ to: s.string(), subject: s.string() }),
        async handle(payload) {
            await sendEmail(payload.to, payload.subject);
        },
    },
});

let router = createRouter({
    middleware: [scheduler(jobs)],
});

router.post("/emails", async ctx => {
    let scheduler = ctx.get(Scheduler);
    await scheduler.enqueue(jobs.sendEmail, {
        to: "a@example.com",
        subject: "Hello",
    });
    return new Response(null, { status: 202 });
});

let handlers = createJobHandler(jobs);

export default {
    fetch: router.fetch,
    queue: handlers.queue,
    scheduled: handlers.scheduled,
} satisfies ExportedHandler<Env>;
```

Retry behavior is configured per enqueue call:

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

## Cron

Cron is a recurrence layer over delayed jobs. A job declares a `schedule` and the `scheduled` handler exported by `createJobHandler` materializes due occurrences into ordinary jobs. Retries, dedupe, priority, and observability all behave the same as any other enqueued job:

```ts
let jobs = createJobs({
    sendWeeklyDigest: {
        binding: env.TASKS,
        schema: s.object({ userId: s.string() }),

        schedule: {
            cron: "0 9 * * MON",
            timezone: "America/Chicago",
            payload: { userId: "system" },
            missedRuns: "enqueue-one",
        },

        async handle(payload) {
            await sendWeeklyDigest(payload.userId);
        },
    },
});
```

`payload` is either a static value or a function `({ scheduledAt }) => Payload` for values derived at enqueue time. Generated payloads are validated against the job schema:

```ts
schedule: {
    cron: "0 9 * * *",
    timezone: "UTC",
    async payload({ scheduledAt }) {
        return { date: scheduledAt.toISOString().slice(0, 10) };
    },
}
```

`timezone` is required. DST defaults to `nonexistentTime: "skip"` and `repeatedTime: "once"`, configurable under `dst`.

`missedRuns` controls catch-up behavior after worker downtime:

| Policy        | Behavior                                                              |
| ------------- | --------------------------------------------------------------------- |
| `skip`        | Advance to the next future occurrence without enqueueing missed work. |
| `enqueue-one` | Enqueue only the most recent missed occurrence. Default.              |
| `catch-up`    | Enqueue every missed occurrence up to a cap.                          |

`catch-up` requires a cap:

```ts
missedRuns: { policy: "catch-up", maxOccurrences: 20 }
```

Each occurrence is deduped by `cron:${jobName}:${scheduledAt.toISOString()}`, composing with the existing `dedupeKey` and `dedupeTtlMs` behavior. A crash between enqueue and bookkeeping does not produce duplicate runs.

### Driving Reconciliation

Cloudflare cron triggers wake the worker. Configure one in `platform()` and `handlers.scheduled` reconciles due schedules on each tick:

```ts
platform({
    cron: "* * * * *",
});
```

A one-minute trigger is appropriate for most workloads. Only schedules with due occurrences enqueue work; the rest are skipped.

### Manual Control

`Scheduler` exposes runtime controls for individual schedules:

```ts
router.post("/admin/digest/run", async ctx => {
    let scheduler = ctx.get(Scheduler);
    await scheduler.triggerSchedule(jobs.sendWeeklyDigest);
    return new Response(null, { status: 202 });
});

router.post("/admin/digest/pause", async ctx => {
    let scheduler = ctx.get(Scheduler);
    await scheduler.pauseSchedule(jobs.sendWeeklyDigest);
    return new Response(null, { status: 204 });
});
```

`triggerSchedule` enqueues a job immediately without advancing `nextRunAt`. `pauseSchedule` and `resumeSchedule` toggle the schedule without losing its cursor.

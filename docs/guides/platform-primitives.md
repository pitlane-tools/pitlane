---
title: Platform Primitives
---

# Platform Primitives

Pitlane exposes Cloudflare bindings through Remix middleware and context keys. Raw bindings come from `cloudflare:workers`; route code reads typed abstractions from context.

## Database

```ts
import { env } from "cloudflare:workers";
import { database, Database } from "pitlane/platform";

database(env.DB);

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
import { fileStorage, FileStorage } from "pitlane/platform";

fileStorage(env.FILES);

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
import { Session } from "remix/session";
import { session } from "remix/session-middleware";
import { createKvSessionStorage } from "pitlane/platform";

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

session(sessionCookie, sessionStorage);

router.get("/", ctx => {
    let userSession = ctx.get(Session);
    return Response.json({ count: userSession.get("count") ?? 0 });
});
```

## Jobs And Queues

```ts
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createJobs, createJobQueue, scheduler, Scheduler } from "pitlane/platform";

let jobs = createJobs({
    sendEmail: {
        binding: env.EMAIL_QUEUE,
        schema: s.object({ to: s.string(), subject: s.string() }),
        async handle(payload) {
            await sendEmail(payload.to, payload.subject);
        },
    },
});

scheduler(jobs);

router.post("/emails", async ctx => {
    let queue = ctx.get(Scheduler);
    await queue.enqueue(jobs.sendEmail, {
        to: "a@example.com",
        subject: "Hello",
    });
    return new Response(null, { status: 202 });
});

let workerQueue = createJobQueue(jobs);

export default {
    fetch: router.fetch,
    queue: workerQueue.handler,
} satisfies ExportedHandler<Env>;
```

Retry behavior is configured per enqueue call:

```ts
await queue.enqueue(
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

```ts
import { createCron } from "pitlane/platform";

let cron = createCron({
    "0 * * * *": {
        async handle(event) {
            await refreshHourlyData(event);
        },
    },
});

export default {
    fetch: router.fetch,
    scheduled: cron.handler,
} satisfies ExportedHandler<Env>;
```

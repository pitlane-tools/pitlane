// @ts-nocheck
import { env } from "cloudflare:workers";
import { createKVSessionStorage } from "pitlane/session-storage-kv";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";

let storage = createKVSessionStorage(env.SESSIONS, {
    keyPrefix: "session:",
    ttl: 60 * 60 * 24,
});

let router = createRouter({
    middleware: [session(cookie, storage)],
});

router.map(routes.home, context => {
    let session = context.get(Session);
    return Response.json({
        count: session.get("count") ?? 0,
    });
});

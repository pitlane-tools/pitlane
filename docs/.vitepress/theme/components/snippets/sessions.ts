// @ts-nocheck
import { env } from "cloudflare:workers";
import { createKVSessionStorage } from "pitlane/session-storage-kv";
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
            return Response.json({
                count: session.get("count") ?? 0,
            });
        },
    },
});

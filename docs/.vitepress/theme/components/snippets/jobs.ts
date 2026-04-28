// @ts-nocheck
import { env } from "cloudflare:workers";
import {
    createJobs,
    Scheduler,
    createJobQueue,
} from "pitlane/job";
import * as s from "remix/data-schema";

let jobs = createJobs({
    sendEmail: {
        schema: s.object({
            to: s.string(),
            subject: s.string(),
        }),
        async handle(payload) {
            await sendEmail(
                payload.to,
                payload.subject,
            );
        },
    },
});

let scheduler = new Scheduler(jobs, {
    queue: env.TASKS,
});

router.map(routes.email, async () => {
    await scheduler.enqueue(jobs.sendEmail, {
        to: "mark@pitlane.tools",
    });
});

let queue = createJobQueue(scheduler);

export default {
    fetch: router.fetch,
    queue: queue.handler,
};

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

router.map(routes.email, async ctx => {
    let data = ctx.get(FormData);
    let emailAddress = s.parse(EmailSchema, data);

    await scheduler.enqueue(jobs.sendEmail, {
        to: emailAddress,
        subject: "Welcome to Pitlane",
    });

    return Response.redirect(routes.home.href());
});

let queue = createJobQueue(scheduler);

export default {
    fetch: router.fetch,
    queue: queue.handler,
};

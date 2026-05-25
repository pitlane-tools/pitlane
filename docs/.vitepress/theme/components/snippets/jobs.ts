// @ts-nocheck
import { env } from "cloudflare:workers";
import {
    createJobs,
    Scheduler,
    createJobQueue,
} from "pitlane/job";
import * as s from "remix/data-schema";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

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

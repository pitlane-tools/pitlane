// @ts-nocheck
import { env } from "cloudflare:workers";
import {
    createJobs,
    Scheduler,
    createScheduledJobs,
} from "pitlane/job";

let jobs = createJobs({
    dailyDigest: {
        async handle() {
            await sendDailyDigest();
        },
    },
});

let scheduler = new Scheduler(jobs, {
    queue: env.TASKS,
});

let scheduled = createScheduledJobs(scheduler, {
    "0 0 * * *": jobs.dailyDigest,
});

export default {
    fetch: router.fetch,
    scheduled: scheduled.handler,
};

<template>
    <section class="wrapper wrapper--ticks border-t py-14 lg:py-20 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center text-center gap-3 mb-12">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Primitives
                </span>
            </div>
            <h3 class="text-balance max-w-2xl">
                Five typed primitives, each one middleware away.
            </h3>
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
            <article class="prim-card">
                <header class="prim-head">
                    <h5>D1 Database</h5>
                    <span class="prim-tag">data-table</span>
                </header>
                <pre class="prim-code"><code>import { Database } from "remix/data-table";
import { database } from "pitlane/data-table-middleware";

router.use(database(env.DB));
let db = ctx.get(Database);</code></pre>
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>R2 File Storage</h5>
                    <span class="prim-tag">file-storage</span>
                </header>
                <pre class="prim-code"><code>import { FileStorage } from "pitlane/file-storage";
import { fileStorage } from "pitlane/file-storage-middleware";

router.use(fileStorage(env.FILES));
let files = ctx.get(FileStorage);</code></pre>
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>KV Sessions</h5>
                    <span class="prim-tag">session-storage</span>
                </header>
                <pre class="prim-code"><code>import { createKvSessionStorage } from "pitlane/session-storage";

let storage = createKvSessionStorage(env.SESSIONS, {
    keyPrefix: "session:",
    ttl: 60 * 60 * 24,
});</code></pre>
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Queues + Jobs</h5>
                    <span class="prim-tag">jobs</span>
                </header>
                <pre class="prim-code"><code>import { createJobs, Scheduler } from "pitlane/jobs";
import { scheduler } from "pitlane/jobs-middleware";

router.use(scheduler(jobs));
let queue = ctx.get(Scheduler);</code></pre>
            </article>

            <article class="prim-card prim-card--wide">
                <header class="prim-head">
                    <h5>Cron</h5>
                    <span class="prim-tag">cron</span>
                </header>
                <pre class="prim-code"><code>import { createCron } from "pitlane/cron";

let cron = createCron({
    "0 * * * *": { handle: refreshHourlyData },
});

export default { scheduled: cron.handler };</code></pre>
            </article>
        </div>
    </section>
</template>

<style scoped>
.prim-card {
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.prim-card--wide {
    grid-column: 1 / -1;
}

.prim-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px dashed var(--vp-c-divider);
    padding-bottom: 0.5rem;
}

.prim-head h5 {
    font-weight: 700;
    color: var(--vp-c-text-1);
}

.prim-tag {
    font-family: var(--vp-font-family-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--vp-c-brand-1);
}

.prim-code {
    font-family: var(--vp-font-family-mono);
    font-size: 0.8rem;
    line-height: 1.55;
    color: var(--vp-c-text-2);
    background: var(--vp-c-bg);
    padding: 0.85rem 1rem;
    overflow-x: auto;
    border: 1px solid var(--vp-c-divider);
    margin: 0;
}
</style>

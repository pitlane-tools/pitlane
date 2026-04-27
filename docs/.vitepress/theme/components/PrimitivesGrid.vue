<script setup>
import { codeToHtml } from "shiki";

const snippets = {
    database: `import { Database } from "remix/data-table";
import { database } from "pitlane/data-table-middleware";

router.use(database(env.DB));
let db = ctx.get(Database);`,
    fileStorage: `import { FileStorage } from "pitlane/file-storage";
import { fileStorage } from "pitlane/file-storage-middleware";

router.use(fileStorage(env.FILES));
let files = ctx.get(FileStorage);`,
    sessions: `import { createKvSessionStorage } from "pitlane/session-storage";

let storage = createKvSessionStorage(
    env.SESSIONS, 
    {
        keyPrefix: "session:",
        ttl: 60 * 60 * 24,
    }
);`,
    jobs: `import { createJobs, Scheduler } from "pitlane/job";
import { scheduler } from "pitlane/job-middleware";

router.use(scheduler(jobs));
let scheduler = ctx.get(Scheduler);`,
    cron: `import { createJobs } from "pitlane/job";

let jobs = createJobs({
    refreshHourlyData: {
        binding: env.TASKS,
        schedule: { 
            cron: "0 * * * *", 
            timezone: "UTC" 
        },
        async handle() { 
            await refresh(); 
        },
    },
});`,
};

const highlighted = {};
for (const [key, code] of Object.entries(snippets)) {
    highlighted[key] = await codeToHtml(code, {
        lang: "ts",
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
    });
}
</script>

<template>
    <section class="wrapper wrapper--ticks border-t py-14 lg:py-20 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center text-center gap-3 mb-12">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Primitives
                </span>
            </div>
            <h3 class="text-balance max-w-2xl">Five typed primitives, each one middleware away.</h3>
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
            <article class="prim-card">
                <header class="prim-head">
                    <h5>D1 Database</h5>
                    <span class="prim-tag">data-table</span>
                </header>
                <div class="prim-code" v-html="highlighted.database" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>R2 File Storage</h5>
                    <span class="prim-tag">file-storage</span>
                </header>
                <div class="prim-code" v-html="highlighted.fileStorage" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>KV Sessions</h5>
                    <span class="prim-tag">session-storage</span>
                </header>
                <div class="prim-code" v-html="highlighted.sessions" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Queues + Jobs</h5>
                    <span class="prim-tag">jobs</span>
                </header>
                <div class="prim-code" v-html="highlighted.jobs" />
            </article>

            <article class="prim-card prim-card--wide">
                <header class="prim-head">
                    <h5>Cron</h5>
                    <span class="prim-tag">cron</span>
                </header>
                <div class="prim-code" v-html="highlighted.cron" />
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
    min-width: 0;
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
    line-height: 1.6;
    border: 1px solid var(--vp-c-divider);
    padding: 0.85rem 1rem;
    overflow-x: auto;
    margin: 0;
}

/* Shiki dual-theme: shiki injects --shiki-light / --shiki-dark CSS variables on every span.
   We pick which set to apply based on the html.dark class. */
.prim-code :deep(.shiki),
.prim-code :deep(pre.shiki) {
    color: var(--shiki-light) !important;
    margin: 0;
    padding: 0;
    overflow: visible;
}

.prim-code :deep(.shiki span) {
    color: var(--shiki-light);
}

:root.dark .prim-code :deep(.shiki),
:root.dark .prim-code :deep(pre.shiki),
:root[data-theme="dark"] .prim-code :deep(.shiki),
:root[data-theme="dark"] .prim-code :deep(pre.shiki) {
    color: var(--shiki-dark) !important;
}

:root.dark .prim-code :deep(.shiki span),
:root[data-theme="dark"] .prim-code :deep(.shiki span) {
    color: var(--shiki-dark);
}
</style>

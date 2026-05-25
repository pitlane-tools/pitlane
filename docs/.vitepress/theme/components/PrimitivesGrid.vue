<script setup lang="ts">
import { codeToHtml } from "shiki";

const rawSnippets = import.meta.glob<string>("./snippets/*.{ts,tsx}", {
    eager: true,
    import: "default",
    query: "?raw",
});

const snippetOrder = {
    database: "database",
    fileStorage: "file-storage",
    sessions: "sessions",
    jobs: "jobs",
    cron: "cron",
    ai: "ai",
    flags: "flags",
    realtime: "realtime",
    assets: "assets",
    contentUsage: "content-1",
    contentDefinition: "content-2",
    metadata: "metadata",
} as const;

type SnippetKey = keyof typeof snippetOrder;

const stripSnippetDirectives = (code: string) => code.replace(/^\/\/ @ts-nocheck\r?\n/, "").trim();

const highlighted = {} as Record<SnippetKey, string>;
for (const [key, file] of Object.entries(snippetOrder) as [SnippetKey, string][]) {
    const code = rawSnippets[`./snippets/${file}.tsx`] ?? rawSnippets[`./snippets/${file}.ts`];
    if (code === undefined) throw new Error(`Missing primitive snippet: ${file}`);
    highlighted[key] = await codeToHtml(stripSnippetDirectives(code), {
        lang: "tsx",
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
            <h3 class="text-balance max-w-2xl">
                Cloudflare platform primitives, designed for Remix.
            </h3>
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
            <article class="prim-card">
                <header class="prim-head">
                    <h5>D1 Database</h5>
                    <span class="prim-tag">pitlane/data-table-d1</span>
                </header>
                <div class="prim-code" v-html="highlighted.database" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>R2 File Storage</h5>
                    <span class="prim-tag">pitlane/file-storage-r2</span>
                </header>
                <div class="prim-code" v-html="highlighted.fileStorage" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>KV Sessions</h5>
                    <span class="prim-tag">pitlane/session-storage-kv</span>
                </header>
                <div class="prim-code" v-html="highlighted.sessions" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Images</h5>
                    <span class="prim-tag">pitlane/assets</span>
                </header>
                <div class="prim-code" v-html="highlighted.assets" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Content Definition</h5>
                    <span class="prim-tag">pitlane/content</span>
                </header>
                <div class="prim-code" v-html="highlighted.contentDefinition" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Content Usage</h5>
                    <span class="prim-tag">pitlane/content</span>
                </header>
                <div class="prim-code" v-html="highlighted.contentUsage" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Feature Flags</h5>
                    <span class="prim-tag">pitlane/flags</span>
                </header>
                <div class="prim-code" v-html="highlighted.flags" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Realtime</h5>
                    <span class="prim-tag">pitlane/realtime</span>
                </header>
                <div class="prim-code" v-html="highlighted.realtime" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Scheduled Jobs</h5>
                    <span class="prim-tag">pitlane/job</span>
                </header>
                <div class="prim-code" v-html="highlighted.cron" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Background Jobs</h5>
                    <span class="prim-tag">pitlane/job</span>
                </header>
                <div class="prim-code" v-html="highlighted.jobs" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Workers AI</h5>
                    <span class="prim-tag">pitlane/ai</span>
                </header>
                <div class="prim-code" v-html="highlighted.ai" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5><code>&lt;head&gt;</code> management</h5>
                    <span class="prim-tag">pitlane/metadata</span>
                </header>
                <div class="prim-code" v-html="highlighted.metadata" />
            </article>

            <!-- https://developers.cloudflare.com/workflows/ -->
            <!-- https://developers.cloudflare.com/durable-objects/ -->
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
    padding: 0.5rem;
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

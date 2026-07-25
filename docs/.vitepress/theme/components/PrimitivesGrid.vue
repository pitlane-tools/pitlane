<script setup lang="ts">
import { codeToHtml } from "shiki";

const rawSnippets = import.meta.glob<string>("./snippets/*.{ts,tsx}", {
    eager: true,
    import: "default",
    query: "?raw",
});

const snippetOrder = {
    config: "config",
    serverEntry: "server-entry",
    clientEntry: "client-entry",
    assets: "assets",
    compose: "compose",
    options: "options",
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
                    The Plugin
                </span>
            </div>
            <h3 class="text-balance max-w-2xl">
                Build orchestration, hydration, and assets — designed for Remix 3.
            </h3>
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
            <article class="prim-card">
                <header class="prim-head">
                    <h5>One-plugin build</h5>
                    <span class="prim-tag">@pitlane/dev</span>
                </header>
                <div class="prim-code" v-html="highlighted.config" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Fetch-handler contract</h5>
                    <span class="prim-tag">remix/router</span>
                </header>
                <div class="prim-code" v-html="highlighted.serverEntry" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Islands, marked in source</h5>
                    <span class="prim-tag">remix/ui</span>
                </header>
                <div class="prim-code" v-html="highlighted.clientEntry" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>The asset runtime</h5>
                    <span class="prim-tag">@pitlane/dev/runtime</span>
                </header>
                <div class="prim-code" v-html="highlighted.assets" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Compose a platform</h5>
                    <span class="prim-tag">@cloudflare/vite-plugin</span>
                </header>
                <div class="prim-code" v-html="highlighted.compose" />
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Options, all defaulted</h5>
                    <span class="prim-tag">RemixPluginOptions</span>
                </header>
                <div class="prim-code" v-html="highlighted.options" />
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

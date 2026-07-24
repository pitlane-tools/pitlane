<template>
    <section class="wrapper wrapper--ticks border-t py-14 lg:py-20 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center text-center gap-3 mb-12">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Pole Position
                </span>
            </div>
            <h3 class="text-balance max-w-xl">A short setup, a long straight.</h3>
        </div>

        <div class="stats">
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>1<span class="stat-unit">plugin</span>
                </div>
                <div class="stat-label">
                    <code>plugins: [remix()]</code> is the whole build config — SSR and client
                    builds, dev, preview, hydration.
                </div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>2<span class="stat-unit">peer deps</span>
                </div>
                <div class="stat-label">
                    <code>remix</code> and <code>vite</code>. Bring your own versions — the
                    tested range is documented.
                </div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>6<span class="stat-unit">targets</span>
                </div>
                <div class="stat-label">
                    Deploy guides shipped: Cloudflare, Netlify, Vercel, Railway, Deno Deploy,
                    GitHub Pages.
                </div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>8<span class="stat-unit">managers</span>
                </div>
                <div class="stat-label">
                    Install docs speak npm, yarn, pnpm, bun, deno, vp, vlt, and nub — pick yours
                    once, the site remembers.
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.stats {
    display: grid;
    gap: 2rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 900px) {
    .stats {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
}

.stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.75rem;
    padding: 1.5rem 1.25rem;
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
    min-height: 12rem;
}

.stat-value {
    font-size: 3rem;
    line-height: 1;
    color: var(--vp-c-text-1);
}

.stat-unit {
    font-size: 0.34em;
    margin-left: 0.25em;
    color: var(--vp-c-text-2);
    font-weight: 600;
    text-transform: lowercase;
    letter-spacing: 0.04em;
    vertical-align: 0.25em;
}

.stat-label {
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
    line-height: 1.5;
    max-width: 16rem;
}
</style>

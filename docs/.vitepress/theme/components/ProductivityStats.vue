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
                    <span class="lap-stat__dot">·</span>100<span class="stat-unit">%</span>
                </div>
                <div class="stat-label">
                    Typed Cloudflare bindings — no <code>any</code>, no drift between config and
                    runtime.
                </div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>5
                </div>
                <div class="stat-label">
                    First-class primitives — D1, R2, KV, Queues, Cron — exposed as Remix
                    middleware.
                </div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>1
                </div>
                <div class="stat-label">
                    Source of truth — <code>platform()</code> in <code>vite.config.ts</code>.
                </div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>0
                </div>
                <div class="stat-label">
                    <code>wrangler.toml</code> files to maintain by hand. Pitlane generates them.
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
    font-size: 0.6em;
    margin-left: 0.05em;
    color: var(--vp-c-text-2);
    font-weight: 600;
}

.stat-label {
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
    line-height: 1.5;
    max-width: 16rem;
}
</style>

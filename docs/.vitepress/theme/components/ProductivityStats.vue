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
                    <span class="lap-stat__dot">·</span>1
                </div>
                <div class="stat-label">Config file (<code>vite.config.ts</code>)</div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>5
                </div>
                <div class="stat-label">Platform primitives</div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>0
                </div>
                <div class="stat-label">Hand-edited <code>wrangler.toml</code> files</div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>&lt;1m
                </div>
                <div class="stat-label">From scaffold to deploy</div>
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
    gap: 0.5rem;
    padding: 1.25rem;
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
}

.stat-value {
    font-size: 3rem;
    line-height: 1;
    color: var(--vp-c-text-1);
}

.stat-label {
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
}
</style>

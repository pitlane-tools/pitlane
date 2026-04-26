<template>
    <section class="wrapper wrapper--ticks border-t py-14 lg:py-20 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center text-center gap-3 mb-12">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    The Stack
                </span>
            </div>
            <h3 class="text-balance max-w-xl">
                One stack: Remix runtime, Vite+ tooling, Cloudflare platform.
            </h3>
        </div>
        <div class="grid gap-6 md:grid-cols-3">
            <div class="stack-card">
                <h5 class="stack-title">Remix</h5>
                <p class="stack-body">
                    Routing, middleware, and the runtime contract your app actually runs on.
                </p>
                <span class="stack-tag">runtime</span>
            </div>
            <div class="stack-card">
                <h5 class="stack-title">Vite+</h5>
                <p class="stack-body">
                    Unified <code>vp</code> workflow for create, install, dev, check, test, build,
                    preview.
                </p>
                <span class="stack-tag">tooling</span>
            </div>
            <div class="stack-card">
                <h5 class="stack-title">Cloudflare</h5>
                <p class="stack-body">
                    Workers, D1, R2, KV, queues, and cron — bound through typed config.
                </p>
                <span class="stack-tag">platform</span>
            </div>
        </div>
        <div class="flex justify-center mt-14">
            <img
                src="/media/pitlane-combo-black.png"
                alt="Pitlane = Remix + Vite+ + Cloudflare"
                class="combo-art combo-art--dark"
            />
            <img
                src="/media/pitlane-combo-white.png"
                alt="Pitlane = Remix + Vite+ + Cloudflare"
                class="combo-art combo-art--light"
            />
        </div>
    </section>
</template>

<style scoped>
.stack-card {
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    position: relative;
}

.stack-title {
    font-weight: 700;
    color: var(--vp-c-text-1);
}

.stack-body {
    color: var(--vp-c-text-2);
    line-height: 1.55;
}

.stack-tag {
    font-family: var(--vp-font-family-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vp-c-text-3);
    margin-top: auto;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--vp-c-divider);
}

.combo-art {
    max-width: min(540px, 80%);
    height: auto;
}

.combo-art--dark {
    display: none;
}

.combo-art--light {
    display: block;
}

:root.dark .combo-art--light,
:root[data-theme="dark"] .combo-art--light {
    display: none;
}

:root.dark .combo-art--dark,
:root[data-theme="dark"] .combo-art--dark {
    display: block;
}
</style>

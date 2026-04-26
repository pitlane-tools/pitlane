<template>
    <section
        class="wrapper wrapper--ticks border-t grid lg:grid-cols-2 divide-x divide-nickel"
    >
        <div class="art-pane">
            <img
                src="/media/pitlane-racecar.png"
                alt="Pitlane pit crew servicing a Pitlane-branded race car"
                class="art-img"
            />
        </div>
        <div class="copy-pane flex flex-col justify-center gap-4 p-8 sm:p-12 lg:p-16">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Platform Ops
                </span>
            </div>
            <h3 class="text-balance max-w-md">Platform ops at pit-crew speed.</h3>
            <p class="opacity-85 max-w-md">
                <code>pitlane resources create</code> reads <code>platform()</code> and provisions
                D1, KV, R2, queues, and cron triggers in one pass.
                <code>pitlane db migrate</code> runs pending D1 migrations.
                <code>pitlane secrets push</code> syncs secrets from <code>.dev.vars</code> to
                Wrangler. <code>pitlane deploy</code> ties it all together.
            </p>
            <a href="/guides/cli" class="button w-fit mt-4">CLI reference</a>
        </div>
    </section>
</template>

<style scoped>
.art-pane {
    position: relative;
    background:
        radial-gradient(circle at 30% 30%, rgba(205, 28, 34, 0.08), transparent 65%),
        var(--vp-c-bg-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 2rem;
    min-height: 22rem;
}

.art-img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.18);
}

:root:not(.dark) .art-img {
    box-shadow: 0 30px 60px rgba(120, 16, 19, 0.14);
}
</style>

<template>
    <section class="wrapper wrapper--ticks border-t grid lg:grid-cols-2 divide-x divide-nickel">
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
                <code>pitlane secrets push</code> syncs secrets from <code>.env</code> to Wrangler.
                <code>pitlane deploy</code> ties it all together.
            </p>
            <a href="/guides/cli" class="button w-fit mt-4">CLI reference</a>
        </div>
    </section>
</template>

<style scoped>
.art-pane {
    position: relative;
    overflow: hidden;
    min-height: 24rem;
}

.art-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
}
</style>

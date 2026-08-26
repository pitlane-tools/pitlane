<template>
    <section class="wrapper wrapper--ticks border-t grid lg:grid-cols-2 divide-x divide-nickel">
        <div class="art-pane">
            <img
                src="/media/pitlane-racecar-day.png"
                alt="Pitlane pit crew servicing a Pitlane-branded race car"
                class="art-img art-img--light"
            />
            <img
                src="/media/pitlane-racecar-night.png"
                alt="Pitlane pit crew servicing a Pitlane-branded race car"
                class="art-img art-img--dark"
            />
        </div>
        <div class="copy-pane flex flex-col justify-center gap-4 p-8 sm:p-12 lg:p-16">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Deployment
                </span>
            </div>
            <h3 class="text-balance max-w-md">
                A pit-crew that can help you deploy in no time flat.
            </h3>
            <p class="opacity-85 max-w-md">
                Build in CI, upload artifacts. Every deploy guide ships a GitHub Actions workflow,
                plus a CLI walkthrough where the platform has one, so the Vite build always runs
                where you control it.
            </p>
            <a href="/deploy/cloudflare" class="button w-fit mt-4">Deployment guides</a>
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

.art-img--dark {
    display: none;
}

:root.dark .art-img--dark,
:root[data-theme="dark"] .art-img--dark {
    display: block;
}

:root.dark .art-img--light,
:root[data-theme="dark"] .art-img--light {
    display: none;
}
</style>

<template>
    <section
        class="wrapper wrapper--ticks border-t grid lg:grid-cols-2 divide-x divide-y divide-nickel"
    >
        <div class="flex flex-col gap-3">
            <div class="p-5 sm:p-10 flex flex-col gap-3">
                <h5 class="text-white">Vite+ Native</h5>
                <p class="sm:max-w-[30rem] text-pretty">
                    Start with `vp create pitlane`, run development with `vp dev`, validate with `vp
                    check`, and build with `vp build`.
                </p>
            </div>
        </div>
        <div class="flex flex-col gap-3 border-r-0">
            <div class="p-5 sm:p-10 flex flex-col gap-3">
                <h5 class="text-white">Explicit Platform Config</h5>
                <p class="max-w-[30rem] text-pretty">
                    The `platform()` Vite plugin is the source of truth for D1, KV, R2, queues,
                    cron, generated Wrangler config, and types.
                </p>
            </div>
        </div>
        <div class="flex flex-col gap-3">
            <div class="p-5 sm:p-10 flex flex-col gap-3">
                <h5 class="text-white">Remix Runtime Primitives</h5>
                <p class="max-w-[30rem] text-pretty">
                    Add middleware for database, file storage, sessions, jobs, and scheduled work,
                    then read typed values from Remix context.
                </p>
            </div>
        </div>
        <div class="flex flex-col gap-3">
            <div class="p-5 sm:p-10 flex flex-col gap-3">
                <h5 class="text-white">Platform Operations</h5>
                <p class="max-w-[30rem] text-pretty">
                    Use `pitlane` for Cloudflare resources, migrations, secrets, setup, and deploys
                    while Vite+ owns the app lifecycle.
                </p>
            </div>
        </div>
    </section>
    <section class="wrapper border-t py-10 flex items-center justify-center">
        <a href="/guides/getting-started" class="button">Read the guide</a>
    </section>
</template>

<template>
    <div class="wrapper wrapper--ticks border-t py-14 lg:py-30 px-5 sm:px-10 lg:px-20">
        <div
            class="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-5 lg:gap-8 text-left"
        >
            <div class="flex flex-col gap-3 max-w-md">
                <div class="section-eyebrow">
                    <span class="section-eyebrow-bar" />
                    <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                        Why Pitlane
                    </span>
                </div>
                <h3 class="max-w-xl text-balance">
                    Cloudflare primitives that fit Remix instead of fighting it.
                </h3>
                <a href="/guides/vite-plugin" class="button w-fit mt-8 hidden lg:block">
                    Learn the workflow
                </a>
            </div>
            <div class="lg:max-w-lg">
                <p class="text-pretty mb-5 opacity-85">
                    Pitlane keeps the platform visible and typed. Configure resources in
                    <code>platform()</code>, let Pitlane generate Wrangler config and worker types,
                    then read D1, R2, KV sessions, queues, and cron through explicit Remix
                    middleware.
                </p>
                <p class="text-pretty opacity-85">
                    Vite+ runs the application lifecycle. Pitlane handles the Cloudflare platform
                    work around it: provisioning, migrations, secrets, generated configuration, and
                    deploys.
                </p>
                <a href="/guides/vite-plugin" class="button w-fit mt-8 block lg:hidden">
                    Learn the workflow
                </a>
            </div>
        </div>
    </div>
</template>

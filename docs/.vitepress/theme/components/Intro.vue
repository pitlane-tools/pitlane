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
                    A build plugin that fits Remix instead of fighting it.
                </h3>
                <a href="/guides/vite-plugin" class="button w-fit mt-8 hidden lg:block">
                    Learn the workflow
                </a>
            </div>
            <div class="lg:max-w-lg">
                <p class="text-pretty mb-5 opacity-85">
                    Pitlane keeps the build visible and typed. <code>remix()</code> sequences the
                    SSR and client builds, <code>clientEntry()</code> marks components for
                    hydration, and <code>?assets=</code> imports resolve hashed asset URLs for
                    server-rendered HTML — no manifest plumbing.
                </p>
                <p class="text-pretty opacity-85">
                    Vite+ (or plain Vite) runs the application lifecycle. Your server entry exports
                    a WinterTC standard fetch handler, and platform plugins like
                    <code>@cloudflare/vite-plugin</code>, <code>@netlify/vite-plugin</code> or
                    <code>nitro/vite</code> compose alongside.
                </p>
                <a href="/guides/vite-plugin" class="button w-fit mt-8 block lg:hidden">
                    Learn the workflow
                </a>
            </div>
        </div>
    </div>
</template>

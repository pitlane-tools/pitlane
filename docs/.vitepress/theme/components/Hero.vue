<template>
    <div class="wrapper wrapper--ticks grid md:grid-cols-2 w-full divide-x">
        <div class="flex flex-col p-10 justify-center items-center md:items-start">
            <div
                class="flex flex-col gap-5 max-w-[31rem] text-center md:text-left items-center md:items-start"
            >
                <h1 class="text-pretty">Platform Integration for Remix Apps</h1>
                <p class="text-lg max-w-md text-pretty opacity-80">
                    Running on Cloudflare and built around Vite+, explicit config, and typed runtime
                    primitives.
                </p>
                <div class="flex flex-wrap items-center justify-center md:justify-start gap-5 mt-8">
                    <a
                        href="/guides/getting-started"
                        class="button button--primary inline-block w-fit"
                    >
                        <span>Get Started</span>
                    </a>
                    <a
                        href="https://github.com/pitlane-tools"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="button inline-block w-fit"
                    >
                        View on GitHub
                    </a>
                </div>
            </div>
        </div>
        <div class="flex flex-col min-h-[22rem] sm:min-h-[30rem]">
            <div
                class="relative px-6 sm:px-16 h-full flex flex-col justify-center overflow-clip py-8 sm:py-16 hero-background"
            >
                <div class="terminal-panel">
                    <div class="terminal-row">$ vp create pitlane my-app</div>
                    <div class="terminal-row">$ vp install</div>
                    <div class="terminal-row">$ vp dev</div>
                    <div class="terminal-row">$ pitlane resources create</div>
                    <div class="terminal-row terminal-row--accent">$ pitlane deploy</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.hero-background {
    background:
        linear-gradient(135deg, rgba(7, 10, 18, 0.32), rgba(4, 12, 20, 0.6)),
        url("/media/pitlane-race-track-night.png");
    background-size: cover;
    background-position: center;
}

:root:not(.dark) .hero-background {
    background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.45), rgba(245, 245, 248, 0.32)),
        url("/media/pitlane-race-track-day.png");
    background-size: cover;
    background-position: center;
}

.terminal-panel {
    border: 1px solid rgba(255, 90, 97, 0.32);
    background: rgba(4, 12, 20, 0.86);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.34);
    padding: 1.25rem;
    display: grid;
    gap: 0.75rem;
    max-width: 28rem;
}

:root:not(.dark) .terminal-panel {
    border-color: rgba(120, 16, 19, 0.28);
    /* background: rgba(15, 18, 26, 0.94); */
    background: rgba(226, 232, 240, 0.96);
    box-shadow: 0 24px 60px rgba(120, 16, 19, 0.18);
}

.terminal-row {
    /* color: rgba(226, 232, 240, 0.82); */
    color: rgba(15, 18, 26, 0.82);
    font-family: var(--vp-font-family-mono);
    font-size: 0.875rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
}

.terminal-row--accent {
    color: #e3242e;
}
</style>

<template>
    <div class="wrapper wrapper--ticks grid md:grid-cols-2 w-full border-nickel divide-x">
        <div class="flex flex-col p-10 justify-center items-center md:items-start">
            <div
                class="flex flex-col gap-5 max-w-[31rem] text-center md:text-left items-center md:items-start"
            >
                <h1 class="text-white text-pretty">
                    Pitlane
                </h1>
                <p class="text-white/70 text-lg max-w-[28rem] text-pretty">
                    Platform integration for Remix 3 apps running on Cloudflare,
                    built around Vite+, explicit config, and typed runtime primitives.
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
        linear-gradient(135deg, rgba(7, 10, 18, 0.28), rgba(4, 12, 20, 0.56)),
        url('/media/pitlane-race-track.png');
    background-size: cover;
    background-position: center;
}

.terminal-panel {
    border: 1px solid rgba(153, 246, 228, 0.22);
    background: rgba(4, 12, 20, 0.82);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.34);
    padding: 1.25rem;
    display: grid;
    gap: 0.75rem;
    max-width: 28rem;
}

.terminal-row {
    color: rgba(226, 232, 240, 0.82);
    font-family: var(--vp-font-family-mono);
    font-size: 0.875rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
}

.terminal-row--accent {
    color: #7dd3fc;
}
</style>

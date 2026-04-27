<script setup>
import CheckerDivider from "./CheckerDivider.vue";
</script>

<template>
    <section class="wrapper wrapper--ticks border-t py-12 lg:py-16 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center gap-8">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Build With
                </span>
            </div>
            <div class="partners">
                <a
                    class="partner"
                    href="https://remix.run"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Remix"
                >
                    <img
                        src="/media/remix-logo-black.svg"
                        alt="Remix"
                        class="partner-logo partner-logo--light"
                    />
                    <img
                        src="/media/remix-logo-white.svg"
                        alt="Remix"
                        class="partner-logo partner-logo--dark"
                    />
                </a>
                <span class="partner-sep" aria-hidden="true">+</span>
                <a
                    class="partner"
                    href="https://viteplus.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Vite+"
                >
                    <img
                        src="/media/vite-plus-black.svg"
                        alt="Vite+"
                        class="partner-logo partner-logo--light"
                    />
                    <img
                        src="/media/vite-plus-white.svg"
                        alt="Vite+"
                        class="partner-logo partner-logo--dark"
                    />
                </a>
                <span class="partner-sep" aria-hidden="true">+</span>
                <a
                    class="partner"
                    href="https://workers.cloudflare.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Cloudflare"
                >
                    <img
                        src="/media/cloudflare.svg"
                        alt="Cloudflare"
                        class="partner-logo partner-logo--light"
                    />
                    <img
                        src="/media/cloudflare.svg"
                        alt="Cloudflare"
                        class="partner-logo partner-logo--dark"
                    />
                </a>
            </div>
        </div>
        <CheckerDivider class="mt-12" />
    </section>
</template>

<style scoped>
.partners {
    display: flex;
    align-items: center;
    gap: clamp(0.75rem, 4vw, 2rem);
    justify-content: center;
    width: 100%;
}

.partner {
    display: inline-flex;
    align-items: center;
    transition: opacity 160ms ease;
    opacity: 1;
    min-width: 0;
}

.partner:hover {
    opacity: 0.75;
}

.partner-logo {
    height: clamp(1.75rem, 6vw, 3rem);
    width: auto;
    max-width: 100%;
}

.partner-logo--dark {
    display: none;
}

:root.dark .partner-logo--dark,
:root[data-theme="dark"] .partner-logo--dark {
    display: block;
}

:root.dark .partner-logo--light,
:root[data-theme="dark"] .partner-logo--light {
    display: none;
}

.partner-sep {
    color: var(--vp-c-brand-1);
    font-weight: 700;
    font-family: var(--vp-font-family-mono);
    font-size: clamp(1rem, 3vw, 1.25rem);
    flex-shrink: 0;
}
</style>

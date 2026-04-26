<script setup>
import CheckerDivider from "./CheckerDivider.vue";
</script>

<template>
    <section class="wrapper wrapper--ticks border-t py-12 lg:py-16 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center gap-6">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Built With
                </span>
            </div>
            <div class="partners">
                <span class="partner">Remix 3</span>
                <span class="partner-sep">+</span>
                <span class="partner">Vite+</span>
                <span class="partner-sep">+</span>
                <span class="partner">Cloudflare</span>
            </div>
        </div>
        <CheckerDivider class="mt-12" />
    </section>
</template>

<style scoped>
.partners {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: wrap;
    justify-content: center;
    font-family: var(--vp-font-family-mono);
    font-size: 1.05rem;
    letter-spacing: 0.02em;
    color: var(--vp-c-text-2);
}

.partner {
    font-weight: 600;
    color: var(--vp-c-text-1);
}

.partner-sep {
    color: var(--vp-c-brand-1);
    font-weight: 700;
}
</style>

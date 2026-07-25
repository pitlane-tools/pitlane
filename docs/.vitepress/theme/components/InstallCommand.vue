<script setup>
import { ref } from "vue";

const command = "vp add -D @pitlane/dev";
const copied = ref(false);

async function copy() {
    await navigator.clipboard.writeText(command);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
}
</script>

<template>
    <section class="wrapper wrapper--ticks border-t py-12 lg:py-16 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center gap-4 text-center">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Install
                </span>
            </div>
            <div class="install-row">
                <span class="install-prompt">$</span>
                <code class="install-cmd">{{ command }}</code>
                <button
                    type="button"
                    class="install-copy"
                    :aria-label="copied ? 'Copied' : 'Copy install command'"
                    @click="copy"
                >
                    {{ copied ? "Copied" : "Copy" }}
                </button>
            </div>
        </div>
    </section>
</template>

<style scoped>
.install-row {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem 0.75rem 1.25rem;
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
    position: relative;
}

.install-prompt {
    color: var(--vp-c-brand-1);
    font-family: var(--vp-font-family-mono);
    font-weight: 700;
}

.install-cmd {
    font-family: var(--vp-font-family-mono);
    font-size: 0.95rem;
    color: var(--vp-c-text-1);
    background: transparent;
}

.install-copy {
    font-family: var(--vp-font-family-mono);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg);
    color: var(--vp-c-text-2);
    cursor: pointer;
    transition: border-color 120ms ease;
}

.install-copy:hover {
    border-color: var(--vp-c-brand-1);
    color: var(--vp-c-text-1);
}
</style>

<script setup>
import { onMounted, onUnmounted, ref } from "vue";

const lines = [
    { ts: "00:00.00", cmd: "vp create pitlane my-app", out: "Scaffolded my-app" },
    { ts: "00:04.21", cmd: "cd my-app && vp install", out: "Installed 412 packages" },
    { ts: "00:18.07", cmd: "pitlane resources create", out: "D1, KV, R2, Queue ready" },
    { ts: "00:22.55", cmd: "vp dev", out: "Local server on :5173" },
    { ts: "00:24.10", cmd: "pitlane deploy", out: "Live at https://my-app.workers.dev", accent: true },
];

const visible = ref(0);
let timer;

onMounted(() => {
    timer = setInterval(() => {
        visible.value = (visible.value + 1) % (lines.length + 1);
    }, 1400);
});

onUnmounted(() => clearInterval(timer));
</script>

<template>
    <section class="wrapper wrapper--ticks border-t py-14 lg:py-20 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center text-center gap-3 mb-10">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Lap Time
                </span>
            </div>
            <h3 class="text-balance max-w-2xl">From scaffold to deploy in one minute.</h3>
        </div>
        <div class="transcript">
            <div
                v-for="(line, i) in lines"
                :key="i"
                class="transcript-row"
                :class="{
                    'transcript-row--on': i < visible,
                    'transcript-row--accent': line.accent,
                }"
            >
                <span class="transcript-ts">{{ line.ts }}</span>
                <span class="transcript-cmd">$ {{ line.cmd }}</span>
                <span class="transcript-out">→ {{ line.out }}</span>
            </div>
        </div>
    </section>
</template>

<style scoped>
.transcript {
    max-width: 56rem;
    margin: 0 auto;
    border: 1px solid var(--vp-c-divider);
    background: rgba(15, 18, 26, 0.96);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.18);
    padding: 1.25rem 1.5rem;
    font-family: var(--vp-font-family-mono);
    font-size: 0.875rem;
    color: rgba(226, 232, 240, 0.5);
}

.transcript-row {
    display: grid;
    grid-template-columns: 5rem 1fr auto;
    gap: 1rem;
    padding: 0.35rem 0;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
    transition: color 220ms ease;
}

.transcript-row:last-child {
    border-bottom: none;
}

.transcript-row--on {
    color: rgba(226, 232, 240, 0.92);
}

.transcript-row--on.transcript-row--accent {
    color: #7dd3fc;
}

.transcript-ts {
    color: rgba(248, 113, 113, 0.85);
    font-variant-numeric: tabular-nums;
}

.transcript-cmd {
    color: inherit;
}

.transcript-out {
    color: inherit;
    opacity: 0.7;
    text-align: right;
}

@media (max-width: 640px) {
    .transcript-row {
        grid-template-columns: 1fr;
        gap: 0.1rem;
    }

    .transcript-out {
        text-align: left;
    }
}
</style>

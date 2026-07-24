<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";

// FIXME: Are these times correct? We should do a few runs of each of these commands and try
// to get more accurate/correct timings
const lines = [
    {
        ts: "00:01.20",
        cmd: "vpx giget github:pitlane-tools/templates/cloudflare airfoil",
        out: "Scaffolded app",
    },
    // FIXME: Is this package number accurate? We'll know after we create the templates and
    // we can inspect them
    { ts: "00:04.50", cmd: "cd airfoil && vp install", out: "Installed 184 packages" },
    { ts: "00:11.80", cmd: "vpx wrangler d1 create airfoil-db", out: "D1 database provisioned" },
    { ts: "00:12.95", cmd: "vp dev", out: "Dev server running on :1612" },
    {
        ts: "00:20.70",
        cmd: "git push",
        out: "Deployed to https://airfoil.workers.dev",
        accent: true,
    },
];

const HOLD_MS = 2000;

function parseTs(ts) {
    const [mm, rest] = ts.split(":");
    const [ss, hh] = rest.split(".");
    return Number(mm) * 60000 + Number(ss) * 1000 + Number(hh) * 10;
}

function formatTs(ms) {
    const totalHundredths = Math.max(0, Math.floor(ms / 10));
    const mm = Math.floor(totalHundredths / 6000);
    const ss = Math.floor((totalHundredths % 6000) / 100);
    const hh = totalHundredths % 100;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(hh).padStart(2, "0")}`;
}

const targets = lines.map(line => parseTs(line.ts));
const totalMs = targets[targets.length - 1];

const elapsedMs = ref(0);
const sectionRef = ref(null);

const rowsWithState = computed(() => {
    const e = elapsedMs.value;
    const activeIdx = targets.findIndex(t => t > e);
    return lines.map((line, i) => {
        if (activeIdx === -1 || i < activeIdx) {
            return { ...line, state: "locked", display: line.ts };
        }
        if (i === activeIdx) {
            return { ...line, state: "active", display: formatTs(e) };
        }
        return { ...line, state: "future", display: " " };
    });
});

let startTime;
let rafId;

function tick(now) {
    if (startTime === undefined) startTime = now;
    const elapsed = now - startTime;
    if (elapsed >= totalMs + HOLD_MS) {
        startTime = now;
        elapsedMs.value = 0;
    } else {
        elapsedMs.value = elapsed;
    }
    rafId = requestAnimationFrame(tick);
}

function startClock() {
    if (rafId !== undefined) return;
    startTime = undefined;
    rafId = requestAnimationFrame(tick);
}

function stopClock() {
    if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
    }
}

let observer;

onMounted(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
        elapsedMs.value = totalMs;
        return;
    }

    observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                startClock();
            } else {
                stopClock();
            }
        }
    });
    if (sectionRef.value) {
        observer.observe(sectionRef.value);
    }
});

onUnmounted(() => {
    stopClock();
    observer?.disconnect();
});
</script>

<template>
    <section ref="sectionRef" class="wrapper py-14 lg:py-20 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center text-center gap-3 mb-10">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Lap Time
                </span>
            </div>
            <h3 class="text-balance max-w-2xl">From scaffold to deploy in under a minute.</h3>
        </div>
        <div class="transcript">
            <div
                v-for="(row, i) in rowsWithState"
                :key="i"
                class="transcript-row"
                :class="{
                    'transcript-row--locked': row.state === 'locked',
                    'transcript-row--active': row.state === 'active',
                    'transcript-row--accent': row.accent,
                }"
            >
                <span class="transcript-ts">{{ row.display }}</span>
                <span class="transcript-cmd">$ {{ row.cmd }}</span>
                <span class="transcript-out">→ {{ row.out }}</span>
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

.transcript-row--locked,
.transcript-row--active {
    color: rgba(226, 232, 240, 0.92);
}

.transcript-row--locked.transcript-row--accent {
    color: #ff5a61;
    text-shadow: 0 0 18px rgba(255, 90, 97, 0.5);
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

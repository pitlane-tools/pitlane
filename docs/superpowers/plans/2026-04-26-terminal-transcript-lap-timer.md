# TerminalTranscript Live Lap Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing static-timestamp cycle in `TerminalTranscript.vue` with a real-time lap timer where past laps stay locked at their target times, the active lap's timestamp ticks up live, and future laps' timestamps are blank.

**Architecture:** Single-file change. Replace the `visible` cycle with an `elapsedMs` ref driven by `requestAnimationFrame`. A `computed` derives per-row state (`locked` / `active` / `future`) from `elapsedMs`. The rAF loop is gated by an `IntersectionObserver` so it only runs when the section is in view, and resets the clock each time the section re-enters. `prefers-reduced-motion: reduce` short-circuits to render the final locked state.

**Tech Stack:** Vue 3 (`<script setup>`), VitePress, plain JS (no TS in this component). Browser APIs: `requestAnimationFrame`, `IntersectionObserver`, `matchMedia`.

**Verification model:** Same as the rest of this docs site — no unit tests. "Tests" are: load `pnpm docs:dev` at `http://localhost:1337`, scroll to the TerminalTranscript section, eyeball the animation; toggle reduced-motion in DevTools; `pnpm docs:build` must succeed.

**Spec:** [docs/superpowers/specs/2026-04-26-terminal-transcript-lap-timer-design.md](../specs/2026-04-26-terminal-transcript-lap-timer-design.md)

---

## Pre-flight

- [ ] **Step 0.1: Start the dev server in a background process**

```bash
cd /Users/orion/Developer/Libraries/pitlane
pnpm docs:dev
```

Leave it running. Default port is 1337.

- [ ] **Step 0.2: Confirm baseline renders**

Open `http://localhost:1337`, scroll to the "Lap Time" section ("From scaffold to deploy in one minute."). Confirm the current behavior: all 5 rows visible from the start, timestamps `00:00.00` / `00:04.21` / `00:18.07` / `00:22.55` / `00:24.10` shown statically, with a highlight that walks the rows on a ~1.4s interval. That's the starting point we're replacing.

---

## Task 1: Replace cycle with live lap timer

**Files:**
- Modify: `docs/.vitepress/theme/components/TerminalTranscript.vue` (entire file)

This is one cohesive change — script, template, and CSS all need to flip together because the new template binds to a `computed` that doesn't exist in the old script. We'll do it in bite-sized steps and verify at the end.

- [ ] **Step 1.1: Replace the entire `<script setup>` block**

Replace lines 1–27 of [docs/.vitepress/theme/components/TerminalTranscript.vue](../../.vitepress/theme/components/TerminalTranscript.vue) with:

```vue
<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";

const lines = [
    { ts: "00:01.10", cmd: "vp create pitlane my-app", out: "Scaffolded my-app" },
    { ts: "00:04.21", cmd: "cd my-app && vp install", out: "Installed 412 packages" },
    { ts: "00:18.07", cmd: "pitlane resources create", out: "D1, KV, R2, Queue ready" },
    { ts: "00:22.55", cmd: "vp dev", out: "Local server on :1612" },
    {
        ts: "00:24.10",
        cmd: "pitlane deploy",
        out: "Live at https://my-app.workers.dev",
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

const targets = lines.map((line) => parseTs(line.ts));
const totalMs = targets[targets.length - 1];

const elapsedMs = ref(0);
const sectionRef = ref(null);

const rowsWithState = computed(() => {
    const e = elapsedMs.value;
    const activeIdx = targets.findIndex((t) => t > e);
    return lines.map((line, i) => {
        if (activeIdx === -1 || i < activeIdx) {
            return { ...line, state: "locked", display: line.ts };
        }
        if (i === activeIdx) {
            return { ...line, state: "active", display: formatTs(e) };
        }
        return { ...line, state: "future", display: "" };
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

    observer = new IntersectionObserver((entries) => {
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
```

Why this shape:
- `parseTs` / `formatTs` keep the `MM:SS.HH` format consistent with the existing `ts` strings.
- `targets` and `totalMs` are computed once at module scope — the `lines` array is static.
- `rowsWithState` is the single source of truth for the template; no per-row state scattered across multiple refs.
- The rAF loop self-resets after `totalMs + HOLD_MS` (~26.1s) for the next loop.
- `startClock` resets `startTime = undefined` so the next `tick` call rebases — that's how re-entering the viewport restarts from `00:00.00`.

- [ ] **Step 1.2: Replace the `<template>` block**

Replace lines 29–56 (the `<template>...</template>` block) with:

```vue
<template>
    <section
        ref="sectionRef"
        class="wrapper py-14 lg:py-20 px-5 sm:px-10 lg:px-20"
    >
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
```

Changes from the old template:
- `ref="sectionRef"` added to `<section>` so the IntersectionObserver can watch it.
- `v-for` iterates `rowsWithState` (the computed) instead of `lines`.
- Class binding swaps `transcript-row--on` for `transcript-row--locked` / `transcript-row--active`.
- Timestamp slot renders `row.display` instead of `line.ts` — that's how `""` produces a blank slot for future rows while the 5rem grid column reserves the space.

- [ ] **Step 1.3: Update the CSS state classes**

In the `<style scoped>` block, replace:

```css
.transcript-row--on {
    color: rgba(226, 232, 240, 0.92);
}

.transcript-row--on.transcript-row--accent {
    color: #ff5a61;
    text-shadow: 0 0 18px rgba(255, 90, 97, 0.5);
}
```

with:

```css
.transcript-row--locked,
.transcript-row--active {
    color: rgba(226, 232, 240, 0.92);
}

.transcript-row--locked.transcript-row--accent,
.transcript-row--active.transcript-row--accent {
    color: #ff5a61;
    text-shadow: 0 0 18px rgba(255, 90, 97, 0.5);
}
```

Why both `--locked` and `--active` get the bright + accent treatment: the deploy row should be red while it's ticking *and* stay red during the ~2s hold at the end (the celebratory finale). Future rows keep the dim base color from `.transcript` (no class needed).

No other CSS in this file changes. The `.transcript`, `.transcript-row` (base), `.transcript-row:last-child`, `.transcript-ts`, `.transcript-cmd`, `.transcript-out`, and `@media (max-width: 640px)` blocks all stay as-is.

- [ ] **Step 1.4: Reload and verify the animation in the browser**

Hard-reload `http://localhost:1337` and scroll to the "Lap Time" section. Verify the full sequence:

1. **t≈0**: Row 1 active with `00:00.00` ticking up. Rows 2–5 dim, timestamp slots empty (the `5rem` grid column should still reserve the space — commands and outputs aligned).
2. **t≈1.10s**: Row 1 locks at `00:01.10`. Row 2 becomes active and starts ticking from there.
3. **t≈4.21s**: Row 2 locks at `00:04.21`. Row 3 active.
4. **t≈18.07s**: Row 3 locks at `00:18.07`. Row 4 active.
5. **t≈22.55s**: Row 4 locks at `00:22.55`. Row 5 active and red (accent).
6. **t≈24.10s**: Row 5 locks at `00:24.10` and stays red.
7. **t≈26.1s** (~2s hold later): everything resets to step 1 and loops.

Also verify:
- Digit columns don't jitter as the timestamp ticks (tabular-nums working).
- Scroll the section out of view, wait 5 seconds, scroll back. The animation should restart from `00:00.00`, not pick up mid-lap.

If anything is off — wrong row active, timestamp jumping, layout shift, etc. — fix it before continuing.

- [ ] **Step 1.5: Verify reduced-motion fallback**

In Chrome DevTools: `Cmd+Shift+P` → "Show Rendering" → set "Emulate CSS media feature prefers-reduced-motion" to `reduce`. Hard-reload the page.

Expected: all 5 rows visible with all timestamps locked at their final values (`00:01.10`, `00:04.21`, `00:18.07`, `00:22.55`, `00:24.10`) and no animation. Row 5 still red.

Reset the rendering override when done.

- [ ] **Step 1.6: Run the production build**

```bash
cd /Users/orion/Developer/Libraries/pitlane
pnpm docs:build
```

Expected: build completes with no errors. If there are Vue compiler warnings or errors, fix them before committing.

- [ ] **Step 1.7: Commit**

```bash
git add docs/.vitepress/theme/components/TerminalTranscript.vue
git commit -m "TerminalTranscript: live lap timer instead of static cycle"
```

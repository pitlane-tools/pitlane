# TerminalTranscript live lap timer

**Date:** 2026-04-26
**Component:** [docs/.vitepress/theme/components/TerminalTranscript.vue](../../.vitepress/theme/components/TerminalTranscript.vue)

## Problem

The current `TerminalTranscript` renders all five rows with their final timestamps already filled in. A highlight walks the rows on a 1.4s interval, but the timestamps never change. For a section eyebrow'd "Lap Time," the timestamps reading as static defeats the metaphor — there is no lap timing actually happening.

## Goal

Behave like a real lap timer:

- The current (active) lap's timestamp is a live, ticking elapsed-time counter.
- When a lap's target time is reached, that row's timestamp locks in and the next lap becomes active.
- Past laps stay locked at their final times.
- Future laps' timestamps are blank until that lap becomes active.

## Behavior

**Playback:** Real-time (~24s loop). The full sequence runs at the same speed the timestamps imply, so the visible timer is itself the proof of the "in one minute" headline. After the final row locks in, hold ~2s, then reset and loop.

**Data change:** Row 1 (`vp create pitlane my-app`) currently has `ts: "00:00.00"`, which would lock instantly under a lap-timer model. Bump it to `ts: "00:01.10"` so row 1 is a real first lap that ticks from `00:00.00` to `00:01.10` before locking. All other rows keep their existing timestamps. Total run is unchanged at 24.10s.

**Row states (three):**

| State | Trigger | Timestamp | Row appearance |
|---|---|---|---|
| Locked | `elapsed >= row.ts` | Locked at `row.ts` | Full opacity (existing `--on` styling) |
| Active | Smallest-indexed row with `row.ts > elapsed` | Live `elapsed`, ticking up | Full opacity; the final row keeps its `--accent` red treatment when it becomes active |
| Future | All other rows | Empty (blank slot, layout reserved) | Dimmed (existing default styling) — command + output remain readable so the section reads as a complete story |

The rightmost lap row (`pitlane deploy`) keeps its existing accent-red treatment but only once it becomes the active row.

**Counter format:** `MM:SS.HH` (matches existing `ts` format — minutes, seconds, hundredths). Updates via `requestAnimationFrame` for smooth tenths/hundredths rendering. Use `font-variant-numeric: tabular-nums` (already set on `.transcript-ts`) so digits don't jitter.

**Lifecycle:**

- Start the rAF loop on mount, **gated by an IntersectionObserver** so the clock only runs when the section is in the viewport. Reset to `elapsed = 0` each time the section re-enters view (so a returning user sees the run from the start, not mid-lap).
- Honor `prefers-reduced-motion: reduce` — render the final/locked state of every row and never start the rAF loop.
- Cancel the rAF loop and disconnect the observer on unmount.

## Non-goals

- No change to layout, typography, or color tokens beyond what's described above.
- No change to row data beyond the row 1 `ts` bump described in Behavior. Commands, outputs, eyebrow text, and headline are unchanged.
- No change to mobile breakpoint behavior beyond the new active/locked/blank logic applying there too.

## Success criteria

- On first scroll into view, only row 1 is active, its timestamp ticks from `00:00.00` upward, and rows 2–5 show empty timestamps.
- At ~1.10s the row 1 timestamp freezes at `00:01.10` and row 2 becomes the ticking row, ticking up to `00:04.21` before locking.
- The pattern continues through `00:24.10` on the final row, after which the section holds for ~2s and restarts.
- Scrolling the section out of view stops the animation; scrolling back resets to `00:00.00`.
- With reduced motion enabled, all five rows render in their final locked state with no animation.

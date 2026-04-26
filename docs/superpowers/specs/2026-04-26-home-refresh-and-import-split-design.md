# Home page refresh + Pitlane import split

**Date:** 2026-04-26
**Status:** Approved (design)

## Goals

1. Make the docs home page render correctly in both light and dark mode (VitePress toggle), instead of being locked to dark via `theme: dark` frontmatter.
2. Build out the home page from three sections to ten, modeled loosely on
   [`vite-plus`'s home components](https://github.com/voidzero-dev/vite-plus/tree/main/docs/.vitepress/theme/components/home),
   bent toward Pitlane's racing-livery brand identity (the cartoon pit-crew art,
   the wheel gun, the race-track gantry, the `pitlane-combo` lockup).
3. Sweep `docs/` to use the new Pitlane subpath imports, which mirror Remix's
   convention of `*-middleware` packages alongside the runtime modules they
   describe.

## Non-goals

- Updating the actual `pitlane` package source (lives in a separate repo).
- Rewriting `pitlane.md` / `vite-plus.md` at the repo root (reference dumps,
  excluded from VitePress via `srcExclude`).
- New routes, guide pages, or restructured navigation.
- Changing guide *content*. Only the import lines in guides change.

## Theming strategy

Drop `theme: dark` from `docs/index.md` frontmatter so the home page follows the
user's VitePress theme toggle.

Replace every hardcoded `text-white` / `text-white/70` / `bg-[dark]` in the
existing home components with VitePress design tokens via Tailwind:
`text-[var(--vp-c-text-1)]`, `text-[var(--vp-c-text-2)]`, etc. The voidzero
theme already wires those tokens to the `.dark` class — swapping them is a
mechanical pass.

Hero background:

- **Dark mode:** keep `pitlane-race-track.png` as the ambient backdrop (current
  behavior).
- **Light mode:** apply a CSS filter (`grayscale(1) brightness(1.4)`) and reduce
  opacity to ~0.18 over the light page background, so the racing motif persists
  without dragging in dark grandstands.

Brand reds stay as currently configured: `#cd1c22` light / `#ff5a61` dark
(already wired in `custom.css`, no change).

**Component-level rule:** every new component renders default text in
`--vp-c-text-1` and uses `dark:` Tailwind variants only for surfaces (cards,
terminal panels, art frames) where contrast inverts.

## Home page composition (new section order)

1. **Hero** *(existing, retheme)* — tagline + dual CTA + terminal panel. Keep
   structure, theme-aware backdrop.
2. **InstallCommand** *(new)* — single copyable line `npx vp create pitlane
   my-app` with a copy button. Mono font, racing-livery thin red underline
   accent.
3. **Stack3Col** *(new)* — "Remix + Vite+ + Cloudflare". Three columns, each
   with a logo, a one-liner, a `pitlane` connector tag underneath. Anchored
   visually by `pitlane-combo.png` (centered above on mobile, balanced left on
   desktop).
4. **Intro** *(existing, retheme)* — "Why Pitlane" body copy, token swap only.
5. **PrimitivesGrid** *(new, replaces `FeatureGrid.vue`)* — five tiles: D1 / R2
   / KV Sessions / Jobs / Cron. Each tile has a name, a sentence, and a 4–6 line
   code snippet using the new split imports.
6. **TerminalTranscript** *(new)* — animated typewriter-style transcript
   cycling through `vp create` → `vp install` → `pitlane resources create` →
   `vp dev` → `pitlane deploy`. JetBrains Mono, lap-time-style timestamps
   prefixed (`00:00.00 $ vp create...`).
7. **OperationsArt** *(new)* — full-width section featuring
   `pitlane-racecar.png` (cartoon pit crew). Right-side copy: "Platform ops at
   pit-crew speed." Two-column on desktop, stacked on mobile.
8. **ProductivityStats** *(new)* — racing-timer aesthetic stat row:
   `1` config file · `5` platform primitives · `0` wrangler.toml hand-edits ·
   `<5s` to first deploy. Big mono digits, tabular nums, red leading dot.
9. **PartnerLogos** *(new)* — small "Built with" row: Remix · Vite+ · Cloudflare
   logos in muted grey, terminated by a checkered-flag horizontal divider.
10. **Footer CTA** *(existing)* — "Start with Pitlane".

### Racing-livery accents (the "C" treatment)

These are the parts most likely to need dialing back to the milder "B"
treatment if the result feels like a parody site:

- Checkered-flag pattern (CSS `linear-gradient` checker) as a 4px-tall divider
  between sections 5↔6 and 9↔10.
- Red (`var(--vp-c-brand-1)`) leading-bar accent on each section heading
  (24×3px bar to the left of the eyebrow text).
- Tabular monospaced numerals on stats with a leading dot (`·`) styled like a
  timing display.

If we need to roll back, the smallest reversion is: delete the
`CheckerDivider.vue` component, drop the leading red bar from section eyebrows,
and replace `ProductivityStats` lap-timer styling with a plain stat row.

## Pitlane import split

The new shape splits today's catch-all `pitlane/platform` runtime imports across
seven subpaths, mirroring Remix's convention of `*-middleware` packages
alongside the runtime modules they describe.

| Symbol | Kind | New source |
|---|---|---|
| `database` | middleware accessor | `pitlane/data-table-middleware` |
| `Database` | type | `remix/data-table` *(Remix, not Pitlane)* |
| `fileStorage` | middleware accessor | `pitlane/file-storage-middleware` |
| `FileStorage` | context key value (`createContextKey<R2FileStorage>()`) | `pitlane/file-storage` |
| `R2FileStorage` | class | `pitlane/file-storage` |
| `createKvSessionStorage` | factory | `pitlane/session-storage` |
| `createJobs`, `createJobQueue`, `Scheduler` | jobs API | `pitlane/jobs` |
| `scheduler` | middleware accessor | `pitlane/jobs-middleware` |
| `createCron` | factory | `pitlane/cron` |
| `remix`, `platform` | Vite plugins | unchanged |

Note that `Database` does not move from `pitlane/platform` to a new Pitlane
subpath — it is a Remix type and re-imports from `remix/data-table`. By
contrast, `FileStorage` is a Pitlane-owned runtime context key (because Remix's
`FileStorage` is interface-only and cannot be used as a middleware key), so it
ships from `pitlane/file-storage` alongside the `R2FileStorage` impl.

### Sweep targets

Per "full sweep through `docs/`" decision:

- `docs/guides/getting-started.md`
- `docs/guides/configuration.md`
- `docs/guides/platform-primitives.md`
- `docs/guides/vite-plus.md`
- `docs/superpowers/specs/2026-04-26-pitlane-docs-site-design.md`
- `docs/superpowers/plans/2026-04-26-pitlane-docs-site.md`
- New home components (`PrimitivesGrid.vue` snippets)

## File plan

### Edits

- `docs/index.md` — remove `theme: dark` frontmatter line.
- `docs/.vitepress/theme/layouts/Home.vue` — replace component imports and
  ordering to match new composition.
- `docs/.vitepress/theme/components/Hero.vue` — swap hardcoded `text-white*`
  for VP tokens; add light-mode race-track filter.
- `docs/.vitepress/theme/components/Intro.vue` — same token swap.
- `docs/.vitepress/theme/custom.css` — add `.checker-divider`, `.lap-stat`,
  `.section-eyebrow-bar` utilities; light-mode hero-bg filter; remove the
  unused `--vp-home-hero-image-background-image` declaration.
- `docs/guides/getting-started.md` — rewrite imports to split shape.
- `docs/guides/configuration.md` — same.
- `docs/guides/platform-primitives.md` — same (largest set of edits, five
  primitive sections).
- `docs/guides/vite-plus.md` — same.
- `docs/superpowers/specs/2026-04-26-pitlane-docs-site-design.md` — same.
- `docs/superpowers/plans/2026-04-26-pitlane-docs-site.md` — same.

### Adds

- `docs/.vitepress/theme/components/InstallCommand.vue`
- `docs/.vitepress/theme/components/Stack3Col.vue`
- `docs/.vitepress/theme/components/PrimitivesGrid.vue`
- `docs/.vitepress/theme/components/TerminalTranscript.vue`
- `docs/.vitepress/theme/components/OperationsArt.vue`
- `docs/.vitepress/theme/components/ProductivityStats.vue`
- `docs/.vitepress/theme/components/PartnerLogos.vue`
- `docs/.vitepress/theme/components/CheckerDivider.vue`

### Deletes

- `docs/.vitepress/theme/components/FeatureGrid.vue` — superseded by
  `PrimitivesGrid.vue` (only consumer is `Home.vue`).

## Verification

- Run `pnpm docs:dev` and manually toggle light/dark in the VP UI. Every section
  must render legibly in both modes.
- Visit `/`, scroll the full home page in both modes, and check each new
  section.
- `grep -rn 'from "pitlane/platform"' docs/` should return only the
  `platform()` Vite plugin import (config-time use), with no runtime symbol
  imports left at that path.
- `pnpm docs:build` must succeed with no Vue or markdown errors.

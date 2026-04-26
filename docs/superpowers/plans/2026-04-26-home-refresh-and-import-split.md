# Home Refresh and Import Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add light/dark mode support to the docs home page, expand the home from three sections to ten in the style of vite-plus's home, and sweep `docs/` to use Pitlane's new Remix-style subpath imports.

**Architecture:** Edit existing home components to use VitePress design tokens instead of hardcoded white text. Add eight new Vue components in `docs/.vitepress/theme/components/`. Rewire `Home.vue` to compose them in the new order. Mechanical find-and-replace across all guides + spec/plan files for the import shape change.

**Tech Stack:** Vue 3 (`<script setup>`), VitePress, Tailwind (provided by `@voidzero-dev/vitepress-theme`), JetBrains Mono / Inter / Montserrat fonts, the existing `pitlane-*` PNG assets in `docs/public/media/`.

**Verification model:** This is a docs site, not a unit-tested codebase. "Tests" are: load `pnpm docs:dev` at `http://localhost:1337`, toggle the theme switcher, eyeball each section in both modes; grep for leftover old imports; `pnpm docs:build` must succeed.

---

## Pre-flight

- [ ] **Step 0.1: Start the dev server in a background process**

```bash
cd /Users/orion/Developer/Libraries/pitlane
pnpm docs:dev
```

Leave it running. The default port is 1337. Reload the browser after each change.

- [ ] **Step 0.2: Confirm baseline renders**

Open `http://localhost:1337` and confirm the existing home page (Hero + Intro + FeatureGrid + Footer) loads. Note the current locked-dark appearance — that's the starting point.

---

## Phase 1: Theming foundation

### Task 1: Drop forced-dark frontmatter

**Files:**
- Modify: `docs/index.md`

- [ ] **Step 1.1: Remove `theme: dark`**

Edit `docs/index.md` to:

```markdown
---
title: Pitlane
titleTemplate: Platform integration for Remix 3
layout: home
---
```

- [ ] **Step 1.2: Verify theme toggle works**

Reload `http://localhost:1337`. Click the theme toggle in the VitePress nav. Confirm the *outer* page chrome (header, footer area outside the home slot) flips between light and dark. The home content itself will still look broken — that's expected, fixed in the next tasks.

- [ ] **Step 1.3: Commit**

```bash
git add docs/index.md
git commit -m "Unlock home page from forced dark theme"
```

### Task 2: Theme-aware Hero

**Files:**
- Modify: `docs/.vitepress/theme/components/Hero.vue`

- [ ] **Step 2.1: Replace hardcoded text colors and add light-mode background filter**

Replace the entire contents of `docs/.vitepress/theme/components/Hero.vue` with:

```vue
<template>
    <div class="wrapper wrapper--ticks grid md:grid-cols-2 w-full border-nickel divide-x">
        <div class="flex flex-col p-10 justify-center items-center md:items-start">
            <div
                class="flex flex-col gap-5 max-w-[31rem] text-center md:text-left items-center md:items-start"
            >
                <h1 class="text-pretty">Pitlane</h1>
                <p class="text-lg max-w-[28rem] text-pretty opacity-80">
                    Platform integration for Remix 3 apps running on Cloudflare, built around Vite+,
                    explicit config, and typed runtime primitives.
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
        url("/media/pitlane-race-track.png");
    background-size: cover;
    background-position: center;
}

:root:not(.dark) .hero-background {
    background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.7), rgba(245, 245, 248, 0.55)),
        url("/media/pitlane-race-track.png");
    background-size: cover;
    background-position: center;
    filter: saturate(0.2);
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

:root:not(.dark) .terminal-panel {
    border-color: rgba(120, 16, 19, 0.18);
    background: rgba(15, 18, 26, 0.94);
    box-shadow: 0 24px 60px rgba(120, 16, 19, 0.12);
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
```

- [ ] **Step 2.2: Eyeball both modes**

Reload the dev server. Hero text should be readable in both modes. Light mode shows a muted/desaturated race track behind the terminal; dark mode shows the original ambient track. Terminal panel stays dark (intentional — terminals are dark surfaces).

- [ ] **Step 2.3: Commit**

```bash
git add docs/.vitepress/theme/components/Hero.vue
git commit -m "Theme-aware hero with light-mode race-track filter"
```

### Task 3: Theme-aware Intro

**Files:**
- Modify: `docs/.vitepress/theme/components/Intro.vue`

- [ ] **Step 3.1: Swap `text-white` for default text**

Replace the entire contents of `docs/.vitepress/theme/components/Intro.vue` with:

```vue
<template>
    <div class="wrapper wrapper--ticks border-t py-14 lg:py-30 px-5 sm:px-10 lg:px-20">
        <div
            class="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-5 lg:gap-8 text-left"
        >
            <div class="flex flex-col gap-3 max-w-md">
                <div class="section-eyebrow">
                    <span class="section-eyebrow-bar" />
                    <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                        Why Pitlane
                    </span>
                </div>
                <h3 class="max-w-xl text-balance">
                    Cloudflare primitives that fit Remix instead of fighting it.
                </h3>
                <a href="/guides/vite-plus" class="button w-fit mt-8 hidden lg:block">
                    Learn the workflow
                </a>
            </div>
            <div class="lg:max-w-lg">
                <p class="text-pretty mb-5 opacity-85">
                    Pitlane keeps the platform visible and typed. Configure resources in
                    <code>platform()</code>, let Pitlane generate Wrangler config and worker types,
                    then read D1, R2, KV sessions, queues, and cron through explicit Remix
                    middleware.
                </p>
                <p class="text-pretty opacity-85">
                    Vite+ runs the application lifecycle. Pitlane handles the Cloudflare platform
                    work around it: provisioning, migrations, secrets, generated configuration, and
                    deploys.
                </p>
                <a href="/guides/vite-plus" class="button w-fit mt-8 block lg:hidden">
                    Learn the workflow
                </a>
            </div>
        </div>
    </div>
</template>
```

- [ ] **Step 3.2: Eyeball both modes**

Reload. Intro section is legible in both light and dark.

- [ ] **Step 3.3: Commit**

```bash
git add docs/.vitepress/theme/components/Intro.vue
git commit -m "Theme-aware Intro with eyebrow accent bar"
```

### Task 4: CSS utilities for racing-livery accents

**Files:**
- Modify: `docs/.vitepress/theme/custom.css`

- [ ] **Step 4.1: Append racing-livery utilities and remove unused hero-image gradient**

Open `docs/.vitepress/theme/custom.css`. Remove these two lines (they're for VitePress's default hero, which we don't use):

```css
    --vp-home-hero-image-background-image: linear-gradient(-45deg, #0f766e 50%, #0e7490 50%);

    --vp-home-hero-image-filter: blur(75px);
```

Then append the following at the bottom of the file:

```css
/* Racing-livery accents */
.section-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
}

.section-eyebrow-bar {
    display: inline-block;
    width: 24px;
    height: 3px;
    background: var(--vp-c-brand-1);
}

.checker-divider {
    display: block;
    width: 100%;
    height: 4px;
    background-image:
        linear-gradient(45deg, var(--vp-c-text-1) 25%, transparent 25%),
        linear-gradient(-45deg, var(--vp-c-text-1) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, var(--vp-c-text-1) 75%),
        linear-gradient(-45deg, transparent 75%, var(--vp-c-text-1) 75%);
    background-size: 8px 8px;
    background-position:
        0 0,
        0 4px,
        4px -4px,
        -4px 0;
    opacity: 0.55;
}

.lap-stat {
    font-family: var(--vp-font-family-mono);
    font-feature-settings: "tnum" 1;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
}

.lap-stat__dot {
    color: var(--vp-c-brand-1);
    margin-right: 0.4em;
}
```

- [ ] **Step 4.2: Verify it compiles**

The dev server should HMR. No errors in the terminal running `pnpm docs:dev`. The eyebrow bar in the Intro section now shows a small red bar to the left of "Why Pitlane".

- [ ] **Step 4.3: Commit**

```bash
git add docs/.vitepress/theme/custom.css
git commit -m "Racing-livery CSS utilities + remove unused hero-image vars"
```

---

## Phase 2: Import sweep

The new shape per the design spec:

| Symbol | New source |
|---|---|
| `database` | `pitlane/data-table-middleware` |
| `Database` | `remix/data-table` *(Remix, not Pitlane — `Database` is a context key value owned by Remix)* |
| `fileStorage` | `pitlane/file-storage-middleware` |
| `FileStorage` | `pitlane/file-storage` *(Pitlane-owned context key value)* |
| `R2FileStorage` | `pitlane/file-storage` |
| `createKvSessionStorage` | `pitlane/session-storage` |
| `Scheduler`, `createJobs`, `createJobQueue` | `pitlane/jobs` |
| `scheduler` | `pitlane/jobs-middleware` |
| `createCron` | `pitlane/cron` |
| `remix`, `platform` | unchanged |

### Task 5: Rewrite `platform-primitives.md` imports

**Files:**
- Modify: `docs/guides/platform-primitives.md`

- [ ] **Step 5.1: Update Database section import (line 14)**

Change:

```ts
import { database, Database } from "pitlane/platform";
```

to:

```ts
import { Database } from "remix/data-table";
import { database } from "pitlane/data-table-middleware";
```

- [ ] **Step 5.2: Update File Storage section import (line 34)**

Change:

```ts
import { fileStorage, FileStorage } from "pitlane/platform";
```

to:

```ts
import { FileStorage } from "pitlane/file-storage";
import { fileStorage } from "pitlane/file-storage-middleware";
```

- [ ] **Step 5.3: Update Sessions section import (line 57)**

Change:

```ts
import { createKvSessionStorage } from "pitlane/platform";
```

to:

```ts
import { createKvSessionStorage } from "pitlane/session-storage";
```

- [ ] **Step 5.4: Update Jobs section import (line 87)**

Change:

```ts
import { createJobs, createJobQueue, scheduler, Scheduler } from "pitlane/platform";
```

to:

```ts
import { createJobs, createJobQueue, Scheduler } from "pitlane/jobs";
import { scheduler } from "pitlane/jobs-middleware";
```

- [ ] **Step 5.5: Update Cron section import (line 141)**

Change:

```ts
import { createCron } from "pitlane/platform";
```

to:

```ts
import { createCron } from "pitlane/cron";
```

- [ ] **Step 5.6: Verify**

```bash
grep -n 'from "pitlane/' docs/guides/platform-primitives.md
```

Expected output (no `pitlane/platform` lines, only the new subpaths):

```
14:import { database } from "pitlane/data-table-middleware";
34:import { FileStorage } from "pitlane/file-storage";
35:import { fileStorage } from "pitlane/file-storage-middleware";
56:import { createKvSessionStorage } from "pitlane/session-storage";
86:import { createJobs, createJobQueue, Scheduler } from "pitlane/jobs";
87:import { scheduler } from "pitlane/jobs-middleware";
140:import { createCron } from "pitlane/cron";
```

(Line numbers may differ slightly depending on whether the import was one line or two.)

- [ ] **Step 5.7: Commit**

```bash
git add docs/guides/platform-primitives.md
git commit -m "Split Pitlane imports in platform-primitives guide"
```

### Task 6: Verify other guides have no runtime imports to rewrite

**Files:**
- Read-only: `docs/guides/getting-started.md`, `docs/guides/configuration.md`, `docs/guides/vite-plus.md`

- [ ] **Step 6.1: Grep guides for `pitlane/platform` runtime symbols**

```bash
grep -n 'from "pitlane/platform"' docs/guides/getting-started.md docs/guides/configuration.md docs/guides/vite-plus.md
```

Expected: only lines that import the `platform` *Vite plugin* (the function used inside `defineConfig({ plugins: [...] })`). Those imports stay.

- [ ] **Step 6.2: Confirm no changes needed**

The three files only import `{ platform }` from `pitlane/platform` (the Vite plugin) and `{ remix }` from `pitlane/remix`. Both stay. No edits in this task.

### Task 7: Sweep historical specs and plans

**Files:**
- Modify: `docs/superpowers/specs/2026-04-26-pitlane-docs-site-design.md`
- Modify: `docs/superpowers/plans/2026-04-26-pitlane-docs-site.md`

- [ ] **Step 7.1: Apply the same five rewrites to each historical doc**

For each file, do the same five textual rewrites as Task 5 (Database / FileStorage / Sessions / Jobs / Cron). Use grep to locate them first:

```bash
grep -n 'from "pitlane/platform"' docs/superpowers/specs/2026-04-26-pitlane-docs-site-design.md docs/superpowers/plans/2026-04-26-pitlane-docs-site.md
```

For each match that imports a runtime symbol (`database`, `Database`, `fileStorage`, `FileStorage`, `createKvSessionStorage`, `createJobs`, `createJobQueue`, `scheduler`, `Scheduler`, `createCron`), rewrite it using the mapping in Task 5. Leave imports of the `platform` Vite plugin alone.

- [ ] **Step 7.2: Verify**

```bash
grep -n 'from "pitlane/platform"' docs/superpowers/specs/2026-04-26-pitlane-docs-site-design.md docs/superpowers/plans/2026-04-26-pitlane-docs-site.md | grep -v 'platform[ ,}]' | grep -v '{ platform '
```

Should print nothing — all remaining `pitlane/platform` imports are for the Vite plugin.

- [ ] **Step 7.3: Commit**

```bash
git add docs/superpowers/specs/2026-04-26-pitlane-docs-site-design.md docs/superpowers/plans/2026-04-26-pitlane-docs-site.md
git commit -m "Split Pitlane imports in historical spec and plan"
```

---

## Phase 3: Shared component

### Task 8: CheckerDivider component

**Files:**
- Create: `docs/.vitepress/theme/components/CheckerDivider.vue`

- [ ] **Step 8.1: Create the component**

```vue
<template>
    <div class="checker-wrap">
        <span class="checker-divider" />
    </div>
</template>

<style scoped>
.checker-wrap {
    display: block;
    width: 100%;
    padding: 0;
    line-height: 0;
}
</style>
```

(The `.checker-divider` style was added to `custom.css` in Task 4.)

- [ ] **Step 8.2: Commit**

```bash
git add docs/.vitepress/theme/components/CheckerDivider.vue
git commit -m "CheckerDivider component"
```

---

## Phase 4: New home sections (one component per task)

### Task 9: InstallCommand

**Files:**
- Create: `docs/.vitepress/theme/components/InstallCommand.vue`

- [ ] **Step 9.1: Create the component**

```vue
<script setup>
import { ref } from "vue";

const command = "npx vp create pitlane my-app";
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
            <p class="opacity-70 text-sm">
                Scaffolds a Remix 3 app wired for Vite+ and Pitlane on Cloudflare.
            </p>
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

.install-row::after {
    content: "";
    position: absolute;
    left: 1rem;
    right: 1rem;
    bottom: -2px;
    height: 2px;
    background: var(--vp-c-brand-1);
    opacity: 0.85;
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
```

- [ ] **Step 9.2: Commit**

```bash
git add docs/.vitepress/theme/components/InstallCommand.vue
git commit -m "InstallCommand component with copy button"
```

### Task 10: Stack3Col

**Files:**
- Create: `docs/.vitepress/theme/components/Stack3Col.vue`

- [ ] **Step 10.1: Create the component**

```vue
<template>
    <section class="wrapper wrapper--ticks border-t py-14 lg:py-20 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center text-center gap-3 mb-12">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    The Stack
                </span>
            </div>
            <h3 class="text-balance max-w-xl">
                One stack: Remix runtime, Vite+ tooling, Cloudflare platform.
            </h3>
        </div>
        <div class="grid gap-6 md:grid-cols-3">
            <div class="stack-card">
                <h5 class="stack-title">Remix 3</h5>
                <p class="stack-body">
                    Routing, middleware, and the runtime contract your app actually runs on.
                </p>
                <span class="stack-tag">runtime</span>
            </div>
            <div class="stack-card stack-card--accent">
                <h5 class="stack-title">Vite+</h5>
                <p class="stack-body">
                    Unified `vp` workflow for create, install, dev, check, test, build, preview.
                </p>
                <span class="stack-tag">tooling</span>
            </div>
            <div class="stack-card">
                <h5 class="stack-title">Cloudflare</h5>
                <p class="stack-body">
                    Workers, D1, R2, KV, queues, and cron — bound through typed config.
                </p>
                <span class="stack-tag">platform</span>
            </div>
        </div>
        <div class="flex justify-center mt-12">
            <img
                src="/media/pitlane-combo.png"
                alt="Pitlane = Remix + Vite+ + Cloudflare"
                class="combo-art"
            />
        </div>
    </section>
</template>

<style scoped>
.stack-card {
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    position: relative;
}

.stack-card--accent::before {
    content: "";
    position: absolute;
    inset: 0 auto auto 0;
    width: 4px;
    height: 100%;
    background: var(--vp-c-brand-1);
}

.stack-title {
    font-weight: 700;
    color: var(--vp-c-text-1);
}

.stack-body {
    color: var(--vp-c-text-2);
    line-height: 1.55;
}

.stack-tag {
    font-family: var(--vp-font-family-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vp-c-text-3);
    margin-top: auto;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--vp-c-divider);
}

.combo-art {
    max-width: min(540px, 80%);
    height: auto;
    border: 1px solid var(--vp-c-divider);
    background: #000;
}

:root:not(.dark) .combo-art {
    opacity: 0.92;
}
</style>
```

- [ ] **Step 10.2: Commit**

```bash
git add docs/.vitepress/theme/components/Stack3Col.vue
git commit -m "Stack3Col component anchored by pitlane-combo art"
```

### Task 11: PrimitivesGrid (replaces FeatureGrid)

**Files:**
- Create: `docs/.vitepress/theme/components/PrimitivesGrid.vue`

- [ ] **Step 11.1: Create the component**

Snippets in this component MUST use the new split-import shape from Phase 2.

```vue
<template>
    <section class="wrapper wrapper--ticks border-t py-14 lg:py-20 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center text-center gap-3 mb-12">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Primitives
                </span>
            </div>
            <h3 class="text-balance max-w-2xl">
                Five typed primitives, each one middleware away.
            </h3>
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
            <article class="prim-card">
                <header class="prim-head">
                    <h5>D1 Database</h5>
                    <span class="prim-tag">data-table</span>
                </header>
                <pre class="prim-code"><code>import { Database } from "remix/data-table";
import { database } from "pitlane/data-table-middleware";

router.use(database(env.DB));
let db = ctx.get(Database);</code></pre>
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>R2 File Storage</h5>
                    <span class="prim-tag">file-storage</span>
                </header>
                <pre class="prim-code"><code>import { FileStorage } from "pitlane/file-storage";
import { fileStorage } from "pitlane/file-storage-middleware";

router.use(fileStorage(env.FILES));
let files = ctx.get(FileStorage);</code></pre>
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>KV Sessions</h5>
                    <span class="prim-tag">session-storage</span>
                </header>
                <pre class="prim-code"><code>import { createKvSessionStorage } from "pitlane/session-storage";

let storage = createKvSessionStorage(env.SESSIONS, {
    keyPrefix: "session:",
    ttl: 60 * 60 * 24,
});</code></pre>
            </article>

            <article class="prim-card">
                <header class="prim-head">
                    <h5>Queues + Jobs</h5>
                    <span class="prim-tag">jobs</span>
                </header>
                <pre class="prim-code"><code>import { createJobs, Scheduler } from "pitlane/jobs";
import { scheduler } from "pitlane/jobs-middleware";

router.use(scheduler(jobs));
let queue = ctx.get(Scheduler);</code></pre>
            </article>

            <article class="prim-card prim-card--wide">
                <header class="prim-head">
                    <h5>Cron</h5>
                    <span class="prim-tag">cron</span>
                </header>
                <pre class="prim-code"><code>import { createCron } from "pitlane/cron";

let cron = createCron({
    "0 * * * *": { handle: refreshHourlyData },
});

export default { scheduled: cron.handler };</code></pre>
            </article>
        </div>
    </section>
</template>

<style scoped>
.prim-card {
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.prim-card--wide {
    grid-column: 1 / -1;
}

.prim-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px dashed var(--vp-c-divider);
    padding-bottom: 0.5rem;
}

.prim-head h5 {
    font-weight: 700;
    color: var(--vp-c-text-1);
}

.prim-tag {
    font-family: var(--vp-font-family-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--vp-c-brand-1);
}

.prim-code {
    font-family: var(--vp-font-family-mono);
    font-size: 0.8rem;
    line-height: 1.55;
    color: var(--vp-c-text-2);
    background: var(--vp-c-bg);
    padding: 0.85rem 1rem;
    overflow-x: auto;
    border: 1px solid var(--vp-c-divider);
    margin: 0;
}
</style>
```

- [ ] **Step 11.2: Commit**

```bash
git add docs/.vitepress/theme/components/PrimitivesGrid.vue
git commit -m "PrimitivesGrid with split-import code snippets per primitive"
```

### Task 12: TerminalTranscript

**Files:**
- Create: `docs/.vitepress/theme/components/TerminalTranscript.vue`

- [ ] **Step 12.1: Create the component**

```vue
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
```

- [ ] **Step 12.2: Commit**

```bash
git add docs/.vitepress/theme/components/TerminalTranscript.vue
git commit -m "TerminalTranscript with lap-time aesthetic typewriter cycle"
```

### Task 13: OperationsArt

**Files:**
- Create: `docs/.vitepress/theme/components/OperationsArt.vue`

- [ ] **Step 13.1: Create the component**

```vue
<template>
    <section
        class="wrapper wrapper--ticks border-t grid lg:grid-cols-2 divide-x divide-nickel"
    >
        <div class="art-pane">
            <img
                src="/media/pitlane-racecar.png"
                alt="Pitlane pit crew servicing a Pitlane-branded race car"
                class="art-img"
            />
        </div>
        <div class="copy-pane flex flex-col justify-center gap-4 p-8 sm:p-12 lg:p-16">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Platform Ops
                </span>
            </div>
            <h3 class="text-balance max-w-md">Platform ops at pit-crew speed.</h3>
            <p class="opacity-85 max-w-md">
                <code>pitlane resources create</code> reads <code>platform()</code> and provisions
                D1, KV, R2, queues, and cron triggers in one pass.
                <code>pitlane db migrate</code> runs pending D1 migrations.
                <code>pitlane secrets push</code> syncs secrets from <code>.dev.vars</code> to
                Wrangler. <code>pitlane deploy</code> ties it all together.
            </p>
            <a href="/guides/cli" class="button w-fit mt-4">CLI reference</a>
        </div>
    </section>
</template>

<style scoped>
.art-pane {
    position: relative;
    background:
        radial-gradient(circle at 30% 30%, rgba(205, 28, 34, 0.08), transparent 65%),
        var(--vp-c-bg-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 2rem;
    min-height: 22rem;
}

.art-img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.18);
}

:root:not(.dark) .art-img {
    box-shadow: 0 30px 60px rgba(120, 16, 19, 0.14);
}
</style>
```

- [ ] **Step 13.2: Commit**

```bash
git add docs/.vitepress/theme/components/OperationsArt.vue
git commit -m "OperationsArt section with cartoon pit-crew art"
```

### Task 14: ProductivityStats

**Files:**
- Create: `docs/.vitepress/theme/components/ProductivityStats.vue`

- [ ] **Step 14.1: Create the component**

```vue
<template>
    <section class="wrapper wrapper--ticks border-t py-14 lg:py-20 px-5 sm:px-10 lg:px-20">
        <div class="flex flex-col items-center text-center gap-3 mb-12">
            <div class="section-eyebrow">
                <span class="section-eyebrow-bar" />
                <span class="text-xs font-medium font-mono uppercase tracking-wide opacity-70">
                    Pole Position
                </span>
            </div>
            <h3 class="text-balance max-w-xl">A short setup, a long straight.</h3>
        </div>

        <div class="stats">
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>1
                </div>
                <div class="stat-label">Config file (<code>vite.config.ts</code>)</div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>5
                </div>
                <div class="stat-label">Platform primitives</div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>0
                </div>
                <div class="stat-label">Hand-edited <code>wrangler.toml</code> files</div>
            </div>
            <div class="stat">
                <div class="lap-stat stat-value">
                    <span class="lap-stat__dot">·</span>&lt;1m
                </div>
                <div class="stat-label">From scaffold to deploy</div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.stats {
    display: grid;
    gap: 2rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 900px) {
    .stats {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
}

.stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
    padding: 1.25rem;
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
}

.stat-value {
    font-size: 3rem;
    line-height: 1;
    color: var(--vp-c-text-1);
}

.stat-label {
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
}
</style>
```

- [ ] **Step 14.2: Commit**

```bash
git add docs/.vitepress/theme/components/ProductivityStats.vue
git commit -m "ProductivityStats lap-timer stat row"
```

### Task 15: PartnerLogos

**Files:**
- Create: `docs/.vitepress/theme/components/PartnerLogos.vue`

- [ ] **Step 15.1: Create the component**

```vue
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
```

- [ ] **Step 15.2: Commit**

```bash
git add docs/.vitepress/theme/components/PartnerLogos.vue
git commit -m "PartnerLogos row with checkered-flag divider"
```

---

## Phase 5: Wire-up and cleanup

### Task 16: Recompose Home.vue and remove old FeatureGrid

**Files:**
- Modify: `docs/.vitepress/theme/layouts/Home.vue`
- Delete: `docs/.vitepress/theme/components/FeatureGrid.vue`

- [ ] **Step 16.1: Replace Home.vue with the new composition**

Replace the entire contents of `docs/.vitepress/theme/layouts/Home.vue` with:

```vue
<script setup>
import Footer from "@components/oss/Footer.vue";
import Spacer from "@components/shared/Spacer.vue";

import CheckerDivider from "../components/CheckerDivider.vue";
import Hero from "../components/Hero.vue";
import InstallCommand from "../components/InstallCommand.vue";
import Intro from "../components/Intro.vue";
import OperationsArt from "../components/OperationsArt.vue";
import PartnerLogos from "../components/PartnerLogos.vue";
import PrimitivesGrid from "../components/PrimitivesGrid.vue";
import ProductivityStats from "../components/ProductivityStats.vue";
import Stack3Col from "../components/Stack3Col.vue";
import TerminalTranscript from "../components/TerminalTranscript.vue";
</script>

<template>
    <Hero />
    <InstallCommand />
    <Stack3Col />
    <Intro />
    <PrimitivesGrid />
    <CheckerDivider />
    <TerminalTranscript />
    <OperationsArt />
    <ProductivityStats />
    <PartnerLogos />
    <Spacer />
    <Footer
        heading="Start with Pitlane"
        subheading="Create a Remix 3 app, configure Cloudflare resources, and deploy through the same Vite+ workflow you use every day."
        button-text="Get started"
        button-link="/guides/getting-started"
    />
</template>
```

(Note: the previous version imported `HeadingSection` from the voidzero theme. We dropped it because each new section now carries its own eyebrow + heading.)

- [ ] **Step 16.2: Delete the old FeatureGrid component**

```bash
rm docs/.vitepress/theme/components/FeatureGrid.vue
```

- [ ] **Step 16.3: Reload and walk through the page in both modes**

Reload `http://localhost:1337`. Scroll the full page top to bottom. Toggle theme. Scroll again. Note any sections that are illegible, broken, or that drift from the design intent.

- [ ] **Step 16.4: Commit**

```bash
git add docs/.vitepress/theme/layouts/Home.vue docs/.vitepress/theme/components/FeatureGrid.vue
git commit -m "Compose new home page sections; remove old FeatureGrid"
```

### Task 17: Final verification

- [ ] **Step 17.1: Confirm no leftover catch-all runtime imports**

```bash
grep -rn 'from "pitlane/platform"' docs/
```

Expected: every match should be the *Vite plugin* import (e.g. `import { platform } from "pitlane/platform"` inside `defineConfig({ plugins: [...] })`). No runtime symbols (`database`, `Database`, `fileStorage`, `FileStorage`, `createKvSessionStorage`, `createJobs`, `createJobQueue`, `Scheduler`, `scheduler`, `createCron`) should be imported from `pitlane/platform` anywhere.

- [ ] **Step 17.2: Production build**

Stop the dev server. Run:

```bash
pnpm docs:build
```

Expected: `vitepress build docs` completes with no errors. Warnings about `<style scoped>` are fine.

- [ ] **Step 17.3: Serve the built site and re-verify**

```bash
pnpm docs:serve
```

Open `http://localhost:1337`. Toggle theme. Confirm the static build matches the dev-server appearance — particularly the InstallCommand copy button (clipboard API), the TerminalTranscript animation, and the racing-livery accents.

- [ ] **Step 17.4: Final commit if any tweaks were needed**

If steps 17.1–17.3 surfaced issues, fix them inline and commit:

```bash
git add -p
git commit -m "Polish: <describe fix>"
```

If everything passed, no commit needed.

---

## Reversion plan (if "C" is too much)

Per the design doc, the racing-livery accents are the bits most likely to need dialing back. To revert from "C" to "B":

1. Delete `CheckerDivider.vue` and remove its references from `PartnerLogos.vue` and `Home.vue`.
2. Remove `.section-eyebrow-bar` from each component's eyebrow (or hide it via CSS).
3. In `ProductivityStats.vue`, replace the lap-timer styling (large mono digits with `·` dot) with a plain stat row.
4. Remove the racing-stripe `::after` accent from `InstallCommand.vue`.

These changes are isolated; no logic depends on them.

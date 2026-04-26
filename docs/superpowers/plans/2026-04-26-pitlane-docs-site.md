# Pitlane Documentation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite+-driven VitePress documentation site for Pitlane, written for early adopters using Pitlane as a realized Remix 3 + Cloudflare platform toolkit.

**Architecture:** Keep the existing `docs/` VitePress app and VoidZero theme, then replace the template content with Pitlane-specific navigation, home-page copy, and user guides. Add root Vite+ project files so all docs workflows run through `vp run`, while Pitlane docs describe Vite+ as the expected project lifecycle tool and `pitlane` as the Cloudflare platform tool.

**Tech Stack:** Vite+, VitePress, `@voidzero-dev/vitepress-theme`, Vue single-file components, Markdown.

---

## File Structure

- Create `package.json`: root private project metadata, docs scripts, and VitePress/VoidZero dependencies.
- Create `vite.config.ts`: Vite+ configuration for formatting and linting.
- Create `.gitignore`: ignore dependencies, VitePress cache, and VitePress build output.
- Modify `docs/.vitepress/config.ts`: Pitlane title, nav, sidebar, favicon, social link, and markdown plugin config.
- Modify `docs/.vitepress/theme/index.ts`: Pitlane logo alt text and remove placeholder project naming.
- Modify `docs/.vitepress/theme/components/Hero.vue`: Pitlane hero copy and calls to action.
- Modify `docs/.vitepress/theme/components/Intro.vue`: practical product introduction for Remix 3 and Cloudflare developers.
- Modify `docs/.vitepress/theme/components/FeatureGrid.vue`: Pitlane feature blocks.
- Modify `docs/.vitepress/theme/layouts/Home.vue`: Pitlane section heading and footer CTA.
- Modify `docs/.vitepress/theme/custom.css`: Pitlane brand colors and remove template-only purple dominance.
- Modify `docs/index.md`: Pitlane home frontmatter.
- Modify `docs/guides/getting-started.md`: first project to first deploy flow.
- Create `docs/guides/vite-plus.md`: Vite+ and Pitlane command boundary.
- Create `docs/guides/configuration.md`: `remix()` and `platform()` configuration.
- Create `docs/guides/platform-primitives.md`: middleware, context keys, D1, R2, KV sessions, queues/jobs, and cron.
- Create `docs/guides/cli.md`: Pitlane CLI responsibilities and commands.
- Create `docs/guides/deployment.md`: local deploy and GitHub Actions deploy flow.
- Create `docs/guides/scaffolding.md`: `vp create pitlane` prompts and generated project shape.

---

### Task 1: Add Vite+ Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create root `package.json`**

Write this exact file:

```json
{
    "name": "pitlane-docs",
    "private": true,
    "type": "module",
    "packageManager": "pnpm@10.8.0",
    "scripts": {
        "docs:dev": "vp exec vitepress dev docs",
        "docs:build": "vp exec vitepress build docs",
        "docs:serve": "vp exec vitepress serve docs"
    },
    "devDependencies": {
        "@voidzero-dev/vitepress-theme": "latest",
        "vite-plus": "latest",
        "vitepress": "latest",
        "vitepress-plugin-group-icons": "latest",
        "vue": "latest"
    }
}
```

- [ ] **Step 2: Create root `vite.config.ts`**

Write this exact file:

```ts
import { defineConfig } from 'vite-plus';

export default defineConfig({
    fmt: {
        singleQuote: true,
    },
    lint: {
        ignorePatterns: [
            'docs/.vitepress/cache/**',
            'docs/.vitepress/dist/**',
            'node_modules/**',
        ],
        options: {
            typeAware: true,
            typeCheck: true,
        },
    },
});
```

- [ ] **Step 3: Create `.gitignore`**

Write this exact file:

```gitignore
node_modules
docs/.vitepress/cache
docs/.vitepress/dist
.vite
.DS_Store
```

- [ ] **Step 4: Install dependencies through Vite+**

Run:

```bash
vp install
```

Expected: dependencies install successfully and a lockfile is created for the detected package manager.

- [ ] **Step 5: Verify the existing docs app can invoke VitePress**

Run:

```bash
vp run docs:build
```

Expected: the command reaches VitePress. It may fail on placeholder theme/content issues before later tasks, but it must not fail with `vitepress: command not found`.

- [ ] **Step 6: Commit project scaffolding**

Run:

```bash
git add package.json vite.config.ts .gitignore pnpm-lock.yaml
git commit -m "Add Vite+ docs project setup"
```

If the generated lockfile is not `pnpm-lock.yaml`, replace that path with the actual lockfile from `git status --short`.

---

### Task 2: Configure VitePress Navigation And Branding

**Files:**
- Modify: `docs/.vitepress/config.ts`
- Modify: `docs/.vitepress/theme/index.ts`
- Modify: `docs/index.md`

- [ ] **Step 1: Replace `docs/.vitepress/config.ts`**

Write this exact file:

```ts
// deno-lint-ignore-file no-explicit-any
import { DefaultTheme, defineConfig } from 'vitepress';
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons';
import { extendConfig } from '@voidzero-dev/vitepress-theme/config';

const guides: DefaultTheme.SidebarItem[] = [
    {
        text: 'Start',
        items: [
            { text: 'Getting Started', link: '/guides/getting-started' },
            { text: 'Vite+ and Pitlane', link: '/guides/vite-plus' },
        ],
    },
    {
        text: 'Build',
        items: [
            { text: 'Configuration', link: '/guides/configuration' },
            { text: 'Platform Primitives', link: '/guides/platform-primitives' },
            { text: 'Scaffolding', link: '/guides/scaffolding' },
        ],
    },
    {
        text: 'Ship',
        items: [
            { text: 'CLI', link: '/guides/cli' },
            { text: 'Deployment', link: '/guides/deployment' },
        ],
    },
];

const config = defineConfig({
    title: 'Pitlane',
    titleTemplate: ':title | Pitlane',
    description: 'Platform integration for Remix 3 apps on Cloudflare.',
    markdown: {
        theme: {
            dark: 'github-dark',
            light: 'github-light',
        },
        config(md) {
            md.use(groupIconMdPlugin);
        },
    },
    vite: {
        plugins: [groupIconVitePlugin() as any],
    },
    themeConfig: {
        logo: '/favicon.svg',
        socialLinks: [
            { icon: 'github', link: 'https://github.com/pitlane-tools' },
        ],
        outline: { level: 'deep' },
        nav: [
            { text: 'Docs', link: '/guides/getting-started', activeMatch: '/guides/' },
        ],
        sidebar: {
            '/guides/': guides,
        },
    },
    head: [
        ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
        ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
        [
            'link',
            { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
        ],
        [
            'link',
            {
                rel: 'stylesheet',
                href:
                    'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,600;0,700;0,800;0,900;1,600;1,700;1,800;1,900&display=swap',
            },
        ],
        [
            'link',
            {
                rel: 'stylesheet',
                href:
                    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap',
            },
        ],
        [
            'link',
            {
                rel: 'stylesheet',
                href:
                    'https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap',
            },
        ],
    ],
});

export default extendConfig(config);
```

- [ ] **Step 2: Replace `docs/.vitepress/theme/index.ts`**

Write this exact file:

```ts
import { h } from 'vue';
import type { Theme } from 'vitepress';
import { themeContextKey, VoidZeroTheme } from '@voidzero-dev/vitepress-theme';
import footerBg from '@voidzero-dev/vitepress-theme/src/assets/vitest/footer-background.jpg';
import monoIcon from '@voidzero-dev/vitepress-theme/src/assets/icons/vitest-mono.svg';
import logoDark from '../../public/logo-dark.svg';
import logoLight from '../../public/logo-light.svg';
import Home from './layouts/Home.vue';
import './custom.css';
import 'virtual:group-icons.css';

export default {
    ...VoidZeroTheme,
    Layout() {
        return h((VoidZeroTheme as any).Layout, null, {
            'home-hero-before': () => h(Home),
        });
    },
    enhanceApp(ctx) {
        ctx.app.provide(themeContextKey, {
            logoDark,
            logoLight,
            logoAlt: 'Pitlane',
            footerBg,
            monoIcon,
        });

        VoidZeroTheme.enhanceApp(ctx);
    },
} satisfies Theme;
```

- [ ] **Step 3: Replace `docs/index.md`**

Write this exact file:

```md
---
title: Pitlane
titleTemplate: Platform integration for Remix 3
layout: home
theme: dark
---
```

- [ ] **Step 4: Run navigation build check**

Run:

```bash
vp run docs:build
```

Expected: build reaches VitePress and does not report missing sidebar paths after guide pages are added in Task 4. If it fails now because new guide pages do not exist yet, continue to Task 3 and Task 4 before re-running.

- [ ] **Step 5: Commit navigation and branding config**

Run:

```bash
git add docs/.vitepress/config.ts docs/.vitepress/theme/index.ts docs/index.md
git commit -m "Configure Pitlane docs navigation"
```

---

### Task 3: Replace Home Page Content

**Files:**
- Modify: `docs/.vitepress/theme/components/Hero.vue`
- Modify: `docs/.vitepress/theme/components/Intro.vue`
- Modify: `docs/.vitepress/theme/components/FeatureGrid.vue`
- Modify: `docs/.vitepress/theme/layouts/Home.vue`
- Modify: `docs/.vitepress/theme/custom.css`

- [ ] **Step 1: Replace `docs/.vitepress/theme/components/Hero.vue`**

Write this exact file:

```vue
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
        linear-gradient(135deg, rgba(18, 24, 38, 0.9), rgba(23, 56, 48, 0.72)),
        url('@assets/vitest/hero-background.jpg');
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
```

- [ ] **Step 2: Replace `docs/.vitepress/theme/components/Intro.vue`**

Write this exact file:

```vue
<template>
    <div class="wrapper wrapper--ticks border-t py-14 lg:py-30 px-5 sm:px-10 lg:px-20">
        <div
            class="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-5 lg:gap-8 text-left"
        >
            <div class="flex flex-col gap-3 max-w-md">
                <div class="flex gap-3 items-center">
                    <span
                        class="text-grey text-xs font-medium font-mono uppercase tracking-wide"
                    >
                        Why Pitlane
                    </span>
                </div>
                <h3 class="text-white max-w-xl text-balance">
                    Cloudflare primitives that fit Remix instead of fighting it.
                </h3>
                <a
                    href="/guides/vite-plus"
                    class="button w-fit mt-8 hidden lg:block"
                >
                    Learn the workflow
                </a>
            </div>
            <div class="lg:max-w-lg">
                <p class="text-pretty mb-5">
                    Pitlane keeps the platform visible and typed. Configure resources
                    in `platform()`, let Pitlane generate Wrangler config and worker
                    types, then read D1, R2, KV sessions, queues, and cron through
                    explicit Remix middleware.
                </p>
                <p class="text-pretty">
                    Vite+ runs the application lifecycle. Pitlane handles the
                    Cloudflare platform work around it: provisioning, migrations,
                    secrets, generated configuration, and deploys.
                </p>
                <a
                    href="/guides/vite-plus"
                    class="button w-fit mt-8 block lg:hidden"
                >
                    Learn the workflow
                </a>
            </div>
        </div>
    </div>
</template>
```

- [ ] **Step 3: Replace `docs/.vitepress/theme/components/FeatureGrid.vue`**

Write this exact file:

```vue
<template>
    <section
        class="wrapper wrapper--ticks border-t grid lg:grid-cols-2 divide-x divide-y divide-nickel"
    >
        <div class="flex flex-col gap-3">
            <div class="p-5 sm:p-10 flex flex-col gap-3">
                <h5 class="text-white">
                    Vite+ Native
                </h5>
                <p class="sm:max-w-[30rem] text-pretty">
                    Start with `vp create pitlane`, run development with `vp dev`,
                    validate with `vp check`, and build with `vp build`.
                </p>
            </div>
        </div>
        <div class="flex flex-col gap-3 border-r-0">
            <div class="p-5 sm:p-10 flex flex-col gap-3">
                <h5 class="text-white">
                    Explicit Platform Config
                </h5>
                <p class="max-w-[30rem] text-pretty">
                    The `platform()` Vite plugin is the source of truth for D1,
                    KV, R2, queues, cron, generated Wrangler config, and types.
                </p>
            </div>
        </div>
        <div class="flex flex-col gap-3">
            <div class="p-5 sm:p-10 flex flex-col gap-3">
                <h5 class="text-white">
                    Remix Runtime Primitives
                </h5>
                <p class="max-w-[30rem] text-pretty">
                    Add middleware for database, file storage, sessions, jobs, and
                    scheduled work, then read typed values from Remix context.
                </p>
            </div>
        </div>
        <div class="flex flex-col gap-3">
            <div class="p-5 sm:p-10 flex flex-col gap-3">
                <h5 class="text-white">
                    Platform Operations
                </h5>
                <p class="max-w-[30rem] text-pretty">
                    Use `pitlane` for Cloudflare resources, migrations, secrets,
                    setup, and deploys while Vite+ owns the app lifecycle.
                </p>
            </div>
        </div>
    </section>
    <section class="wrapper border-t py-10 flex items-center justify-center">
        <a href="/guides/getting-started" class="button">Read the guide</a>
    </section>
</template>
```

- [ ] **Step 4: Replace `docs/.vitepress/theme/layouts/Home.vue`**

Write this exact file:

```vue
<script setup>
import Footer from '@components/oss/Footer.vue';
import HeadingSection from '@components/oss/HeadingSection.vue';
import Spacer from '@components/shared/Spacer.vue';
import Hero from '../components/Hero.vue';
import Intro from '../components/Intro.vue';
import FeatureGrid from '../components/FeatureGrid.vue';
</script>

<template>
    <Hero />
    <Intro />
    <HeadingSection heading="The Remix platform layer for Cloudflare." />
    <FeatureGrid />
    <Spacer />
    <Footer
        heading="Start with Pitlane"
        subheading="Create a Remix 3 app, configure Cloudflare resources, and deploy through the same Vite+ workflow you use every day."
        button-text="Get started"
        button-link="/guides/getting-started"
    />
</template>
```

- [ ] **Step 5: Update Pitlane brand colors in `docs/.vitepress/theme/custom.css`**

Replace only the `:root`, dark theme, and light theme color blocks with this content. Leave the existing imports, typography, layout fixes, and keyboard styles in place.

```css
/* Brand colors — light mode */
:root {
    --color-brand: #0f766e;
    --color-grey: #87909a;

    --vp-c-brand-1: #0f766e;
    --vp-c-brand-2: #0e7490;
    --vp-c-brand-3: #14b8a6;

    --vp-sidebar-width: 320px;

    --vp-font-family-base:
        Inter, -apple-system, BlinkMacSystemFont, 'avenir next', avenir, 'segoe ui',
        'helvetica neue', helvetica, Cantarell, Ubuntu, roboto, arial,
        sans-serif;
    --vp-font-family-mono:
        'JetBrains Mono', ui-monospace, SFMono-Regular, 'Andale Mono', 'Ubuntu Mono', Menlo,
        Consolas, Monaco, 'Liberation Mono', 'Lucida Console', monospace;

    --vp-home-hero-image-background-image: linear-gradient(
        -45deg,
        #0f766e 50%,
        #0e7490 50%
    );

    --vp-home-hero-image-filter: blur(75px);
}

/* Brand colors — dark mode */
:root.dark:not([data-theme]),
:root[data-theme='dark'] {
    --color-brand: #2dd4bf;
    --vp-c-brand-1: #2dd4bf;
    --vp-c-brand-2: #38bdf8;
    --vp-c-brand-3: #0f766e;
}

:root[data-theme='light'] {
    --color-brand: #0f766e;
    --vp-c-brand-1: #0f766e;
    --vp-code-color: #0f766e;
}
```

- [ ] **Step 6: Run home build check**

Run:

```bash
vp run docs:build
```

Expected: build may still fail until the guide pages from Task 4 exist, but Vue compilation must not report errors from edited home components.

- [ ] **Step 7: Commit home page content**

Run:

```bash
git add docs/.vitepress/theme/components/Hero.vue docs/.vitepress/theme/components/Intro.vue docs/.vitepress/theme/components/FeatureGrid.vue docs/.vitepress/theme/layouts/Home.vue docs/.vitepress/theme/custom.css
git commit -m "Add Pitlane docs home page"
```

---

### Task 4: Add User-Facing Guide Pages

**Files:**
- Modify: `docs/guides/getting-started.md`
- Create: `docs/guides/vite-plus.md`
- Create: `docs/guides/configuration.md`
- Create: `docs/guides/platform-primitives.md`
- Create: `docs/guides/cli.md`
- Create: `docs/guides/deployment.md`
- Create: `docs/guides/scaffolding.md`

- [ ] **Step 1: Replace `docs/guides/getting-started.md`**

Write this exact file:

````md
---
title: Getting Started
---

# Getting Started

Pitlane creates Remix 3 applications for Cloudflare with Vite+ as the project workflow and Pitlane as the platform layer.

## Create A Project

```bash
vp create pitlane my-app
cd my-app
vp install
```

The Remix template configures Vite+ and adds the Pitlane plugins used by the application.

## Run Locally

```bash
vp dev
```

`vp dev` starts the Vite development server. Pitlane's platform plugin delegates to Cloudflare's local Worker runtime integration so bindings behave like Cloudflare bindings during development.

## Configure Resources

Declare Cloudflare resources in `vite.config.ts`:

```ts
import { defineConfig } from "vite-plus";
import { remix } from "pitlane/remix";
import { platform } from "pitlane/platform";

export default defineConfig({
    plugins: [
        remix(),
        platform({
            d1: { binding: "DB", database: "contacts" },
            kv: { binding: "SESSIONS" },
            r2: { binding: "FILES" },
            queues: { binding: "TASKS", queue: "task-queue" },
            cron: "0 * * * *",
        }),
    ],
});
```

The `platform()` plugin generates `.pitlane/wrangler.jsonc` and `.pitlane/worker-configuration.d.ts`. Those files are inspectable build artifacts, not files you edit by hand.

## Provision Cloudflare Resources

```bash
pitlane login
pitlane resources create
```

Provisioning is explicit. Pitlane reads the `platform()` config and creates or links the Cloudflare resources your app declares.

## Validate And Build

```bash
vp check
vp build
```

Vite+ owns format, lint, type checking, tests, development, and production builds.

## Deploy

```bash
pitlane deploy
```

`pitlane deploy` builds the app, runs pending remote D1 migrations, deploys with Wrangler using the generated `.pitlane/wrangler.jsonc`, and prints the live URL.
````

- [ ] **Step 2: Create `docs/guides/vite-plus.md`**

Write this exact file:

````md
---
title: Vite+ and Pitlane
---

# Vite+ And Pitlane

Pitlane is built for Vite+ projects. Vite+ is the unified command surface for the application lifecycle; Pitlane handles Cloudflare platform operations around that lifecycle.

## Command Boundary

Use Vite+ for application work:

```bash
vp create pitlane my-app
vp install
vp dev
vp check
vp test
vp build
vp preview
```

Use Pitlane for platform work:

```bash
pitlane resources create
pitlane db migrate
pitlane secrets push
pitlane deploy
```

Pitlane does not replace Vite+ commands such as `dev`, `build`, `check`, or `test`.

## Configuration

Pitlane plugins live in the same `vite.config.ts` file as the rest of your Vite+ configuration:

```ts
import { defineConfig } from "vite-plus";
import { remix } from "pitlane/remix";
import { platform } from "pitlane/platform";

export default defineConfig({
    plugins: [
        remix(),
        platform({
            d1: { binding: "DB", database: "contacts" },
        }),
    ],
});
```

Use Vite+ config blocks for toolchain behavior such as formatting, linting, tests, packaging, and task running. Use `platform()` for Cloudflare resources.

## Dependency Management

Use Vite+ package commands inside Pitlane projects:

```bash
vp add remix
vp add -D pitlane
vp remove unused-package
vp install
```

Vite+ selects the package manager from the workspace and keeps dependency commands consistent across machines.
````

- [ ] **Step 3: Create `docs/guides/configuration.md`**

Write this exact file:

````md
---
title: Configuration
---

# Configuration

Pitlane configuration starts in `vite.config.ts`.

## Remix Plugin

`remix()` configures the Remix 3 framework build for Vite+:

```ts
import { defineConfig } from "vite-plus";
import { remix } from "pitlane/remix";

export default defineConfig({
    plugins: [
        remix({
            clientEntry: "app/entry.browser",
            serverEntry: "app/entry.server",
            serverEnvironments: ["ssr"],
            serverHandler: false,
        }),
    ],
});
```

All options are optional. The plugin configures SSR and client Vite environments, transforms client entry references, wires preview server behavior, and suppresses expected abort errors from client disconnects.

## Platform Plugin

`platform()` is the source of truth for Cloudflare resources:

```ts
import { defineConfig } from "vite-plus";
import { remix } from "pitlane/remix";
import { platform } from "pitlane/platform";

export default defineConfig({
    plugins: [
        remix(),
        platform({
            name: "contacts",
            compatibilityDate: "2026-04-08",
            d1: { binding: "DB", database: "contacts" },
            kv: { binding: "SESSIONS" },
            r2: { binding: "FILES" },
            queues: { binding: "TASKS", queue: "task-queue" },
            cron: "0 * * * *",
        }),
    ],
});
```

Pitlane generates `.pitlane/wrangler.jsonc` from this config and runs Wrangler type generation into `.pitlane/worker-configuration.d.ts`.

## Multiple Bindings

Every resource type accepts one object or an array:

```ts
platform({
    d1: [
        { binding: "DB", database: "primary" },
        { binding: "ANALYTICS_DB", database: "analytics" },
    ],
    kv: [{ binding: "CACHE" }, { binding: "SESSIONS" }],
    r2: [{ binding: "UPLOADS" }, { binding: "ASSETS" }],
    queues: [
        { binding: "TASKS", queue: "task-queue" },
        { binding: "EMAILS", queue: "email-queue" },
    ],
    cron: ["0 * * * *", "0 0 * * *"],
});
```

When you configure multiple bindings of the same type, create additional Remix context keys and add one middleware call per binding.
````

- [ ] **Step 4: Create `docs/guides/platform-primitives.md`**

Write this exact file:

````md
---
title: Platform Primitives
---

# Platform Primitives

Pitlane exposes Cloudflare bindings through Remix middleware and context keys. Raw bindings come from `cloudflare:workers`; route code reads typed abstractions from context.

## Database

```ts
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { database } from "pitlane/data-table-middleware";

database(env.DB);

router.get("/contacts", async ctx => {
    let db = ctx.get(Database);
    let contacts = await db.findMany(Contacts);
    return Response.json(contacts);
});
```

`database()` wraps a D1 binding with Pitlane's `D1DatabaseAdapter` and exposes a `Database` instance.

## File Storage

```ts
import { env } from "cloudflare:workers";
import { FileStorage } from "pitlane/file-storage";
import { fileStorage } from "pitlane/file-storage-middleware";

fileStorage(env.FILES);

router.post("/avatar", async ctx => {
    let files = ctx.get(FileStorage);
    await files.set("avatar", await ctx.request.blob());
    return new Response(null, { status: 204 });
});
```

`fileStorage()` wraps R2 with `R2FileStorage`.

## Sessions

```ts
import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";
import { createKvSessionStorage } from "pitlane/session-storage";

let sessionCookie = createCookie("__session", {
    secrets: ["s3cr3t"],
    httpOnly: true,
    secure: true,
    sameSite: "lax",
});

let sessionStorage = createKvSessionStorage(env.SESSIONS, {
    keyPrefix: "session:",
    ttl: 60 * 60 * 24,
});

session(sessionCookie, sessionStorage);

router.get("/", ctx => {
    let userSession = ctx.get(Session);
    return Response.json({ count: userSession.get("count") ?? 0 });
});
```

## Jobs And Queues

```ts
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createJobs, createJobQueue, Scheduler } from "pitlane/jobs";
import { scheduler } from "pitlane/jobs-middleware";

let jobs = createJobs({
    sendEmail: {
        binding: env.EMAIL_QUEUE,
        schema: s.object({ to: s.string(), subject: s.string() }),
        async handle(payload) {
            await sendEmail(payload.to, payload.subject);
        },
    },
});

scheduler(jobs);

router.post("/emails", async ctx => {
    let queue = ctx.get(Scheduler);
    await queue.enqueue(jobs.sendEmail, {
        to: "a@example.com",
        subject: "Hello",
    });
    return new Response(null, { status: 202 });
});

let workerQueue = createJobQueue(jobs);

export default {
    fetch: router.fetch,
    queue: workerQueue.handler,
} satisfies ExportedHandler<Env>;
```

Retry behavior is configured per enqueue call:

```ts
await queue.enqueue(
    jobs.sendEmail,
    { to: "vip@example.com", subject: "Important update" },
    {
        retry: {
            maxAttempts: 5,
            strategy: "exponential",
            baseDelayMs: 1000,
            maxDelayMs: 60_000,
            jitter: "full",
        },
    },
);
```

## Cron

```ts
import { createCron } from "pitlane/cron";

let cron = createCron({
    "0 * * * *": {
        async handle(event) {
            await refreshHourlyData(event);
        },
    },
});

export default {
    fetch: router.fetch,
    scheduled: cron.handler,
} satisfies ExportedHandler<Env>;
```
````

- [ ] **Step 5: Create `docs/guides/cli.md`**

Write this exact file:

````md
---
title: CLI
---

# CLI

The `pitlane` CLI wraps Cloudflare platform operations for Remix 3 apps. It reads Cloudflare resources from the `platform()` plugin in `vite.config.ts`.

Pitlane does not replace Vite+ lifecycle commands. Use `vp dev`, `vp check`, `vp test`, and `vp build` for application work.

## Database

```bash
pitlane db generate
pitlane db push
pitlane db migrate
pitlane db migrate --remote
pitlane db reset
pitlane db seed
```

Use database commands for D1 schema generation, local migrations, remote migrations, reset, and seed flows.

## Secrets

```bash
pitlane secrets push
pitlane secrets list
```

`pitlane secrets push` reads `.env`, compares it with deployed Cloudflare secret names, and pushes changes. Cloudflare secret values are write-only.

## Resources

```bash
pitlane resources list
pitlane resources create
pitlane resources link
```

Resource provisioning is explicit. `pitlane resources create` reads `platform()` and creates the configured D1, KV, R2, queue, and cron resources.

## Deploy

```bash
pitlane deploy
pitlane deploy --dry-run
```

`pitlane deploy` builds the app, applies pending remote migrations, deploys with Wrangler, and prints the live URL.

## Setup

```bash
pitlane setup
```

`pitlane setup` writes `.github/workflows/deploy.yml` using `pitlane-tools/deploy-action`. When `gh` is available and authenticated, it can help initialize the repository, create a GitHub remote, configure Cloudflare credentials, and write the workflow.

## Auth

```bash
pitlane login
pitlane whoami
```

Authentication delegates to Wrangler so Pitlane uses the same Cloudflare identity as the rest of your Cloudflare tooling.
````

- [ ] **Step 6: Create `docs/guides/deployment.md`**

Write this exact file:

````md
---
title: Deployment
---

# Deployment

Pitlane deploys Remix 3 apps to Cloudflare using configuration generated from `platform()`.

## Local Deploy

```bash
vp check
vp build
pitlane deploy
```

The deploy flow:

1. Builds the project with Vite+.
2. Runs pending remote D1 migrations.
3. Stops if a migration fails.
4. Runs Wrangler deploy with `.pitlane/wrangler.jsonc`.
5. Prints the live URL.

Use a dry run before applying changes:

```bash
pitlane deploy --dry-run
```

## GitHub Actions

Use `pitlane-tools/deploy-action` after the app is built:

```yaml
name: Build & Deploy

on:
    push:
        branches: [main]

permissions:
    contents: read
    deployments: write

jobs:
    deploy:
        runs-on: ubuntu-latest
        environment:
            name: production
            url: https://my-app.example.com
        steps:
            - uses: actions/checkout@v4

            - uses: voidzero-dev/setup-vp@v1
              with:
                  node-version: "24"
                  cache: true

            - run: vp install --frozen-lockfile
            - run: vp check
            - run: vp build

            - uses: pitlane-tools/deploy-action@v1
              with:
                  cloudflareApiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

The action handles Pitlane's platform deploy steps. Your workflow remains responsible for checkout, Vite+ setup, dependency installation, checks, and build.
````

- [ ] **Step 7: Create `docs/guides/scaffolding.md`**

Write this exact file:

````md
---
title: Scaffolding
---

# Scaffolding

Create a Pitlane project with Vite+:

```bash
vp create pitlane
```

The Remix template is the Pitlane path for Cloudflare-backed Remix 3 apps.

## Project Kind

```text
? Project kind:
❯ Remix
  React Router — SPA
  React Router — SSR
  React Router — RSC
```

Selecting Remix creates a project with:

- `vite.config.ts` using `remix()` and `platform()`
- `app/entry.server.tsx` with the Remix middleware stack
- `pitlane/cli` as a development dependency
- `.pitlane/` in `.gitignore`
- no handwritten `wrangler.jsonc`

## Platform Features

```text
? Platform features:
  ☐ Database (D1)
  ☐ File Storage (R2)
  ☐ Session Storage (KV)
  ☐ Queues
  ☐ Cron Jobs
```

Pitlane wires selected platform features into `platform()` and the server entry.

## Project Features

```text
? Project features:
  ☐ Authentication
  ☐ Testing
  ☐ Prerendering
  ☐ Content Layer (MDX)
  ☐ Tailwind (CSS)
  ☐ CI/CD (GitHub Actions)
```

Project features add framework-level setup such as auth, tests, prerendering, MDX content, Tailwind, and deployment workflows.

## Generated Shape

```text
my-app/
├── .github/workflows/deploy.yml
├── app/
│   ├── entry.server.tsx
│   ├── home.tsx
│   ├── jobs.ts
│   ├── root.tsx
│   ├── routes.ts
│   ├── schema.ts
│   └── styles/tailwind.css
├── seed.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

With no optional features selected, the project is a minimal Remix 3 app on Cloudflare with Vite+ and Pitlane platform configuration.
````

- [ ] **Step 8: Run guide build check**

Run:

```bash
vp run docs:build
```

Expected: VitePress build succeeds.

- [ ] **Step 9: Check for template copy**

Run:

```bash
rg "My Project|brief description|Feature One|Feature Two|Feature Three|Feature Four" docs
```

Expected: no matches.

- [ ] **Step 10: Commit guide pages**

Run:

```bash
git add docs/guides
git commit -m "Add Pitlane user guides"
```

---

### Task 5: Final Verification And Local Preview

**Files:**
- No file edits.

- [ ] **Step 1: Install dependencies from lockfile**

Run:

```bash
vp install --frozen-lockfile
```

Expected: dependency installation succeeds without lockfile changes.

- [ ] **Step 2: Run docs build**

Run:

```bash
vp run docs:build
```

Expected: VitePress reports a successful production build into `docs/.vitepress/dist`.

- [ ] **Step 3: Run static checks**

Run:

```bash
vp check
```

Expected: formatting, linting, and type checks complete successfully. If `vp check` fails because Vite+ cannot type-check VitePress theme internals, capture the exact diagnostic and decide whether a focused `lint.ignorePatterns` entry is justified.

- [ ] **Step 4: Start the docs dev server**

Run:

```bash
vp run docs:dev -- --host 127.0.0.1
```

Expected: VitePress prints a local URL such as `http://127.0.0.1:5173/`.

- [ ] **Step 5: Smoke test the local site**

Open the local URL and verify:

- Home page shows Pitlane, not template copy.
- The Docs nav opens `/guides/getting-started`.
- Sidebar links resolve for Getting Started, Vite+ and Pitlane, Configuration, Platform Primitives, Scaffolding, CLI, and Deployment.
- The page does not show missing import or hydration errors in the browser console.

- [ ] **Step 6: Stop the dev server**

Stop the running VitePress process with `Ctrl-C`.

- [ ] **Step 7: Commit verification adjustments if needed**

If verification required config edits, commit them:

```bash
git add package.json vite.config.ts docs
git commit -m "Fix docs verification issues"
```

If no files changed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: the plan covers Vite+ project setup, VitePress config, home content, guide pages, Vite+ public messaging, Pitlane/Vite+ command boundaries, and final verification.
- Placeholder scan: tasks include concrete file paths, file contents, commands, and expected results.
- API consistency: examples use `defineConfig` from `vite-plus`, `remix` from `pitlane/remix`, and platform runtime exports from their respective subpaths (`pitlane/data-table-middleware`, `pitlane/file-storage-middleware`, `pitlane/session-storage`, `pitlane/jobs`, `pitlane/jobs-middleware`, `pitlane/cron`), matching the approved design and source material.

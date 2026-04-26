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

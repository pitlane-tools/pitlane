---
title: Vite+
description: How Pitlane composes with Vite+ — application lifecycle on Vite+, Cloudflare platform operations on Pitlane.
---

# Vite+

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

---
title: Deploy to Vercel
description: Run a Remix 3 app on Vercel with @pitlane/dev and the Nitro Vite plugin — zero-config git deploys onto Vercel Functions.
---

# Vercel

Deploy a Remix 3 app to [Vercel](https://vercel.com) by composing `remix()` with [`nitro/vite`](https://nitro.build). Nitro packages the `ssr` environment's fetch handler for the deploy target — and on Vercel that's genuinely zero-config: Vercel injects `VERCEL=1` into every build, Nitro auto-selects its `vercel` preset, and the build lands in Vercel's [Build Output API](https://vercel.com/docs/build-output-api) format that the platform reads directly. No framework preset, build command, or output directory to configure by hand.

## Configuration

```sh
vp add -D nitro
```

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix({ serverHandler: false }), nitro()],
});
```

`serverHandler: false` hands dev-time request handling to Nitro's dev server, which runs the same fetch handler Nitro packages for production.

Server routes run as [Vercel Functions](https://vercel.com/docs/functions) on Fluid compute — standard Web APIs, scale-to-zero. Client assets are served from Vercel's CDN.

## Local development and preview

```sh
vp dev      # dev server through Nitro's runtime
vp build    # locally: portable .output build
vp preview  # preview the build
```

Locally, Nitro builds its portable Node output; the Vercel-specific `.vercel/output` structure is produced when the build runs on Vercel (or under `vercel build`).

## Deploy from git

Push the repository and import it at [vercel.com/new](https://vercel.com/new). Vercel detects the Nitro Vite plugin, fills in the build settings, and deploys — subsequent pushes create preview deployments per branch and production deployments from the default branch.

## Deploy with the CLI

```sh
vpx vercel login
vpx vercel          # preview deployment
vpx vercel --prod   # production
```

`vercel build` + `vercel deploy --prebuilt` also work when you want to build in your own CI and upload the finished `.vercel/output` directory.

## Environment variables

Define them per environment in the Vercel dashboard (**Settings → Environment Variables**) or with `vercel env add`. They reach the server handler as `process.env.*`; `vercel env pull` writes a local `.env.local` for development.

::: warning Verify with the template
The Vercel path runs through Nitro's packaging rather than `@pitlane/dev`'s own output, so option details (dev handler ownership, output layout) follow Nitro's current release. The [pitlane-tools](https://github.com/pitlane-tools) Vercel template is the tested reference for this composition.
:::

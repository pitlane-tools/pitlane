---
title: Deploy to Vercel
description: Run a Remix 3 app on Vercel with @pitlane/dev and the Nitro Vite plugin — Vercel Functions via the Build Output API.
---

# Vercel

Deploy a Remix 3 app to [Vercel](https://vercel.com) by composing `remix()` with [`nitro/vite`](https://nitro.build). Nitro packages the `ssr` environment's fetch handler for the deploy target: Vercel injects `VERCEL=1` into builds, Nitro auto-selects its `vercel` preset, and the output lands in Vercel's [Build Output API](https://vercel.com/docs/build-output-api) format that the platform reads directly — no framework preset, build command, or output directory to configure by hand.

## Configuration

::: code-group

```sh [npm]
npm add -D nitro
```

```sh [yarn]
yarn add -D nitro
```

```sh [pnpm]
pnpm add -D nitro
```

```sh [bun]
bun add -D nitro
```

```sh [deno]
deno add -D npm:nitro
```

```sh [vp]
vp add -D nitro
```

```sh [vlt]
vlt add -D nitro
```

```sh [nub]
nub add -D nitro
```

:::

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

Locally, Nitro builds its portable Node output; the Vercel-specific `.vercel/output` structure is produced when the build runs under `vercel build` (which sets `VERCEL=1`, locally or in CI).

## Deploy with the CLI

Link the project once, then always deploy **prebuilt** — the artifact built on your machine (or CI) is the artifact that ships, and Vercel's build system never runs:

```sh
vpx vercel login
vpx vercel link

vpx vercel build && vpx vercel deploy --prebuilt            # preview deployment
vpx vercel build --prod && vpx vercel deploy --prebuilt --prod   # production
```

`vercel build` runs the Vite build locally with Vercel's environment applied (so Nitro emits `.vercel/output`), and `--prebuilt` uploads that directory as-is.

::: warning
A plain `vercel` / `vercel --prod` uploads *source* and builds on Vercel's infrastructure — skip it. The Vite build point stays in your CI.
:::

## Deploy with GitHub Actions

Store three repository secrets: `VERCEL_TOKEN` (an [access token](https://vercel.com/account/settings/tokens)), plus `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (both written to `.vercel/project.json` by `vercel link`).

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
    push:
        branches: [main]

permissions:
    contents: read
    deployments: write

env:
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: voidzero-dev/setup-vp@v1
              with:
                  cache: true

            - run: vp install --frozen-lockfile

            - run: vpx vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

            - run: vpx vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

            - run: vpx vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

`vercel build` runs the Vite build with Vercel's environment applied (so Nitro emits `.vercel/output`), and `--prebuilt` uploads that directory as-is — the build you tested is the build that ships.

## Environment variables

Define them per environment in the Vercel dashboard (**Settings → Environment Variables**) or with `vercel env add`. They reach the server handler as `process.env.*`; `vercel env pull` writes a local `.env.local` for development.

::: warning Verify with the template
The Vercel path runs through Nitro's packaging rather than `@pitlane/dev`'s own output, so option details (dev handler ownership, output layout) follow Nitro's current release. The [pitlane-tools](https://github.com/pitlane-tools) Vercel template is the tested reference for this composition.
:::

## Client-only apps (SPA)

A client-only Remix 3 app skips `@pitlane/dev` **and** `nitro/vite` entirely — with no SSR and no `clientEntry()` boundaries there is nothing to transform or package, so no Remix- or Pitlane-specific Vite settings are needed. Plain Vite builds a static site Vercel serves from its CDN.

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>My Remix App</title>
        <script type="module" src="/app/main.tsx"></script>
    </head>
    <body>
        <div id="app"></div>
    </body>
</html>
```

```tsx
// app/main.tsx
import { createRoot, on, type Handle } from "remix/ui";

function App(handle: Handle) {
    let count = 0;

    return () => (
        <button mix={[on("click", () => { count++; handle.update(); })]}>
            Count: {count}
        </button>
    );
}

createRoot(document.getElementById("app")!).render(<App />);
```

```jsonc
// tsconfig.json
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "remix/ui" } }
```

`vite build` emits the site into `dist/`, which Vercel's Vite preset picks up. Add the SPA fallback so deep links serve `index.html`:

```json
// vercel.json
{
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Deploys are unchanged — build prebuilt, upload the artifact: `vpx vercel build --prod && vpx vercel deploy --prebuilt --prod`, or the same [GitHub Actions workflow](#deploy-with-github-actions) above.

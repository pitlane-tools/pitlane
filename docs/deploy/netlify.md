---
title: Deploy to Netlify
description: Run a Remix 3 app on Netlify with @pitlane/dev — a one-file Netlify Function wraps the built fetch handler, and the Netlify Vite plugin emulates the platform locally.
---

# Netlify

Deploy a Remix 3 app to [Netlify](https://www.netlify.com) by publishing the client build as static files and serving everything else through one [Netlify Function](https://docs.netlify.com/build/functions/overview/) that wraps the built fetch handler. [`@netlify/vite-plugin`](https://www.npmjs.com/package/@netlify/vite-plugin) adds local emulation of the Netlify platform (Functions, Blobs, redirects, headers, environment variables, Image CDN) to `vite dev`.

## Configuration

```sh
vp add -D @netlify/vite-plugin
```

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import netlify from "@netlify/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix(), netlify()],
});
```

::: info Who serves what in dev
Keep `remix()`'s default `serverHandler: true` here. Netlify's plugin emulates platform primitives around the dev server; SSR itself is still served by your app's fetch handler.
:::

## The server function

Netlify Functions speak the same fetch-handler language as the built server entry, so the function is a three-line wrapper. Create `netlify/functions/server.mjs`:

```js
// netlify/functions/server.mjs
import server from "../../dist/ssr/index.js";

export default request => server.fetch(request);

export const config = {
    path: "/*",
    preferStatic: true,
};
```

`path: "/*"` routes every request to the function; `preferStatic: true` lets files in the publish directory win first, so hashed client assets are served from the CDN and never touch the function.

Then `netlify.toml` wires the build:

```toml
# netlify.toml
[build]
  command = "vite build"
  publish = "dist/client"
```

::: tip Under the hood
This is the same shape Netlify's TanStack Start integration generates automatically — a thin function re-exporting the `ssr` environment's `fetch`. Netlify's generic Vite plugin can generate it too, but only behind a private, explicitly unsupported flag today; the committed function file above is the documented, stable path. If Netlify promotes that flag to public API, this guide gets three lines shorter.
:::

## Local development

```sh
vp dev      # dev server + Netlify platform emulation
vp build    # production build
vp preview  # serve the production build via @pitlane/dev's preview
```

Running under the Netlify CLI instead? `netlify dev` configures the environment itself and the Vite plugin steps aside automatically.

## Deploy with the CLI

Create the site once and link the directory, then every deploy is two commands:

```sh
vpx netlify-cli login
vpx netlify-cli init      # create + link the site (or `link` for an existing one)

vp build
vpx netlify-cli deploy            # draft URL
vpx netlify-cli deploy --prod     # production
```

The CLI reads `netlify.toml`, uploads `dist/client`, and bundles the server function — its import of `dist/ssr/index.js` is traced and packaged automatically.

## Deploy with GitHub Actions

Store two repository secrets: `NETLIFY_AUTH_TOKEN` (a [personal access token](https://app.netlify.com/user/applications#personal-access-tokens)) and `NETLIFY_SITE_ID` (**Site configuration → Site details → Site ID**, or `netlify sites:list`).

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
    push:
        branches: [main]

permissions:
    contents: read
    deployments: write

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: voidzero-dev/setup-vp@v1
              with:
                  cache: true

            - run: vp install --frozen-lockfile

            - run: vp build

            - run: vpx netlify-cli deploy --prod
              env:
                  NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
                  NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## Environment variables

Set them in the Netlify UI (**Site configuration → Environment variables**) or via `netlify env:set`. They're available to the server function as `process.env.*` / `Netlify.env`; the Vite plugin mirrors them into `vite dev`.

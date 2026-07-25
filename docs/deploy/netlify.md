---
title: Deploy to Netlify
description: Run a Remix 3 app on Netlify with @pitlane/dev — a one-file Netlify Function wraps the built fetch handler, and the Netlify Vite plugin emulates the platform locally.
---

# Netlify

Deploy a Remix 3 app to [Netlify](https://www.netlify.com) by publishing the client build as static files and serving everything else through one [Netlify Function](https://docs.netlify.com/build/functions/overview/) that wraps the built fetch handler. [`@netlify/vite-plugin`](https://www.npmjs.com/package/@netlify/vite-plugin) adds local emulation of the Netlify platform (Functions, Blobs, redirects, headers, environment variables, Image CDN) to `vite dev`.

::: tip Start from the template
`npx giget github:pitlane-tools/templates/netlify my-app` scaffolds a working guest book app wired for this guide — see [pitlane-tools/templates](https://github.com/pitlane-tools/templates).
:::

## Configuration

::: code-group

```sh [npm]
npm add -D @netlify/vite-plugin
```

```sh [yarn]
yarn add -D @netlify/vite-plugin
```

```sh [pnpm]
pnpm add -D @netlify/vite-plugin
```

```sh [bun]
bun add -D @netlify/vite-plugin
```

```sh [deno]
deno add -D npm:@netlify/vite-plugin
```

```sh [vp]
vp add -D @netlify/vite-plugin
```

```sh [vlt]
vlt add -D @netlify/vite-plugin
```

```sh [nub]
nub add -D @netlify/vite-plugin
```

:::

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

Netlify runs server code two ways, and both speak the same fetch-handler language as the built server entry — the wrapper is three lines either way. Pick **one**:

|               | [Netlify Functions](https://docs.netlify.com/build/functions/overview/) | [Netlify Edge Functions](https://docs.netlify.com/build/edge-functions/overview/)                       |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Runtime       | Node, in Netlify's serverless infrastructure                            | Deno, at the edge PoP nearest the visitor                                                               |
| Static assets | CDN wins first via `preferStatic`                                       | Run **before** static serving — assets must be excluded via `excludedPath`                              |
| Fits          | The default; larger CPU/memory limits, Node APIs                        | Latency-sensitive SSR; stricter [runtime limits](https://docs.netlify.com/build/edge-functions/limits/) |

### Netlify Functions (Node)

Create `netlify/functions/server.mjs`:

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

### Netlify Edge Functions (Deno)

Create `netlify/edge-functions/server.mjs` instead:

```js
// netlify/edge-functions/server.mjs
import server from "../../dist/ssr/index.js";

export default request => server.fetch(request);

export const config = {
    path: "/*",
    excludedPath: ["/assets/*", "/favicon.ico"],
};
```

Edge functions run **before** the CDN serves static files, so there is no `preferStatic` — instead, [`excludedPath`](https://docs.netlify.com/build/edge-functions/declarations/) carves the static surface out of the match. `/assets/*` covers the hashed client build; extend the array with anything else you ship from `public/`.

Two things to know about the edge variant:

- The handler executes on **Deno**. Remix 3 is built on Web APIs, so the SSR bundle runs there — but avoid Node-only APIs (`node:fs`, `node:crypto` beyond WebCrypto) in server code you deploy to the edge.
- Don't ship both files: the edge function matches first and the Node function would never run.

Either way, `netlify.toml` names the publish directory — and deliberately **no build command**: the Vite build always runs in your CI (or your shell), never on Netlify's build system, so the fingerprinted assets you tested are the ones that ship:

```toml
# netlify.toml
[build]
    publish = "dist/client"
```

::: tip Under the hood

The Functions variant is the same shape Netlify's TanStack Start integration generates automatically — a thin function re-exporting the `ssr` environment's `fetch`. Netlify's generic Vite plugin can generate it too, but only behind a private, explicitly unsupported flag today; the committed function file above is the documented, stable path. If Netlify promotes that flag to public API, this guide gets three lines shorter.

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
vpx netlify-cli deploy --no-build            # draft URL
vpx netlify-cli deploy --no-build --prod     # production
```

`--no-build` keeps the CLI from triggering a build of its own — you already built. The deploy uploads `dist/client` and bundles whichever server wrapper you committed — the Node function through Netlify's function bundler, the edge function through the Deno-based edge bundler. Both trace the import of `dist/ssr/index.js` and package it automatically, locally in the CLI.

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

            - run: vpx netlify-cli deploy --no-build --prod
              env:
                  NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
                  NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## Environment variables

Set them in the Netlify UI (**Site configuration → Environment variables**) or via `netlify env:set`. Netlify Functions read them as `process.env.*`; Edge Functions use [`Netlify.env.get("KEY")`](https://docs.netlify.com/build/edge-functions/api/#netlify-specific-context-object). The Vite plugin mirrors them into `vite dev`.

## Client-only apps

A client-only Remix 3 app skips `@pitlane/dev` entirely — with no SSR and no `clientEntry()` boundaries there is nothing to transform, so no Remix- or Pitlane-specific Vite settings are needed. Plain Vite builds a static site, and there is no server function to write.

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
        <button
            mix={[
                on("click", () => {
                    count++;
                    handle.update();
                }),
            ]}
        >
            Count: {count}
        </button>
    );
}

createRoot(document.getElementById("app")!).render(<App />);
```

```jsonc
// tsconfig.json
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "remix/ui",
    },
}
```

`vite build` emits the site into `dist/`. Publish that directory and add the SPA fallback so deep links serve `index.html`:

```toml
# netlify.toml
[build]
    publish = "dist"

[[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
```

Deploys are unchanged: `vpx netlify-cli deploy --no-build --prod` from the CLI, or the same [GitHub Actions workflow](#deploy-with-github-actions) above.

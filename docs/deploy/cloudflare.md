---
title: Deploy to Cloudflare Workers
description: Run a Remix 3 app on Cloudflare Workers with @pitlane/dev and the Cloudflare Vite plugin — workerd in dev, Miniflare preview, wrangler deploy.
---

# Cloudflare Workers

Deploy a Remix 3 app to [Cloudflare Workers](https://developers.cloudflare.com/workers/) by composing `remix()` with [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/). Cloudflare's plugin owns the runtime story end to end: dev requests run inside [workerd](https://github.com/cloudflare/workerd) (real bindings, real runtime), `vite preview` serves the production build through Miniflare, and `wrangler deploy` ships it.

## Configuration

Install the platform pieces:

::: code-group

```sh [npm]
npm add -D @cloudflare/vite-plugin wrangler
```

```sh [yarn]
yarn add -D @cloudflare/vite-plugin wrangler
```

```sh [pnpm]
pnpm add -D @cloudflare/vite-plugin wrangler
```

```sh [bun]
bun add -D @cloudflare/vite-plugin wrangler
```

```sh [deno]
deno add -D npm:@cloudflare/vite-plugin npm:wrangler
```

```sh [vp]
vp add -D @cloudflare/vite-plugin wrangler
```

```sh [vlt]
vlt add -D @cloudflare/vite-plugin wrangler
```

```sh [nub]
nub add -D @cloudflare/vite-plugin wrangler
```

:::

Point Cloudflare's plugin at the `ssr` environment and let it own dev-time request handling:

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix({ serverHandler: false }), cloudflare({ viteEnvironment: { name: "ssr" } })],
});
```

`wrangler.jsonc` points at your server entry and the client build output:

```jsonc
// wrangler.jsonc
{
    "name": "my-remix-app",
    "main": "app/entry.server.tsx",
    "assets": { "directory": "dist/client" },
    "compatibility_date": "2026-04-02",
    "compatibility_flags": ["nodejs_compat"],
}
```

Your server entry is already a Workers module — the default-exported router **is** the `fetch` handler. Extra worker events compose around it:

```ts
export default router;

// or, with queue/cron handlers:
export default {
    fetch: router.fetch,
    async queue(batch) {
        /* ... */
    },
};
```

## Bindings

Read bindings through the `cloudflare:workers` module — in dev they come from workerd's local emulation, in production from the deployed worker:

```ts
import { env } from "cloudflare:workers";

let value = await env.MY_KV.get("key");
```

::: tip Tip

Importing `cloudflare:workers` makes the SSR bundle resolvable only inside workerd. That's expected — `@pitlane/dev`'s preview server detects it and steps aside so Cloudflare's Miniflare preview takes over.

:::

## Local development and preview

```sh
vp dev      # dev server — SSR runs inside workerd with your bindings
vp build    # production build
vp preview  # serve the production build through Miniflare
```

For local secrets during `vp dev`, use a gitignored [`.dev.vars`](https://developers.cloudflare.com/workers/configuration/secrets/#local-development-with-secrets) file next to `wrangler.jsonc`. Non-secret values can live in `wrangler.jsonc` under `"vars"`.

## Deploy with the CLI

```sh
vpx wrangler login
vp build
vpx wrangler deploy
```

Production secrets are write-only through Wrangler:

```sh
vpx wrangler secret put MY_SECRET
```

## Deploy with GitHub Actions

Create an API token at **My Profile → API Tokens** using the _Edit Cloudflare Workers_ template, and store it as the `CLOUDFLARE_API_TOKEN` repository secret.

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

            - run: vpx wrangler deploy
              env:
                  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

`wrangler deploy` reads `wrangler.jsonc`, so the workflow needs no name, paths, or account flags — the config is the single source of truth locally and in CI.

## Client-only apps

A client-only Remix 3 app skips `@pitlane/dev` entirely — with no SSR and no `clientEntry()` boundaries there is nothing to transform, so no Remix- or Pitlane-specific Vite settings are needed. Plain Vite builds a static site that Workers serves as assets.

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

`vite build` emits the site into `dist/`. The Worker config becomes assets-only — no `main`, and `single-page-application` fallback serves `index.html` on deep links:

```jsonc
// wrangler.jsonc
{
    "name": "my-remix-spa",
    "compatibility_date": "2026-04-02",
    "assets": {
        "directory": "./dist",
        "not_found_handling": "single-page-application",
    },
}
```

Deploys are unchanged: `vpx wrangler deploy` from the CLI, or the same [GitHub Actions workflow](#deploy-with-github-actions) above.

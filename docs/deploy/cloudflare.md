---
title: Deploy to Cloudflare Workers
description: Run a Remix 3 app on Cloudflare Workers with @pitlane/dev and the Cloudflare Vite plugin — workerd in dev, Miniflare preview, wrangler deploy.
---

# Cloudflare Workers

Deploy a Remix 3 app to [Cloudflare Workers](https://developers.cloudflare.com/workers/) by composing `remix()` with [`@cloudflare/vite-plugin`](https://developers.cloudflare.com/workers/vite-plugin/). Cloudflare's plugin owns the runtime story end to end: dev requests run inside [workerd](https://github.com/cloudflare/workerd) (real bindings, real runtime), `vite preview` serves the production build through Miniflare, and `wrangler deploy` ships it.

::: tip Start from the template

`npx giget github:pitlane-tools/templates/cloudflare my-app` scaffolds a working guest book app wired for this guide — see [pitlane-tools/templates](https://github.com/pitlane-tools/templates).

:::

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

A D1 binding gets you a `remix/data-table` database through [`@pitlane/data-table-d1`](/guides/cloudflare-d1), which supplies the async driver D1 needs in place of the synchronous SQLite one.

## Prerendering and frame navigation

When you enable [`prerender`](/guides/prerendering), Cloudflare's default asset-first routing serves the generated HTML before your Worker runs. It does not distinguish a document request from a request carrying `x-remix-frame` or `x-remix-target`. A request for `/page` can redirect to `/page/` and receive `page/index.html`, putting a full document inside a frame during soft navigation.

This recipe assumes your browser's `run({ resolveFrame })` sends `x-remix-frame` or `x-remix-target` and your controller recognizes those headers. Remix rc.2's default frame resolver sends only `Accept: text/html`, so check your app's resolver rather than assuming those headers are present.

Run the Worker first and give it an asset binding:

```jsonc
// wrangler.jsonc
{
    "name": "my-remix-app",
    "main": "app/entry.server.tsx",
    "assets": {
        "directory": "dist/client",
        "binding": "ASSETS",
        "run_worker_first": true,
    },
    "compatibility_date": "2026-04-02",
    "compatibility_flags": ["nodejs_compat"],
}
```

Wrap the router at the server entry. Keep any `routes` export needed by `prerender: true`:

```ts
// app/entry.server.tsx
import { env } from "cloudflare:workers";
import { router } from "./router.ts";

export { routes } from "./routes.ts";

export default {
    async fetch(request: Request) {
        if (
            (request.method === "GET" || request.method === "HEAD") &&
            !request.headers.has("x-remix-frame") &&
            !request.headers.has("x-remix-target")
        ) {
            let asset = await env.ASSETS.fetch(request);
            if (asset.status !== 404) return asset;
        }
        return router.fetch(request);
    },
};
```

Generate binding types with `vpx wrangler types` after adding `ASSETS`. Frame requests and mutations go straight to the router. Ordinary GET/HEAD requests can use the prerendered document or another static asset; a missing asset falls through to the router. The controller still decides which content belongs in each frame.

Both changes are required. `run_worker_first` without the wrapper stops serving assets, and the wrapper without `run_worker_first` never sees a request that matches an asset. Worker-first routing also incurs a Worker invocation for asset requests. Cloudflare supports [selective Worker-first paths](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/#run-worker-first-for-selective-paths), but every frame-resolved prerendered path must be included, with and without its trailing slash. Excluding it restores the asset-first behavior that causes this bug.

Keep the Vite plugins composed as above, with `prerender` added to `remix({ serverHandler: false, prerender: true })`. `@pitlane/dev` does not change your Wrangler routing settings.

Check the production build with `vp preview`: a request to a frame-resolved route carrying the frame headers must return frame content without an asset redirect or a document shell. The wrapper forwards the URL unchanged, so the controller must handle the trailing-slash forms used by your links and frame sources. An ordinary document request should still serve the prerendered HTML. Click between frame-targeted links and confirm that the page retains one header and footer.

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

A client-only Remix 3 app runs `remix()` in [SPA mode](/guides/spa) and drops `@cloudflare/vite-plugin`: `server: false` builds no server environment, so there is no worker to run. The plugin's remaining job is [component HMR](/guides/hmr#component-hmr), which is why it earns its place in a static build.

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

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix({ server: false })],
});
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

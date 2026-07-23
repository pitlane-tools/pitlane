---
title: Deploy to Deno Deploy
description: Run a Remix 3 app on Deno Deploy — the built fetch handler behind a three-line Deno.serve entrypoint, built and deployed by Deploy's own infrastructure.
---

# Deno Deploy

Deploy a Remix 3 app to [Deno Deploy](https://deno.com/deploy) — the new platform at [console.deno.com](https://console.deno.com), which runs full Deno 2 apps with integrated builds, CDN caching, and built-in logs, traces, and metrics. No platform plugin is involved: Deploy builds your app on its infrastructure and runs the built fetch handler under real Deno.

::: warning New Deploy only
This guide targets the current Deno Deploy. Deploy Classic (`dash.deno.com`) shut down on July 20, 2026 — if you're coming from it, see the [migration guide](https://docs.deno.com/deploy/migration_guide/).
:::

## Configuration

`remix()` needs no Deploy-specific options — the defaults apply. Two small files adapt the project to Deno:

```jsonc
// deno.json
{
    "nodeModulesDir": "auto",
    "tasks": { "build": "vite build" }
}
```

Deploy's **Dynamic Entrypoint** is executed the way `deno run` executes a file, so it must start a server. Wrap the built fetch handler in three lines:

```ts
// main.ts
import server from "./dist/ssr/index.js";

Deno.serve({ port: Number(Deno.env.get("PORT") ?? 8000) }, request => server.fetch(request));
```

Static assets keep flowing through the `staticFiles("./dist/client")` middleware in your router, same as every other server target.

The app's build configuration (dashboard **Edit build config**, or CLI flags):

| Setting | Value |
| --- | --- |
| Framework preset | No Preset |
| Install command | `deno install` |
| Build command | `deno task build` |
| Runtime configuration | Dynamic |
| Dynamic Entrypoint | `main.ts` |

## Local development

```sh
vp dev      # dev server through @pitlane/dev
vp build    # production build
vp preview  # serve the production build
```

To exercise the production bundle under Deno itself before deploying:

```sh
deno serve --port 3000 dist/ssr/index.js
```

## Deploy with the CLI

The `deno deploy` command ships with the Deno CLI. It tarballs your source, uploads it, and **builds on Deploy's infrastructure** using the app's build configuration — no local build step:

```sh
deno deploy                      # first run: authenticates, prompts for app name
deno deploy --app my-remix-app --prod
```

Create the app non-interactively (flags switch the wizard off):

```sh
deno deploy create \
    --org my-org \
    --app my-remix-app \
    --entrypoint main.ts
```

Useful companions:

```sh
deno deploy logs                 # stream runtime logs
deno deploy env load .env       # push env vars; secret-looking keys are auto-marked secret
```

## Deploy with GitHub Actions

Create an access token at [console.deno.com/account/access-tokens](https://console.deno.com/account/access-tokens) and store it as the `DENO_DEPLOY_TOKEN` repository secret. Deploy builds server-side, so the workflow only uploads the checkout:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
    push:
        branches: [main]

permissions:
    contents: read

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: denoland/setup-deno@v2
              with:
                  deno-version: v2.x

            - run: deno deploy --app my-remix-app --prod
              env:
                  DENO_DEPLOY_TOKEN: ${{ secrets.DENO_DEPLOY_TOKEN }}
```

::: info Where's the build step?
There isn't one, on purpose. `deno deploy` uploads a source tarball (excluding `node_modules` unless `--allow-node-modules`), and Deploy runs the app's configured install and build commands — `deno install`, `deno task build` — on its own build infrastructure; that's the **Install** and **Build** sections streaming in the build logs, with their own [timeout and memory limits](https://docs.deno.com/runtime/reference/cli/deploy/). Adding `vp build` to this workflow would build twice and ship nothing extra. This is the same shape as the [Railway workflow](/deploy/railway#deploy-with-github-actions) — the platform builds; CI only uploads.
:::

## Environment variables

Set them per context — **Production** for production domains, **Development** for preview/branch URLs — in the dashboard's environment-variables drawer, or push a local file with `deno deploy env load .env`. They reach the app through `Deno.env.get()` (and `process.env` under Node compatibility).

## Client-only apps (SPA)

A client-only Remix 3 app skips `@pitlane/dev` entirely — with no SSR and no `clientEntry()` boundaries there is nothing to transform, so no Remix- or Pitlane-specific Vite settings are needed. Deno Deploy hosts static sites first-class, including a **Single Page App mode** that serves `index.html` for unmatched paths — no wrapper entrypoint, no fallback hacks.

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

Configure the app as **Static** with directory `dist` and Single Page App mode on — in the dashboard, or in one non-interactive command:

```sh
deno deploy create \
    --org my-org \
    --app my-remix-spa \
    --runtime-mode static \
    --static-dir dist \
    --single-page-app
```

Deploys are unchanged: `deno deploy --prod` from the CLI, or the same [GitHub Actions workflow](#deploy-with-github-actions) above.

::: warning Verify with the template
The Dynamic Entrypoint contract (`Deno.serve` wrapper, `PORT` injection) follows Deploy's current documentation; the [pitlane-tools](https://github.com/pitlane-tools) templates are the tested reference for this composition.
:::

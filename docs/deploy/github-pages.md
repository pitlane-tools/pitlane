---
title: Deploy to GitHub Pages
description: "Deploy a client-only Remix 3 app to GitHub Pages with remix({ server: false }), covering the base path and the 404.html fallback a project site needs."
---

# GitHub Pages

[GitHub Pages](https://pages.github.com) serves static files only — there is no server runtime, so this guide is exclusively for **client-only Remix 3 apps**. (Need SSR? Pick a target with a server: [Cloudflare](/deploy/cloudflare), [Netlify](/deploy/netlify), [Vercel](/deploy/vercel), or [Railway](/deploy/railway).)

::: tip Start from the template
`npx giget github:pitlane-tools/templates/github-pages my-app` scaffolds a working guest book app wired for this guide — see [pitlane-tools/templates](https://github.com/pitlane-tools/templates).
:::

A client-only app runs `remix()` in [SPA mode](/guides/spa): `server: false` turns off the server environment, so there is nothing to build to `dist/ssr` and nothing serving requests in dev. The plugin still gives you [component hot module replacement](/guides/hmr#component-hmr), which is why it earns its place in a static build.

## Setup

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
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "remix/ui" } }
```

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix({ server: false })],
});
```

## The two GitHub Pages quirks

**Base path.** A project site is served from `https://<user>.github.io/<repo>/`, so Vite needs the base configured or every asset URL 404s:

```ts
// vite.config.ts
export default defineConfig({
    base: "/<repo>/",
    plugins: [remix({ server: false })],
});
```

User/organization sites (`<user>.github.io`) and custom domains serve from `/` and skip this.

**SPA fallback.** Pages has no rewrite rules; the convention is a `404.html` that is a copy of `index.html`, so deep links boot the app:

```sh
vite build && cp dist/index.html dist/404.html
```

## Deploy with GitHub Actions

GitHub Pages deploys through Actions — there is no separate CLI deploy. Enable it once under **Settings → Pages → Source: GitHub Actions**, then:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
    push:
        branches: [main]

permissions:
    contents: read
    pages: write
    id-token: write

concurrency:
    group: pages
    cancel-in-progress: false

jobs:
    deploy:
        runs-on: ubuntu-latest
        environment:
            name: github-pages
            url: ${{ steps.deployment.outputs.page_url }}
        steps:
            - uses: actions/checkout@v4

            - uses: actions/setup-node@v4
              with:
                  node-version: 24

            - run: npm ci

            - run: npm run build && cp dist/index.html dist/404.html

            - uses: actions/configure-pages@v5

            - uses: actions/upload-pages-artifact@v3
              with:
                  path: dist

            - id: deployment
              uses: actions/deploy-pages@v4
```

Every push to `main` publishes; the deployment URL shows up on the workflow run and under the repository's **Environments**.

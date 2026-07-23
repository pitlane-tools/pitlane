---
title: Remix SPA on static hosting
description: Build a client-only Remix 3 app with plain Vite — no @pitlane/dev needed — and deploy it to any static host.
---

# Remix SPA

A client-only Remix 3 app is just a static site: there's no SSR, and since every component already runs in the browser there are no `clientEntry()` boundaries to transform.

**You don't need `@pitlane/dev` for this.** The plugin exists to orchestrate a server + client build pair and rewrite hydration entries; a SPA has neither. Plain Vite is the whole toolchain.

## Setup

```ts
// vite.config.ts
import { defineConfig } from "vite"; // or "vite-plus"

export default defineConfig({});
```

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

Mount the app with `createRoot` from `remix/ui`:

```tsx
// app/main.tsx
import { createRoot, on, type Handle } from "remix/ui";

function App(handle: Handle) {
    let count = 0;

    return () => (
        <div>
            <h1>Count: {count}</h1>
            <button
                mix={[
                    on("click", () => {
                        count++;
                        handle.update();
                    }),
                ]}
            >
                Increment
            </button>
        </div>
    );
}

createRoot(document.getElementById("app")!).render(<App />);
```

Set the JSX runtime in `tsconfig.json`:

```jsonc
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "remix/ui"
    }
}
```

```sh
vite dev      # dev server
vite build    # static build → dist/
vite preview  # serve the build locally
```

## Deploying

`dist/` is a plain static site — any static host works. The only server-side concern is the **SPA fallback**: unknown paths must serve `index.html` so the app boots on deep links.

::: code-group

```jsonc [Cloudflare (wrangler.jsonc)]
{
    "name": "my-remix-spa",
    "compatibility_date": "2026-04-02",
    "assets": {
        "directory": "./dist",
        "not_found_handling": "single-page-application",
    },
}
```

```toml [Netlify (netlify.toml)]
[build]
  command = "vite build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

```json [Vercel (vercel.json)]
{
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

:::

### Deploy with the CLI

```sh
# Cloudflare (reads wrangler.jsonc)
vite build && npx wrangler deploy

# Netlify (reads netlify.toml)
vite build && npx netlify-cli deploy --prod

# Vercel
npx vercel --prod
```

### Deploy with GitHub Actions

The static build deploys with the same workflows as the server targets — swap the deploy step in from the matching provider guide ([Cloudflare](/deploy/cloudflare#deploy-with-github-actions), [Netlify](/deploy/netlify#deploy-with-github-actions), [Vercel](/deploy/vercel#deploy-with-github-actions)). Cloudflare, for example:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
    push:
        branches: [main]

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: actions/setup-node@v4
              with:
                  node-version: 24

            - run: npm ci

            - run: npm run build

            - run: npx wrangler deploy
              env:
                  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## When to reach for `@pitlane/dev`

The moment you add a server — SSR, server routes, form actions handled by `remix/router` — you're back in fetch-handler territory: add `@pitlane/dev`, an `app/entry.server.tsx`, and pick a [deployment target](/package/dev#deployment). Client components you want hydrated from server HTML become `clientEntry()` exports at that point, not before.

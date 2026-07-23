---
title: Deploy to Railway
description: Run a Remix 3 app on Railway under Node, Bun, or Deno — the built fetch handler plus one Dockerfile.
---

# Railway

Deploy a Remix 3 app to [Railway](https://railway.com) as a plain server process — no platform plugin involved. `vite build` produces `dist/ssr/index.js` (your fetch handler) and `dist/client/` (static assets, served by the `staticFiles` middleware in your router), and a Dockerfile runs whichever runtime you choose.

When a `Dockerfile` is present at the repository root, [Railway builds and deploys it automatically](https://docs.railway.com/builds/dockerfiles) — the image you define is exactly what runs. Railway injects a `PORT` environment variable at runtime; your server binds `0.0.0.0:$PORT`.

Add a `.dockerignore` so builds stay small and reproducible:

```
node_modules
dist
.git
```

## Node

The Node template's `server.ts` already reads `PORT` (Node runs TypeScript directly):

```ts
// server.ts
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

// @ts-expect-error - built output has no types
import ssr from "./dist/ssr/index.js";

let server = http.createServer(createRequestListener(request => ssr.fetch(request)));
server.listen(process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000);
```

```dockerfile
# Dockerfile
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
CMD ["node", "server.ts"]
```

The exec-form `CMD` is fine here because `server.ts` reads `process.env.PORT` itself.

## Bun

Bun runs the built entry directly — when a module default-exports a `fetch` handler, `bun run` starts a server around it, listening on `$PORT` automatically (`$BUN_PORT` → `$PORT` → `$NODE_PORT` → `3000`, bound to `0.0.0.0`). No wrapper file needed:

```dockerfile
# Dockerfile
FROM oven/bun:1-alpine
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

ENV NODE_ENV=production
CMD ["bun", "run", "dist/ssr/index.js"]
```

## Deno

The built entry matches `deno serve`'s default-export contract exactly. One flag matters: `deno serve` does **not** read `$PORT` itself, so pass it explicitly — and use the **shell-form `CMD`**, because exec-form (`CMD ["deno", …]`) never expands environment variables:

```dockerfile
# Dockerfile
FROM denoland/deno:alpine
WORKDIR /app

COPY . .
RUN deno install --allow-scripts
RUN deno task build

# Shell form so Railway's injected $PORT expands.
CMD deno serve -A --port=$PORT dist/ssr/index.js
```

(`-A` grants the runtime permissions the server code needs; tighten to specific `--allow-*` flags once you know your app's surface.)

## Deploy with the CLI

```sh
npm i -g @railway/cli   # or: brew install railway
railway login
railway init            # new project (or `railway link` for an existing one)
railway up              # upload + build the Dockerfile + deploy
railway domain          # generate the public URL — services are private by default
```

Railway builds the image on its side, so no local Docker (or local build step) is needed before `railway up`.

## Deploy with GitHub Actions

Create a project-scoped token (**Project Settings → Tokens**) and store it as the `RAILWAY_TOKEN` repository secret. The image build still runs on Railway; the workflow only uploads the checkout:

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

            - run: npm i -g @railway/cli

            - run: railway up --service my-remix-app --detach
              env:
                  RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

`--service` names the Railway service to deploy into (`railway status` lists them); `--detach` returns once the upload is accepted instead of streaming build logs into the Actions run.

## Environment variables

Set them per service in the dashboard (**Variables**) or `railway variable set KEY=value`. Railway injects `PORT`; define your own only if you need a fixed port. `railway run <cmd>` injects the service's variables into a local process for parity debugging.

## Client-only apps (SPA)

A client-only Remix 3 app skips `@pitlane/dev` entirely — with no SSR and no `clientEntry()` boundaries there is nothing to transform, so no Remix- or Pitlane-specific Vite settings are needed. Plain Vite builds a static site; on Railway, a multi-stage Dockerfile builds it and serves it with [Caddy](https://caddyserver.com).

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

The Caddyfile binds Railway's injected port and rewrites deep links to `index.html`:

```
# Caddyfile
:{$PORT}
root * /srv
encode gzip
try_files {path} /index.html
file_server
```

```dockerfile
# Dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
```

Deploys are unchanged: `railway up` from the CLI, or the same [GitHub Actions workflow](#deploy-with-github-actions) above.

::: tip Zero-config static hosting
The Dockerfile keeps the serving stack explicit and in your repo. Railway's own [static hosting](https://docs.railway.com/guides/static-hosting) path is even shorter — deploy the repo from GitHub with no configuration and Railpack detects the static Vite build itself. Either way you get automatic SSL, [custom domains](https://docs.railway.com/networking/public-networking#custom-domains), per-PR [preview environments](https://docs.railway.com/environments#enable-pr-environments), and an optional [built-in CDN](https://docs.railway.com/networking/cdn).
:::

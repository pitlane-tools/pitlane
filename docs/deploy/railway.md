---
title: Deploy to Railway
description: Run a Remix 3 app on Railway under Node, Bun, or Deno — the built fetch handler plus one Dockerfile.
---

# Railway

Deploy a Remix 3 app to [Railway](https://railway.com) as a plain server process — no platform plugin involved. `vite build` produces `dist/ssr/index.js` (your fetch handler) and `dist/client/` (static assets, served by the `staticFiles` middleware in your router), and a Dockerfile runs whichever runtime you choose.

::: tip Start from a template
`npx giget github:pitlane-tools/templates/railway-node my-app` (or `railway-bun`, `railway-deno`) scaffolds a working guest book app wired for this guide — see [pitlane-tools/templates](https://github.com/pitlane-tools/templates).
:::


The Dockerfile is **built in your CI, never by Railway**: CI runs `docker build` (the Vite build happens inside it, under your control), pushes the image to [GitHub Container Registry](https://ghcr.io), and the Railway service [deploys that pre-built image](https://docs.railway.com/quick-start#deploying-your-project---from-a-docker-image) — Railway only pulls and runs. It injects a `PORT` environment variable at runtime; your server binds `0.0.0.0:$PORT`.

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

Bun's automatic serving of default-exported `fetch` handlers doesn't apply cleanly here: `bun run` passes its `Server` object as a second argument and routes through its own server wrapper, which breaks the router's action dispatch (form `POST`s fall through to the index render). Wrap the built entry in a three-line `Bun.serve` server instead:

```ts
// server.ts
// @ts-expect-error - built output has no types
import ssr from "./dist/ssr/index.js";

let server = Bun.serve({
    port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000,
    fetch: request => ssr.fetch(request),
});
```

```dockerfile
# Dockerfile
FROM oven/bun:1-alpine
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

ENV NODE_ENV=production
CMD ["bun", "server.ts"]
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

One-time setup: create an empty project at [railway.com/new](https://railway.com/new), add a service with **Docker Image** as the source (e.g. `ghcr.io/<user>/my-remix-app:latest` — [private images](https://docs.railway.com/builds/private-registries) need registry credentials), and generate a domain (**Settings → Networking** — services are private by default).

Install the [Railway CLI](https://docs.railway.com/reference/cli) as a dev dependency:

::: code-group

```sh [npm]
npm add -D @railway/cli
```

```sh [yarn]
yarn add -D @railway/cli
```

```sh [pnpm]
pnpm add -D @railway/cli
```

```sh [bun]
bun add -D @railway/cli
```

```sh [deno]
deno add -D npm:@railway/cli
```

```sh [vp]
vp add -D @railway/cli
```

```sh [vlt]
vlt add -D @railway/cli
```

```sh [nub]
nub add -D @railway/cli
```

:::

Then every deploy is: build the image, push it, tell Railway to pull it.

```sh
docker build -t ghcr.io/<user>/my-remix-app:latest .
docker push ghcr.io/<user>/my-remix-app:latest

vpx railway login
vpx railway link            # link this directory to the project once
vpx railway redeploy --service my-remix-app --yes
```

`railway redeploy` re-pulls the image tag and rolls the service — no source upload, no platform build.

## Deploy with GitHub Actions

Create a project-scoped token (**Project Settings → Tokens**) and store it as the `RAILWAY_TOKEN` repository secret. The workflow builds the image (running the Vite build inside `docker build`, in CI), pushes it to GHCR with the built-in `GITHUB_TOKEN`, and redeploys the service:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
    push:
        branches: [main]

permissions:
    contents: read
    packages: write

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: docker/login-action@v3
              with:
                  registry: ghcr.io
                  username: ${{ github.actor }}
                  password: ${{ secrets.GITHUB_TOKEN }}

            - uses: docker/build-push-action@v6
              with:
                  context: .
                  push: true
                  tags: ghcr.io/${{ github.repository }}:latest

            - uses: voidzero-dev/setup-vp@v1

            - run: vp install --frozen-lockfile

            - run: vpx railway redeploy --service my-remix-app --yes
              env:
                  RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

`--service` names the Railway service to roll (`railway status` lists them). The Vite build point is the `docker build` step — in CI, under your control, never on the platform.

## Environment variables

Set them per service in the dashboard (**Variables**) or `railway variable set KEY=value`. Railway injects `PORT`; define your own only if you need a fixed port. `railway run <cmd>` injects the service's variables into a local process for parity debugging.

## Client-only apps

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

Deploys are unchanged: the same image flow — `docker build` + push + `railway redeploy` from the CLI, or the same [GitHub Actions workflow](#deploy-with-github-actions) above.

::: tip Platform features

However the image ships, the service gets automatic SSL, [custom domains](https://docs.railway.com/networking/public-networking#custom-domains), per-PR [preview environments](https://docs.railway.com/environments#enable-pr-environments), and an optional [built-in CDN](https://docs.railway.com/networking/cdn).

:::

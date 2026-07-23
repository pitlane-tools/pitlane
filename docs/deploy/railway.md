---
title: Deploy to Railway
description: Run a Remix 3 app on Railway under Node, Bun, or Deno — the built fetch handler plus one railway.json.
---

# Railway

Deploy a Remix 3 app to [Railway](https://railway.com) as a plain server process — no platform plugin involved. `vite build` produces `dist/ssr/index.js` (your fetch handler) and `dist/client/` (static assets, served by the `staticFiles` middleware in your router), and Railway runs whichever runtime you choose.

Railway builds with [Railpack](https://docs.railway.com/builds/railpack) and injects a `PORT` environment variable; your server binds `0.0.0.0:$PORT`. Runtime autodetection differs per runtime (and Bun's is genuinely ambiguous in Railway's own docs), so every section below commits an explicit [`railway.json`](https://docs.railway.com/config-as-code/reference) — deterministic beats detected.

## Node

The Node template's `server.ts` already reads `PORT`:

```ts
// server.ts
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

// @ts-expect-error - built output has no types
import ssr from "./dist/ssr/index.js";

let server = http.createServer(createRequestListener(request => ssr.fetch(request)));
server.listen(process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000);
```

```json
// railway.json
{
    "$schema": "https://railway.com/railway.schema.json",
    "build": {
        "builder": "RAILPACK",
        "buildCommand": "npm run build"
    },
    "deploy": {
        "startCommand": "node server.ts",
        "restartPolicyType": "ON_FAILURE"
    }
}
```

## Bun

Bun runs the built entry directly — when a module default-exports a `fetch` handler, `bun run` starts a server around it, listening on `$PORT` automatically (`$BUN_PORT` → `$PORT` → `$NODE_PORT` → `3000`, bound to `0.0.0.0`). No wrapper file needed:

```json
// railway.json
{
    "$schema": "https://railway.com/railway.schema.json",
    "build": {
        "builder": "RAILPACK",
        "buildCommand": "bun run build"
    },
    "deploy": {
        "startCommand": "bun run dist/ssr/index.js",
        "restartPolicyType": "ON_FAILURE"
    }
}
```

::: tip
Railway's own Bun guide recommends a Dockerfile because Railpack's Bun detection is limited to package-manager detection in `package.json` projects. The explicit `railway.json` above sidesteps the ambiguity without Docker; a Dockerfile (`FROM oven/bun:1-alpine`) remains a fine alternative.
:::

## Deno

The built entry matches `deno serve`'s default-export contract exactly. One flag matters: `deno serve` does **not** read `$PORT` itself, so pass it explicitly:

```json
// railway.json
{
    "$schema": "https://railway.com/railway.schema.json",
    "build": {
        "builder": "RAILPACK",
        "buildCommand": "deno task build"
    },
    "deploy": {
        "startCommand": "deno serve -A --port=$PORT dist/ssr/index.js",
        "restartPolicyType": "ON_FAILURE"
    }
}
```

Railpack-driven start commands run in a shell, so `$PORT` expands as written. (`-A` grants the runtime permissions the server code needs; tighten to specific `--allow-*` flags once you know your app's surface.)

## Deploy with the CLI

```sh
npm i -g @railway/cli   # or: brew install railway
railway login
railway init            # new project (or `railway link` for an existing one)
railway up              # build + deploy the current directory
railway domain          # generate the public URL — services are private by default
```

## Deploy from git

**New Project → Deploy from GitHub repo** in the [Railway dashboard](https://railway.com/new); every push to the linked branch auto-deploys. Turn on **Wait for CI** in service settings to gate deploys on GitHub Actions. Generate a domain under **Settings → Networking** — same as the CLI flow, nothing is public until you do.

## Environment variables

Set them per service in the dashboard (**Variables**) or `railway variable set KEY=value`. Railway injects `PORT`; define your own only if you need a fixed port. `railway run <cmd>` injects the service's variables into a local process for parity debugging.

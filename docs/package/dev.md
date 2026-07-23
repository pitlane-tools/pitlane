---
title: "@pitlane/dev"
description: The remix() Vite plugin for Remix 3 — build orchestration, hydration transform, dev server, and preview for any Vite or Vite+ project.
---

# @pitlane/dev

The `remix()` Vite plugin for [Remix 3](https://remix.run). One plugin wires a Remix app into any Vite or [Vite+](https://viteplus.dev) project:

- **Build orchestration** — a `client` + `ssr` environment pair with sensible output defaults (`dist/client`, `dist/ssr`), built in the right order.
- **The `clientEntry()` transform** — `clientEntry(import.meta.url, …)` components resolve to hashed production chunk URLs with export fragments, in every environment.
- **Dev server** — `vite dev` serves requests through your app's own fetch handler, with HMR.
- **Preview** — `vite preview` runs the production build through the same fetch handler production runs.

`@pitlane/dev` is deliberately platform-agnostic: your server entry default-exports a standard fetch handler, and hosting composes around it. Platform plugins — `@cloudflare/vite-plugin`, `@netlify/vite-plugin`, `nitro/vite` — sit alongside it in the same plugin array, and plain fetch runtimes (Node, Bun, Deno) run the built output directly.

**Composable hosting, not a hosting engine.**

## Installation

::: code-group

```sh [vp]
vp add -D @pitlane/dev
```

```sh [npm]
npm install --save-dev @pitlane/dev
```

```sh [pnpm]
pnpm add -D @pitlane/dev
```

:::

`@pitlane/dev` declares `remix@^3.0.0-beta.5` and `vite@>=7` as peer dependencies.

## Quick start

A complete setup is three files: the Vite config, a server entry, and a browser entry.

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite"; // or "vite-plus"

export default defineConfig({
    plugins: [remix()],
});
```

```tsx
// app/entry.server.tsx
import { staticFiles } from "remix/middleware/static";
import { createRouter, type MiddlewareContext } from "remix/router";

import { Document } from "./document.tsx";
import { render, type RenderMiddleware } from "./render.tsx";
import { routes } from "./routes.ts";

type AppContext = MiddlewareContext<[RenderMiddleware]>;

declare module "remix/router" {
    interface RouterTypes {
        context: AppContext;
    }
}

export let router = createRouter<AppContext>({
    middleware: [staticFiles("./dist/client"), render()],
});

router.map(routes.home, ({ render }) => render(<Document />));

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
```

```ts
// app/entry.browser.ts
import { run } from "remix/ui";

run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
    },
    async resolveFrame(src, signal) {
        let response = await fetch(src, { headers: { accept: "text/html" }, signal });
        return response.body ?? (await response.text());
    },
});
```

Then the standard Vite lifecycle applies:

```sh
vp dev      # dev server with HMR, requests served by your router
vp build    # production build → dist/ssr + dist/client
vp preview  # serve the production build locally
```

(Substitute `vite dev`, `vite build`, and `vite preview` on generic Vite.)

## Options

Every option has a sensible default; most projects pass none.

```ts
remix({
    clientEntry: "app/entry.browser", // false disables the client build
    serverEntry: "app/entry.server",
    serverEnvironments: ["ssr"],
    serverHandler: true, // false when a platform plugin serves dev requests
});
```

| Option               | Type              | Default               | Purpose                                                                                                                              |
| -------------------- | ----------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------|
| `clientEntry`        | `string \| false` | `"app/entry.browser"` | Client entry module. Pass `false` for fully server-rendered apps with no hydration.                                                  |
| `serverEntry`        | `string`          | `"app/entry.server"`  | Server entry module, built as `dist/ssr/index.js`.                                                                                   |
| `serverEnvironments` | `string[]`        | `["ssr"]`             | Environment names the `clientEntry()` transform treats as "server".                                                                  |
| `serverHandler`      | `boolean`         | `true`                | Serve dev requests through your server entry. Set `false` when `@cloudflare/vite-plugin`, `@netlify/vite-plugin`, or `nitro/vite` owns dev-time request handling. |

## The server entry contract

The server entry **default-exports a fetch handler** — an object exposing `fetch(request: Request): Response | Promise<Response>`. A `createRouter()` router already satisfies it:

```ts
export default router;
```

That one shape is the entire composition seam:

- **Dev** (`serverHandler: true`) imports the entry through Vite's module runner and calls `default.fetch` per request.
- **Preview** imports the built `dist/ssr/index.js` and calls `default.fetch`.
- **Production** is whatever your target does with a fetch handler — a Workers module export, `Bun.serve`, `deno serve`, or Node via `remix/node-fetch-server`.

Extra runtime exports compose around it without breaking the contract:

```ts
export default {
    fetch: router.fetch,
    async queue(batch) {
        /* ... */
    },
};
```

::: warning
A named export (`export let router = …`) alone is not enough — the **default** export is the contract every consumer reads.
:::

## Asset references

Server-rendered documents need the URLs of hashed client assets. Import any module with the `?assets=` query to get its resolved assets for an environment, and merge results with `mergeAssets` from `@pitlane/dev/runtime`:

```tsx
// app/document.tsx
import { mergeAssets } from "@pitlane/dev/runtime";

import clientAssets from "./entry.browser.ts?assets=client";
import serverAssets from "./entry.server.tsx?assets=ssr";

export function Document() {
    let assets = mergeAssets(clientAssets, serverAssets);

    return () => (
        <html lang="en">
            <head>
                {assets.css.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="stylesheet" />
                ))}
                <script async src={clientAssets.entry} type="module" />
                {assets.js.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="modulepreload" />
                ))}
            </head>
            <body>{/* ... */}</body>
        </html>
    );
}
```

Each result has the shape `{ entry?, js: [{ href }], css: [{ href }] }`, and `mergeAssets` deduplicates by `href`. During dev, URLs point at source modules and `js` is empty — Vite handles module loading and style injection itself. In production they point at hashed files in `dist/client`.

Add the ambient declarations to type `?assets=` imports:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@pitlane/dev/assets"] } }
```

## Authoring client entries

The transform rewrites `clientEntry(import.meta.url, …)` so the first argument becomes the module's asset URL plus an `#ExportName` fragment. On the server that URL feeds the hydration markers; in the browser it tells `run()` which chunk to load.

```tsx
import { clientEntry, on } from "remix/ui";

export const Counter = clientEntry(import.meta.url, handle => {
    let count = 0;
    return () => (
        <button mix={[on("click", () => { count++; handle.update(); })]}>
            Count: <span>{count}</span>
        </button>
    );
});
```

The matched pattern is strict, by design:

- **Named, top-level exports only** — `export const Name = clientEntry(import.meta.url, …)`. The `#Name` fragment comes from the export name.
- Default exports, aliased imports of `clientEntry`, and non-exported calls are intentionally left untouched.
- Multiple `clientEntry` exports in one file share a single assets import.

## Deployment

Component authoring and the client build never change across targets. Two things vary: the `serverHandler` option, and how production runs the built fetch handler.

### Node

The plugin defaults are all you need. Run the built entry under `node:http` with the adapter from `remix/node-fetch-server`:

```ts
// server.ts
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

// @ts-expect-error - built output has no types
import ssr from "./dist/ssr/index.js";

let server = http.createServer(createRequestListener(request => ssr.fetch(request)));
server.listen(process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000);
```

Static assets are served by the `staticFiles("./dist/client")` middleware inside your router, so preview and production share one code path and `server.ts` stays a one-liner.

### Bun

```ts
// server.ts
import router from "./app/entry.server.tsx";

Bun.serve({
    port: 3000,
    fetch: request => router.fetch(request),
});
```

### Deno

The built entry already satisfies `deno serve`'s default-export contract:

```sh
deno serve --allow-read --allow-net dist/ssr/index.js
```

### Cloudflare Workers

Hand the `ssr` environment to Cloudflare's plugin. Dev runs your server code inside workerd — real bindings, real runtime — and `vite preview` serves the production build through Miniflare.

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix({ serverHandler: false }), cloudflare({ viteEnvironment: { name: "ssr" } })],
});
```

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

Deploy with `wrangler deploy`.

### Netlify

```ts
export default defineConfig({
    plugins: [remix({ serverHandler: false }), netlify()],
});
```

### Vercel (via Nitro)

```ts
import { nitro } from "nitro/vite";

export default defineConfig({
    plugins: [remix({ serverHandler: false }), nitro()],
});
```

## Build layout

```
dist/
├── client/          # static assets, hashed — serve as-is
│   └── assets/*
└── ssr/
    └── index.js     # your fetch handler, bundled
```

`vite build` builds the SSR environment first, then the client — the client build resolves asset references against the SSR manifest, so the order is load-bearing. When another plugin also orchestrates builds (Cloudflare's, for example), `remix()` coordinates so each environment builds exactly once.

## Compatibility

| Dependency  | Tested against |
| ----------- | -------------- |
| `vite`      | 8.1.5          |
| `vite-plus` | 0.2.6          |
| `remix`     | 3.0.0-beta.5   |
| Node        | 24 LTS, 25     |

Remix 3 is in beta; each `@pitlane/dev` release records the exact beta it was verified against. Rolldown is not required — the transform runs identically on generic Vite and Vite+.

### Troubleshooting

**`AssertionError: isRunnableDevEnvironment(environment)` on `vite dev`** — the project resolves two different `vite` packages (typically Vite+ running the server while a plain `vite` install satisfies peer ranges). Give the project a single vite identity by aliasing, e.g. with pnpm:

```jsonc
// package.json
{
    "devDependencies": { "vite": "npm:@voidzero-dev/vite-plus-core@latest" },
    "pnpm": { "overrides": { "vite": "npm:@voidzero-dev/vite-plus-core@latest" } }
}
```

Generic-Vite projects have one vite by construction and are unaffected.

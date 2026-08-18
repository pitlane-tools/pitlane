# @pitlane/dev

The `remix()` Vite plugin for [Remix 3](https://remix.run). One plugin wires a Remix app into any Vite or [Vite+](https://viteplus.dev) project: multi-environment build orchestration, the `clientEntry()` hydration transform, dev serving through your app's fetch handler, and a preview server for the production build.

`@pitlane/dev` is deliberately platform-agnostic. Your server entry default-exports a standard fetch handler, and hosting composes around it — platform plugins (`@cloudflare/vite-plugin`, `@netlify/vite-plugin`, `nitro/vite`) in the same plugin array, or plain runtimes (Node, Bun, Deno) running the built output directly. Composable hosting, not a hosting engine.

## Install

```sh
npm install --save-dev @pitlane/dev
# or
vp add -D @pitlane/dev
```

Requires `remix@^3.0.0-beta.10` and `vite@>=7` as peers. Tested against **Vite 8.1** (Rolldown), **Vite+ 0.2** (`vp`), and `remix@3.0.0-beta.10` — the [templates](https://github.com/pitlane-tools/templates) are the continuously tested reference.

## Quick start

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
});
```

`vite dev` serves the app through your router. `vite build` produces `dist/ssr` and `dist/client`. `vite preview` serves the production build through the same fetch handler production runs.

> [!NOTE]
> Dev updates are coarse-grained today: the server entry is re-imported per request, and client edits trigger a page refresh. Remix UI's first-class HMR runtime is in progress upstream ([remix-run/remix#11515](https://github.com/remix-run/remix/pull/11515)) — we're tracking it, and `@pitlane/dev` will ship the companion transform once it lands so components hot-swap in place.

## Options

```ts
remix({
    clientEntry: "app/entry.browser", // default — false disables the client build
    serverEntry: "app/entry.server", // default
    serverEnvironments: ["ssr"], // default
    serverHandler: true, // default — false when a platform plugin serves dev requests
});
```

| Option               | Type              | Default               | Purpose                                                                                                                                                           |
| -------------------- | ----------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientEntry`        | `string \| false` | `"app/entry.browser"` | Client entry module. Pass `false` for fully server-rendered apps with no hydration.                                                                               |
| `serverEntry`        | `string`          | `"app/entry.server"`  | Server entry module, built as `dist/ssr/index.js`.                                                                                                                |
| `serverEnvironments` | `string[]`        | `["ssr"]`             | Environment names the `clientEntry()` transform treats as "server".                                                                                               |
| `serverHandler`      | `boolean`         | `true`                | Serve dev requests through your server entry. Set `false` when `@cloudflare/vite-plugin`, `@netlify/vite-plugin`, or `nitro/vite` owns dev-time request handling. |

## The server entry contract

The server entry **default-exports a fetch handler** — an object exposing `fetch(request: Request): Response | Promise<Response>`. A `createRouter()` router already is one:

```ts
export default router;
```

Every consumer speaks that same shape:

- **Dev** imports the entry through Vite's module runner and calls `default.fetch`.
- **Preview** imports `dist/ssr/index.js` and calls `default.fetch`.
- **Production** is whatever your target does with a fetch handler: `export default { fetch: router.fetch }` on Workers, `Bun.serve({ fetch: router.fetch })`, `deno serve dist/ssr/index.js`, or Node via `remix/node-fetch-server`.

Need extra worker exports? Wrap it:

```ts
export default {
    fetch: router.fetch,
    async queue(batch) {
        /* ... */
    },
};
```

## Asset references — `?assets=`

Server-rendered documents need the hashed URLs of client assets. Import any module with the `?assets=` query to get its resolved assets for an environment:

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

Each result is `{ entry?, js: [{ href }], css: [{ href }] }`; `mergeAssets` dedupes by href. In dev, URLs point at source modules and `js` is empty (Vite handles module loading); in production they point at hashed files in `dist/client`.

Type the query imports by adding the ambient declarations to your tsconfig:

```jsonc
{ "compilerOptions": { "types": ["@pitlane/dev/assets"] } }
```

## `clientEntry()` authoring rules

The transform rewrites `clientEntry(import.meta.url, …)` so the first argument becomes the module's asset URL plus an `#ExportName` fragment — on the server via the `?assets=client` manifest, on the client via `import.meta.url` itself.

```tsx
import { clientEntry, on } from "remix/ui";

export const Counter = clientEntry(import.meta.url, handle => {
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
            Count: <span>{count}</span>
        </button>
    );
});
```

The matched pattern is strict, by design:

- **Named, top-level exports only** — `export const Name = clientEntry(import.meta.url, …)`. The `#Name` fragment comes from the export name.
- Default exports, aliased imports of `clientEntry`, and non-exported calls are left untouched.
- Multiple `clientEntry` exports per file share one assets import.

## Deployment

The client build and component authoring never change across targets. Only two things vary: the `serverHandler` option and how production runs the built fetch handler.

### Node

```ts
// server.ts
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

// @ts-expect-error - built output has no types
import ssr from "./dist/ssr/index.js";

let server = http.createServer(createRequestListener(request => ssr.fetch(request)));
server.listen(process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000);
```

Static assets are served by the `staticFiles("./dist/client")` middleware inside your router, so `server.ts` stays a one-liner and preview/production share one code path.

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

`vite dev` runs your server code inside workerd (real bindings, real runtime), `vite preview` serves the production build through Miniflare, and `wrangler deploy` ships it.

### Netlify

Keep the defaults — Netlify's plugin emulates the platform in dev while your fetch handler serves SSR. A three-line Netlify Function (`netlify/functions/server.mjs`) wraps the built entry; see the [Netlify guide](https://pitlane.tools/deploy/netlify).

```ts
export default defineConfig({
    plugins: [remix(), netlify()],
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

`vite build` builds the SSR environment first, then the client (the client build resolves asset references against the SSR manifest). When another plugin also orchestrates builds — Cloudflare's, for example — `remix()` coordinates so each environment builds exactly once.

## Compatibility

| Dependency  | Tested against |
| ----------- | -------------- |
| `vite`      | 8.1.5          |
| `vite-plus` | 0.2.6          |
| `remix`     | 3.0.0-beta.10  |
| Node        | 24 LTS, 25     |

Remix 3 is in beta; each `@pitlane/dev` release records the exact beta it was verified against. Rolldown is not required — the transform runs identically on generic Vite and Vite+.

### Troubleshooting

**`AssertionError: isRunnableDevEnvironment(environment)` on `vite dev`** — your project resolves two different `vite` packages (typically Vite+ running the server while a plain `vite` install satisfies peer ranges). Give the project a single vite identity by aliasing, e.g. with pnpm:

```jsonc
// package.json
{
    "devDependencies": { "vite": "npm:@voidzero-dev/vite-plus-core@latest" },
    "pnpm": { "overrides": { "vite": "npm:@voidzero-dev/vite-plus-core@latest" } },
}
```

Generic-Vite projects have one vite by construction and are unaffected.

## License

MIT

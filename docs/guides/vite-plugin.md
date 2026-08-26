---
title: Using the Vite plugin
description: How @pitlane/dev's remix() plugin behaves in your app day to day, across the asset runtime, the clientEntry() transform and its footguns, dev-server semantics, preview, and the build.
---

# Using the Vite plugin

This guide covers living with `remix()` from `@pitlane/dev` day to day. It explains how asset references flow through your app and what the `clientEntry()` transform does, including what it deliberately refuses to do. Dev, preview, and the production build each get their own section. Hot module replacement has its own guide, [Hot module replacement](/guides/hmr). Exact API signatures live in the generated [API reference](/package/dev/). Per-target deployment configs live in the [deploy guides](#deploying).

## Installation

::: code-group

```sh [npm]
npm add -D @pitlane/dev
```

```sh [yarn]
yarn add -D @pitlane/dev
```

```sh [pnpm]
pnpm add -D @pitlane/dev
```

```sh [bun]
bun add -D @pitlane/dev
```

```sh [deno]
deno add -D npm:@pitlane/dev
```

```sh [vp]
vp add -D @pitlane/dev
```

```sh [vlt]
vlt add -D @pitlane/dev
```

```sh [nub]
nub add -D @pitlane/dev
```

:::

`@pitlane/dev` declares `remix@^3.0.0-beta.10` and `vite@>=7` as peer dependencies. The tested matrix is **Vite 8.1** (Rolldown) and **Vite+ 0.2** (`vp`) with `remix@3.0.0-beta.10`. The [templates](https://github.com/pitlane-tools/templates) exercise that matrix continuously in CI.

## Templates

Prefer starting from a working app? The [`pitlane-tools/templates`](https://github.com/pitlane-tools/templates) monorepo has the same Remix 3 guest book wired for eight deploy targets. Cloudflare uses D1. Netlify uses Netlify DB, while Vercel pairs Nitro with Postgres. Railway runs on Node, Bun, or Deno. The remaining templates cover Deno Deploy and GitHub Pages (Service Worker + IndexedDB). Scaffold one with [giget](https://github.com/unjs/giget):

```sh
npx giget github:pitlane-tools/templates/<template> my-app
```

Because every template is the same app, diffing any two shows exactly what a platform swap touches, usually only the database middleware and deploy config.

## The three-file core

Everything the plugin does orbits three files you own:

- **`vite.config.ts`** needs only `plugins: [remix()]`, and the defaults cover the rest.
- **`app/entry.server.tsx`** builds a router and **default-exports it**. The default export's `.fetch(Request)` is the contract every consumer reads: the dev server, `vite preview`, and whatever runs in production.
- **`app/entry.browser.ts`** calls `run()` from `remix/ui` to hydrate `clientEntry()` components against server HTML.

`vite dev`, `vite build`, `vite preview`: the standard lifecycle, nothing bespoke.

## Options

Every option has a sensible default. Most projects pass none.

```ts
remix({
    server: true, // false selects SPA mode
    prerender: undefined, // true, a path array, a function, or a config object
    clientEntry: "app/entry.browser", // false disables the client build
    serverEntry: "app/entry.server",
    serverEnvironments: ["ssr"],
    serverHandler: true, // false when a platform plugin serves dev requests
});
```

| Option               | Type                               | Default               | Purpose                                                                                                                                  |
| -------------------- | ---------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `server`             | `boolean`                          | `true`                | Whether the app has a server. Pass `false` for [SPA mode](#spa-mode), which ignores every option below.                                  |
| `prerender`          | `boolean \| string[] \| fn \| obj` | none                  | Render paths to static HTML at build time. See [Prerendering](/guides/prerendering).                                                     |
| `clientEntry`        | `string \| false`                  | `"app/entry.browser"` | Client entry module. Pass `false` for fully server-rendered apps with no hydration.                                                      |
| `serverEntry`        | `string`                           | `"app/entry.server"`  | Server entry module, built as `dist/ssr/index.js`.                                                                                       |
| `serverEnvironments` | `string[]`                         | `["ssr"]`             | Environment names the `clientEntry()` transform treats as "server".                                                                      |
| `serverHandler`      | `boolean`                          | `true`                | Serve dev requests through your server entry. Set `false` when `@cloudflare/vite-plugin` or `nitro/vite` owns dev-time request handling. |

## SPA mode

Some apps have no server: the router runs in the browser, the build is a
folder of static files. `remix({ server: false })` targets those. React Router
spells the same switch `ssr: false`.

```ts
// vite.config.ts
export default defineConfig({
    plugins: [remix({ server: false })],
});
```

The three-file core collapses to one. There is no `app/entry.server.tsx`, no
server environment, and no `dist/ssr`; `index.html` is the entry, and
`vite build` emits a static site beside it. Every other option on this page
goes unread, and the rest of this guide covers machinery a client-only app
never reaches. [Single-page apps](/guides/spa) is the guide for that mode.

The switch removes the server, not the server rendering. An app that wants a
browser-rendered UI in front of routes that still run per request keeps the
default mode: see [client rendering with a
server](/guides/spa#client-rendering-with-a-server).

## The asset runtime

Server-rendered HTML has to name the hashed client assets. The plugin's answer is the `?assets=` import query plus `mergeAssets` from `@pitlane/dev/runtime`:

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

Each result is `{ entry?, js: [{ href }], css: [{ href }] }`. `mergeAssets` deduplicates by `href`. Type the imports once in `tsconfig.json`:

```jsonc
{ "compilerOptions": { "types": ["@pitlane/dev/assets"] } }
```

### Dev and production resolve differently, by design

|                          | `vite dev`                                   | production build                                   |
| ------------------------ | -------------------------------------------- | -------------------------------------------------- |
| `entry`                  | source URL (`/app/entry.browser.ts`)         | hashed chunk (`/assets/entry.browser-D3adB33f.js`) |
| `js`                     | **always empty** (no chunk graph exists yet) | reachable chunks, for `modulepreload`              |
| `css` (`?assets=ssr`)    | dev links carrying `data-vite-dev-id`        | hashed files copied into `dist/client`             |
| `css` (`?assets=client`) | empty (Vite injects dev styles itself)       | hashed files                                       |

Write the `Document` once against the full shape and both modes come out right: empty arrays render nothing in dev, real tags in production.

::: warning Footgun Warning

`?assets=` is server-side data. In the client environment, `?assets=` imports resolve to an empty result, because the browser already knows its own modules, and Vite's preload optimization covers chunk loading. Read `?assets=` in server-rendered components (your `Document`), never in code that only runs in the browser expecting real values.

:::

## The `clientEntry()` transform

`clientEntry(import.meta.url, …)` marks a component for hydration. At build time the plugin rewrites the first argument into the module's asset URL plus an `#ExportName` fragment. At runtime the server writes that URL into hydration markers, and the browser's `run()` imports the chunk and hydrates in place.

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

Multiple `clientEntry` exports in one file share a single assets import, so grouping related islands per file is free.

### The pattern is strict and silent

The transform matches **exactly** this shape, at the top level of a module:

```
export const Name = clientEntry(import.meta.url, …at least one more argument)
```

Anything else is silently left untouched. An untransformed call passes `import.meta.url` through as a plain string. Server rendering still succeeds, but the hydration data points at a URL that isn't a client chunk. The failed module request leaves the component inert in the browser. If an island won't hydrate, check these first:

```tsx
// ✗ default export — no export name for the #fragment
export default clientEntry(import.meta.url, handle => {
    /* … */
});

// ✗ aliased callee — the transform matches the literal name `clientEntry`
import { clientEntry as ce } from "remix/ui";

export const Counter = ce(import.meta.url, handle => {
    /* … */
});

// ✗ not exported — the browser could never import it by name
const Counter = clientEntry(import.meta.url, handle => {
    /* … */
});

// ✗ wrapped in a helper — the call site the transform sees isn't clientEntry()
export const Counter = myIslandHelper(import.meta.url, handle => {
    /* … */
});

// ✗ computed first argument — must be literally `import.meta.url`
export const Counter = clientEntry(String(import.meta.url), handle => {
    /* … */
});

// ✓ the one true shape
export const Counter = clientEntry(import.meta.url, handle => {
    /* … */
});
```

Only a top-level `export const Name = clientEntry(…)` call is rewritten. The `#Name` fragment names a real export, and the explicit pattern cannot false-positive on unrelated `import.meta.url` usage in the same file (which the transform leaves alone).

### `serverEnvironments`

The transform needs to know which environments are "server". Server environments get the `?assets=client` prepend, and the client gets `import.meta.url + "#Name"`. The default, `["ssr"]`, is right unless you've renamed or added server environments. If you have, pass the same names to `remix({ serverEnvironments })`. [Hot module replacement](/guides/hmr) reads the same option to tell server modules from client ones, so a mismatch breaks both.

## Dev server semantics

With the default `serverHandler: true`, every request is answered by your server entry through Vite's module runner. The entry is re-imported per request, so server-side edits are live without restarting. The `if (import.meta.hot) import.meta.hot.accept()` line in the server entry is what keeps those re-imports cheap, so keep it.

::: info Hot module replacement

Component edits swap in place and keep live island state, and edits to server-only modules refetch the page through your fetch handler without discarding that state. Both are on by default in `vite dev`. See [Hot module replacement](/guides/hmr) for which edits preserve state, which remount, and the two requirements the server half has.

:::

- **Set `serverHandler: false` when a platform plugin owns dev requests.** `@cloudflare/vite-plugin` (workerd) and `nitro/vite` bring their own runtimes. Netlify's plugin does not serve SSR, so keep the default there. Each [deploy guide](#deploying) states the right value.
- **Aborted requests don't panic the overlay.** Search-as-you-type and mid-navigation fetch cancellations throw `aborted` errors that the plugin filters out of Vite's error overlay. Real errors still surface.

## Preview and the static-files footgun

`vite preview` imports `dist/ssr/index.js` and serves requests through its default export, the same artifact that production runs. If the import fails because the bundle targets another runtime (a Workers bundle importing `cloudflare:workers`), the plugin steps aside so the platform's preview can take over.

::: warning Footgun Warning

In dev, Vite serves every module and stylesheet itself. In preview and production, hashed assets under `dist/client` are served by **your router's** `staticFiles("./dist/client")` middleware (on platforms without a static layer, such as Node, Railway images, and preview). Forget the middleware and everything works in dev while every asset 404s in preview. That missing middleware is the usual cause of an unstyled preview. Platforms with their own static serving (Workers assets, Netlify's CDN, Vercel) bypass the middleware for those paths. Keeping it in the router is still correct and makes preview match production.

:::

## The build

`vite build` runs a coordinated multi-environment build:

```
dist/
├── client/          # hashed static assets
│   └── assets/*
└── ssr/
    └── index.js     # the fetch handler
```

- **SSR builds first, then the client.** The client build resolves `?assets=ssr` against the SSR manifest, so the order matters. The plugin sequences it, so don't hand-orchestrate builds around it.
- **Assets are never inlined** (`assetsInlineLimit: 0`) so every asset has a real hashed URL the `?assets=` runtime can name.
- **Composing with another build orchestrator is coordinated.** When a platform plugin also drives builds (Cloudflare's does), each environment still builds exactly once.

## Compatibility

| Dependency  | Tested against |
| ----------- | -------------- |
| `vite`      | 8.1.5          |
| `vite-plus` | 0.2.6          |
| `remix`     | 3.0.0-beta.10  |
| Node        | 24 LTS, 26     |

Remix 3 is in beta, and each `@pitlane/dev` release records the exact beta it was verified against. Rolldown is optional. The transform runs identically on generic Vite and Vite+.

### Troubleshooting

**`AssertionError: isRunnableDevEnvironment(environment)` on `vite dev`**. The project resolves two different `vite` packages (typically Vite+ running the server while a plain `vite` install satisfies peer ranges). Give the project a single vite identity by aliasing, e.g. with pnpm:

```jsonc
// package.json
{
    "devDependencies": {
        "vite": "npm:@voidzero-dev/vite-plus-core@latest",
    },
    "pnpm": {
        "overrides": {
            "vite": "npm:@voidzero-dev/vite-plus-core@latest",
        },
    },
}
```

Generic-Vite projects have one vite by construction and are unaffected.

## Deploying

Once the app works, pick a target. Each guide covers config, CLI deploys, and a GitHub Actions workflow, all with the Vite build running in your CI:

- [Cloudflare Workers](/deploy/cloudflare)
- [Netlify](/deploy/netlify)
- [Vercel](/deploy/vercel)
- [Railway](/deploy/railway)
- [Deno Deploy](/deploy/deno-deploy)
- [GitHub Pages](/deploy/github-pages) (client-only apps)

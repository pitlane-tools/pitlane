# @pitlane/vite-plugin-remix

A Vite plugin for [Remix](https://remix.run). It builds client and server bundles with an asset manifest for [`@pitlane/assets`](https://pitlane.tools/guides/assets), gives `clientEntry()` islands portable identities that Remix's `render({ assets })` resolves, serves development requests through your app's fetch handler, and previews the production build. It works with Vite and [Vite+](https://viteplus.dev).

Your server entry exports a standard fetch handler. Use platform plugins such as `@cloudflare/vite-plugin`, `@netlify/vite-plugin`, or `nitro/vite` in the same Vite config, or run the built application on Node, Bun, or Deno.

## Install

```sh
npm install --save-dev @pitlane/vite-plugin-remix
npm install @pitlane/assets
# or
vp add -D @pitlane/vite-plugin-remix
vp add @pitlane/assets
```

`@pitlane/assets` goes in `dependencies` because `app/assets.ts` imports its resolver at runtime. Requires `remix@^3.0.0` and `vite@>=8.1` as peers, on Node `^20.19.0 || >=22.12.0`. [Compatibility](#compatibility) lists the versions this release was tested against, and the [starter templates](https://github.com/pitlane-tools/templates) are complete example projects.

This package was published as `@pitlane/dev` through 0.7. The [upgrade table](https://pitlane.tools/guides/vite-plugin#upgrading-from-pitlanedev) lists every change.

## Quick start

```ts
// vite.config.ts
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite"; // or "vite-plus"

export default defineConfig({
    plugins: [remix()],
});
```

```ts
// app/assets.ts
import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

export let assets = createAssetResolver(manifest);

export let scriptEntry = await assets.getScriptEntry("app/entry.browser.ts");
export let stylesheets = await assets.getStylesheets("app/entry.server.tsx");
```

```tsx
// app/entry.server.tsx
import { render } from "remix/middleware/render";
import { staticFiles } from "remix/middleware/static";
import { createRouter, type MiddlewareContext } from "remix/router";

import { assets } from "./assets.ts";
import { Document } from "./document.tsx";
import { routes } from "./routes.ts";

let renderMiddleware = render({ assets });
type AppContext = MiddlewareContext<[typeof renderMiddleware]>;

declare module "remix/router" {
    interface RouterTypes {
        context: AppContext;
    }
}

export let router = createRouter<AppContext>({
    middleware: [staticFiles("./dist/client"), renderMiddleware],
});

router.map(routes.home, ({ render }) => render(<Document />));

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
```

The document reads `scriptEntry` and `stylesheets` from `app/assets.ts`; see [Document assets](#document-assets).

```ts
// app/entry.browser.ts
import { run } from "remix/component";

run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
    },
});
```

`vite dev` serves the app through your router. `vite build` produces `dist/ssr` and `dist/client`. `vite preview` serves the production build through the same fetch handler production runs.

## Hot module replacement

`vite dev` hot-updates both halves of a Remix app in place, keeping live client state. Full details, including which edits preserve state and which remount, are in the [HMR guide](https://pitlane.tools/guides/hmr).

**Components.** Editing a component swaps its new code in without remounting, so hydrated `clientEntry()` islands keep their state (open menus, form input, counters). This runs the [`remix/component-hmr`](https://github.com/remix-run/remix/tree/main/packages/component-hmr) transforms during dev. Both authoring styles hot-swap, because the plugin normalizes arrow-form component and `clientEntry()` exports to named functions before instrumenting them:

```tsx
// All of these hot-swap in place, preserving live state:
export const Counter = clientEntry(import.meta.url, handle => {
    /* ... */
});
export const Toggle = clientEntry(import.meta.url, function Toggle(handle) {
    /* ... */
});
export const Card = handle => () => <div />;
export function Panel(handle) {
    /* ... */
}
```

Only named (PascalCase) component exports in `.tsx`/`.jsx` files whose setup returns a render function are instrumented; other exports are left untouched. Editing the render function keeps live state. Editing the setup scope above the `return` remounts the component, so its state resets.

**Server data.** Editing a server-only module (the document, a middleware, a route handler, any module the client never imports) re-fetches the current page through your fetch handler and reconciles the new server-rendered HTML into the DOM. Hydrated island state survives, so you see fresh server output without a full-page reload. This is the Remix analog of React Router's loader/action revalidation, driven through the frame runtime rather than a client data router.

The plugin broadcasts a `server:update` event; your browser entry keeps the runtime `run()` returns and passes it to `revalidate` from `@pitlane/vite-plugin-remix/hmr` when one arrives:

```ts
// app/entry.browser.ts
import { revalidate } from "@pitlane/vite-plugin-remix/hmr";
import { run } from "remix/component";

let app = run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
    },
});

if (import.meta.hot) {
    import.meta.hot.on("server:update", () => revalidate(app));
}
```

Keep any existing `run()` options when adding the listener. `revalidate` waits for initial hydration, then reloads the top frame, which refetches the page through your fetch handler and reconciles it in place. A failed reload is logged and the next update retries. A newer update supersedes a reload still in flight, so the page shows the latest server output. Reloading the frame produces no history entry and fires no `navigate` event, so apps that intercept navigation themselves work unchanged.

Don't make the listener `async` or return the reload from it: Vite waits for listener promises and handles HMR messages one at a time, so a pending reload would hold back the next update.

A production build replaces `import.meta.hot` with `undefined` and drops the whole block. Apps with `clientEntry: false` have no browser entry to hold the listener, so server edits do not revalidate there. Version 0.7 and earlier rendered an `<HMR />` component from `pitlane:dev` instead; remove it from your document when you add the listener. See the [HMR guide](https://pitlane.tools/guides/hmr).

## Options

```ts
remix({
    server: true, // default — false selects SPA mode
    prerender: undefined, // default — true, a path array, a function, or a config object
    clientEntry: "app/entry.browser", // default — false builds no browser script
    serverEntry: "app/entry.server", // default
    serverEnvironments: ["ssr"], // default
    serverHandler: true, // default — false when a platform plugin serves dev and preview requests
    assets: {}, // default — { include, chunkImportMap } for @pitlane/assets
});
```

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `server` | `boolean` | `true` | Whether the app has a server. Pass `false` for [SPA mode](#spa-mode), which ignores every option below. |
| `prerender` | `boolean \| string[] \| fn \| obj` | none | Render paths to static HTML at build time. See [Prerendering](#prerendering). |
| `clientEntry` | `string \| false` | `"app/entry.browser"` | Browser script entry. Pass `false` for fully server-rendered apps with no hydration. |
| `serverEntry` | `string` | `"app/entry.server"` | Server entry module, built as `dist/ssr/index.js` and loaded for dev requests. |
| `serverEnvironments` | `string[]` | `["ssr"]` | Environment names treated as "server" for island discovery, stylesheet collection, and HMR. |
| `serverHandler` | `boolean` | `true` | Serve dev requests through your server entry with [`@pitlane/vite-plugin-fetch-server`](https://pitlane.tools/guides/fetch-server), and `vite preview` requests through the built one. Set `false` when `@cloudflare/vite-plugin` or `nitro/vite` owns request handling; their preview servers then serve the build. Netlify's plugin does not serve SSR, so keep the default there. |
| `assets` | `{ include?, chunkImportMap? }` | `{}` | Passed to the `@pitlane/assets` plugin: browser entries named by computed paths, and the chunk import map switch, which `remix()` turns on unless you pass `false`. |

## Prerendering

`prerender` writes responses to static HTML during `vite build`. For page routes, those are full documents. It does not automatically emit separate responses for frame targets at the same URL. There is no second rendering path: the build sends a `Request` through the same fetch handler production runs.

```ts
remix({ prerender: ["/", "/blog", "/blog/hello-world"] });
```

`true` prerenders every static path in the app's route map, which the server entry exports alongside its handler:

```ts
// app/entry.server.tsx
export { routes } from "./routes.ts";
export default router;
```

A function computes the list, and gets `getStaticPaths()` for the route-map half of it:

```ts
remix({
    async prerender({ getStaticPaths }) {
        let slugs = await getPostSlugsFromCMS();
        return [...getStaticPaths(), ...slugs.map(slug => `/blog/${slug}`)];
    },
});
```

The object form adds `concurrency`, and `spider` for following the links each rendered page contains:

```ts
remix({ prerender: { paths: ["/"], spider: true, concurrency: 4 } });
```

Each path lands at `<path>/index.html` under the client output. Rendering runs after both builds and the asset manifest, so the HTML names real hashed chunks. Unsupported with `server: false`, which builds no server to render with.

For fully static frame navigation, [prerender separate document and frame URLs](https://pitlane.tools/guides/prerendering#fully-static-frame-navigation). Use the frame URL in `<Frame src>` and link `data-rmx-src`, while `href` keeps the document URL for navigation and reloads. List both kinds of route in `prerender`, then deploy only the client output. This preserves 100% prerendering without frame headers, a custom resolver, or runtime SSR. The app supplies the frame routes and link attributes; the plugin does not generate them automatically. Cloudflare can serve the result with an [assets-only configuration](https://pitlane.tools/deploy/cloudflare#fully-static-frame-navigation). Hybrid Worker-first rendering is an explicit alternative for dynamic content.

A bundle Node cannot import renders anyway: `@cloudflare/vite-plugin` and friends already contribute a preview server, so when the import fails the build starts that server and renders through it, inside the runtime that will serve the pages. Selecting that runtime needs no extra configuration; serving the output still needs the routing described above.

Full details in the [prerendering guide](https://pitlane.tools/guides/prerendering); the crawler underneath is [`@pitlane/crawler`](https://pitlane.tools/package/crawler/), and the [crawling guide](https://pitlane.tools/guides/crawler) covers using it on its own.

## SPA mode

Some apps have no server — a static host, a router that never touches one. `remix({ server: false })` targets those. React Router spells the same switch `ssr: false`:

```ts
// vite.config.ts
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix({ server: false })],
});
```

There is no server environment, nothing is built to `dist/ssr`, and `vite build` emits a static site from your `index.html`. The plugin's one remaining job is the one a SPA still wants: component HMR. Editing a component swaps it in place and keeps live state, arrow forms included.

Every `server*` option goes with it, and `clientEntry` too — the browser entry is whatever `index.html` loads. There is no server data to revalidate, so the browser entry needs no server-update listener.

Deploying means pointing every unknown URL at `index.html` so the client router can resolve it; on GitHub Pages that is a copy of `index.html` at `404.html`, on Netlify a `/* /index.html 200` redirect.

The option removes the server, not the server rendering, which is what React Router's `ssr: false` does too. For a browser-rendered UI in front of routes that still run per request, stay in the default mode and let the server entry answer JSON on its data routes and one `remix/component` shell on its document routes: nothing here asks it to render app UI. [Client rendering with a server](https://pitlane.tools/guides/spa#client-rendering-with-a-server) shows the shape.

SPA mode also works under Vite's experimental bundled dev mode (`experimental.bundledDev`, or `vite dev --experimentalBundle`), component hot-swap included. Server-rendered apps do not yet: bundled dev serves only bundle entrypoints, so the client module URLs an SSR render writes into its HTML resolve to nothing. That is upstream's [Phase 4](https://github.com/vitejs/vite/discussions/22746) — server environments — still a prototype.

## The server entry contract

The server entry **default-exports a fetch handler** — an object exposing `fetch(request: Request): Response | Promise<Response>`. A `createRouter()` router already is one:

```ts
export default router;
```

Every consumer speaks that same shape:

- **Dev** imports the entry through Vite's module runner and calls `default.fetch`, through [`@pitlane/vite-plugin-fetch-server`](https://pitlane.tools/guides/fetch-server).
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

## Document assets

Server-rendered documents need the URLs of the browser entry, its preloads, and the stylesheets the server graph imports. `app/assets.ts` (above) resolves them once through [`@pitlane/assets`](https://pitlane.tools/guides/assets), and the document reads plain values:

```tsx
// app/document.tsx
import { ImportMap } from "remix/component/server";

import { scriptEntry, stylesheets } from "./assets.ts";

export function Document() {
    return () => (
        <html lang="en">
            <head>
                {stylesheets.map(href => (
                    <link key={href} rel="stylesheet" href={href} />
                ))}
                <ImportMap value={scriptEntry.importMap} />
                {scriptEntry.preloads.map(href => (
                    <link key={href} rel="modulepreload" href={href} />
                ))}
                <script type="module" src={scriptEntry.href} />
            </head>
            <body>{/* ... */}</body>
        </html>
    );
}
```

In dev, URLs point at source modules and `preloads` is empty; in production they point at hashed files in `dist/client`. `remix()` turns on Vite's chunk import maps, so in production `scriptEntry.importMap` is the client build's map: render it with Remix's `<ImportMap>` before any module script or `modulepreload` link. `remix({ assets: { chunkImportMap: false } })` turns maps off and leaves `{ imports: {} }`; apps using Vite's `experimental.renderBuiltUrl`, which cannot be combined with maps, need that.

## `clientEntry()` authoring rules

The transform rewrites the first argument of `clientEntry(import.meta.url, …)` to `"file:<path from the project root>#<ExportName>"`, the same literal in every environment. `render({ assets })` resolves that identity to the island's chunk and hoists its preloads; the island is emitted as its own client chunk with its exports intact.

```tsx
import { clientEntry, on } from "remix/component";

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
- Multiple `clientEntry` exports per file share one chunk.

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

Static assets are served by the `staticFiles("./dist/client")` middleware inside your router, so `server.ts` only starts a listener, and preview and production share one code path.

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
import { remix } from "@pitlane/vite-plugin-remix";
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

`vite dev` runs your server code inside workerd with your real bindings, `vite preview` serves the production build through Miniflare, and `wrangler deploy` ships it.

### Netlify

Keep the defaults: Netlify's plugin emulates the platform in dev while your fetch handler serves SSR. One Netlify Function (`netlify/functions/server.mjs`) imports the built entry and answers every request with it; see the [Netlify guide](https://pitlane.tools/deploy/netlify).

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

`dist` is Vite's `build.outDir`: set it, and the environments build into `<outDir>/client` and `<outDir>/ssr`, so point `staticFiles()` at the new client directory. Setting `environments.<name>.build.outDir` places that environment's output exactly where you name instead.

`vite build` builds the server environment first, then the client: islands and literal `getScriptEntry` paths are discovered in the server build and emitted by the client build. The asset manifest is written into `dist/ssr` before prerendering or any other orchestrator reads the build. When another plugin also orchestrates builds — Cloudflare's, for example — each environment still builds exactly once.

## Compatibility

| Dependency  | Tested against         |
| ----------- | ---------------------- |
| `vite`      | 8.1 and the latest 8.x |
| `vite-plus` | 1.0                    |
| `remix`     | 3.0.0                  |
| Node        | 26 (CI)                |

Each `@pitlane/vite-plugin-remix` release records the exact Remix version it was verified against. The supported Node range is `^20.19.0 || >=22.12.0`. The transform runs identically on generic Vite and Vite+.

### Troubleshooting

**`vp` stops with `Expected @voidzero-dev/vite-plus-core@…, but found vite@…`** — Vite+ 1.0 requires the `vite` your project declares to be Vite+ core at the same version as `vite-plus`. Alias it to the core. `vp migrate` sets up the same alias, pinned to the exact version:

```jsonc
// package.json
{
    "devDependencies": {
        "vite": "npm:@voidzero-dev/vite-plus-core@^1.0.0",
        "vite-plus": "^1.0.0",
    },
}
```

**pnpm reports the `vite >=8.1.0` peer as unmet under that alias** — `@voidzero-dev/vite-plus-core` reports its own version (`1.x`), not the Vite version it bundles, so the peer range cannot match it. Tell pnpm which versions of `vite` satisfy it:

```yaml
# pnpm-workspace.yaml
peerDependencyRules:
    allowedVersions:
        vite: "1"
```

Bun and npm install without complaint.

**`AssertionError: isRunnableDevEnvironment(environment)` on dev** — your project resolves two different `vite` packages, typically because a dependency installs a plain `vite` beside the alias. Override `vite` with the same alias in your package manager's configuration, such as `overrides` in `pnpm-workspace.yaml`, so the whole project resolves one copy.

Generic-Vite projects have one vite by construction and are unaffected.

## Documentation

- [Vite plugin overview](https://pitlane.tools/guides/vite-plugin)
- [Hot module replacement](https://pitlane.tools/guides/hmr)
- [Single-page apps](https://pitlane.tools/guides/spa)
- [Prerendering](https://pitlane.tools/guides/prerendering)
- Deployment: [Cloudflare Workers](https://pitlane.tools/deploy/cloudflare), [Netlify](https://pitlane.tools/deploy/netlify), [Vercel](https://pitlane.tools/deploy/vercel), [Railway](https://pitlane.tools/deploy/railway), [Deno Deploy](https://pitlane.tools/deploy/deno-deploy), [GitHub Pages](https://pitlane.tools/deploy/github-pages)
- [API reference](https://pitlane.tools/package/vite-plugin-remix/)

For AI agents and other LLM tools, the documentation is also published as Markdown. [`llms.txt`](https://pitlane.tools/llms.txt) indexes every page, [`llms-full.txt`](https://pitlane.tools/llms-full.txt) holds them all in one file, and every page has a Markdown twin at its URL plus `.md`, or plus `index.md` when the URL ends in `/`, such as [`https://pitlane.tools/guides/vite-plugin.md`](https://pitlane.tools/guides/vite-plugin.md).

## License

MIT

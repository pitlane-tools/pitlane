---
title: Single-page apps
description: "How remix({ server: false }) sets up a client-rendered Remix 3 app, and what the plugin still contributes once there is no server."
---

# Single-page apps

Some Remix 3 apps have no server. The router runs in the browser, the build is a folder of static files, and the host is a CDN. `remix({ server: false })` is the switch for those apps.

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite"; // or "vite-plus"

export default defineConfig({
    plugins: [remix({ server: false })],
});
```

If you want browser-only UI in front of server routes that still run per request, that is [the default mode](#client-rendering-with-a-server), not this one.

Pitlane does not prerender your app by default, meaning you don't need to worry about server-safe rendering when you've declared `server: false`. Your `index.html` is served as written and no part of your app runs outside a browser.

## What the switch changes

|                    | `server: true` (default)         | `server: false`       |
| ------------------ | -------------------------------- | --------------------- |
| Vite Environments  | `client` and `ssr`               | `client`              |
| Build input        | `clientEntry` and `serverEntry`  | `index.html`          |
| Build output       | `dist/client` and `dist/ssr`     | `dist`                |
| Dev requests       | your fetch handler               | Vite's static server  |
| Component HMR      | yes                              | yes                   |
| Server-data HMR    | yes                              | no server data exists |
| `?assets=` imports | how HTML names its client assets | Vite injects the tags |

Every `server*` option goes with it: `serverEntry`, `serverEnvironments`, and `serverHandler` describe a server that no longer exists. `clientEntry` goes too, because the browser entry is whatever `index.html` loads.

## Why use the plugin at all

Vite already serves `index.html` in dev and builds it into a static site. The plugin's remaining job is [component hot module replacement](/guides/hmr#component-hmr). Without HMR, editing a component reloads the page and every piece of live state goes with it: a half-typed form, an open menu, a scroll position. With it, the component swaps in place and that state survives.

Both authoring styles hot-swap. The plugin rewrites an arrow-form component export to a function expression with a name before instrumenting it:

```tsx
// app/counter.tsx
import { on, type Handle } from "remix/ui";

export function Counter(handle: Handle) {
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
```

Editing the returned markup swaps it in and the count keeps counting. Editing the setup scope above the `return` remounts the component, which is the same rule as everywhere else; see [state survives a render edit](/guides/hmr#state-survives-a-render-edit-and-resets-on-a-setup-edit).

Because server-data revalidation has no server to revalidate against, `<HMR />` from `pitlane:dev` resolves to the inert component here. An app that renders it unconditionally costs nothing, as it's entirely removed by the bundler in both development and production builds.

## The app shell

`index.html` is the entry, at the project root, loading one module:

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>My Remix App</title>
        <script type="module" src="/app/entry.browser.tsx"></script>
    </head>
    <body>
        <div id="app"></div>
    </body>
</html>
```

```jsonc
// tsconfig.json
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "remix/ui",
    },
}
```

## Rendering

Two shapes work, depending on whether the app needs routing.

### A root component

`createRoot` from `remix/ui` renders a component tree into an element. There is no routing, and the URL never changes:

```tsx
// app/entry.browser.tsx
import { createRoot } from "remix/ui";

import { App } from "./app.tsx";

let container = document.getElementById("app");
if (!container) throw new Error("missing #app container");

createRoot(container).render(<App />);
```

### A router

`remix/spa` connects an ordinary Remix fetch router to the document. The `render()` middleware gives every handler a `context.render()` that answers with a UI node, and `run()` dispatches the current URL plus every same-origin navigation and form submission through that router:

```tsx
// app/router.tsx
import { createRouter } from "remix/router";
import { render } from "remix/spa";

export let router = createRouter({ middleware: [render()] });

router.get("/", ({ render }) => render(<Home />));
router.get("/about", ({ render }) => render(<About />));
```

```tsx
// app/entry.browser.tsx
import { run } from "remix/spa";

import { router } from "./router.tsx";

let app = run(router);
await app.ready();
```

::: warning `remix/spa` is in preview

`remix/spa` lands in [remix-run/remix#11687](https://github.com/remix-run/remix/pull/11687) and is not in a published Remix release yet. Until it is, install the PR's preview build:

```sh
pnpm add "remix-run/remix#preview/pr-11687&path:packages/remix"
```

SPA mode itself does not depend on it. The plugin only cares that nothing renders on a server.

:::

## The build

`vite build` produces a static site and no server bundle:

```
dist/
├─ index.html
└─ assets/
   ├─ index-<hash>.js
   └─ index-<hash>.css
```

The HMR instrumentation is dev-only, so none of it reaches those chunks.

## Serving it

A SPA answers every URL with the same HTML and lets the client sort out the rest. `vite preview` already does that, so a deep link works locally without configuration. Static hosts need telling:

| Host           | Fallback                                        |
| -------------- | ----------------------------------------------- |
| GitHub Pages   | copy `index.html` to `404.html` after the build |
| Netlify        | `/* /index.html 200` in `_redirects`            |
| Cloudflare     | `/* /index.html 200` in `_redirects`            |
| Nginx or Caddy | `try_files $uri /index.html`                    |

The [GitHub Pages guide](/deploy/github-pages) walks through the full workflow, including the base path a project site needs.

## Bundled dev mode

Vite's experimental [bundled dev mode](https://github.com/vitejs/vite/discussions/22746) serves your app as a Rolldown bundle during `vite dev` instead of as unbundled modules. Pitlane's SPA mode works with bundled dev mode today, HMR included:

```ts
export default defineConfig({
    plugins: [remix({ server: false })],
    experimental: {
        bundledDev: true,
    },
});
```

**Bundled dev mode does not yet support SSR apps in its experimental form**. Bundled dev mode serves bundle entrypoints only, so the client module URLs an server-side renderer writes into its HTML resolve to nothing. Upstream tracks server environments as [Phase 4 of the bundled-dev roadmap](https://github.com/vitejs/vite/discussions/22746), and it is still a prototype.

## Client rendering with a server

If you want a browser-rendered UI in front of routes that still run on the server, leave the default `server` setting alone for the plugin. Serving a client-rendered app from a server with server routes is easy in Remix:

### The shell

The document the server sends for every navigable route, written as a component rather than a template literal, so the markup is typed and the asset URLs come from imports:

```tsx
// app/shell.tsx
import clientAssets from "./entry.browser.tsx?assets=client";

export function Shell() {
    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>My app</title>
                <script src={clientAssets.entry} type="module" />
            </head>
            <body>
                <div id="app" />
            </body>
        </html>
    );
}
```

`clientAssets.entry` is the URL of `app/entry.browser.tsx`: the dev URL during `vite dev`, the hashed chunk after a build. That one import is the whole reason the shell does not need to know its own build output. The [Vite plugin guide](/guides/vite-plugin#the-asset-runtime) covers the protocol, including `css` and `mergeAssets` for apps with stylesheets.

### The server

`renderToString` from `remix/ui/server` turns the shell into HTML, and `createHtmlResponse` puts the DOCTYPE and the content type on it. Data routes answer next to it, in the same router:

```tsx
// app/entry.server.tsx
import { createHtmlResponse as html } from "remix/response/html";
import { createRouter } from "remix/router";
import { renderToString } from "remix/ui/server";

import { getPosts } from "./posts.ts";
import { routes } from "./routes.ts";
import { Shell } from "./shell.tsx";

export let router = createRouter();

router.map(routes.posts, () => Response.json(getPosts()));

async function shell(): Promise<Response> {
    return html(await renderToString(<Shell />));
}

router.map(routes.home, () => shell());
router.map(routes.post, () => shell());
1;

export default router;
```

`renderToString` renders the element tree and stops there. It emits no DOCTYPE, which is what `createHtmlResponse` is for; a shell without one puts the browser in quirks mode.

### The browser

This is what `clientAssets.entry` pulls in, and it is the same code SPA mode runs. Either shape from [Rendering](#rendering) works. A `createRoot` tree:

```tsx
// app/entry.browser.tsx
import { createRoot } from "remix/ui";

import { App } from "./app.tsx";

let container = document.getElementById("app");
if (!container) throw new Error("missing #app container");

createRoot(container).render(<App />);
```

Or a client router through `remix/spa`, which is the shape that earns the shell in the first place, because now the URL means something:

```tsx
// app/router.tsx
import { createRouter } from "remix/router";
import { render } from "remix/spa";

export let router = createRouter({ middleware: [render()] });

router.get("/", ({ render }) => render(<Home />));
router.get("/posts/:id", ({ render, params }) => render(<Post id={params.id} />));
```

```tsx
// app/entry.browser.tsx
import { run } from "remix/spa";

import { router } from "./router.tsx";

let app = run(router);
await app.ready();
```

Two routers, and they are not the same one. The browser router owns what the user sees. The server router owns the shell and the data those views fetch. They meet at the URL, so the server maps every navigable route to the shell: a deep link or a refresh has to arrive at HTML that boots the client router, which then resolves the path.

::: warning `remix/spa` is in preview

It is proposed in [remix-run/remix#11687](https://github.com/remix-run/remix/pull/11687) and is not in a published Remix release yet. See [Rendering](#rendering) for the preview install. Neither this shape nor SPA mode depends on it.

:::

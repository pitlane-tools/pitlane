---
title: Single-page apps
description: "How remix({ ssr: false }) sets up a client-rendered Remix 3 app, and what the plugin still contributes once there is no server."
---

# Single-page apps

Some Remix 3 apps never render on a server. The router runs in the browser, the
build is a folder of static files, and the host is a CDN. `remix({ ssr: false })`
is the switch for those apps.

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite"; // or "vite-plus"

export default defineConfig({
    plugins: [remix({ ssr: false })],
});
```

React Router spells the same idea `ssr: false`, so the concept transfers. The
scope differs. React Router still server-renders your root route at build time
to produce `index.html`, which keeps every route SSR-safe even in SPA mode.
Pitlane does not prerender. Your `index.html` is served as written, and no part
of your app runs outside a browser.

## What the switch changes

|                    | default                          | `ssr: false`          |
| ------------------ | -------------------------------- | --------------------- |
| Environments       | `client` and `ssr`               | `client`              |
| Build input        | `clientEntry` and `serverEntry`  | `index.html`          |
| Build output       | `dist/client` and `dist/ssr`     | `dist`                |
| Dev requests       | your fetch handler               | Vite's static server  |
| Component HMR      | yes                              | yes                   |
| Server-data HMR    | yes                              | no server data exists |
| `?assets=` imports | how HTML names its client assets | Vite injects the tags |

`serverEntry`, `serverEnvironments`, `serverHandler`, and `clientEntry` go
unread. Passing one changes nothing: there is no server environment for it to
describe, and the browser entry is whatever `index.html` loads.

## Why use the plugin at all

Vite already serves `index.html` in dev and builds it into a static site. The
plugin's remaining job is [component hot module
replacement](/guides/hmr#component-hmr), and it is worth as much to a
client-rendered app as to a server-rendered one. Without it, editing a
component reloads the page and every piece of live state goes with it: a
half-typed form, an open menu, a scroll position. With it, the component swaps
in place and that state survives.

Both authoring styles hot-swap. The plugin rewrites an arrow-form component
export to a function expression with a name before instrumenting it:

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

Editing the returned markup swaps it in and the count keeps counting. Editing
the setup scope above the `return` remounts the component, which is the same
rule as everywhere else; see [state survives a render
edit](/guides/hmr#state-survives-a-render-edit-and-resets-on-a-setup-edit).

`<HMR />` from `pitlane:dev` resolves to the inert component here, so an app
that renders it unconditionally costs nothing. Server-data revalidation has no
server to revalidate against.

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
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "remix/ui" } }
```

## Rendering

Two shapes work, depending on whether the app needs routing.

**A root component.** `createRoot` from `remix/ui` renders a component tree
into an element. There is no routing, and the URL never changes:

```tsx
// app/entry.browser.tsx
import { createRoot } from "remix/ui";

import { App } from "./app.tsx";

let container = document.getElementById("app");
if (!container) throw new Error("missing #app container");

createRoot(container).render(<App />);
```

**A router.** `remix/spa` connects an ordinary Remix fetch router to the
document. The `render()` middleware gives every handler a `context.render()`
that answers with a UI node, and `run()` dispatches the current URL plus every
same-origin navigation and form submission through that router:

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

::: warning `remix/spa` is a preview
`remix/spa` lands in [remix-run/remix#11687](https://github.com/remix-run/remix/pull/11687)
and is not in a published Remix release yet. Until it is, install the PR's
preview build:

```sh
pnpm add "remix-run/remix#preview/pr-11687&path:packages/remix"
```

SPA mode itself does not depend on it. The plugin only cares that nothing
renders on a server.
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

A SPA answers every URL with the same HTML and lets the client router sort out
the rest. `vite preview` already does that, so a deep link works locally
without configuration. Static hosts need telling:

| Host           | Fallback                                        |
| -------------- | ----------------------------------------------- |
| GitHub Pages   | copy `index.html` to `404.html` after the build |
| Netlify        | `/* /index.html 200` in `_redirects`            |
| Cloudflare     | `/* /index.html 200` in `_redirects`            |
| Nginx or Caddy | `try_files $uri /index.html`                    |

Miss this and valid routes return 404 in production while working in dev,
which is the single most common way a SPA deploy goes wrong. The
[GitHub Pages guide](/deploy/github-pages) walks through the full workflow,
including the base path a project site needs.

## Bundled dev mode

Vite's experimental [bundled dev
mode](https://github.com/vitejs/vite/discussions/22746) serves your app as a
Rolldown bundle during `vite dev` instead of unbundled ES modules. SPA mode
runs under it today, component hot-swap included:

```ts
export default defineConfig({
    experimental: { bundledDev: true },
    plugins: [remix({ ssr: false })],
});
```

`vite dev --experimentalBundle` does the same from the command line.

Server-rendered apps do not run under it. Bundled dev serves bundle
entrypoints only, so the client module URLs a server render writes into its
HTML resolve to nothing. Upstream tracks server environments as Phase 4 of the
bundled-dev roadmap, and it is still a prototype.

## Choosing between the modes

Reach for `ssr: false` when the app has no server to speak of: a static host, a
docs viewer, an internal tool, anything whose data lives in the browser or
behind a public API.

Keep server rendering when first paint matters for content the browser has to
fetch, when a search engine has to read the page, or when the app already owns
a fetch handler for sessions, databases, or private API keys. Moving back is a
matter of adding `app/entry.server.tsx` and dropping the option, because
component authoring is identical on both sides.

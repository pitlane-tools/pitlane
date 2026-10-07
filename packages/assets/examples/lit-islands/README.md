# Lit islands with `@pitlane/assets`

A server-rendered Lit app whose pages are static HTML apart from a few interactive elements. It shows how `@pitlane/assets` gives each page exactly the scripts and stylesheets it needs:

- `src/framework/islands.ts` registers each island's browser entry with a string-literal `getScriptEntry` call on the resolver from `src/assets.ts`.
- `src/entry.server.ts` routes requests with `@remix-run/fetch-router` and renders each page body with `@lit-labs/ssr`. Lit reports which custom elements it rendered, so the document loads, preloads, and maps only those islands. The about page renders none and ships no JavaScript.
- Each island is a `LitElement` rendered on the server into a declarative shadow root. Its `static styles` ride inside that root and its chunk, so islands need no stylesheet links. Each browser entry imports `@lit-labs/ssr-client/lit-element-hydrate-support.js` before Lit, so the element adopts the server-rendered root instead of rendering a new one.
- Each page imports its own CSS and is loaded lazily, so `getStylesheets` returns a different set for each page.
- Chunk import maps are on, so the document renders the import map before any `modulepreload` link or module script.

## Commands

```sh
npm install
npm run dev        # vite dev, served through fetchServer()
npm run build      # client → dist/client, server → dist/ssr
npm start          # node server.ts on PORT, default 3000
npm run check      # typecheck, build, verify, smoke
```

`npm run verify` renders every page through the built server bundle and checks that each script, preload, and stylesheet URL is a hashed file in `dist/client`, that only the home page loads island chunks, and that the pages' stylesheets differ. `npm run smoke` starts the production server and drives it in headless Chromium, which needs `npx playwright install chromium` once.

Under `vite dev`, each server reload redefines the island elements, and Lit logs that `CustomElementRegistry` already has them. That message is expected in development only.

## Versions

| Package | Version | Why |
| --- | --- | --- |
| `lit` | 3.3.3 | Current release |
| `@lit-labs/ssr` | 4.1.0 | Current release; renders `LitElement`s into declarative shadow roots |
| `@lit-labs/ssr-client` | 1.1.8 | Current release; hydrates those roots in the browser |
| `@remix-run/fetch-router`, `@remix-run/html-template`, `@remix-run/node-fetch-server` | 1.0.0 | Current releases |
| `vite` | 8.3.3 | `@pitlane/assets` needs Vite 8.1 or later |
| `playwright` | 1.63.0 | Drives the smoke test |
| `@types/node` | `^24.10.0` | `@lit-labs/ssr` 4.1.0 declares an optional peer of `@types/node` below 25, so npm refuses version 25 |

The example installs `@pitlane/assets` and `@pitlane/vite-plugin-fetch-server` from npm. To try unreleased builds, point both at packed tarballs with `npm pkg set` before installing.

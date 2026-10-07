# Preact islands with `@pitlane/assets`

A server-rendered Preact 11 app where only islands run in the browser. Pages are static HTML; each exported component under `src/islands/` becomes an island that hydrates from its own chunk.

- `islands-plugin.ts` rewrites each island module in the server build so it calls `createAssetResolver(manifest).getScriptEntry("src/islands/<name>.tsx")` with a literal key. That call is what registers the island as a browser entry; there is no list of islands anywhere.
- `src/island.ts` renders the island to static markup inside a `<preact-island>` element, with `modulepreload` links for the island's chunk beside it. `src/entry.client.ts` defines that element, imports the chunk, and hydrates.
- `src/entry.server.ts` routes with `@remix-run/fetch-router` and renders documents with `@remix-run/html-template`. Pages load lazily, so each page links only the stylesheets it and its islands import: `getStylesheets` receives the server entry, the client entry, and the page's source key.
- `vite.config.ts` turns on chunk import maps, a plugin option that is off by default, so every document renders the map before its first module link or script.

The home page holds two islands, a counter and a disclosure; the about page holds none and preloads no island chunks.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server; `fetchServer()` sends requests to `src/entry.server.ts` |
| `npm run build` | Client build to `dist/client`, server build to `dist/ssr` |
| `npm start` | Serves the build on `PORT` (default 3000) with `@remix-run/node-fetch-server` |
| `npm run verify` | Renders both pages through `dist/ssr` and checks every script, preload, and stylesheet URL is a hashed file in `dist/client`, and that only the island page preloads island chunks |
| `npm run smoke` | Starts `server.ts` and clicks the counter in headless Chromium, failing on any console error. Run `npx playwright install chromium` once first |
| `npm run check` | `typecheck`, `build`, `verify`, and `smoke` in order |

## Versions

Pinned exactly so the example keeps building against the versions it was checked with: `preact@11.0.0`, `preact-render-to-string@6.8.0`, `@preact/preset-vite@2.10.6` (with its `@babel/core` peer), `vite@8.3.3`, and the 1.0.0 releases of `@remix-run/fetch-router`, `@remix-run/html-template`, and `@remix-run/node-fetch-server`. The example installs on its own with plain `npm install`; it has no lockfile, so a fresh install picks up the current `@pitlane/assets` and `@pitlane/vite-plugin-fetch-server`.

# React Router with `@pitlane/assets`

A React 19 app rendered on the server by React Router's data router, without React Router's framework mode. It shows how a router app names its browser assets through `@pitlane/assets`:

- `src/routes.ts` discovers pages with `import.meta.glob`, and each route records its module's source key in `handle.source`.
- `src/entry.server.tsx` matches the request first, then passes the client entry and the matched routes' keys to `getPreloads` and `getStylesheets`. Only `/about` imports `about/page.css`, so only its document links it. Every page is a lazy route, so each document preloads its own route's chunk and no other's.
- The document shell is written with `@remix-run/html-template`, and React renders the router into `<div id="root">`. Owning the shell makes the head's order explicit: the import map, then stylesheets, then `modulepreload` links, then the module script. When React renders the whole `<html>`, the map has to be spliced into React's output stream after `<head>` instead.
- `vite.config.ts` turns on chunk import maps with `assets({ chunkImportMap: true })`. They are off by default; with them on, every document has to deliver the map.
- `server.ts` serves the production build with `@remix-run/node-fetch-server`: files from `dist/client`, everything else through the built server entry.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | `vite dev`, with requests served by `src/entry.server.tsx` through `@pitlane/vite-plugin-fetch-server` |
| `npm run build` | Builds `dist/client` and `dist/ssr` |
| `npm start` | Serves the build on `PORT`, default 3000 |
| `npm run verify` | Renders each route through the built server entry and checks every script, preload, and stylesheet URL is a hashed file in `dist/client` |
| `npm run smoke` | Starts `server.ts` and loads it in headless Chromium: the counter must work after hydration, with no browser errors. Run `npx playwright install chromium` once first |
| `npm run check` | `typecheck`, `build`, `verify`, and `smoke` |

The example installs on its own, outside the Pitlane workspace. To try unreleased packages, pack them and point the dependencies at the tarballs:

```sh
npm pkg set "dependencies.@pitlane/assets=file:/path/to/pitlane-assets.tgz"
npm pkg set "devDependencies.@pitlane/vite-plugin-fetch-server=file:/path/to/pitlane-vite-plugin-fetch-server.tgz"
npm install
```

## Versions

Framework packages are pinned exactly, so the example keeps building the same way until someone updates it on purpose: `react` and `react-dom` 19.3.0, `react-router` 8.4.0, `@vitejs/plugin-react` 6.1.2, and `vite` 8.3.3. `react-router` 8.4.0 requires Node 22.22.0 or later, which sets this example's `engines` field. `playwright` is pinned for the browser smoke test.

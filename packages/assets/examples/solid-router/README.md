# Solid Router with `@pitlane/assets`

A Solid 2 app rendered on the server and hydrated in the browser, routed by Solid Router 2 without SolidStart. It shows how a router app names its browser assets through `@pitlane/assets`:

- `src/router.ts` discovers pages with `import.meta.glob`. Each page is a `lazy()` route, and each route records its module's source key in `info.source`. One router instance serves the server and the browser.
- `src/entry.server.tsx` matches the request with `Router.match(url)`, which returns each matched route's `info`, then passes the client entry and the matched routes' keys to `getPreloads` and `getStylesheets`. Only `/about` imports `about.css`, so only its document links it, and each document preloads its own route's chunk and no other's.
- On the server, the router reads its location from the `url` prop of `<Router>`. In the browser it reads the address bar.
- Solid's `lazy()` needs the script URL of each lazy module it renders on the server, so the browser can import the module before hydrating. The server entry hands Solid a small resolver for that, which answers with `getScriptEntry(key).href`. That works only for a registered browser entry, and the key comes from Solid at render time rather than from a string literal, so `vite.config.ts` registers every page through `assets({ include })`, using the same `src/pages/*.tsx` pattern the router passes to `import.meta.glob`. The same call answers under `vite dev` and in a build.
- The document shell is written with `@remix-run/html-template`, and Solid renders the app into `<div id="app">`. The head carries the import map, then stylesheets, then `modulepreload` links, then Solid's hydration script and the module script.
- `vite.config.ts` turns on chunk import maps with `assets({ chunkImportMap: true })`. They are off by default; with them on, every document has to deliver the map.
- `server.ts` serves the production build with `@remix-run/node-fetch-server`: files from `dist/client`, everything else through the built server entry.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | `vite dev`, with requests served by `src/entry.server.tsx` through `@pitlane/vite-plugin-fetch-server` |
| `npm run build` | Builds `dist/client` and `dist/ssr` |
| `npm start` | Serves the build on `PORT`, default 3000 |
| `npm run verify` | Renders each route through the built server entry and checks that every script, preload, and stylesheet URL is a hashed file in `dist/client`, that each route preloads only its own lazy chunk, and that only `/about` links its stylesheet |
| `npm run smoke` | Starts `server.ts`, clicks the counter and an `<a>` link in headless Chromium, and fails on any console error. Run `npx playwright install chromium` once first |
| `npm run check` | `typecheck`, `build`, `verify`, and `smoke` in order |

## Versions

| Package | Version | Why |
| --- | --- | --- |
| `solid-js`, `@solidjs/web` | 2.0.0-rc.13 | Solid 2 release candidate. `@solidjs/web`'s `latest` tag still names rc.0, so the version is pinned |
| `@solidjs/router` | 2.0.0-next.35 | The Solid 2 router; its peers require rc.13 |
| `@solidjs/vite-plugin` | 3.0.0-next.35 | Replaces `vite-plugin-solid` for Solid 2 |
| `vite` | 8.3.3 | `@pitlane/assets` needs Vite 8.1 or later |
| `@remix-run/html-template`, `@remix-run/node-fetch-server` | `^1.0.0` | Document shell and production server |
| `playwright` | 1.63.0 | Drives the smoke test |

Prereleases are pinned exactly because each release candidate can change the API. Every peer range names a matching prerelease, so plain `npm install` works without `--legacy-peer-deps`.

The example installs `@pitlane/assets` and `@pitlane/vite-plugin-fetch-server` from npm. To try unreleased builds, point both at packed tarballs with `npm pkg set` before installing.

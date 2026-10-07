# Vue Vapor and Vue Router with `@pitlane/assets`

A server-rendered Vue Router app whose pages are Vapor components. The server matches the request's routes, then asks the asset resolver for the client entry, the matched pages' `modulepreload` hints, and their stylesheets. Each document links only what its routes need.

- `src/routes.ts` builds the routes from `import.meta.glob("./pages/*.vue")`. Every page is a lazy route with its own chunk, and its `meta.source` is the page's source key.
- `src/entry.server.ts` passes `["src/entry.client.ts", ...matchedSources]` to `getPreloads` and `getStylesheets`, and renders the document with `@remix-run/html-template`. Only `/about` links its own stylesheet.
- `src/assets.ts` constructs the resolver once. The server's literal `assets.getScriptEntry("src/entry.client.ts")` registers the client entry, so the app needs no `index.html`.
- `vite.config.ts` turns on `assets({ chunkImportMap: true })`. Chunk import maps are off by default for `assets()`. With them on, every document delivers the client's import map before its first `modulepreload` link.
- The pages use `<script setup vapor>`. The layout and Vue Router's own components are ordinary VDOM components, so the browser app installs `vaporInteropPlugin`. On the server, Vapor pages compile to ordinary SSR render functions, and Node's build of `vue` has no Vapor runtime, so the server app does without the plugin.

## Commands

```sh
npm install
npm run dev        # vite dev, served through fetchServer({ entry: "./src/entry.server.ts" })
npm run build      # dist/client and dist/ssr
npm start          # node server.ts on PORT, default 3000
npm run check      # typecheck, build, verify, smoke
```

`npm run verify` renders `/`, `/about`, and `/faq` through the built server entry. It checks that every script, `modulepreload`, stylesheet, and import-map URL is a hashed file in `dist/client`. It also checks that only `/about` links the about stylesheet and that each lazy page chunk is preloaded on its own route alone. Last, it confirms each page compiled in Vapor mode: the client chunk holds the page as an HTML template, and the server build marks the page, but not the layout, `__vapor: true`.

`npm run smoke` starts `server.ts` and loads `/` and `/faq` in headless Chromium. Run `npx playwright install chromium` once first. It clicks the Vapor counter after hydration, navigates to `/about` and back to `/` on the client, and fails on any console error. In production Vue reports a hydration mismatch as a console error.

## Versions

| Package | Version | Why |
| --- | --- | --- |
| `vue` | `3.6.0-rc.10` | Vapor mode ships in Vue 3.6, which is a release candidate |
| `vue-router` | `5.3.1` | The current major. Its `createRouter`, `RouterView`, and history API are what this app uses |
| `@vitejs/plugin-vue` | `6.0.9` | Compiles `<script setup vapor>` with the installed `vue`'s compiler; no option needed |
| `vite` | `8.3.3` | The assets plugin needs Vite 8.1 or later |
| `playwright` | `1.63.0` | For `npm run smoke` |

`.npmrc` sets `legacy-peer-deps=true`. `vue-router` declares a peer of `vue@^3.5.34 || ^4.0.0`, and `@vitejs/plugin-vue` declares `vue@^3.2.25`. Neither range admits a prerelease such as `3.6.0-rc.10`, so a plain `npm install` stops with `ERESOLVE`. Remove the file once Vue 3.6 is stable.

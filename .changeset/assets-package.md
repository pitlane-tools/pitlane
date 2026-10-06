---
"@pitlane/assets": minor
---

New package: framework-neutral asset resolution for server-rendered apps.

`createAssetResolver(manifest)` resolves source paths such as `app/entry.browser.ts` or `file:app/counter.tsx#Counter` to the URLs the current Vite dev server or build produced. Its `getScriptEntry`, `getHref`, `getPreloads`, `getStylesheets`, and `getImportMap` methods return script URLs, `modulepreload` hints, stylesheet lists, and the client import map. The resolver matches the asset server from `remix/assets`, so it can be passed to Remix's `render({ assets })`, and imports no framework, so any other renderer can use it too. Looking up a server module's stylesheets never compiles that module for the browser.

`@pitlane/assets/manifest` is the manifest the `assets()` Vite plugin from `@pitlane/assets/vite-plugin` supplies. Published as is, it is `{ mode: "unavailable" }`, and every lookup explains how to supply one. `@pitlane/assets/build` exports `createAssetManifest`, which turns another bundler's normalized output into the same manifest.

Generated manifests preserve source keys and environment names through JSON serialization, including names such as `__proto__`.

Chunk import maps are off by default. With `assets({ chunkImportMap: true })`, `renderImportMap({ value, nonce })` serializes the returned map into a `<script type="importmap">` string that delivers it safely. The Vite plugin requires Vite 8.1 or later.

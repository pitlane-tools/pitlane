# @pitlane/assets

## 0.2.0

### Minor Changes

- f14d251: `assets()` accepts `allowFiles`, `allowPackages`, and `denyFiles`, the browser boundary options of `remix/assets`, and reads them the same way. Setting `allowFiles` turns the boundary on: `vite build` fails, listing each file and its importer, when a file outside it would reach the client output, including files that server code links and the build copies there. `vite dev` fails the browser transform of such a module and refuses to serve such a file. Without `allowFiles` nothing changes. With `remix()`, pass the options as `remix({ assets: { allowFiles, … } })`. Upgrade if you deploy the same app to the `remix/assets` Node server and to a bundled host such as Oxygen or Cloudflare, so a file the Node server refuses no longer ships silently from the build.
- f14d251: `@pitlane/assets/vite-plugin` exports `ASSETS_MANIFEST_FILE`, the name of the manifest module `vite build` writes at the root of each server environment's output directory. Server bundles import that file by a relative path, so a host that deploys a single module, such as Shopify Oxygen, has to fold it into the bundle in a later build. Use the constant there instead of hardcoding `__pitlane_assets_manifest.js`.

### Patch Changes

- The API reference and installed declarations now document `assets()` and every `AssetsPluginOptions` member, and the default `@pitlane/assets/manifest` export. No behavior changed.
- d7fcdd4: The development manifest no longer rebuilds from scratch. `assets()` under `vite dev` now keeps the import edges it recorded for every module and, after an edit, transforms only the changed file before answering the next request; modules the server never executed, such as lazy routes, are no longer transformed again on every invalidation. Browser modules it discovers are transformed through Vite's own request pipeline, so the browser's first load reads the cache instead of transforming them a second time.

    On an app with about 1,900 server modules and 400 browser modules, an edit that previously held the next request for 20–45 seconds now answers in under 2 seconds, the same as the previous `@pitlane/dev` integration, and the first manifest costs about a third less. The dev manifest's contents are unchanged.

- 92ce0a2: `vite build` no longer publishes server-only files into the client output. The copy from each server build into the client output directory took every file the server bundle emitted, so server sourcemaps, `.dev.vars` and `wrangler.json` from `@cloudflare/vite-plugin`, `oxygen.json` from MiniOxygen, and anything else a plugin wrote beside the server bundle ended up in the publicly served directory. Only the stylesheets the server code imports, the fonts and images they reference, and the files the server code imports are copied now, and the server's half of the asset manifest names only those files. Upgrade if you deploy the client output of an app built with server sourcemaps or a platform plugin.
- 8e38080: The development manifest no longer stays out of date after a build that changes kept interrupting. Under `vite dev`, `assets()` builds the manifest again when a module it reads is invalidated mid-build, and gives up after three builds so a plugin that invalidates modules on every transform cannot hold the request forever. Vite then cached the manifest it gave up on, and it stayed cached, missing the last change's stylesheets and browser entries, until another edit invalidated it. That was most likely on a cold start, where Vite's dependency optimizer re-runs and invalidates the browser module graph. The next import of `@pitlane/assets/manifest` now builds it again, and a build that completes uninterrupted is cached as before.
- d8670f8: The development manifest no longer keeps what a module imported, or which browser entries it named, before an edit. Under `vite dev`, `assets()` can transform one module more than once at the same time: the manifest's discovery and the module runner each ask for it, or an edit invalidates the module mid-transform. If a transform of the old code finished last, the manifest kept that code's stylesheets and literal `getScriptEntry()` and `getHref()` inputs until the module changed again, including in the first manifest a dev server built. A transform whose module was invalidated after its request began now records nothing, and a manifest being built when that happens is built again.

## 0.1.0

### Minor Changes

- 3053134: New package: framework-neutral asset resolution for server-rendered apps.

    `createAssetResolver(manifest)` resolves source paths such as `app/entry.browser.ts` or `file:app/counter.tsx#Counter` to the URLs the current Vite dev server or build produced. Its `getScriptEntry`, `getHref`, `getPreloads`, `getStylesheets`, and `getImportMap` methods return script URLs, `modulepreload` hints, stylesheet lists, and the client import map. The resolver matches the asset server from `remix/assets`, so it can be passed to Remix's `render({ assets })`, and imports no framework, so any other renderer can use it too. Looking up a server module's stylesheets never compiles that module for the browser.

    `@pitlane/assets/manifest` is the manifest the `assets()` Vite plugin from `@pitlane/assets/vite-plugin` supplies. Published as is, it is `{ mode: "unavailable" }`, and every lookup explains how to supply one. `@pitlane/assets/build` exports `createAssetManifest`, which turns another bundler's normalized output into the same manifest.

    Generated manifests preserve source keys and environment names through JSON serialization, including names such as `__proto__`.

    Chunk import maps are off by default. With `assets({ chunkImportMap: true })`, `renderImportMap({ value, nonce })` serializes the returned map into a `<script type="importmap">` string that delivers it safely. The Vite plugin requires Vite 8.1 or later.

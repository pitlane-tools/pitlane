---
"@pitlane/vite-plugin-remix": minor
---

`@pitlane/dev` is now `@pitlane/vite-plugin-remix`, and documents name their assets through an explicit resolver from `@pitlane/assets` instead of `?assets=` imports. There is no compatibility package or alias: replace the dependency, and import `remix` from `@pitlane/vite-plugin-remix` and `revalidate` from `@pitlane/vite-plugin-remix/hmr`. Vite 8.1 or later is required; under Vite+ that is `vite-plus` 1.0 or later with `vite` aliased to `@voidzero-dev/vite-plus-core`. The core reports its own version, so pnpm flags the `vite >=8.1.0` peer as unmet; set `peerDependencyRules.allowedVersions.vite` to `"1"` in `pnpm-workspace.yaml`.

`remix()` composes `assets()` from `@pitlane/assets/vite-plugin` and, while its server handler is enabled, `fetchServer()` from `@pitlane/vite-plugin-fetch-server`. Every existing option keeps its meaning; the new `assets` option passes `include` and `chunkImportMap` to the asset plugin. `@hiogawa/vite-plugin-fullstack` and the direct `oxc-parser` dependency are gone.

Construct the resolver in `app/assets.ts` from the manifest the build supplies, and add `@pitlane/assets` to `dependencies`:

```ts
import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

export let assets = createAssetResolver(manifest);
export let scriptEntry = await assets.getScriptEntry("app/entry.browser.ts");
```

Then pass it to Remix's renderer with `render({ assets })`. Islands keep `clientEntry(import.meta.url, …)`; the plugin rewrites the id to a portable `file:app/counter.tsx#Counter`, and Remix resolves it through the resolver, so an island now gets `modulepreload` hints. An app that calls `render()` without `assets` fails at its first island with Remix's own error.

`remix()` turns on Vite's chunk import maps for the client build by default. After a build, `scriptEntry.importMap` carries the map, and the document must render it before any `modulepreload` link or module script: add `<ImportMap value={scriptEntry.importMap} />` from `remix/component/server` at the top of `<head>`'s script tags. The browser needs import maps and `import.meta.resolve`. To keep ordinary chunk URLs instead, pass `remix({ assets: { chunkImportMap: false } })`; an app using Vite's `experimental.renderBuiltUrl` must, since the two cannot be combined and the build stops with an error naming both. That option wins over Vite's own `build.chunkImportMap`; with no option, a native setting applies. A bare `assets()` keeps maps off.

| Before | After |
| --- | --- |
| `import clientAssets from "./entry.browser.ts?assets=client"`, then `.entry` | `(await assets.getScriptEntry("app/entry.browser.ts")).href` |
| `clientAssets.js` as `modulepreload` links | `.preloads` from the same call, or `assets.getPreloads([...])` |
| `import serverAssets from "./entry.server.tsx?assets=ssr"`, then `.css` | `await assets.getStylesheets("app/entry.server.tsx")` |
| `mergeAssets(...)` from `@pitlane/dev/runtime` | arrays; `getPreloads` and `getStylesheets` deduplicate |
| a hand-written `resolveClientEntry` forwarding preloads | delete it |
| `"types": ["@pitlane/dev/assets"]` in `tsconfig.json` | delete it |
| `import { HMR } from "pitlane:dev"` and `<HMR />` in the document | delete both; add the `server:update` listener from the [HMR guide](https://pitlane.tools/guides/hmr#setup) to the browser entry |

The `/runtime` and `/assets` subpaths are removed. The build writes `__pitlane_assets_manifest.js` into the server output in place of fullstack's manifest. The [Vite plugin guide](https://pitlane.tools/guides/vite-plugin) and the [asset resolution guide](https://pitlane.tools/guides/assets) cover the new wiring.

---
"@pitlane/vite-plugin-remix": minor
---

`@pitlane/dev` is now `@pitlane/vite-plugin-remix`, and documents name their assets through an explicit resolver from `@pitlane/assets` instead of `?assets=` imports. There is no compatibility package or alias: replace the dependency, and import `remix` from `@pitlane/vite-plugin-remix` and `revalidate` from `@pitlane/vite-plugin-remix/hmr`. Vite 8.1 or later is required.

`remix()` composes `assets()` from `@pitlane/assets/vite-plugin` and, while its server handler is enabled, `fetchServer()` from `@pitlane/vite-plugin-fetch-server`. Every existing option keeps its meaning; the new `assets` option passes `include` and `chunkImportMap` to the asset plugin. `@hiogawa/vite-plugin-fullstack` and the direct `oxc-parser` dependency are gone.

Construct the resolver in `app/assets.ts` from the manifest the build supplies, and add `@pitlane/assets` to `dependencies`:

```ts
import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

export let assets = createAssetResolver(manifest);
export let scriptEntry = await assets.getScriptEntry("app/entry.browser.ts");
```

Then pass it to Remix's renderer with `render({ assets })`. Islands keep `clientEntry(import.meta.url, …)`; the plugin rewrites the id to a portable `file:app/counter.tsx#Counter`, and Remix resolves it through the resolver, so an island now gets `modulepreload` hints. An app that calls `render()` without `assets` fails at its first island with Remix's own error.

| Before | After |
| --- | --- |
| `import clientAssets from "./entry.browser.ts?assets=client"`, then `.entry` | `(await assets.getScriptEntry("app/entry.browser.ts")).href` |
| `clientAssets.js` as `modulepreload` links | `.preloads` from the same call, or `assets.getPreloads([...])` |
| `import serverAssets from "./entry.server.tsx?assets=ssr"`, then `.css` | `await assets.getStylesheets("app/entry.server.tsx", { environment: "ssr" })` |
| `mergeAssets(...)` from `@pitlane/dev/runtime` | arrays; `getPreloads` and `getStylesheets` deduplicate |
| a hand-written `resolveClientEntry` forwarding preloads | delete it |
| `"types": ["@pitlane/dev/assets"]` in `tsconfig.json` | delete it |

The `/runtime` and `/assets` subpaths are removed. The build writes `__pitlane_assets_manifest.js` into the server output in place of fullstack's manifest. The [Vite plugin guide](https://pitlane.tools/guides/vite-plugin) and the [asset resolution guide](https://pitlane.tools/guides/assets) cover the new wiring.

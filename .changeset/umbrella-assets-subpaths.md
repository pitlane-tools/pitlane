---
"pitlane": minor
---

The umbrella follows the asset cutover. `pitlane/dev` and `pitlane/dev/hmr` become `pitlane/vite-plugin-remix` and `pitlane/vite-plugin-remix/hmr`; `pitlane/dev/runtime` and `pitlane/dev/assets` are removed, and `pitlane/content/vite` becomes `pitlane/content/vite-plugin`. None of the old subpaths remains as an alias.

Five subpaths are new: `pitlane/assets`, `pitlane/assets/manifest`, `pitlane/assets/build`, and `pitlane/assets/vite-plugin` from `@pitlane/assets`, and `pitlane/vite-plugin-fetch-server`. An app using the umbrella `pitlane` package constructs its resolver from `createAssetResolver` in `pitlane/assets` and the manifest in `pitlane/assets/manifest`, and drops `pitlane/dev/assets` from `tsconfig.json`'s `types`. The lifted `vite` peer now requires 8.1 or later. The [umbrella guide](https://pitlane.tools/guides/umbrella#subpaths) lists every subpath.

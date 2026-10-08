---
"@pitlane/assets": minor
---

`@pitlane/assets/vite-plugin` exports `ASSETS_MANIFEST_FILE`, the name of the manifest module `vite build` writes at the root of each server environment's output directory. Server bundles import that file by a relative path, so a host that deploys a single module, such as Shopify Oxygen, has to fold it into the bundle in a later build. Use the constant there instead of hardcoding `__pitlane_assets_manifest.js`.

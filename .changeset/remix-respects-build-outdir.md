---
"@pitlane/vite-plugin-remix": patch
---

`remix()` now builds into your configured `build.outDir` instead of always writing to `dist/client` and `dist/ssr`. The client and server environments default to `<outDir>/client` and `<outDir>/ssr`, and an explicit `environments.client.build.outDir` or `environments.ssr.build.outDir` wins over both. The asset manifest, prerendered pages, preview, and the `wrangler.json` that `@cloudflare/vite-plugin` writes all follow. Previously the plugin overwrote both settings without warning, so every build landed in the repository-root `dist/`. An app that sets neither option builds exactly where it did before.

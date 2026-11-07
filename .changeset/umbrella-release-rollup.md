---
"pitlane": minor
---

Roll up the scoped package releases since `pitlane@1.0.0-alpha.2`, including the previously published assets 0.2 and Remix Vite plugin 0.9 changes:

- Configure the browser boundary with `remix({ assets: { allowFiles, allowPackages, denyFiles } })`. Setting `allowFiles` rejects files outside the boundary in development and production. `ASSETS_MANIFEST_FILE` identifies the server manifest for hosts that bundle a single module.
- Keep server-only build artifacts, including sourcemaps and platform configuration, out of the client output. Development manifests update incrementally, discard stale transforms, and retry interrupted builds instead of caching incomplete results.
- Respect `build.outDir` and per-environment output directories. `serverHandler: false` also gives preview serving to the platform plugin, and component HMR transforms skip test runners whose server HMR is disabled. Apps using `serverHandler: false` without a platform preview server now get static-only preview; enable the server handler to retain Pitlane's Node preview server.
- Prerender with Cloudflare's Vite plugin 2.0 after its Build Output is ready, while retaining compatibility with the 1.x plugin.

Installed guides and package references include the expanded public API documentation, Cloudflare's `cf` deployment and D1 migration workflows, and the removal of Deno deployment instructions. The package set is verified against Remix 3.2.0; the compatible `^3.0.0` peer range is unchanged. The umbrella remains on its alpha release channel.

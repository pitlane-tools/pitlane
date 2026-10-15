---
"@pitlane/vite-plugin-remix": patch
---

`remix({ prerender })` now works beside `@cloudflare/vite-plugin` 2.0, the beta that Cloudflare's `cf` CLI builds with. That plugin writes the Build Output its preview server reads only at the end of the build, so prerendering failed with `Build Output Specification: no root config found`. Prerendering now runs after every other `buildApp` hook, and `@cloudflare/vite-plugin` 1.x keeps working as before.

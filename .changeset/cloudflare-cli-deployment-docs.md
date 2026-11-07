---
"@pitlane/vite-plugin-remix": patch
---

The Cloudflare Workers recipe now uses `cloudflare.config.ts` and `cf deploy`, with exact pins for `cf@1.0.0-beta.17` and `@cloudflare/vite-plugin@2.0.0-beta.v.0`. Static assets come from Vite's client build, so the Worker configuration no longer names an assets directory. This updates the deployment instructions without changing plugin behavior.

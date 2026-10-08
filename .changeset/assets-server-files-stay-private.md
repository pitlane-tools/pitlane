---
"@pitlane/assets": patch
---

`vite build` no longer publishes server-only files into the client output. The copy from each server build into the client output directory took every file the server bundle emitted, so server sourcemaps, `.dev.vars` and `wrangler.json` from `@cloudflare/vite-plugin`, `oxygen.json` from MiniOxygen, and anything else a plugin wrote beside the server bundle ended up in the publicly served directory. Only the stylesheets the server code imports, the fonts and images they reference, and the files the server code imports are copied now, and the server's half of the asset manifest names only those files. Upgrade if you deploy the client output of an app built with server sourcemaps or a platform plugin.

---
"@pitlane/vite-plugin-remix": minor
---

`serverHandler: false` now hands `vite preview` to the platform plugin as well as dev requests. `remix()` used to install its preview server regardless, and stepped aside only when Node failed to import the built server entry, so a self-contained Worker bundle — one with no `cloudflare:*` imports, such as a single-module Oxygen Worker — was answered in Node instead of by the platform's preview. Upgrade if you filtered out the `pitlane-remix-preview-server` plugin to keep `vite preview` on MiniOxygen, Miniflare, or Nitro; that workaround is no longer needed. If you set `serverHandler: false` without a platform plugin that serves preview, `vite preview` now serves only static files; set it back to `true` to keep Pitlane's preview server. With the default `serverHandler: true`, preview is unchanged.

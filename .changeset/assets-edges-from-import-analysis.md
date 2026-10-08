---
"@pitlane/assets": patch
---

`assets()` under `vite dev` now reads each module's imports from Vite's own import analysis instead of resolving every specifier a second time, so a transform costs the plugin one parse rather than a resolver round-trip per import. The edges it records are unchanged: imports of a module Vite's import analysis does not resolve, such as a bundler-external, are still resolved and dropped, and Vite's injected HMR runtime stays out of the browser graph.

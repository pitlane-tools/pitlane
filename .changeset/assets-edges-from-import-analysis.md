---
"@pitlane/assets": patch
---

`assets()` under `vite dev` now reads each module's imports from Vite's own import analysis instead of resolving every specifier a second time, so a transform costs the plugin one parse rather than a resolver round-trip per import. The edges it records are unchanged: an import a resolver answered with `external: true` is still left out, whatever id it answered with, a virtual module is followed whether or not its id carries a null byte, and Vite's injected HMR runtime stays out of the browser graph.

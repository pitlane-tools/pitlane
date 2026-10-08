---
"@pitlane/assets": patch
---

The development manifest no longer rebuilds from scratch. `assets()` under `vite dev` now keeps the import edges it recorded for every module and, after an edit, transforms only the changed file before answering the next request; modules the server never executed, such as lazy routes, are no longer transformed again on every invalidation. Browser modules it discovers are transformed through Vite's own request pipeline, so the browser's first load reads the cache instead of transforming them a second time.

On an app with about 1,900 server modules and 400 browser modules, an edit that previously held the next request for 20–45 seconds now answers in under 2 seconds, the same as the previous `@pitlane/dev` integration, and the first manifest costs about a third less. The dev manifest's contents are unchanged.

---
"@pitlane/vite-plugin-remix": patch
---

Component HMR transforms now run only on a dev server with HMR on. A test runner such as Vitest serves modules with `server.hmr: false`, where the instrumentation it added to every component module cost more than the tests' own transforms: an app whose Node suite took 96 seconds without `remix()` took 150 with it, and now takes 96 again. Components reach tests untouched, as they do in a production build.

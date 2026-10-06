---
"@pitlane/dev": minor
---

Server-data HMR no longer ships a component. The `pitlane:dev` module and its `<HMR />` export are removed, along with their declaration in `@pitlane/dev/assets`; an app that still imports it fails to resolve the module.

The plugin still broadcasts `pitlane:server-update` when a server-only module changes, after the same 50ms settle. The app's browser entry now receives it: keep the runtime `run()` returns, and inside `if (import.meta.hot)` reload `app.frames.top` when the event arrives, waiting on `app.ready()` first. Overlapping updates should collapse into one follow-up reload. The [HMR guide](https://pitlane.tools/guides/hmr#setup) has the full snippet. A production build drops the branch along with `import.meta.hot`.

To migrate, delete the `pitlane:dev` import and the `<HMR />` element from your document, and add the listener to your browser entry. Component HMR is unchanged and needs no wiring.

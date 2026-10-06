---
"@pitlane/dev": minor
---

Server-data HMR no longer ships a component. The `pitlane:dev` module and its `<HMR />` export are removed, along with their declaration in `@pitlane/dev/assets`; an app that still imports it fails to resolve the module.

The plugin now broadcasts `server:update`, the event name Remix uses, in place of `pitlane:server-update`, still after the same 50ms settle once a server-only module changes. The app's browser entry now receives it and hands the runtime `run()` returned to `revalidate(app)`, exported from the new browser-safe `@pitlane/dev/hmr` subpath. `revalidate` waits for hydration, reloads the top frame, and logs a failure so the next update retries; a newer update supersedes a reload still in flight. It returns nothing because Vite waits for listener promises and handles HMR messages one at a time, so keep the listener synchronous. A production build drops the branch along with `import.meta.hot`.

To migrate, delete the `pitlane:dev` import and the `<HMR />` element from your document, and add this to your browser entry:

```ts
import { revalidate } from "@pitlane/dev/hmr";

let app = run({/* your existing options */});

if (import.meta.hot) {
    import.meta.hot.on("server:update", () => revalidate(app));
}
```

A listener of your own on `pitlane:server-update` must listen for `server:update` instead. Component HMR is unchanged and needs no wiring. The [HMR guide](https://pitlane.tools/guides/hmr#setup) has the full setup.

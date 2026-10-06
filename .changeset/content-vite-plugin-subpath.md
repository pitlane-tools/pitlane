---
"@pitlane/content": minor
---

`contentLayer()` moves from `@pitlane/content/vite` to `@pitlane/content/vite-plugin`, matching the `/vite-plugin` subpath every Pitlane package now uses for its Vite plugin. The old subpath is removed with no alias, so an import of `@pitlane/content/vite` fails to resolve. Change the import in `vite.config.ts`:

```ts
import { contentLayer } from "@pitlane/content/vite-plugin";
```

The plugin and its options are unchanged. Errors that tell you to add `contentLayer()` name the new subpath, or `pitlane/content/vite-plugin` in an app that imports content through the `pitlane` umbrella.

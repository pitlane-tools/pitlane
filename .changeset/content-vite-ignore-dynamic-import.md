---
"@pitlane/content": patch
---

Vite no longer warns that it cannot analyze a dynamic import in `@pitlane/content` when an app using `contentLayer()` starts its dev server. The runtime import of a document's resolved dependencies is now marked `/* @vite-ignore */`, since its target is only known at request time.

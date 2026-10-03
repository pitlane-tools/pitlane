---
"@pitlane/dev": patch
---

`remix()` now inlines `pitlane/dev/runtime` into a server build the way it inlines `@pitlane/dev/runtime`, so an app importing the runtime through the `pitlane` umbrella never imports `@pitlane/dev` at run time.

---
"@pitlane/content": patch
---

`contentLayer()` now prebuilds collections an app declares through the `pitlane` umbrella. An app importing `pitlane/content` instead of `@pitlane/content` previously got a server build with the umbrella externalized, so the bundle answered from the package's empty manifest and every collection came back empty on a host with no filesystem. The plugin now keeps `pitlane` bundled and out of dependency optimization, as it already did `@pitlane/content`.

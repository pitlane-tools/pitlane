---
"@pitlane/content": patch
---

Errors that tell you to add `contentLayer()` now name the specifier your app can import. In an app that imports content through the `pitlane` umbrella they say `pitlane/content/vite`; otherwise they still say `@pitlane/content/vite`. Before, an umbrella app was told to import `@pitlane/content/vite`, which a strict package manager such as pnpm does not let it resolve.

---
"@pitlane/content": patch
"@pitlane/crawler": patch
"@pitlane/data-table-d1": patch
"@pitlane/dev": patch
"@pitlane/theme": patch
---

Documentation comments, plus two type-only exports from `@pitlane/content`. No runtime behavior changed.

- `@pitlane/content` now exports the `Content` and `ReferenceSchema` types. `Content<T>` is what `createContent()` returns, and `ReferenceSchema<C>` is what `c.reference(collection)` returns. Both already appeared in those signatures; now code can import them by name.
- The TSDoc that editors show and the reference at pitlane.tools is built from now covers more. `remix()` and `createContent()` have examples. The package entry points and the main functions link to their guides. `RemixPluginOptions`, `PrerenderConfig`, `PrerenderOption`, `CrawlOptions`, `D1DatabaseOptions`, `D1DriverOptions`, `D1Meta`, `D1PreparedStatement`, and `D1Result` have summaries. Every `@pitlane/content` entry point and the `@pitlane/theme/default` and `@pitlane/theme/dtcg` entry points have module summaries.
- `loaders.file()` describes the file shapes it accepts and when `options.parser` is required. `ThemeResult.extend()` describes what its patch may hold. `DefaultTheme` lists its top-level token groups.

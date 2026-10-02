---
"@pitlane/content": minor
"@pitlane/crawler": minor
"@pitlane/data-table-d1": minor
"@pitlane/dev": minor
"@pitlane/theme": minor
---

Require stable Remix 3 (`remix@^3.0.0`) and migrate component rendering, JSX, and hot module replacement to `remix/component` and `remix/component-hmr`.

Update application imports from `remix/ui` to `remix/component`, including `/server` and JSX runtime subpaths, and set `jsxImportSource` to `remix/component`. Rename `remix/ui-hmr` imports and Node hooks to `remix/component-hmr`; the asset loader is now `componentHmr()`. Content rendering and theme styles use Remix's explicit `unsafeHTML()` boundary while preserving their existing escaping and trusted-content requirements.

These releases no longer support Remix prereleases. Upgrade Remix and the affected Pitlane packages together. UI primitives and animation utilities, when used by your application, are separate `@remix-run/ui` dependencies in Remix 3.

The Vite plugin also pre-optimizes the component and HMR runtimes together so the first hot update after a cold start preserves component state without a manual reload.

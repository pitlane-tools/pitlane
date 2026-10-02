# @pitlane/crawler

## 0.3.0

### Minor Changes

- 07bb5f7: Require stable Remix 3 (`remix@^3.0.0`) and migrate component rendering, JSX, and hot module replacement to `remix/component` and `remix/component-hmr`.

    Update application imports from `remix/ui` to `remix/component`, including `/server` and JSX runtime subpaths, and set `jsxImportSource` to `remix/component`. Rename `remix/ui-hmr` imports and Node hooks to `remix/component-hmr`; the asset loader is now `componentHmr()`. Content rendering and theme styles use Remix's explicit `unsafeHTML()` boundary while preserving their existing escaping and trusted-content requirements.

    These releases no longer support Remix prereleases. Upgrade Remix and the affected Pitlane packages together. UI primitives and animation utilities, when used by your application, are separate `@remix-run/ui` dependencies in Remix 3.

    The Vite plugin also pre-optimizes the component and HMR runtimes together so the first hot update after a cold start preserves component state without a manual reload.

## 0.2.3

### Patch Changes

- 6be8e56: Documentation only. No code changed.

    - Every README now says where the documentation is published as Markdown for AI agents and other LLM tools: `https://pitlane.tools/llms.txt` indexes every page, `https://pitlane.tools/llms-full.txt` holds them all in one file, and any page URL with `.md` appended returns that page as Markdown.
    - The `@pitlane/content` README gains the Vite setup the content guide describes. That setup covers the `satteri` and `vite-plugin-satteri` dev dependencies, and a `vite.config.ts` registering `satteri()` with `jsxImportSource: "remix/ui"`, `headings()`, `rawStyles()`, and `contentLayer()` before `remix()`. Before this, the README named `contentLayer()` but not the plugins it has to sit beside, and an MDX file compiled without `jsxImportSource: "remix/ui"` is a React component rather than a Remix one.
    - The `@pitlane/content` entry-point table lists `@pitlane/content/hot`, and the README describes the four `@pitlane/content/internal/*` entry points as internal and unstable, with what each one is for: reuse by a plugin for a bundler other than Vite.

- d4dfade: Documentation comments, plus two type-only exports from `@pitlane/content`. No runtime behavior changed.

    - `@pitlane/content` now exports the `Content` and `ReferenceSchema` types. `Content<T>` is what `createContent()` returns, and `ReferenceSchema<C>` is what `c.reference(collection)` returns. Both already appeared in those signatures; now code can import them by name.
    - The TSDoc that editors show and the reference at pitlane.tools is built from now covers more. `remix()` and `createContent()` have examples. The package entry points and the main functions link to their guides. `RemixPluginOptions`, `PrerenderConfig`, `PrerenderOption`, `CrawlOptions`, `D1DatabaseOptions`, `D1DriverOptions`, `D1Meta`, `D1PreparedStatement`, and `D1Result` have summaries. Every `@pitlane/content` entry point and the `@pitlane/theme/default` and `@pitlane/theme/dtcg` entry points have module summaries.
    - `loaders.file()` describes the file shapes it accepts and when `options.parser` is required. `ThemeResult.extend()` describes what its patch may hold. `DefaultTheme` lists its top-level token groups.

    `@pitlane/dev/assets` documents each `?assets` import form and `pitlane:dev`, and has its own reference page.

## 0.2.2

Published 2026-09-21. [npm](https://www.npmjs.com/package/@pitlane/crawler/v/0.2.2) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/crawler%400.2.2) · [Source](https://github.com/pitlane-tools/pitlane/commit/b725843491ad0c36c61c83d44466134f76dbd615).

Documentation only. No crawler code changed.

- The npm description is now "In-memory route crawling and static path discovery for Remix.", short enough to read in a registry listing.
- Three things the README described loosely now match what the code does. Under `spider`, a redirect queues a relative `Location` rather than any same-origin target. The `Crawl failed` message drops `statusText` when the response carries none. An absolute or protocol-relative href is skipped because requests are dispatched under a placeholder origin, which is a firmer reason than "belongs to another origin".
- `staticPaths` leaves out a route pinned to a protocol or a hostname, since its href is not a path. That exclusion was never written down.
- The options table says `none` where a default does not exist, and a Documentation section links the crawling guide, the prerendering guide, and the API reference.

## 0.2.1

Published 2026-09-10. [npm](https://www.npmjs.com/package/@pitlane/crawler/v/0.2.1) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/crawler%400.2.1) · [Source](https://github.com/pitlane-tools/pitlane/commit/dc4844ff683fb1eb6b61f6ab9fe960b8a6c93b44).

Target Remix `3.0.0-rc.2`.

- No crawler code changed. `crawl()` still dispatches into a router's `fetch` and yields the same `{ pathname, filepath, response }` records.
- The `remix` peer stays at `^3.0.0-rc.1`, which already admits rc.2. Nothing needs to move to install this alongside either prerelease.
- Declarations now come from `typescript@7.0.2`. The pack step reached `@typescript/native-preview` through `dts: { tsgo: true }` until [19d9558](https://github.com/pitlane-tools/pitlane/commit/19d95585aa54078425cccb20414998bf5175fa79) dropped that opt-in. The published `dist/index.d.mts` is byte-identical between 0.2.0 and 0.2.1.
- Tested against `remix@3.0.0-rc.2`.

## 0.2.0

Published 2026-09-01. [npm](https://www.npmjs.com/package/@pitlane/crawler/v/0.2.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/crawler%400.2.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/2617cd3d0e4c074878f34a96c6175116f926cf05).

Target Remix `3.0.0-rc.1`.

- Raised the `remix` peer dependency to `^3.0.0-rc.1` (from `^3.0.0-beta.10`). The crawler's own API is unchanged — `crawl()` still dispatches into a router's `fetch` and yields the same `{ pathname, filepath, response }` records, and the published `dist/index.mjs` and `dist/index.d.mts` are byte-identical to 0.1.0's.
- rc.1 moved the framework's DOM attributes into the `data-rmx-*` namespace, which is visible here because the crawler decides what to follow: the opt-out an app writes on an anchor is now `data-rmx-document`, not `rmx-document`. Following itself reads `href`, `rel`, and `<meta name="robots">`, so no crawler code changed.
- Tested against `remix@3.0.0-rc.1`.

## 0.1.0

Published 2026-08-25. [npm](https://www.npmjs.com/package/@pitlane/crawler/v/0.1.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/crawler%400.1.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/a4f462e245d943c00d5e851cbe6768bb8fdacf48).

Initial release.

- `crawl(router, options)` — walks an app by dispatching requests into its router's `fetch`, yielding `{ pathname, filepath, response }` per path. Follows `<a href>` and `<link rel="alternate">`, queues the assets a page references, honours `rel="nofollow"` and `<meta name="robots">`, skips absolute, protocol-relative and non-navigable hrefs, and visits each path once. A redirect yields nothing and reports through `onRedirect`, since there is no document to write and the app still answers the path at runtime; under `spider` a relative `Location` is queued instead. Any other non-2xx response aborts the crawl. `paths`, `spider`, `assets`, `concurrency`, `ignorePageNofollow`, and `onRedirect` configure it.
- `staticPaths(routes)` — the paths a Remix 3 route map can serve with no params, deduplicated and sorted. `GET` and method-agnostic routes whose patterns declare no variables or wildcards.
- The API comes from [remix-run/remix#11150](https://github.com/remix-run/remix/pull/11150), which was closed with the implementation kept beside the Remix docs site. Two deliberate differences: `assets` is a new option, because a bundler has usually emitted those files already, and the first error wins over the last when several paths fail under concurrency.
- One ESM entry point, no runtime dependencies: `remix@^3.0.0-beta.10` is the only peer and `remix/route-pattern` the only import the published bundle makes. Node `^20.19.0 || >=22.12.0`.
- Tested against `remix@3.0.0-beta.10`.

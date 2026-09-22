# @pitlane/crawler

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

# @pitlane/crawler

## 0.2.0

Target Remix `3.0.0-rc.1`.

- Raised the `remix` peer dependency to `^3.0.0-rc.1` (from
  `^3.0.0-beta.10`). The crawler's own API is unchanged — `crawl()` still
  dispatches into a router's `fetch` and yields the same
  `{ pathname, filepath, response }` records.
- rc.1 moved the framework's DOM attributes into the `data-rmx-*` namespace,
  which is visible here because the crawler decides what to follow: the opt-out
  an app writes on an anchor is now `data-rmx-document`, not `rmx-document`.
  Following itself reads `href`, `rel`, and `<meta name="robots">`, so no
  crawler code changed.
- Tested against `remix@3.0.0-rc.1`.

## 0.1.0

Initial release.

- `crawl(router, options)` — walks an app by dispatching requests into its
  router's `fetch`, yielding `{ pathname, filepath, response }` per path.
  Follows `<a href>` and `<link rel="alternate">`, queues the assets a page
  references, honours `rel="nofollow"` and `<meta name="robots">`, skips
  cross-origin and non-navigable hrefs, and visits each path once. A redirect
  yields nothing and reports through `onRedirect`, since there is no document
  to write and the app still answers the path at runtime; under `spider` the
  same-origin target is queued instead. Any other non-2xx response aborts the
  crawl. `paths`, `spider`, `assets`, `concurrency`, `ignorePageNofollow`, and
  `onRedirect` configure it.
- `staticPaths(routes)` — the paths a Remix 3 route map can serve with no
  params, deduplicated and sorted. `GET` and method-agnostic routes whose
  patterns declare no variables or wildcards.
- The API comes from [remix-run/remix#11150](https://github.com/remix-run/remix/pull/11150),
  which was closed with the implementation kept beside the Remix docs site.
  Two deliberate differences: `assets` is a new option, because a bundler has
  usually emitted those files already, and the first error wins over the last
  when several paths fail under concurrency.
- Tested against `remix@3.0.0-beta.10`.

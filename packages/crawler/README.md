# @pitlane/crawler

Spider a [Remix](https://remix.run) fetch router in memory.

`crawl(router)` follows links in rendered pages and yields successful responses. Requests go directly to the router's fetch handler, without an HTTP server.

Prerendering is then a `for await` loop that writes each response to disk:

```ts
import { crawl } from "@pitlane/crawler";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import router from "./app/entry.server.ts";

for await (let { pathname, filepath, response } of crawl(router)) {
    let outputPath = path.join("dist", filepath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, new Uint8Array(await response.arrayBuffer()));
    console.log(`${pathname} -> ${outputPath}`);
}
```

## Install

```sh
npm install @pitlane/crawler
# or
vp add @pitlane/crawler
```

Requires `remix@^3.0.0-rc.1` as a peer.

The [`remix()` Vite plugin](https://pitlane.tools/package/dev/) already depends on this package and runs it for `remix({ prerender })`, so a prerendered Vite app needs no direct install. The [prerendering guide](https://pitlane.tools/guides/prerendering) covers that path.

Install it directly for the other uses of a walk: static exports, sitemaps, link checks, render smoke tests. Those are in the [crawling guide](https://pitlane.tools/guides/crawler).

## `crawl(router, options?)`

Returns an async iterator of `{ pathname, filepath, response }`, one per fetched path.

- `pathname` is the path that was requested.
- `filepath` is where the response belongs on disk. HTML gets `<pathname>/index.html` so a static host serves it back for the original path; everything else keeps its own path.
- `response` is the router's response, body unread.

Results arrive in completion order, and every path is fetched at most once.

A redirect yields nothing: there is no document to write, and the app still answers the path at runtime. It reports through `onRedirect` instead, and with `spider` on, a relative `Location` is queued, so a crawl seeded at a `/` that points elsewhere still finds the site. Any other non-2xx response aborts the crawl with `Crawl failed: <status> <statusText> (<pathname>)`, dropping `statusText` when the response carries none.

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `paths` | `string[]` | `["/"]` | Where to start. |
| `spider` | `boolean` | `true` | Follow `<a href>` and `<link rel="alternate">` to find more paths. |
| `assets` | `boolean` | `true` | Queue the `<link href>`, `<script src>`, and `<img src>` each page references. Turn it off when a bundler already emitted those files. |
| `concurrency` | `number` | `1` | How many paths to fetch at once. |
| `ignorePageNofollow` | `(pathname: string) => boolean` | none | Crawl a page's links even though the page asked robots not to follow them. |
| `onRedirect` | `(pathname, location) => void` | none | Called for a path that redirected instead of returning a document. `location` is `null` when the redirect named none. |

The first argument is anything with a `fetch(request: Request)` method: a `createRouter()` router, a built server bundle's default export, a worker-style `{ fetch }` object.

### What spidering skips

The spider leaves these alone:

- `rel="nofollow"` on a link, and `<meta name="robots" content="nofollow">` (or `googlebot`) on a page.
- Absolute and protocol-relative URLs. Requests are dispatched under a placeholder origin, so an href that names a host is out of the crawl's reach.
- `#fragment`, `mailto:`, `tel:`, `javascript:`, and `data:` hrefs.

Use `ignorePageNofollow` when a page's `nofollow` is aimed at search engines rather than at the build, such as a versioned docs tree that should not be indexed but does need to be written out.

## `staticPaths(routes)`

`staticPaths` reads a route map and returns the paths the app can serve with no params, which is what a prerender pass needs before it knows any dynamic values:

```ts
import { staticPaths } from "@pitlane/crawler";
import { get, route } from "remix/routes";

let routes = route({
    home: "/",
    blog: get("/blog"),
    post: get("/blog/:slug"),
});

staticPaths(routes); // ["/", "/blog"]
```

A route qualifies when it answers `GET` (or any method) and its pattern declares no variables or wildcards. `/blog/:slug` is left out, because its values live outside the route map, and so is a route pinned to a protocol or hostname, because its href is not a path. Results are deduplicated and sorted, so a build that renders them lists its output the same way every time.

## Provenance

The `crawl` API comes from [remix-run/remix#11150](https://github.com/remix-run/remix/pull/11150), which proposed it for `fetch-router` and was closed in favour of keeping the implementation next to the Remix docs site. This package brings it back out as something an application can install, with two changes:

- `assets` is new. Upstream always queues a page's assets, which is right for a site with no bundler and wrong for one where Vite already emitted them.
- The first error wins when several paths fail at once, rather than the last.

`staticPaths` has no upstream counterpart. It covers the ground React Router's `getStaticPaths` covers: a Remix router exposes no route table, but the route map an app builds it from is an ordinary object, so `staticPaths` walks that instead.

## Documentation

- [Crawling guide](https://pitlane.tools/guides/crawler)
- [Prerendering guide](https://pitlane.tools/guides/prerendering)
- [API reference](https://pitlane.tools/package/crawler/)

## License

MIT

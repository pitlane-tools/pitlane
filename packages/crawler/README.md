# @pitlane/crawler

Spider a [Remix 3](https://remix.run) fetch router in memory.

`crawl(router)` dispatches requests straight into `router.fetch` and yields every response it gets back, following the links each page contains. No socket, no server, no browser, no HTTP: the router is the whole transport, so an app can be walked wherever the app itself runs.

That makes prerendering a `for await` loop.

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

Requires `remix@^3.0.0-beta.10` as a peer.

Using the [`remix()` Vite plugin](https://pitlane.tools/package/dev/)? You do not need this package directly — `remix({ prerender })` runs it for you. See the [prerendering guide](https://pitlane.tools/guides/prerendering).

For everything else a walk is good for — static exports, sitemaps, link checks, render smoke tests — see the [crawling guide](https://pitlane.tools/guides/crawler).

## `crawl(router, options?)`

Returns an async iterator of `{ pathname, filepath, response }`, one per fetched path.

- `pathname` — the path that was requested.
- `filepath` — where the response belongs on disk. HTML gets `<pathname>/index.html` so a static host serves it back for the original path; everything else keeps its own path.
- `response` — the router's response, body unread.

Results arrive in completion order. Every path is fetched at most once, and a non-2xx response aborts the crawl with `Crawl failed: <status> <statusText> (<pathname>)`.

| Option               | Type                            | Default | Purpose                                                                                                                                |
| -------------------- | ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `paths`              | `string[]`                      | `["/"]` | Where to start.                                                                                                                        |
| `spider`             | `boolean`                       | `true`  | Follow `<a href>` and `<link rel="alternate">` to find more paths.                                                                     |
| `assets`             | `boolean`                       | `true`  | Queue the `<link href>`, `<script src>`, and `<img src>` each page references. Turn it off when a bundler already emitted those files. |
| `concurrency`        | `number`                        | `1`     | How many paths to fetch at once.                                                                                                       |
| `ignorePageNofollow` | `(pathname: string) => boolean` | —       | Crawl a page's links even though the page asked robots not to follow them.                                                             |

The first argument is anything with a `fetch(request: Request)` method: a `createRouter()` router, a built server bundle's default export, a worker-style `{ fetch }` object.

### What spidering respects

Crawling stops where a crawler should stop, so a run over a real site does not wander:

- `rel="nofollow"` on a link, and `<meta name="robots" content="nofollow">` (or `googlebot`) on a page.
- Absolute and protocol-relative URLs, which belong to another origin.
- `#fragment`, `mailto:`, `tel:`, `javascript:`, and `data:` hrefs.

`ignorePageNofollow` is the escape hatch for the case where a page's `nofollow` is aimed at search engines rather than at you — a versioned docs tree that should not be indexed but does need to be built.

## `staticPaths(routes)`

The question that comes before a crawl: which paths can this app serve with no params?

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

A route qualifies when it answers `GET` (or any method) and its pattern declares no variables or wildcards. `/blog/:slug` is left out, because its values live outside the route map. Results are deduplicated and sorted, so a build that renders them lists its output the same way every time.

## Provenance

The `crawl` API comes from [remix-run/remix#11150](https://github.com/remix-run/remix/pull/11150), which proposed it for `fetch-router` and was closed in favour of keeping the implementation next to the Remix docs site. This package brings it back out as something an application can install, with two changes:

- `assets` is new. Upstream always queues a page's assets, which is right for a site with no bundler and wrong for one where Vite already emitted them.
- The first error wins when several paths fail at once, rather than the last.

`staticPaths` has no upstream counterpart. It is the Remix 3 answer to React Router's `getStaticPaths`: a Remix router exposes no route table, but the route map an app builds it from is an ordinary object, and that is the thing worth reading.

## License

MIT

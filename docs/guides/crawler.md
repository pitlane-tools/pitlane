---
title: Crawling
description: "How @pitlane/crawler walks a Remix 3 fetch router in memory, and the jobs that walk is good for: static exports, sitemaps, link checks, and render smoke tests."
---

# Crawling

[`@pitlane/crawler`](/package/crawler/) walks an app by dispatching requests
straight into its router:

```ts
import { crawl } from "@pitlane/crawler";

import router from "./app/entry.server.ts";

for await (let { pathname, response } of crawl(router)) {
    console.log(pathname, response.status);
}
```

`router.fetch` is the whole transport, so the crawl runs wherever the app runs
and sees what a real request sees, at the cost of a function call per page.

Every page it fetches is scanned for links, and those are fetched too, so one
call reaches everything reachable from `/`.

::: tip Already using `remix({ prerender })`?
Then you are already running this, and you do not need the package directly.
The [prerendering guide](/guides/prerendering) covers that path. This guide is
for the jobs the plugin does not do.
:::

## Install

::: code-group

```sh [npm]
npm install @pitlane/crawler
```

```sh [pnpm]
pnpm add @pitlane/crawler
```

```sh [vp]
vp add @pitlane/crawler
```

:::

Remix 3 is a peer dependency. The first argument to `crawl()` is anything with
a `fetch(request: Request)` method, so a `createRouter()` router works, and so
does a built bundle's default export or a hand-written `{ fetch }` object.

## Exporting a static site

The whole job is a `for await` loop and two filesystem calls. `filepath` is
where the response belongs on disk: HTML gets `<pathname>/index.html` so a
static host serves it back for the original URL, and everything else keeps its
own path.

```ts
import { crawl } from "@pitlane/crawler";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import router from "./app/entry.server.ts";

for await (let { filepath, response } of crawl(router)) {
    let outputPath = path.join("dist", filepath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, new Uint8Array(await response.arrayBuffer()));
}
```

Starting from `/` with spidering on, that writes every page the site links to.
Assets come along too, which is right for a site with no bundler and wrong for
one where Vite already emitted them. Pass `assets: false` for the second case.

## Generating a sitemap

A crawl already knows every URL, so a sitemap is the same loop with a different
body:

```ts
import { crawl } from "@pitlane/crawler";

const ORIGIN = "https://example.com";

let urls: string[] = [];
for await (let { pathname, response } of crawl(router, { assets: false })) {
    if (response.headers.get("Content-Type")?.includes("text/html")) {
        urls.push(`${ORIGIN}${pathname}`);
    }
}

let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
    .sort()
    .map(url => `  <url><loc>${url}</loc></url>`)
    .join("\n")}
</urlset>`;
```

The `Content-Type` check keeps redirects and JSON endpoints out of the file.
Sorting keeps the output stable, so a rebuild produces no diff when nothing
changed.

## Checking for broken links in CI

A crawl aborts on the first non-2xx response, with the failing path in the
message. That makes a link check a test with no assertions in it:

```ts
import { crawl } from "@pitlane/crawler";
import { it } from "vitest";

import router from "../app/entry.server.ts";

it("answers every page it links to", async () => {
    // Throws `Crawl failed: 404 Not Found (/blog/renamed-post)` on a dead link.
    for await (let _ of crawl(router, { concurrency: 8 })) {
        // Nothing to assert: reaching the end is the assertion.
    }
});
```

This catches the class of bug a type checker cannot see: an `href` typed by
hand, a post that was renamed, a route deleted while a nav item survived it.
Leave `assets: true` on and it checks stylesheet and script URLs too.

## Smoke-testing every page renders

The same walk, reading each response instead of discarding it, tells you
whether any page throws once real data flows through it:

```ts
for await (let { pathname, response } of crawl(router, { concurrency: 8 })) {
    let html = await response.text();
    expect(html, `${pathname} rendered an error boundary`).not.toContain("data-error-boundary");
}
```

Bodies arrive unread, so the caller decides whether to read them. A crawl that
never reads a body never buffers one.

## Crawling part of a site

Spidering is on by default, which makes `crawl(router)` mean "everything
reachable". Turn it off and the crawl fetches exactly the paths it was given:

```ts
crawl(router, { paths: ["/", "/about", "/pricing"], spider: false });
```

Or keep it on and pick different starting points, which walks those subtrees
and nothing else:

```ts
crawl(router, { paths: ["/docs"] });
```

`concurrency` sets how many paths are in flight at once. Rendering happens in
process, so the useful value depends on how much of a render waits on I/O.
Start at the default of 1 and measure.

## Where a crawl stops

Crawling stops where a crawler should stop, so a walk over a real site does not
wander off it:

- `rel="nofollow"` on a link, and `<meta name="robots" content="nofollow">` on
  a page.
- Absolute and protocol-relative URLs, which belong to another origin.
- `#fragment`, `mailto:`, `tel:`, `javascript:`, and `data:` hrefs.

`ignorePageNofollow` is the escape hatch for a page whose `nofollow` is aimed
at search engines rather than at you, such as a versioned docs tree that should
not be indexed but does need to be built:

```ts
crawl(router, {
    ignorePageNofollow: pathname => pathname.startsWith("/docs/v1/"),
});
```

## Asking what pages exist

`staticPaths()` answers the question that comes before a crawl: which paths can
this app serve with no params?

```ts
import { staticPaths } from "@pitlane/crawler";
import { get, route } from "remix/routes";

export let routes = route({
    home: "/",
    blog: get("/blog"),
    post: get("/blog/:slug"),
});

staticPaths(routes); // ["/", "/blog"]
```

A route qualifies when it answers `GET` (or any method) and its pattern
declares no variables or wildcards. `/blog/:slug` drops out, because its values
live outside the route map. Results are deduplicated and sorted.

This is the Remix 3 answer to React Router's `getStaticPaths`. A Remix router
exposes no route table, but the route map it was built from is an ordinary
object, and that is the thing worth reading.

Pair it with the paths only the app knows:

```ts
crawl(router, {
    paths: [...staticPaths(routes), ...slugs.map(slug => `/blog/${slug}`)],
    spider: false,
});
```

## What it is not

A crawl dispatches `Request` objects and reads the HTML that comes back. It
runs no JavaScript, so a page whose content appears after hydration looks empty
to it. Use a browser for that.

It also has no opinion about robots.txt, rate limits, or other origins, because
it never leaves the router it was handed. Point it at a URL and it will not go.

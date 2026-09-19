---
title: Crawling
description: "How @pitlane/crawler walks a Remix 3 fetch router in memory, and the jobs that walk is good for: sitemaps, link checks, and render smoke tests."
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

::: tip Prerendering a site?
Writing an app's pages to disk has its own guide in two halves.
[Prerendering](/guides/prerendering) is the one for an app built with Vite,
where `remix({ prerender })` runs this package for you.
[Prerendering without a build](/guides/prerendering-no-build) is the one for
an app with no bundler. This guide is for the other jobs a walk is good for.
:::

## Install

::: code-group

```sh [npm]
npm add @pitlane/crawler
```

```sh [yarn]
yarn add @pitlane/crawler
```

```sh [pnpm]
pnpm add @pitlane/crawler
```

```sh [bun]
bun add @pitlane/crawler
```

```sh [deno]
deno add npm:@pitlane/crawler
```

```sh [vp]
vp add @pitlane/crawler
```

```sh [vlt]
vlt add @pitlane/crawler
```

```sh [nub]
nub add @pitlane/crawler
```

:::

Remix 3 is a peer dependency. The first argument to `crawl()` is anything with
a `fetch(request: Request)` method, so a `createRouter()` router works, and so
does a built bundle's default export or a hand-written `{ fetch }` object.

## Exporting a static site

Writing every response to disk has moved to its own guide:
[prerendering without a build](/guides/prerendering-no-build) covers the loop,
where each response belongs on disk, and what to do about assets.

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

The `Content-Type` check keeps JSON endpoints out of the file; redirects never
arrive in the first place. Sorting keeps the output stable, so a rebuild
produces no diff when nothing changed.

## Checking for broken links in CI

A crawl aborts on the first failing response, meaning any status outside the
2xx range that is not a redirect, with the failing path in the message. That
makes a link check a test with no assertions in it:

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

This catches the class of bug a type checker cannot see. An `href` typed by
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
object. That is the thing worth reading.

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

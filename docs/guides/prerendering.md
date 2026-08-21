---
title: Prerendering
description: "How remix({ prerender }) renders paths to static HTML at build time, and where the paths come from."
---

# Prerendering

A page whose content does not change per request does not need a server on the
critical path. `remix({ prerender })` renders those pages during
`vite build` and writes the HTML into the client output, where a CDN serves it
without waking anything up.

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix({ prerender: ["/", "/blog", "/blog/hello-world"] })],
});
```

There is no separate rendering path. The build creates a `Request`, sends it
through the same fetch handler production runs, and keeps the response. Route
handlers, middleware, and components behave exactly as they do at runtime,
because they are the same code answering the same request.

## Where the paths come from

Four shapes, in order of how much the app knows about its own URLs.

### Everything static

`true` prerenders every path the app's route map can serve with no params.

```ts
remix({ prerender: true });
```

`/` and `/blog` qualify. `/blog/:slug` does not, because the slugs live outside
the route map. For this to work the server entry has to export the route map
alongside its handler:

```ts
// app/entry.server.tsx
export { routes } from "./routes.ts";
export default router;
```

Without that export the build fails and says so, rather than quietly
prerendering nothing.

### An explicit list

```ts
let slugs = getPostSlugs();

remix({
    prerender: ["/", "/blog", ...slugs.map(slug => `/blog/${slug}`)],
});
```

### A function

When the list needs a database, a CMS, or a filesystem walk, pass a function.
It receives `getStaticPaths()`, which is the `true` behavior on demand, so the
per-slug half is the only part you write:

```ts
remix({
    async prerender({ getStaticPaths }) {
        let slugs = await getPostSlugsFromCMS();
        return [
            ...getStaticPaths(), // "/" and "/blog"
            ...slugs.map(slug => `/blog/${slug}`),
        ];
    },
});
```

### The object form

`paths` takes any of the three above, and two more options come with it:

```ts
remix({
    prerender: {
        paths: true,
        concurrency: 4,
        spider: false,
    },
});
```

`concurrency` renders that many paths at once. Rendering is CPU-bound in
process, so the gain depends on how much of a render waits on I/O; start at the
default of 1 and measure.

## Spidering

`spider: true` turns the path list into a set of starting points. Every
rendered page is scanned for links, and those get rendered too:

```ts
remix({ prerender: { paths: ["/"], spider: true } });
```

One starting path can be the whole config for a site whose pages all link to
each other. Anything reachable gets built, including the page you forgot to
list.

Crawling stops where a crawler should stop: `rel="nofollow"` links,
`<meta name="robots" content="nofollow">` pages, other origins, and
non-navigable hrefs like `mailto:`. That is
[`@pitlane/crawler`](/package/crawler/) underneath, which is installable on its
own for sitemaps, link checks, and static exports the plugin does not cover.
The [crawling guide](/guides/crawler) walks through those.

## Output on disk

Each path becomes an `index.html` under the client output, so a static host
serves it back for the original URL:

```
dist/client/
├─ index.html                    ← /
├─ blog/
│  ├─ index.html                 ← /blog
│  └─ hello-world/
│     └─ index.html              ← /blog/hello-world
└─ assets/
   ├─ entry.browser-<hash>.js
   └─ index-<hash>.css
```

The build logs each file as it writes it.

Prerendering runs last, after both environments are built and the assets
manifest is written. That ordering is what makes the HTML on disk identical to
the HTML the runtime server would produce: the `?assets=` imports resolve to
real hashed chunk URLs, not dev paths.

If the app is served from a sub-path, declare the routes under it (the
[GitHub Pages guide](/deploy/github-pages) shows the pattern) and set Vite's
`base` to match. The rendered files still go to the top of the client output,
because the host mounts that whole directory at the base.

## Serving the output

With `ssr: true`, which is the default, prerendering is an optimization rather
than a deployment mode. The server is still there. Put the client output in
front of it and requests for a prerendered path never reach the handler; every
other path renders as usual. A `staticFiles()` middleware in the server entry
does this in one line, and most CDNs do it in front of the origin.

Hydration is unaffected. The HTML carries the same island markers a runtime
render produces, and the same client entry picks them up.

## Data that goes stale

A prerendered page is frozen at build time. That is the point, and it is also
the constraint: a page showing anything that changes between deploys should not
be in the list.

There is no revalidation mechanism here, and no incremental regeneration.
Rebuild and redeploy, or leave the path out and let the server render it.

## Not available in SPA mode

`remix({ ssr: false, prerender })` throws. Prerendering renders through the
server entry, and [SPA mode](/guides/spa) builds no server, so there is nothing
to render with. The two are alternatives: SPA mode serves one shell that
hydrates any path, prerendering serves real HTML per path.

## Non-Node server bundles

Prerendering imports the built server bundle into the Vite build process, so it
needs a bundle Node can run. A Workers bundle that imports `cloudflare:workers`
cannot be, and the build says as much instead of failing obscurely. Deploy
targets with their own runtime render at request time.

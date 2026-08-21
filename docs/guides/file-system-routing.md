---
title: File system routing
description: "How @pitlane/routing derives a Remix route map from the controllers under app/actions, what the filenames mean, and how to replace the convention."
---

# File system routing

A Remix app declares its URLs in one place and answers them in another. The
route map in `app/routes.ts` names every pattern, and the controllers under
`app/actions/` handle them. Keeping the two in sync is manual work that grows
with the app, and nothing catches a route you defined but never wired up.

`@pitlane/routing` derives the route map from the controllers. You write the
files. The plugin writes the map.

```ts
// app/routes.ts
import { flatRoutes } from "@pitlane/routing";

export default await flatRoutes();
```

That is the whole config. Route modules under `app/actions/` become routes, and
`remix()` regenerates the map whenever one appears, moves, or disappears.
`app/routes.ts` stops holding the map itself and describes where the map comes
from instead.

## Installation

`@pitlane/routing` holds the conventions and `remix()` runs them, so both are
needed.

::: code-group

```sh [npm]
npm add -D @pitlane/routing
```

```sh [yarn]
yarn add -D @pitlane/routing
```

```sh [pnpm]
pnpm add -D @pitlane/routing
```

```sh [bun]
bun add -D @pitlane/routing
```

```sh [deno]
deno add -D npm:@pitlane/routing
```

```sh [vp]
vp add -D @pitlane/routing
```

```sh [vlt]
vlt add -D @pitlane/routing
```

```sh [nub]
nub add -D @pitlane/routing
```

:::

The plugin picks up `app/routes.ts` on its own. Point `routes` somewhere else if
the file lives elsewhere:

```ts
// vite.config.ts
export default defineConfig({
    plugins: [remix({ routes: "app/routes.config.ts" })],
});
```

## Two generated files

Generation writes real TypeScript next to your app code rather than a virtual
module, which is what makes route params type-check without a second type
generator:

```
app/
├─ routes.ts        ← you write this (the convention)
├─ routes.gen.ts    ← the route map
├─ router.gen.ts    ← the wiring
└─ actions/         ← you write these (the controllers)
```

`routes.gen.ts` exports the map. It imports `remix/routes` and nothing else, so
your controllers can import it without a cycle:

```ts
// app/routes.gen.ts
import { get, route } from "remix/routes";

export let routes = route({
    index: get("/"),
    about: get("/about"),
});
```

`router.gen.ts` exports an installer that registers every route against a
router you own:

```tsx
// app/entry.server.tsx
import { createRouter } from "remix/router";

import { install } from "./router.gen.ts";

export let router = createRouter<AppContext>({
    middleware: [staticFiles("./dist/client"), render()],
});

install(router);

export { routes } from "./routes.gen.ts";
export default router;
```

Middleware, context types, and the fetch handler stay yours. The installer only
calls `router.route(...)` for each generated pattern.

Both files are build output. Add them to `.gitignore`, and mark them readonly so
an editor never invites you to fix them by hand:

```jsonc
// .vscode/settings.json
{
    "files.readonlyInclude": { "**/*.gen.ts": true },
}
```

## Filenames

The default convention is [React Router's file route
conventions](https://reactrouter.com/how-to/file-route-conventions), applied to
`app/actions/` instead of `app/routes/`. Dots and directories are
interchangeable, so `concerts.$city.tsx`, `concerts/$city.tsx`, and
`concerts/$city/controller.tsx` all describe the same route.

| File                           | Pattern                | Name                    |
| ------------------------------ | ---------------------- | ----------------------- |
| `_index.tsx`                   | `/`                    | `routes.index`          |
| `about.tsx`                    | `/about`               | `routes.about`          |
| `salt-lake-city.tsx`           | `/salt-lake-city`      | `routes.saltLakeCity`   |
| `concerts._index.tsx`          | `/concerts`            | `routes.concerts.index` |
| `concerts.$city.tsx`           | `/concerts/:city`      | `routes.concerts.show`  |
| `concerts.$city.edit.tsx`      | `/concerts/:city/edit` | `routes.concerts.edit`  |
| `concerts_.mine.tsx`           | `/concerts/mine`       | `routes.concertsMine`   |
| `_auth.login.tsx`              | `/login`               | `routes.auth.login`     |
| `files.$.tsx`                  | `/files(/*path)`       | `routes.files.splat`    |
| `$.tsx`                        | `(*path)`              | `routes.splat`          |
| `sitemap[.]xml.tsx`            | `/sitemap\.xml`        | `routes.sitemapXml`     |

Remix patterns come out the other side, so `$city` becomes `:city` and a splat
becomes `(*path)`. The parentheses matter: `files.$.tsx` in React Router serves
`/files` as well as `/files/a/b.pdf`, and `files/*path` alone would miss the
bare `/files`.

### Names follow the resource helpers

Route map keys are the app's URL vocabulary, because `href()` reads them:

```ts
routes.concerts.show.href({ city: "salt-lake-city" });
```

Filenames carry no names of their own, so the convention derives them. Literal
segments camelCase, and param segments are absorbed into the pattern rather
than becoming a level of their own. A leaf ending in a param takes the name
Remix's own [`resources()`
helper](https://github.com/remix-run/remix/tree/main/packages/fetch-router)
would give it:

| Pattern                | Name       |
| ---------------------- | ---------- |
| `/concerts`            | `index`    |
| `/concerts/new`        | `new`      |
| `/concerts/:city`      | `show`     |
| `/concerts/:city/edit` | `edit`     |

`routes.concerts.show` rather than `routes.concerts.city`, so reading a call
site tells you what the route does instead of what its parameter is named.

Two files that resolve to the same name fail the build and name both files.
Nothing is silently overwritten.

### Files that are not routes

`app/actions/` already holds modules that are not routes. A route's own
components sit next to it, and `app/actions/render.tsx` is where a Remix app
keeps its `render()` helper. Turning every module in the tree into a URL would
publish all of them.

The rules that keep them out:

- **A directory holding `controller.tsx` takes its routes from that file.** The
  other files beside it are that route's own components and helpers, the same
  way React Router treats a folder with a `route.tsx` in it.
- **A leading `-` marks a file or directory as private.** `-render.tsx` and
  `-components/` never become routes at any level.
- **`render.*` and `middleware.*` are ignored by name**, because both are
  existing Remix conventions rather than routes.

Anything else is a route. `ignoredRouteFiles` takes globs when that is not
enough:

```ts
// app/routes.ts
export default await flatRoutes({
    rootDirectory: "app/actions",
    ignoredRouteFiles: ["**/*.server.ts", "legacy/**"],
});
```

`rootDirectory` is relative to the Vite root and defaults to `app/actions`.
Point it at `app/routes` for a tree that holds nothing but routes, and the
first two rules stop mattering.

## Controllers

Every leaf gets a file, and that file default-exports its action:

```tsx
// app/actions/concerts/$city.tsx
import { createAction } from "remix/router";

import { routes } from "../../routes.gen.ts";
import { ConcertPage } from "./concert-page.tsx";

export default createAction(routes.concerts.show, ({ params, render }) => {
    return render(<ConcertPage city={params.city} />);
});
```

`params.city` is typed `string`. The generated map holds the pattern as a
literal type, `createAction` reads the pattern off the route you hand it, and
the inference falls out of that. No `+types` directory, no ambient declaration
file, no separate generation step.

Getting the route wrong is a type error rather than a runtime 404:

```tsx
// Argument of type '"cities"' is not assignable ...
createAction(routes.concerts.cities, () => new Response());
```

### Middleware for a group

A directory is a route group. Middleware next to it applies to every route
inside:

```ts
// app/actions/admin/middleware.ts
import { requireAuth } from "remix/middleware/auth";

export default [requireAuth()];
```

This is where React Router's parent route file lands. `concerts.tsx` wrapping
`concerts._index.tsx` in a layout has no equivalent in Remix, which composes
layouts by importing components instead of nesting routes. The two things a
parent route really owns, a shared URL prefix and shared middleware, are what a
directory and its `middleware.ts` own here.

### One controller for a resource

Seven CRUD routes as seven files is a lot of files, and three of them cannot be
spelled as filenames at all: `POST /concerts` and `GET /concerts` differ by
method, not by path. A directory can declare its routes with a descriptor
instead, and handle them in one controller:

```tsx
// app/actions/concerts/controller.tsx
import { createController } from "remix/router";
import { resources } from "remix/routes";

import { routes } from "../../routes.gen.ts";

export let route = resources("concerts", { param: "city" });

export default createController(routes.concerts, {
    middleware: [requireAuth()],
    actions: {
        index: ({ render }) => render(<ConcertList />),
        new: ({ render }) => render(<NewConcert />),
        create: () => redirect(routes.concerts.index.href(), 303),
        show: ({ params, render }) => render(<Concert city={params.city} />),
        edit: ({ params, render }) => render(<EditConcert city={params.city} />),
        update: ({ params }) => redirect(routes.concerts.show.href(params), 303),
        destroy: () => redirect(routes.concerts.index.href(), 303),
    },
});
```

The `route` export is read from the source, not executed, so it does not
matter that this same file imports the map the export helps generate. Any of
`route()`, `get()`, `post()`, `form()`, `resource()`, and `resources()` from
`remix/routes` works, with literal arguments:

```ts
export let route = form("contact", { formMethod: "PUT", names: { action: "update" } });
```

::: warning Footgun Warning

A descriptor owns every leaf in its directory, and `createController` requires
an action for each one, so the two styles do not mix inside a single group. A
route-shaped sibling next to a `controller.tsx`, such as `concerts/$city.tsx`,
fails the build and names both files rather than being quietly dropped.

:::

## Bring your own convention

`flatRoutes()` reads a directory and returns a route tree. Anything else that
returns the same tree works the same way, which is what React Router called
virtual file routes:

```ts
// app/routes.ts
import { action, controller, group, physical } from "@pitlane/routing";
import { get, resources } from "remix/routes";

export default group({
    index: action("/", "actions/home.tsx"),
    concerts: group("concerts", {
        index: action("/", "actions/concerts/list.tsx"),
        show: action(get(":city"), "actions/concerts/detail.tsx"),
    }),
    admin: controller(resources("admin/users"), "actions/admin/users.tsx"),
    blog: physical("actions/blog"),
});
```

The builders mirror `remix/routes` and add the file:

| Builder                        | Produces                                                  |
| ------------------------------ | --------------------------------------------------------- |
| `group(prefix?, children)`     | A route group, the same shape as `route(base, defs)`       |
| `action(pattern, file)`        | One leaf, implemented by a `createAction` default export   |
| `controller(descriptor, file)` | Leaves from a descriptor, one `createController` export    |
| `physical(directory)`          | The filename convention, for one subtree                   |

File paths are relative to the directory holding `app/routes.ts`, so
`"actions/home.tsx"` means `app/actions/home.tsx`.

Names, nesting, and file locations are yours. `physical()` mounts the default
convention under part of the tree, so a hand-written map can cover the awkward
areas of an app and let the convention handle the rest.

Mixing the two directions works as well: a directory reached through
`physical()` can hold a `routes.ts` of its own that switches back to explicit
builders for its subtree.

### Writing a convention

`flatRoutes()` is an ordinary async function over the same builders, so a
convention of your own is the same kind of function:

```ts
// app/routes.ts
import { glob } from "node:fs/promises";

import { action, group, type RouteNode } from "@pitlane/routing";

let pages: Record<string, RouteNode> = {};

for await (let file of glob("actions/pages/*.tsx", { cwd: "app" })) {
    let name = file.slice("actions/pages/".length, -".tsx".length);
    pages[name] = action(`/${name}`, file);
}

export default group(pages);
```

It runs at build time in Node, so `node:fs` and a database client are both fair
game. `flatRoutes()` lives in `@pitlane/routing` as the worked example, and
another convention can be published as its own package the same way.

## Code splitting

The installer imports controllers lazily. Patterns register at startup, and a
controller module loads the first time one of its routes matches:

```ts
// app/router.gen.ts
router.route(routes.concerts.show.method, routes.concerts.show.pattern, async context => {
    let { default: action } = await import("./actions/concerts/$city.tsx");
    return action(context);
});
```

Route matching only needs patterns, so nothing is lost by deferring the rest.
What that buys depends on where the app runs. A Worker pays CPU for module
evaluation on every cold start, and a request for `/` no longer evaluates the
admin dashboard's component tree or its schema. Prerendering benefits too:
`remix({ prerender: true })` enumerates static paths from the route map alone
and now evaluates no controllers at all to do it.

The cost is when failures surface. A controller that throws while its module
evaluates used to break at startup, and now breaks on the first request to that
route. Type checking catches most of that class of problem first. Pass
`codeSplit: false` for eager imports:

```ts
remix({ routes: { codeSplit: false } });
```

Dev and build behave the same either way, deliberately. Eager imports in dev
would move where errors appear rather than remove them.

Islands are unaffected. `clientEntry()` components are already split per island
by Vite, and browser bundles do not change here.

## No layout routes

Remix has no layout routes, and this adds none. A route file returns a
`Response`, and a shared shell is a component the route imports. Nesting in a
route map is a URL prefix and a middleware boundary, nothing more.

Route names are derived, not configurable, in the default convention. When a
name matters more than the filename, declare that route with `action()` or
`controller()` and name it directly.

## Adopting it in an existing app

The generated map is a `RouteMap` like any other, so the rest of the app does
not care where it came from.

1. Move each controller to the filename its route implies. `routes.concerts.show`
   becomes `app/actions/concerts/$city.tsx`.
2. Replace `app/routes.ts` with `export default await flatRoutes()`.
3. Import `routes` from `./routes.gen.ts`, and call `install(router)` in the
   server entry in place of the hand-written `router.map(...)` calls.
4. Run `vite build` and compare `app/routes.gen.ts` against the map you
   deleted.

Step four is the real check. A route that changed pattern or name shows up as a
diff, and `href()` call sites for a renamed route fail to compile.

---
title: Content (no build)
description: "How @pitlane/content serves Markdown, MDX, and data collections from a Remix 3 application that runs from source with no bundler, using remix/assets and Sätteri at request time."
---

# Content (no build)

This is [Content](/guides/content) for an application with **no build step**.
No Vite, no `@pitlane/dev`, no `content()`. The server runs your TypeScript
through `remix/node-tsx`, `remix/assets` compiles and serves the browser
modules, and [Sätteri](https://satteri.bruits.org) renders Markdown
when a request asks for it.

Everything about declaring and querying a collection is the same. The
`app/content.ts` file in this package's two demos is
byte-identical, and a diff of them is the test that keeps it that way. What
changes is the setup around it, and it changes in four places:

|                          | With a bundler                       | Here                       |
| ------------------------ | ------------------------------------ | -------------------------- |
| Markdown renderer        | `vite-plugin-satteri`, at build time | `satteri`, per request     |
| The `headings` plugin    | registered by you in the Vite config | registered for you         |
| An MDX file's imports    | resolved by the bundler              | resolved by this package   |
| Reloading a content file | the `content()` watcher              | `hotContent`, with one gap |

## Installing

```sh
npm install @pitlane/content satteri
```

`satteri` is an optional peer dependency, needed here because Markdown renders
at request time. A collection of `.json` or `.yaml` files does not need it.

There is no `vite-plugin-satteri` on this path and no Vite config to put it in.

## Declaring collections

Unchanged from the bundled setup:

```ts
// app/content.ts
import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

export let content = await createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({ pattern: "**/*.{md,mdx}", base: "app/content/blog" }),
        schema: s.object({
            title: s.string(),
            summary: s.string(),
            publishedOn: coerce.date(),
            author: c.reference("authors"),
        }),
    }),
    authors: c.collection({
        loader: loaders.file("app/content/authors.json"),
        schema: s.object({ name: s.string(), bio: s.string() }),
    }),
}));
```

The loaders read `node:fs` on first access. Paths resolve against
`process.cwd()`, which is the directory you start the server from.

Ids, schemas, references, `getCollection`, `getEntry`, and the fields on an
entry all behave exactly as [Content](/guides/content) describes. Read that
page for those. This one covers what differs.

## Rendering Markdown and MDX

`render()` resolves to the same `{ Content, headings }` it resolves to
anywhere:

```tsx
let { Content, headings } = await post.render();
```

Sätteri parses the body when that call happens, and the result is cached with
the entry, so a second render of the same post costs nothing.

**You do not register the `headings` plugin here.** The bundled path needs it
in the Vite config because the plugin compiles the file; this path adds it
itself, so `headings` is filled on `.md` and `.mdx` alike with no
configuration. Register extra Sätteri plugins through the loader instead:

```ts
import expressiveCode from "satteri-expressive-code";

loaders.glob({
    pattern: "**/*.md",
    base: "app/content/blog",
    satteri: { hastPlugins: [expressiveCode({ themes: ["github-dark"] })] },
});
```

That option configures the runtime path, which is the only path here. On a
collection `content()` prebuilt it does nothing, and the build says so.

::: warning Runtime MDX is Node, Bun, and Deno only
Compiling MDX per request needs `new Function`, which Cloudflare Workers
forbids. Markdown is fine anywhere Sätteri runs. A `.mdx` collection served
from Workers has to be prebuilt with `content()`, which means adding a build
step and following [Content](/guides/content) instead.
:::

## Importing components into MDX

An MDX file imports components the way any module does, and the file is
identical to the one a bundled application would use:

```mdx
import { Badge } from "#/ui/badge.tsx";
import { Counter } from "#/ui/public/counter.tsx";

# Release notes

<Badge label="new" /> is rendered on the server and never reaches the browser.

<Counter start={0} />
```

With no bundler, `@pitlane/content` resolves those specifiers itself, starting
from the MDX file's own location. A relative path means what it says, and
`#/ui/badge.tsx` means what it means in a controller of the same app. An
attributes clause travels with the import, so
`import data from "./data.json" with { type: "json" }` loads the same way on
both hosts.

A specifier that does not resolve fails the render, naming the file and the
specifier. So does an export the module does not have. Neither renders a hole.

A document's own `export` is left alone, so `export const year = 2026` beside
an import still reaches the body that uses it.

### Two forms this path refuses

```mdx
import * as ui from "./badge.tsx";
```

Sätteri compiles a namespace import to nothing in the mode this path uses, so
it is rejected by name rather than left undefined. Import the components by
name.

```mdx
{import.meta.env.MODE}
```

The document is compiled to a function body here rather than a module, so
there is no `import.meta` to read. It is refused with the document named.

Both work under `content()`, where the document compiles to a real module.

### Bare specifiers resolve under `require` conditions

A dependency published with only an `import` condition fails at runtime,
naming the file and the specifier. That is a property of how the document is
loaded, not something this package can route around. Prebuild the collection
and the bundler resolves it.

### MDX's own two rules

A block of `import`s and `export`s cannot begin with a comment, because MDX
reads the whole run as prose instead and the components it names go undefined.
Put the comment after the first statement. The block is also parsed as
JavaScript with JSX rather than TypeScript, so a type annotation in it fails to
parse. `export const Aside = handle => <aside>{handle.props.children}</aside>`
is fine. Annotating `handle` is not.

These two hold on every host, because they belong to MDX itself.

## Hydrating a component from MDX

A component that hydrates in the browser is a `clientEntry` component, and its
entry id is `import.meta.url` on every host:

```tsx
// app/ui/public/counter.tsx
import { clientEntry, on, type Handle } from "remix/ui";

export const Counter = clientEntry(
    import.meta.url,
    function Counter(handle: Handle<{ start: number }>) {
        let count = handle.props.start;

        return () => (
            <button
                mix={[
                    on("click", () => {
                        count += 1;
                        void handle.update();
                    }),
                ]}
                type="button"
            >
                clicked {count} times
            </button>
        );
    },
);
```

With no bundler nothing rewrites that URL, so it stays a `file:` URL and the
renderer resolves it through the asset server you gave it:

```ts
// app/entry.server.tsx
import { asyncContext } from "remix/middleware/async-context";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import { assets } from "#/utils/assets.ts";
import { loadAssetEntry } from "#/middleware/asset-entry.ts";

export let router = createRouter({
    middleware: [asyncContext(), loadAssetEntry(), render({ assets })],
});
```

`render({ assets })` calls `assets.getScriptEntry()` for each `clientEntry` the
page renders, and emits the URL the browser loads, its module preloads, and the
import map that resolves the bare specifiers inside it. Whether the component
arrived through a controller or through an MDX import makes no difference.

The asset server needs to reach the files those components live in:

```ts
// app/utils/assets.ts
import { createAssetServer } from "remix/assets";

export let assets = createAssetServer({
    basePath: "/assets",
    rootDir: process.cwd(),
    allowFiles: ["app/**/public/**"],
    allowPackages: ["remix"],
});
```

A page can install more than one import map that way, which not every browser
supports. Load modules through `remix/multiple-import-maps-polyfill` in the
browser entry so the ones that do not still hydrate:

```ts
// app/public/entry.browser.ts
import { importModule } from "remix/multiple-import-maps-polyfill";
import { run } from "remix/ui";

run({
    async loadModule(moduleUrl, exportName) {
        let module = await importModule(moduleUrl);
        let Component = module[exportName];
        if (typeof Component !== "function") {
            throw new Error(`Unknown component: ${moduleUrl}#${exportName}`);
        }
        return Component;
    },
});
```

## Reloading a content file while the app runs

Add one line beside `createContent`:

```ts
// app/content.ts
import { hotContent } from "@pitlane/content/hot";

export let content = await createContent(c => ({ ... }));

await hotContent(content);
```

Leave it in for production. `hotContent` does nothing unless the process is
supervised by `remix/node-hmr`, so a production server and a Worker both skip
it, and `remix/node-hmr/runtime` is never imported outside development.

Supervising the server is the setup from the
[Remix bookstore demo](https://github.com/remix-run/remix/tree/main/demos/bookstore):
an `hmr.ts` that runs `server.ts` and proxies to it, started with
`NODE_ENV=development`.

```json
{
    "scripts": {
        "dev": "NODE_ENV=development node --import remix/node-tsx ./hmr.ts",
        "start": "NODE_ENV=production node --import remix/node-tsx ./server.ts"
    }
}
```

Edit a post and save. The collection it belongs to is discarded and the page
reloads, so the next request re-reads the file. A collection whose files did
not change keeps what it had. A post saved with frontmatter its schema rejects
shows the error on the page, naming the file and the field.

::: warning A new content file needs a restart
`remix/node-hmr` reports a file change only for a path it was given. A file
that does not exist yet was never given, so a post you have just created stays
invisible until the server restarts. Editing an existing post reloads the page.
So does deleting one.

Touching any file the server imports restarts it, so in practice the fix is a
save in an editor you already have open. Under `content()` there is no such
gap.
:::

## Limitations

Collected, including the ones above:

- **A newly created content file does not reload.** Edits and deletions do.
  The cause is upstream, in how `remix/node-hmr` filters watcher events.
- **Runtime `.mdx` needs `new Function`.** Node, Bun, and Deno only. Workers
  requires a prebuild, which requires a bundler.
- **`import * as ui from "./badge.tsx"` in MDX is refused**, because Sätteri
  compiles it to nothing in this mode.
- **`import.meta` in MDX is refused**, because the document is a function body
  rather than a module.
- **A bare specifier resolves under `require` conditions**, so an
  `import`-only dependency fails at runtime.
- **A populated collection is a snapshot for the life of the process**, held
  until you restart or invalidate it. Content that must be fresh per request wants a
  [`LiveLoader`](/guides/content-loaders#writing-a-liveloader).
- **A prebuilt heading list cannot drift here, because nothing is prebuilt.**
  The matching caveat on the bundled path does not apply.

## Reference

- [Content](/guides/content): the same collections, prebuilt by a bundler
- [Creating a content loader](/guides/content-loaders): reading from anywhere
  other than the filesystem
- [`@pitlane/content`](/package/content/): `createContent` and the types
- [`@pitlane/content/loaders`](/package/content/loaders): `glob` and `file`
- [`@pitlane/content/hot`](/package/content/hot): `hotContent`

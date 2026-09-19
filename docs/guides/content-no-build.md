---
title: Content (no build)
description: "How @pitlane/content turns Markdown, MDX, and data files into schema-validated collections a Remix 3 controller can query, served straight from source with Sätteri rendering at request time."
---

# Content (no build)

[`@pitlane/content`](/package/content/) reads a directory of Markdown, MDX, or
data files and hands back collections you query like a database:

```ts
let posts = await content.blog.getCollection();
let post = await content.blog.getEntry(params.slug);
let { Content, headings } = await post.render();
```

Frontmatter is validated against a schema, so a post that misspells a field
fails where you can see it rather than rendering `undefined`. One entry can
point at another. Types come from the schema, so nothing is generated and
nothing can go stale.

Everything here runs from your source. The server loads your TypeScript through
`remix/node-tsx`, `remix/assets` compiles and serves the modules the browser
needs, and [Sätteri](https://satteri.bruits.org) renders Markdown when a
request asks for it.

## Install

Both are runtime dependencies, because the server that answers a request is
what reads the files and renders them:

::: code-group

```sh [npm]
npm add @pitlane/content satteri
```

```sh [yarn]
yarn add @pitlane/content satteri
```

```sh [pnpm]
pnpm add @pitlane/content satteri
```

```sh [bun]
bun add @pitlane/content satteri
```

```sh [deno]
deno add npm:@pitlane/content npm:satteri
```

```sh [vp]
vp add @pitlane/content satteri
```

```sh [vlt]
vlt add @pitlane/content satteri
```

```sh [nub]
nub add @pitlane/content satteri
```

:::

`satteri` is an optional peer dependency of `@pitlane/content`, needed when a
collection holds `.md` or `.mdx` files. A collection of only `.json` or
`.yaml` files does not need it.

## What a collection is

A collection is a set of entries that share a shape. A directory of blog posts,
one JSON file of authors, a feed of releases pulled from an API. Each entry has
an `id`, some validated `data`, and optionally a body to render.

What defines a collection:

- A **loader**, which says where the bytes come from. Required.
- A **schema**, which says what the data must look like. Required here, because
  a collection whose data is unvalidated is a directory with extra steps.

### When to create one

- You have several files that share a structure, such as posts with the same
  frontmatter fields.
- You have content in a CMS or an API and want to query it the way you query
  local files.
- You want a field a typo cannot survive.

### When not to create one

- One page with some prose in it. Write the page.
- Files you never parse, such as a directory of PDFs. Serve them as assets.
- Data that belongs in a database, queried per request by a controller. A
  collection is content, not state.

## Declaring collections

Write one module, `app/content.ts` by convention, that calls `createContent`:

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

`coerce.date()` rather than `s.string()` turns `publishedOn: 2026-01-02` into
a `Date`.

`createContent` does no I/O. It returns as soon as the collections are wired,
and each one reads its files the first time something asks for it. Relative
paths resolve against the directory you start the server from.

Controllers import `content` from the module and query it:

```tsx
import { createController } from "remix/router";

import { content } from "../content.ts";

export default createController({
    async index({ render }) {
        let posts = await content.blog.getCollection(post => post.data.publishedOn < new Date());
        return await render(<PostList posts={posts} />);
    },
});
```

## The two built-in loaders

`loaders.glob` reads a directory of files, one entry per file. `pattern` is an
ordinary string, so it can be computed, read from an environment variable, or
assembled in a loop. `base` is the directory patterns resolve against, relative
to the project root, and defaults to the root itself.

What each extension becomes:

| Extension       | Becomes                                                   |
| --------------- | --------------------------------------------------------- |
| `.md`, `.mdx`   | frontmatter is the data, the rest of the file is the body |
| `.json`         | the parsed file is the data, with no body                 |
| `.yaml`, `.yml` | the same, parsed as YAML                                  |
| anything else   | skipped                                                   |

Frontmatter is the leading `---`-fenced block, parsed as YAML.

`loaders.file` reads one file holding many entries. An array wants a string
`id` on each item, which is removed from the data because it becomes the
entry's id:

```json
[
    { "id": "ada", "name": "Ada Lovelace" },
    { "id": "grace", "name": "Grace Hopper" }
]
```

An object uses its keys as ids instead, so the same two authors can be written:

```json
{
    "ada": { "name": "Ada Lovelace" },
    "grace": { "name": "Grace Hopper" }
}
```

`.json`, `.yaml`, and `.yml` are built in. Any other extension needs a parser,
which is also how you read a format nothing here knows, such as JSONC or TOML:

```ts
loaders.file("app/content/authors.jsonc", { parser: text => parseJsonc(text) });
```

Anything that is not a local file wants a loader of your own. See
[Creating a content loader](/guides/content-loaders).

## Ids

An id is the matched path relative to `base`, with the extension stripped:
`app/content/blog/2026/hello.mdx` under `base: "app/content/blog"` becomes
`2026/hello`. That is the id you route on, so a nested directory gives you a
nested URL for free.

Pass `generateId` to derive it from something else, such as a frontmatter
`slug`. It receives `entry`, the matched path relative to `base` with its
extension still on it, so a fallback to the default id strips that itself:

```ts
loaders.glob({
    pattern: "**/*.mdx",
    base: "app/content/blog",
    generateId: ({ data, entry }) => (data.slug as string) ?? entry.replace(/\.mdx$/, ""),
});
```

## The schema

A schema is any [Standard Schema](https://standardschema.dev) validator, which
in a Remix application means `remix/data-schema`:

```ts
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

schema: s.object({
    title: s.string(),
    draft: s.defaulted(s.boolean(), false),
    publishedOn: coerce.date(),
    updatedOn: s.optional(coerce.date()),
    tags: s.array(s.string()),
});
```

Frontmatter arrives as YAML, so `publishedOn: 2026-01-02` is already a `Date`
and `tags: [a, b]` is already an array. `coerce` matters for the fields YAML
leaves as strings, and for data from an API where everything is a string.

The parsed shape is what `entry.data` is typed as. Nothing is generated, so
there is no step that can disagree with what you wrote.

### References

`c.reference("authors")` is a schema that accepts a string and produces
`{ collection, id }`. It composes wherever a schema goes:

```ts
schema: s.object({
    author: c.reference("authors"),
    tags: s.array(c.reference("tags")),
});
```

Hand the result straight to the other collection:

```ts
let author = await content.authors.getEntry(post.data.author);
```

That type-checks only against the collection the reference names, so passing a
`Reference<"authors">` to `content.tags.getEntry` is a compile error.

A reference is not checked for existence. `getEntry` resolves to `undefined`
when nothing matches, and that is where a broken pointer surfaces. A collection
name that does not exist at all is caught earlier, when `createContent` runs:

```text
Unknown collection "wrtiers" referenced by createContent; known collections are blog, authors.
```

## Querying a collection

`getCollection()` returns every entry, sorted by `id` ascending. The order does
not depend on the filesystem, so the same content always renders the same way.

```ts
let all = await content.blog.getCollection();
let published = await content.blog.getCollection(post => post.data.publishedOn < new Date());
```

`getEntry(id)` returns one entry, or `undefined` when nothing has that id:

```ts
let post = await content.blog.getEntry("hello-world");
```

Every entry carries the same five things:

| Field        | What it is                                              |
| ------------ | ------------------------------------------------------- |
| `id`         | the file path relative to `base`, without the extension |
| `collection` | the key this entry came from                            |
| `data`       | the frontmatter, parsed and validated by the schema     |
| `filePath`   | the file it was read from, when it came from one        |
| `render()`   | resolves to the entry's component and headings          |

A collection reads its files once, on first access, and keeps them for the life
of the process. Failures are the exception: nothing caches them, so one
unreadable file does not break a collection until you restart.

## Generating routes from content

An id is a path, so a route parameter is all it takes:

```ts
// app/routes.ts
export let routes = route({ post: get("/blog/:slug") });
```

```tsx
// app/actions/controller.tsx
export default createController(routes, {
    async post({ params, render }) {
        let post = await content.blog.getEntry(params.slug);
        if (!post) return new Response("Not found", { status: 404 });

        let { Content, headings } = await post.render();
        return await render(<PostPage post={post} headings={headings} Content={Content} />);
    },
});
```

## Rendering Markdown and MDX

`render()` resolves to a component and a heading list:

```tsx
let { Content, headings } = await post.render();

return await render(
    <article>
        <TableOfContents headings={headings} />
        <Content />
    </article>,
);
```

Sätteri parses the body when that call happens, and the result is cached with
the entry, so listing a collection's titles never pays for the bodies it does
not show and a second render of the same post costs nothing. Each heading is
`{ depth, slug, text }`, and the slug matches the `id` on the rendered heading,
so `#install-the-package` lands on it.

The heading list needs no setup. `@pitlane/content` registers the plugin that
produces it, on `.md` and `.mdx` alike.

Props on `<Content />` reach the MDX content, which is how you override the
elements it renders:

```tsx
<Content components={{ h2: Heading, a: Link }} />
```

Extra Sätteri plugins go through the loader:

```ts
loaders.glob({
    pattern: "**/*.md",
    base: "app/content/blog",
    satteri: { hastPlugins: [myPlugin()] },
});
```

A collection of `.json` or `.yaml` files needs none of this. Calling `render()`
on a data entry is an error rather than an empty component, because a blank
page is the harder bug to find:

```text
Entry "authors/ada" has no renderable content.
```

::: warning MDX needs a host that allows `new Function`
Compiling MDX for a request evaluates the compiled body, which Cloudflare
Workers and any other runtime with the same restriction forbid. Node, Bun, and
Deno all allow it. Markdown has no such requirement and renders anywhere
Sätteri runs.
:::

## Importing components into MDX

An MDX file imports components the way any module does:

```mdx
import { Badge } from "#/ui/badge.tsx";
import { Counter } from "#/ui/public/counter.tsx";

# Release notes

<Badge label="new" /> is rendered on the server and never reaches the browser.

<Counter start={0} />
```

`@pitlane/content` resolves those specifiers from the MDX file's own location.
A relative path means what it says, and `#/ui/badge.tsx` means what it means in
a controller of the same app. Attributes travel with the import too, so
`import data from "./data.json" with { type: "json" }` loads the data.

A specifier that does not resolve fails the render, naming the file and the
specifier. So does an export the module does not have. Neither renders a hole.

A document's own `export` is left alone, so `export const year = 2026` beside
an import still reaches the body that uses it.

### Two forms that are refused

```mdx
import * as ui from "./badge.tsx";
```

Sätteri compiles a namespace import to nothing in the mode this path uses, so
it is rejected by name rather than left undefined. Import the components by
name.

```mdx
{import.meta.env.MODE}
```

A document is compiled to a function body rather than a module, so there is no
`import.meta` to read. It is refused with the document named.

### Bare specifiers resolve under `require` conditions

A dependency published with only an `import` condition fails to load, naming
the file and the specifier. Import a `require`-compatible entry point, or wrap
the dependency in a module of your own that the MDX file imports by path.

### MDX's own two rules

A block of `import`s and `export`s cannot begin with a comment, because MDX
reads the whole run as prose instead and the components it names go undefined.
Put the comment after the first statement. The block is also parsed as
JavaScript with JSX rather than TypeScript, so a type annotation in it fails to
parse. `export const Aside = handle => <aside>{handle.props.children}</aside>`
is fine. Annotating `handle` is not.

## Hydrating a component from MDX

A component that hydrates in the browser is a `clientEntry` component, and its
entry id is the URL of the file it lives in:

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

The renderer resolves that `file:` URL through the asset server you give it:

```ts
// app/entry.server.tsx
import { asyncContext } from "remix/middleware/async-context";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import { loadAssetEntry } from "#/middleware/asset-entry.ts";
import { assets } from "#/utils/assets.ts";

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
supervised by `remix/node-hmr`, so a production server skips it and
`remix/node-hmr/runtime` is never imported outside development.

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
save in an editor you already have open.
:::

## Highlighting code

Highlighting is a Sätteri plugin rather than an option this package owns. Use
[`satteri-expressive-code`](https://github.com/bruits/satteri/tree/main/packages/satteri-expressive-code),
which gives [Expressive Code](https://expressive-code.com) frames, line
markers, and a copy button over [Shiki](https://shiki.style) themes. It runs
when a request renders, so it is a dependency rather than a dev one:

::: code-group

```sh [npm]
npm add satteri-expressive-code
```

```sh [yarn]
yarn add satteri-expressive-code
```

```sh [pnpm]
pnpm add satteri-expressive-code
```

```sh [bun]
bun add satteri-expressive-code
```

```sh [deno]
deno add npm:satteri-expressive-code
```

```sh [vp]
vp add satteri-expressive-code
```

```sh [vlt]
vlt add satteri-expressive-code
```

```sh [nub]
nub add satteri-expressive-code
```

:::

```ts
import expressiveCode from "satteri-expressive-code";

loaders.glob({
    pattern: "**/*.md",
    base: "app/content/blog",
    satteri: { hastPlugins: [expressiveCode({ themes: ["github-dark", "github-light"] })] },
});
```

The plugin emits its own `<style>` element with the content, so it needs no
stylesheet of yours.

## Limitations

- **A newly created content file does not reload.** Edits and deletions do.
  The cause is upstream, in how `remix/node-hmr` filters watcher events.
- **MDX needs a host that allows `new Function`.** Node, Bun, and Deno qualify.
  Cloudflare Workers does not, and refuses to render `.mdx` at request time.
- **`import * as ui from "./badge.tsx"` in MDX is refused**, because Sätteri
  compiles it to nothing in this mode.
- **`import.meta` in MDX is refused**, because a document is compiled to a
  function body rather than a module.
- **A bare specifier resolves under `require` conditions**, so an
  `import`-only dependency fails to load.
- **A collection is a snapshot for the life of the process**, held until you
  restart or edit one of its files. Content that must be fresh per request
  wants a [`LiveLoader`](/guides/content-loaders#writing-a-liveloader).
- **A content change discards the whole collection**, not the entry that
  changed. Nothing here diffs entries or keeps a per-entry digest.
- **A reference is not checked for existence**, only for type. A pointer at a
  missing entry surfaces as `getEntry` resolving to `undefined`.

## Errors you will see

A schema failure names the collection, the entry, the file, and every issue:

```text
Failed to parse entry "hello" in collection "blog" (app/content/blog/hello.md):
  - title: Expected a string
  - publishedOn: Expected a date
```

An id claimed twice is a conflict rather than a merge:

```text
Duplicate entry id "hello" in collection "blog".
```

Rendering Markdown with `satteri` missing fails by naming the file it was
rendering and the dependency to install.

## Reference

- [Creating a content loader](/guides/content-loaders): reading from anywhere
  other than the filesystem
- [`@pitlane/content`](/package/content/): `createContent` and the types
- [`@pitlane/content/loaders`](/package/content/loaders): `glob` and `file`
- [`@pitlane/content/hot`](/package/content/hot): `hotContent`

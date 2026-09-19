---
title: Content
description: "How @pitlane/content turns Markdown, MDX, and data files into schema-validated collections a Remix 3 controller can query, prebuilt into the bundle by the contentLayer() Vite plugin."
---

# Content

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

This page covers an application built with Vite and
[`@pitlane/dev`](/guides/vite-plugin). For an application that runs from source
with no bundler at all, read [Content (no build)](/guides/content-no-build)
instead. The collections themselves are identical on both, and that is the
point of the split: only the setup around them differs.

## Install

`@pitlane/content` is a runtime dependency, because your controllers import
it. Markdown and MDX add two more, and both are build-only here: the plugin
compiles the bodies, and `contentLayer()` calls `satteri` directly to measure a
Markdown file's heading list.

::: code-group

```sh [npm]
npm add @pitlane/content
npm add -D satteri vite-plugin-satteri
```

```sh [yarn]
yarn add @pitlane/content
yarn add -D satteri vite-plugin-satteri
```

```sh [pnpm]
pnpm add @pitlane/content
pnpm add -D satteri vite-plugin-satteri
```

```sh [bun]
bun add @pitlane/content
bun add -D satteri vite-plugin-satteri
```

```sh [deno]
deno add npm:@pitlane/content
deno add -D npm:satteri npm:vite-plugin-satteri
```

```sh [vp]
vp add @pitlane/content
vp add -D satteri vite-plugin-satteri
```

```sh [vlt]
vlt add @pitlane/content
vlt add -D satteri vite-plugin-satteri
```

```sh [nub]
nub add @pitlane/content
nub add -D satteri vite-plugin-satteri
```

:::

`vite-plugin-satteri` declares `satteri` as a peer dependency, so installing
it alone is not enough. A collection of only `.json` or `.yaml` files needs
neither.

One case moves `satteri` out of `devDependencies`: a
[`LiveLoader`](/guides/content-loaders#writing-a-liveloader) that returns a
Markdown body renders at request time even in a bundled application, because
`contentLayer()` never touches it. That collection needs `satteri` at runtime, so
install it with `add` rather than `add -D`.

[`@pitlane/dev`](/guides/vite-plugin) is assumed here and installs itself the
same way, as a dev dependency.

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
        loader: loaders.glob({ pattern: "**/*.mdx", base: "app/content/blog" }),
        schema: s.object({
            title: s.string(),
            summary: s.string(),
            publishedOn: coerce.date(),
            author: c.reference("authors"),
        }),
    }),
    authors: c.collection({
        loader: loaders.file("app/content/authors.json"),
        schema: s.object({ name: s.string(), avatar: s.string() }),
    }),
}));
```

`coerce.date()` rather than `s.string()` turns `publishedOn: 2026-01-02` into a
`Date`.

`createContent` does no I/O. It returns as soon as the collections are wired,
so importing this module is free and safe on every host, Cloudflare Workers
included. Workers rejects asynchronous work at module scope.

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
`@pitlane/content` parses it in one place for both rendering paths, so a
prebuilt collection and a collection read at runtime cannot disagree about an
entry's data.

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
not depend on the filesystem, so a prerender is reproducible.

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

A collection loads once, on first access, and is memoized for the life of the
process. Failures are the exception: nothing caches them, so one timed-out
fetch does not break a collection until you restart.

To pass an entry to a component, name its type with `CollectionEntry`, which
takes the collection rather than its data:

```tsx
import type { CollectionEntry } from "@pitlane/content";

import { content } from "#app/content.ts";

export function PostCard(handle: Handle<{ post: CollectionEntry<typeof content.blog> }>) {
    return () => <h2>{handle.props.post.data.title}</h2>;
}
```

Nothing is generated, so this cannot go stale: change the schema and the
component stops type-checking.

## Generating routes from content

An id is a path, so a route parameter is all it takes:

```tsx
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

To publish the whole collection as static HTML, hand those paths to
[prerendering](/guides/prerendering):

```ts
let posts = await content.blog.getCollection();

remix({ prerender: posts.map(post => `/blog/${post.id}`) });
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

Nothing parses Markdown until you call `render()`, so listing a collection's
titles never pays for the bodies it does not show. Each heading is
`{ depth, slug, text }`, and the slug matches the `id` on the rendered heading,
so `#install-the-package` lands on it.

Props on `<Content />` reach the MDX content, which is how you override the
elements it renders:

```tsx
<Content components={{ h2: Heading, a: Link }} />
```

### Setting up Sätteri

Markdown is compiled by [Sätteri](https://satteri.bruits.org), installed
[above](#install) alongside its Vite plugin.

Register it in the Vite config, **before** `remix()`, with the two plugins
`@pitlane/content` ships:

```ts
// vite.config.ts
import { headings, rawStyles } from "@pitlane/content/satteri";
import { contentLayer } from "@pitlane/content/vite";
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite";
import satteri from "vite-plugin-satteri";

export default defineConfig({
    plugins: [
        satteri({
            mdx: { jsxImportSource: "remix/ui" },
            mdastPlugins: [headings()],
            hastPlugins: [rawStyles()],
        }),
        contentLayer(),
        remix(),
    ],
});
```

`jsxImportSource: "remix/ui"` is required. It is what makes a compiled MDX file
a Remix component rather than a React one.

`headings()` fills the `headings` array `render()` resolves to. An MDX file
exports the list from its compiled module. Markdown compiles to an HTML string
with no room for one, so `contentLayer()` measures that list itself during the
build. A prebuilt `.md` page gets the same table of contents as the same file
rendered at runtime.

`rawStyles()` keeps a `<style>` element's CSS intact. Remix escapes `>` in the
text of an element, and a browser never undoes that inside `<style>`, so a
rule written `pre > code` would arrive as `pre &gt; code` and do nothing. The
plugin hands the CSS over as raw markup instead. Add it whenever your content
can produce a `<style>` — which includes every page with a highlighted code
block, because that is how [Expressive Code](#highlighting-code) ships its
theme.

A collection of `.json` or `.yaml` files needs none of this. Calling `render()`
on a data entry is an error rather than an empty component, because a blank
page is the harder bug to find:

```text
Entry "authors/ada" has no renderable content.
```

### Importing components into MDX

An MDX file imports components the way any module does:

```mdx
import { Badge } from "#/ui/badge.tsx";
import { Counter } from "#/ui/public/counter.tsx";

# Release notes

<Badge label="new" /> is rendered on the server and never reaches the browser.

<Counter start={0} />
```

With a bundler these are ordinary imports, resolved by Vite, with all of Vite's
resolution behind them. A component that hydrates in the browser is a
`clientEntry` component whose entry id is `import.meta.url`, which the bundler
rewrites to the built asset's URL:

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

MDX itself imposes two rules, and they hold on every host. A block of `import`s
and `export`s cannot begin with a comment, because MDX reads the whole run as
prose instead and the components it names go undefined. Put the comment after
the first statement. The block is also parsed as JavaScript with JSX rather
than TypeScript, so a type annotation in it fails to parse.
`export const Aside = handle => <aside>{handle.props.children}</aside>` is
fine. Annotating `handle` is not.

## Prebuilding for a host with no filesystem

`loaders.glob` and `loaders.file` read the filesystem. Cloudflare Workers does
not have one, so add `contentLayer()` to the Vite config and the build resolves the
collections ahead of time. Entry data becomes plain values in the bundle, and
Markdown bodies become modules the bundler compiles.

```ts
import { contentLayer } from "@pitlane/content/vite";

export default defineConfig({
    plugins: [contentLayer(), remix()],
});
```

**Your collections do not change.** `app/content.ts` is identical either way,
and so is every controller that queries it. Adding a host edits the Vite
config.

`contentLayer()` executes `app/content.ts` in Node during the build, so that module
must import cleanly there. Keep it to collection declarations, with no
`cloudflare:workers` imports and nothing that needs a live server. Point
`entry` elsewhere if the module lives somewhere else:

```ts
contentLayer({ entry: "app/collections.ts" });
```

Only a `ContentLoader` is prebuilt. A `LiveLoader` is untouched, because there
is no single execution for the build to run, and it still runs per read
wherever the app is deployed.

If a bundled app reaches a collection with neither source, it says so instead
of serving an empty list:

```text
Collection "blog" has no prebuilt content and no filesystem to read.
Add contentLayer() from "@pitlane/content/vite" to your Vite config.
```

## Reloading while you work

`contentLayer()` watches every path the loaders report. Editing, adding, or deleting
a content file rebuilds the affected collection and reloads the page, so
nothing here needs a restart.

That watching is the plugin's, so it covers the collections the plugin
prebuilds. A `LiveLoader` re-reads on every request anyway and has nothing to
watch.

## Highlighting code

Highlighting is a Sätteri plugin rather than an option this package owns. Use
[`satteri-expressive-code`](https://github.com/bruits/satteri/tree/main/packages/satteri-expressive-code),
which gives [Expressive Code](https://expressive-code.com) frames, line
markers, and a copy button over [Shiki](https://shiki.style) themes. It runs
in the build here, so it is a dev dependency:

::: code-group

```sh [npm]
npm add -D satteri-expressive-code
```

```sh [yarn]
yarn add -D satteri-expressive-code
```

```sh [pnpm]
pnpm add -D satteri-expressive-code
```

```sh [bun]
bun add -D satteri-expressive-code
```

```sh [deno]
deno add -D npm:satteri-expressive-code
```

```sh [vp]
vp add -D satteri-expressive-code
```

```sh [vlt]
vlt add -D satteri-expressive-code
```

```sh [nub]
nub add -D satteri-expressive-code
```

:::

```ts
import expressiveCode from "satteri-expressive-code";

let code = expressiveCode({ themes: ["github-dark", "github-light"] });

satteri({
    mdx: { jsxImportSource: "remix/ui" },
    mdastPlugins: [headings()],
    hastPlugins: [code, rawStyles()],
});
```

The plugin emits its own `<style>` element with the content, so it needs no
stylesheet of yours. That is why `rawStyles()` is in the list and why it comes
after `code`: without it Expressive Code's own rules lose their `>` and your
code blocks render with the theme half applied.

A loader's `satteri` option configures the runtime rendering path only. On a
collection `contentLayer()` prebuilt it does nothing, and the build says so:

```text
Collection "blog" configures loader options.satteri, but contentLayer() prebuilt it,
so vite-plugin-satteri renders it and those options do nothing. Move the plugins
into satteri() in your Vite config, or drop contentLayer() for this collection.
```

## Limitations

- **A component written in a `.md` file does not render.** Markdown compiles
  to an HTML string, so `<Callout />` in a `.md` body is an unknown tag rather
  than your component, and nothing says so. Author that file as `.mdx`. This
  catches people moving off `@mdx-js/rollup`, which compiled both extensions
  as MDX; we intend to close the gap by compiling Markdown to components too,
  which would also drop the wrapper `<div>` below.
- **A rendered Markdown body is wrapped in a `<div>`.** `innerHTML` is an
  element prop, so the markup needs an element to land on. MDX has no wrapper.
- **A prebuilt Markdown heading list is measured with `headings()` alone.**
  Another `mdastPlugin` that rewrites heading text or slugs changes the
  prebuilt HTML without changing that list, because `vite-plugin-satteri` does
  not publish the options it was given. Rewriting headings is a reason to use
  `.mdx`, which carries its own list.
- **A content change rebuilds the whole collection**, not the entry that
  changed. Nothing here diffs entries or keeps a per-entry digest.
- **A populated collection is a snapshot for the life of the process.** There
  is no TTL and no background refresh. Content that must be fresh per request
  wants a [`LiveLoader`](/guides/content-loaders#writing-a-liveloader).
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

Rendering Markdown with no renderer installed names the fix:

```text
Rendering "app/content/blog/hello.md" needs the optional peer dependency "satteri";
install it, or add contentLayer() from @pitlane/content/vite so the build compiles this collection.
```

## Reference

- [Content (no build)](/guides/content-no-build): the same collections, served
  from source with no bundler
- [Creating a content loader](/guides/content-loaders): reading from anywhere
  else
- [`@pitlane/content`](/package/content/): `createContent` and the types
- [`@pitlane/content/loaders`](/package/content/loaders): `glob` and `file`
- [`@pitlane/content/satteri`](/package/content/satteri): the `headings` and `rawStyles` plugins
- [`@pitlane/content/vite`](/package/content/vite): the `contentLayer()` plugin

---
title: Content Collections
description: "How @pitlane/content turns Markdown, MDX, and data files into schema-validated collections a Remix 3 controller can query, on a Node host and on Cloudflare Workers through the content() Vite plugin."
---

# Content Collections

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

The **loader** says where the bytes come from. The **schema** says what the
data must look like. `coerce.date()` rather than `s.string()` turns
`publishedOn: 2026-01-02` into a `Date`.

`createContent` does no I/O. It returns as soon as the collections are wired,
so importing this module is free and safe on every host, Cloudflare Workers
included. Workers rejects asynchronous work at module scope.

Controllers import `content` from the module and query it:

```ts
import { createController } from "remix/router";

import { content } from "../content.ts";

export default createController({
    async index({ render }) {
        let posts = await content.blog.getCollection(post => post.data.publishedOn < new Date());
        return await render(<PostList posts={posts} />);
    },
});
```

## Reading a collection

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

Frontmatter is the leading `---`-fenced block, parsed as YAML. `@pitlane/content`
parses it in one place for both rendering paths, so a prebuilt collection and a
collection read at runtime cannot disagree about an entry's data.

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

## References

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

### Markdown needs Sätteri

Rendering a Markdown body at runtime uses
[Sätteri](https://satteri.bruits.org), an optional peer dependency. Install it
when a collection has `.md` or `.mdx` files:

```sh
npm install satteri vite-plugin-satteri
```

Then register Sätteri in the Vite config, **before** `remix()`, along with the
`headings` plugin that produces the heading list:

```ts
// vite.config.ts
import { content } from "@pitlane/content/vite";
import { headings } from "@pitlane/content/satteri";
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite";
import satteri from "vite-plugin-satteri";

export default defineConfig({
    plugins: [
        satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()] }),
        content(),
        remix(),
    ],
});
```

`jsxImportSource: "remix/ui"` is required: it is what makes a compiled MDX file
a Remix component rather than a React one.

A collection of `.json` or `.yaml` files needs none of this. Calling `render()`
on a data entry is an error rather than an empty component, because a blank page
is the harder bug to find:

```text
Entry "authors/ada" has no renderable content.
```

## Running on a host with no filesystem

`loaders.glob` and `loaders.file` read the filesystem. Cloudflare Workers does
not have one, so add `content()` to the Vite config and the build resolves the
collections ahead of time. Entry data becomes plain values in the bundle, and
Markdown bodies become modules the bundler compiles.

```ts
import { content } from "@pitlane/content/vite";

export default defineConfig({
    plugins: [content(), remix()],
});
```

**Your collections do not change.** `app/content.ts` is identical either way,
and so is every controller that queries it. Adding a host edits the Vite config.

`content()` executes `app/content.ts` in Node during the build, so that module
must import cleanly there. Keep it to collection declarations: no
`cloudflare:workers` imports, and nothing that needs a live server. Point
`entry` elsewhere if the module lives somewhere else:

```ts
content({ entry: "app/collections.ts" });
```

With `content()` installed, editing, adding, or deleting a content file
rebuilds the affected collection and reloads the page. Without it, a collection
reads the filesystem once and a later change needs a restart.

If a bundled app reaches a collection with neither source, it says so instead of
serving an empty list:

```text
Collection "blog" has no prebuilt content and no filesystem to read.
Add content() from "@pitlane/content/vite" to your Vite config.
```

::: warning A prebuilt `.md` entry has no headings
For Markdown, `vite-plugin-satteri` emits an HTML string with no room for a
heading list, so `headings` is `[]` once a `.md` file is prebuilt. `.mdx`
produces headings on every host, which is the reason to prefer it for any page
that needs a table of contents.
:::

## Highlighting code

Highlighting is a Sätteri plugin rather than an option this package owns. Use
[`satteri-expressive-code`](https://github.com/bruits/satteri/tree/main/packages/satteri-expressive-code),
which gives [Expressive Code](https://expressive-code.com) frames, line markers,
and a copy button over [Shiki](https://shiki.style) themes.

Configure it once per rendering path you use: the Vite plugin for prebuilt
content, the loader for content rendered at runtime.

```ts
import expressiveCode from "satteri-expressive-code";

let code = expressiveCode({ themes: ["github-dark", "github-light"] });

// prebuilt by content()
satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()], hastPlugins: [code] });

// rendered at runtime
loaders.glob({ pattern: "**/*.md", base: "app/content/blog", satteri: { hastPlugins: [code] } });
```

The plugin emits its own `<style>` element with the content, so it needs no
stylesheet of yours.

## Which loader do I write?

The two built-in loaders cover local files. For anything else you write the
loader, and the interface you satisfy is what tells `@pitlane/content` how to
treat it.

Write a **`ContentLoader`** when one execution can produce the whole
collection. It is handed a store and fills it, which makes its output a value
the build can resolve once and inline:

```ts
import type { ContentLoader } from "@pitlane/content";

function releases(repository: string): ContentLoader {
    return {
        name: "releases",
        async load(context) {
            let response = await fetch(`https://api.github.com/repos/${repository}/releases`);
            for (let release of await response.json()) {
                context.store.set({
                    id: release.tag_name,
                    data: await context.parseData({ id: release.tag_name, data: release }),
                    body: { format: "md", source: release.body },
                });
            }
        },
    };
}
```

Write a **`LiveLoader`** when there is no such moment, such as a CMS whose
editors expect to see a change without a deploy:

```ts
import type { LiveLoader } from "@pitlane/content";

function cms(): LiveLoader {
    return {
        name: "cms",
        async loadCollection() {
            return await fetchEveryPost();
        },
        async loadEntry(id) {
            return await fetchPost(id);
        },
    };
}
```

Both are ordinary objects with no flag to set, and the choice is about what the
data is rather than where the app runs:

|                           | `ContentLoader`                            | `LiveLoader`                         |
| ------------------------- | ------------------------------------------ | ------------------------------------ |
| Interface                 | `load(context)`                            | `loadCollection()` / `loadEntry(id)` |
| With `content()`          | resolved during the build, entries inlined | untouched; runs per read             |
| Without a bundler         | runs on the first read, then memoized      | runs per read                        |
| Sees data published later | no                                         | yes                                  |
| Schema failures surface   | during the build, or on the first read     | on every read                        |

Snapshotting a CMS at build time is a `ContentLoader` over `fetch`. That is how
a fully static site works, so it is a choice rather than a mistake. A
`LiveLoader` is never touched by `content()`, because there is no single
execution for the build to run.

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

A collection whose loader fails rejects the read that triggered it, and the
failure is not cached. The next read tries again, so one timed-out fetch does
not break a collection until the process restarts.

Rendering Markdown with no renderer installed names the fix:

```text
Rendering "app/content/blog/hello.md" needs the optional peer dependency "satteri";
install it, or add content() from @pitlane/content/vite so the build compiles this collection.
```

## Reference

- [`@pitlane/content`](/package/content/): `createContent` and the types
- [`@pitlane/content/loaders`](/package/content/loaders): `glob` and `file`
- [`@pitlane/content/satteri`](/package/content/satteri): the `headings` plugin
- [`@pitlane/content/vite`](/package/content/vite): the `content()` plugin

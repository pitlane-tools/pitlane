---
title: Creating a Content Loader
description: "How to write a ContentLoader or a LiveLoader for @pitlane/content, with worked examples for CSV files, RSS feeds, a GitHub API, a headless CMS, and mock data."
---

# Creating a Content Loader

The two built-in loaders read local files. Everything else is a loader you
write, and the interface you satisfy is what tells `@pitlane/content` how to
treat the collection.

```ts
import type { ContentLoader, LiveLoader } from "@pitlane/content";
```

There is no flag and no registration. An object with a `load` method is a
`ContentLoader`. An object with `loadCollection` and `loadEntry` is a
`LiveLoader`. The shape is the declaration.

## Choosing between them

Write a **`ContentLoader`** when one execution can produce the whole
collection, such as a directory of files or an export from a CMS. That claim
is what lets a build run it once and inline the answer.

Write a **`LiveLoader`** when no such moment exists: inventory, prices, draft
content an editor expects to see without a deploy.

|                           | `ContentLoader`                            | `LiveLoader`                         |
| ------------------------- | ------------------------------------------ | ------------------------------------ |
| Interface                 | `load(context)`                            | `loadCollection()` / `loadEntry(id)` |
| With `contentLayer()`     | resolved during the build, entries inlined | untouched, runs per read             |
| Without a bundler         | runs on the first read, then memoized      | runs per read                        |
| Sees data published later | no                                         | yes                                  |
| Schema failures surface   | during the build, or on the first read     | on every read                        |
| Can be prerendered        | yes                                        | yes, frozen at the moment you render |

Snapshotting a CMS at build time is a `ContentLoader` over `fetch`, and that is
how a fully static site works. It is a choice rather than a mistake.

## Writing a `ContentLoader`

```ts
interface ContentLoader {
    name: string;
    load(context: LoaderContext): Promise<void> | void;
    watchedPaths?(): string[];
}
```

`load` is handed a context and fills a store. It returns nothing:

```ts
interface LoaderContext {
    collection: string;
    root: string;
    parseData<D>(input: { id: string; data: unknown; filePath?: string }): Promise<D>;
    store: { set(entry: LoadedEntry): void };
}
```

- **`collection`** is the key this loader was declared under, useful in error
  messages.
- **`root`** is the project root a relative path resolves against. Use it
  rather than `process.cwd()`: under a build it is the Vite root, which is what
  keeps a collection pointing at the same files when the build runs from
  somewhere else.
- **`parseData`** validates one entry against the collection's schema and
  returns the parsed value. Always pass its result to `store.set`, never the
  raw data.
- **`store.set`** takes `{ id, data, filePath?, body? }`. An id claimed twice
  throws rather than merging.

A body is what makes an entry renderable:

```ts
context.store.set({
    id: "hello",
    data: await context.parseData({ id: "hello", data: frontmatter }),
    body: { format: "md", source: "# Hello\n\nSome prose." },
});
```

`format` is `"md"` or `"mdx"`. An entry with no body is data, and calling
`render()` on it is an error rather than a blank page.

### A CSV loader

The shortest useful loader, turning each row of one file into an entry:

```ts
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ContentLoader } from "@pitlane/content";

export function csv(options: { file: string; idColumn?: string }): ContentLoader {
    let watched: string[] = [];

    return {
        name: "csv",
        async load(context) {
            let filePath = path.resolve(context.root, options.file);
            watched = [filePath];

            let [header, ...rows] = (await fs.readFile(filePath, "utf8")).trim().split("\n");
            let columns = header.split(",").map(column => column.trim());

            for (let row of rows) {
                let values = row.split(",").map(value => value.trim());
                let record = Object.fromEntries(
                    columns.map((column, index) => [column, values[index]]),
                );
                let id = String(record[options.idColumn ?? "id"]);

                context.store.set({
                    id,
                    data: await context.parseData({ id, data: record, filePath }),
                    filePath,
                });
            }
        },
        watchedPaths: () => watched,
    };
}
```

`watchedPaths` is what a development host watches to notice a change. Report
the files or directories your loader read. Omit it and the collection is
simply not watched. A loader with no local files has nothing to report, which
is why it is optional.

Pass a schema that describes the columns, and every row is validated:

```ts
products: c.collection({
    loader: csv({ file: "data/products.csv" }),
    schema: s.object({ id: s.string(), name: s.string(), price: coerce.number() }),
});
```

### A feed loader

Fetching at load time is the same shape. Entries get a body, so each one
renders:

```ts
import type { ContentLoader } from "@pitlane/content";

export function feed(options: { url: string }): ContentLoader {
    return {
        name: "feed",
        async load(context) {
            let response = await fetch(options.url);
            if (!response.ok) {
                throw new Error(`${options.url} returned ${response.status}`);
            }

            for (let item of parseFeed(await response.text())) {
                context.store.set({
                    id: slug(item.link),
                    data: await context.parseData({ id: slug(item.link), data: item }),
                    body: { format: "md", source: item.description },
                });
            }
        },
    };
}
```

Throw when the source is unreachable. Under `contentLayer()`
it fails the build, which is the moment you want to hear about a broken feed.
Without a bundler it rejects the read that triggered it, and the failure is not
memoized, so the next request tries again.

### A GitHub releases loader

An API with its own pagination and its own field names, mapped into something
a schema can describe:

```ts
import type { ContentLoader } from "@pitlane/content";

export function releases(options: { repository: string; token?: string }): ContentLoader {
    return {
        name: "github-releases",
        async load(context) {
            let headers: HeadersInit = { accept: "application/vnd.github+json" };
            if (options.token) headers.authorization = `Bearer ${options.token}`;

            let page = 1;
            while (true) {
                let url = `https://api.github.com/repos/${options.repository}/releases?per_page=100&page=${page}`;
                let response = await fetch(url, { headers });
                if (!response.ok) {
                    throw new Error(`GitHub returned ${response.status} for ${options.repository}`);
                }

                let batch = (await response.json()) as GitHubRelease[];
                if (batch.length === 0) return;

                for (let release of batch) {
                    let data = {
                        tag: release.tag_name,
                        name: release.name ?? release.tag_name,
                        publishedOn: release.published_at,
                        prerelease: release.prerelease,
                    };

                    context.store.set({
                        id: release.tag_name,
                        data: await context.parseData({ id: release.tag_name, data }),
                        body: { format: "md", source: release.body ?? "" },
                    });
                }

                page += 1;
            }
        },
    };
}
```

Two things worth copying. The loader takes its credentials as options rather
than reading `process.env` itself, so it works on a host that has no `process`
and the application decides where secrets come from. And the data handed to
`parseData` is a shape you chose, not the API's response, so a field the API
renames breaks in the loader instead of in every template.

### A mock loader

Useful while the real source does not exist yet, and useful in tests:

```ts
import type { ContentLoader, LoadedEntry } from "@pitlane/content";

export function mock(entries: Omit<LoadedEntry, "data"> & { data: unknown }[]): ContentLoader {
    return {
        name: "mock",
        async load(context) {
            for (let entry of entries) {
                context.store.set({
                    ...entry,
                    data: await context.parseData({ id: entry.id, data: entry.data }),
                });
            }
        },
    };
}
```

Running it through `parseData` is the point. A mock that skips validation
passes tests the real loader would fail.

## Writing a `LiveLoader`

```ts
interface LiveLoader<Data = Record<string, unknown>> {
    name: string;
    loadCollection(): Promise<LiveEntry<Data>[]>;
    loadEntry(id: string): Promise<LiveEntry<Data> | undefined>;
}
```

There is no store and no `parseData`. Return entries and the collection
validates them, on every read, because a live source can change its mind
between one request and the next:

```ts
import type { LiveLoader } from "@pitlane/content";

export function cms(options: { endpoint: string; token: string }): LiveLoader {
    async function query(path: string) {
        let response = await fetch(`${options.endpoint}${path}`, {
            headers: { authorization: `Bearer ${options.token}` },
        });
        if (!response.ok) throw new Error(`CMS returned ${response.status} for ${path}`);
        return await response.json();
    }

    return {
        name: "cms",
        async loadCollection() {
            let documents = (await query("/documents")) as CmsDocument[];
            return documents.map(document => ({
                id: document.slug,
                data: { title: document.title, updatedOn: document.updated_at },
                body: { format: "md", source: document.markdown },
            }));
        },
        async loadEntry(id) {
            let document = (await query(`/documents/${id}`)) as CmsDocument | null;
            if (!document) return undefined;
            return {
                id: document.slug,
                data: { title: document.title, updatedOn: document.updated_at },
                body: { format: "md", source: document.markdown },
            };
        },
    };
}
```

`loadEntry` exists so reading one entry does not fetch the whole collection.
Implement it as a real single-entry query when the source has one. Falling back
to a scan of `loadCollection` is honest but slow, and on a large source it is
the difference between a page and a timeout.

Return `undefined` from `loadEntry` for an entry that does not exist.
`getEntry` passes that straight through, and a controller turns it into a 404.

### Filtering a live collection

`loadCollection` takes no arguments. Filter with the predicate `getCollection`
accepts:

```ts
let recent = await content.news.getCollection(entry => entry.data.updatedOn > lastWeek);
```

When the filtering has to happen at the source, put it in the loader's
options and declare a second collection:

```ts
let content = createContent(c => ({
    news: c.collection({ loader: cms({ endpoint, token }), schema: article }),
    drafts: c.collection({ loader: cms({ endpoint, token, status: "draft" }), schema: article }),
}));
```

Two collections with different queries is clearer than one collection with a
mode, and each gets its own schema.

## Testing a loader

A loader is an ordinary object, so a test drives it with a context of your
own:

```ts
import { expect, it } from "vitest";

it("reads every row", async () => {
    let entries: LoadedEntry[] = [];

    await csv({ file: "fixtures/products.csv" }).load({
        collection: "products",
        root: import.meta.dirname,
        parseData: async ({ data }) => data,
        store: { set: entry => entries.push(entry) },
    });

    expect(entries.map(entry => entry.id)).toEqual(["a1", "b2"]);
});
```

A `parseData` that returns its input keeps the test about reading. Add one real
schema test on top, so a change to the shape you hand it is caught too.

## Using collections without Remix

A collection reads files and validates them. Answering `getCollection` and
`getEntry` needs nothing from Remix, and `@pitlane/content` has no static
dependency on it. Every peer it declares is optional, so this installs and
runs:

::: code-group

```sh [npm]
npm add @pitlane/content zod
```

```sh [yarn]
yarn add @pitlane/content zod
```

```sh [pnpm]
pnpm add @pitlane/content zod
```

```sh [bun]
bun add @pitlane/content zod
```

```sh [deno]
deno add npm:@pitlane/content npm:zod
```

```sh [vp]
vp add @pitlane/content zod
```

```sh [vlt]
vlt add @pitlane/content zod
```

```sh [nub]
nub add @pitlane/content zod
```

:::

```ts
import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import { z } from "zod";

let content = createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({ pattern: "**/*.md", base: "content" }),
        schema: z.object({ title: z.string(), author: z.string() }),
    }),
    authors: c.collection({
        loader: loaders.file("authors.json"),
        schema: z.object({ name: z.string() }),
    }),
}));

let post = await content.blog.getEntry("hello");
let author = await content.authors.getEntry(post.data.author);
```

Any [Standard Schema](https://standardschema.dev) validator works, because that
is the only thing a schema is asked for.

Two parts of the package do want Remix, and both say so when reached:

- **`render()`** resolves to a Remix component, so it loads `remix` when you
  call it. Without it you get
  `Rendering "blog/hello" needs the peer dependency "remix"`. Entry data is
  unaffected: a collection of `.json` files never calls it.
- **`c.reference()`** produces a schema in the shape `remix/data-schema`'s
  combinators require, so it nests inside `s.object` and `s.array`. Zod only
  nests Zod schemas and rejects it. Validate the id as a string instead and do
  the lookup yourself, which is what a reference does anyway.

The published types have a rough edge. `remix/ui` is still named by an
`import type` for the component `render()` returns. So is `satteri`, by the
one describing a loader option. Every TypeScript starter enables `skipLibCheck` and most
projects keep it, which hides both. Turn it off and you get two `TS2307`s for
packages you chose not to install.

## Building a plugin for another bundler

`contentLayer()` is a Vite plugin, and Vite appears in exactly one module of this
package. The two pieces that are not about Vite are published so a plugin for
Rsbuild, Turbopack, or esbuild does not have to copy them:

| Import                               | What it does                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `@pitlane/content/internal/prebuild` | opens the channel the content entry records into while it runs, and reads back the collections, watched paths, and root        |
| `@pitlane/content/internal/codegen`  | turns those recorded entries into the manifest module's source, and a Markdown or MDX body into the expression that imports it |
| `@pitlane/content/internal/mdx`      | reads an MDX document's ESM block, returning each import's specifier and bindings with the block's remainder                   |

The sequence is the same on any bundler. Open the channel,
execute the application's content module however your bundler runs a module,
close the channel, then serve the emitted manifest source in place of
`@pitlane/content/internal/manifest`.

```ts
import { manifestModule } from "@pitlane/content/internal/codegen";
import { closePrebuild, openPrebuild } from "@pitlane/content/internal/prebuild";

let channel = openPrebuild(projectRoot);
try {
    await runModule("app/content.ts");
} finally {
    closePrebuild();
}

let source = manifestModule(collectionsFrom(channel), bodies, headings);
```

These are `internal` deliberately. Their shape follows this package's needs
rather than a contract, and it can change in a minor release. That is a worse
promise than the public API makes and a better one than copying the files.

## Publishing a loader

A loader is a package that exports a factory. Keep `@pitlane/content` a
**peer** dependency, and depend on its types only:

```json
{
    "peerDependencies": { "@pitlane/content": "^0.1.0" }
}
```

Nothing in this package needs to be imported at runtime to write a loader.
`ContentLoader` and `LiveLoader` are types, which means a published loader can
have no runtime dependency on `@pitlane/content` at all.

[Astro's loader ecosystem](https://github.com/ascorbic/astro-loaders) is worth
reading for prior art on what makes a good one: a narrow option object,
sensible ids derived from the source, errors that name the source, and a schema
the consumer can extend rather than one you impose.

## Limitations

- **`contentLayer()` only prebuilds a `ContentLoader`.** A `LiveLoader` is never
  inlined, so a collection using one still needs its source reachable from
  wherever the app is deployed, Workers included.
- **A `ContentLoader` runs during the build**, in Node, so it cannot use
  anything that only exists at request time. Reading a secret from
  `process.env` inside the loader breaks on a host without one. Take it as an
  option instead.
- **`watchedPaths` reports paths, and how they are used differs by host.**
  `contentLayer()` watches the directories it reports. A host with no bundler
  watches the files its entries came from, so a loader that reports only
  directories is still watched correctly there, but a file created after the
  load is not seen until a restart. See
  [Content (no build)](/guides/content-no-build#reloading-a-content-file-while-the-app-runs).
- **A `ContentLoader`'s result is memoized for the life of the process.**
  There is no TTL and no revalidation. A source that updates while the server
  runs wants a `LiveLoader`.
- **A `LiveLoader` re-validates on every read.** That is deliberate, and it
  means a schema that is expensive to run is a cost you pay per request.
- **Rendering a Markdown body still needs a renderer.** `satteri` has to be
  installed wherever the rendering happens, which for a `LiveLoader` is the
  running server even in a bundled application, because `contentLayer()` never
  prebuilds one. A `.mdx` body also needs `new Function`, so Workers requires
  prebuilding and a `LiveLoader` cannot serve `.mdx` there at all.

## Reference

- [Content](/guides/content): declaring, querying, and rendering collections,
  on either host
- [`@pitlane/content`](/package/content/): `ContentLoader`, `LiveLoader`,
  `LoaderContext`, `LoadedEntry`, `LiveEntry`

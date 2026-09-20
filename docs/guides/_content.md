# Content

**`@pitlane/content`** is the best way to manage Markdown, MDX, JSON, YAML, or any other kind of content for your Remix project, including blog posts, product descriptions, character profiles, recipes, or any structured content. Collections help you organize, validate, and query your documents.

The content package enables you to render content from anywhere: locally in your repo, hosted remotely, or fetched live.

## Install

:::: vite

`@pitlane/content` is a runtime dependency. Markdown and MDX add two more dependencies, and both are build-only: the plugin compiles the bodies, and `contentLayer()` calls `satteri` directly to retrieve a Markdown file's heading list.

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

::::

:::: no-build

`@pitlane/content` and `satteri` are runtime dependencies because the content client transforms the Markdown and MDX at runtime when using it within a Remix no-build setup.

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

`satteri` is an optional peer dependency of `@pitlane/content`, needed only when a collection holds `.md` or `.mdx` files.

::::

:::: vite

When writing a custom [`LiveLoader`](/guides/content-loaders#writing-a-liveloader) that returns a Markdown body which renders at request time even in a bundled application, make sure to declare `satteri` as a runtime dependency instead of a dev dependency.

[`@pitlane/dev`](/guides/vite-plugin) is assumed here and installs itself the same way, as a dev dependency.

::::

::::: vite

## Configuring Vite

Register two plugins in your Vite config, before `remix()`:

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

`satteri()` compiles Markdown and MDX bodies during the build. `jsxImportSource: "remix/ui"` is required. It is what makes a compiled MDX file a Remix component rather than a React one. `headings()` collects the heading list that `render()` returns, and `rawStyles()` keeps the CSS inside a `<style>` element intact, which any content with a highlighted code block produces.

`contentLayer()` executes `app/content.ts` in Node during the build and inlines every collection's entries into the bundle. Entry data becomes plain values, and Markdown bodies become modules the bundler compiles, so a deployed application never reads the filesystem. That is what lets the same collections run on Cloudflare Workers. Keep that module to collection declarations, with no `cloudflare:workers` imports and nothing that needs a live server. A module at another path is named with `entry`:

```ts
contentLayer({ entry: "app/collections.ts" });
```

A collection of only `.json` or `.yaml` files needs `contentLayer()` and nothing else.

:::::

## What is Content?

Pitlane's content package encompasses a few different dimensions: structured and validated data, consumed as a plain JavaScript object, renderable body content that can be consumed as a JSX component, and a source from which the data is loaded. Content can be simple static data, such as JSON or YAML files, it can be more complex data with a renderable body such as Markdown or MDX, which still contain structured data in their frontmatter, or it could be any arbitrary API call, populating a local store or being refetched on every call. For instance:

- `app/`
    - `content.ts` (_the content schema_)
    - `content/`
        - `newsletters/` (_the "newsletters" collection_)
            - `week-1.md` (_a collection entry_)
            - `week-2.md` (_a collection entry_)
            - `week-3.md` (_a collection entry_)
        - `authors.json` (_a single file containing all collection entries for the "authors" collection_)

Collections are defined in the schema file (`app/content.ts`, by convention) which is where you to create validations for your content's data and initialize the client for retrieving your content.

```ts
// app/content.ts
import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

export let content = await createContent(c => ({
    newsletters: c.collection({
        loader: loaders.glob({ base: "app/content/newsletters", pattern: "**/*.{md,mdx}" }),
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

Two types of content collections are available to allow you to work with data fetched either at build time or at request time. Both build-time collections and live updating collections use:

- A required `loader` to retrieve your content and data from wherever it is stored and make it available to your project through content-focused APIs.
- A required `schema` that allows you to define the expected shape of each entry for type safety and validation.

Collections stored locally in your repo or on your filesystem can use one of the provided build-time loaders (from `@pitlane/content/loaders`) to fetch data from Markdown, MDX, YAML, or JSON files. Point the content client to the location of your content, define your data schema, and you're good to go with a blog or similarly content-heavy, mostly static site in no time!

By building a custom build-time content loader or live loader yourself, you can fetch remote data from any external source, such as a CMS, database, or headless payment system, either at build time or live on demand.

## Defining Content Collections

:::: no-build

All of your content collections are defined using the `createContent()` function from `@pitlane/content`. There is no special location your collections must be defined, though we use `app/content.ts` in our demos, by convention.

::::

:::: vite

All of your content collections are defined using the `createContent()` function from `@pitlane/content`. There is no special location your collections must be defined, though the `contentLayer()` plugin from `@pitlane/content` uses `app/content.ts` as the default. If you change this location, you'll need to make sure to update the `entry` option of the `contentLayer()` plugin in your `vite.config.ts` file.

::::

Each individual collection configures:

- a `loader` for a data source (required)
- a `schema` for type safety (required)

```ts
// app/content.ts
// 1. Import utilities from `@pitlane/content`
import { createContent } from "@pitlane/content";

// 2. Import loader(s)
import * as loaders from "@pitlane/content/loaders";

// 3. Import data schema
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

// 4. Export a single `content` client to use in your controllers
export let content = await createContent(c => ({
    // 5. Define a `loader` and `schema` for each collection
    blog: c.collection({
        loader: loaders.glob({ base: "app/content/blog", pattern: "**/*.{md,mdx}" }),
        schema: s.object({
            title: s.string(),
            description: s.string(),
            pubDate: coerce.date(),
            updatedDate: s.optional(coerce.date()),
        }),
    }),
}));
```

You can then use the `getCollection()` and `getEntry()` methods on each content collection to query your content collections data and render your content.

## Defining the Collection Schema

Schemas enforce consistent frontmatter or entry data within a collection. A schema **guarantees** that this data exists in a predictable form when you need to reference or query it. If any entry violates its collection schema, the error names the collection, the entry, the file, and every field that failed:

```text
Failed to parse entry "hello" in collection "blog" (app/content/blog/hello.md):
  - title: Expected string
  - publishedOn: Expected date
```

Schemas also provide the TypeScript types for your content. The parsed shape is what `entry.data` is typed as when you query the collection, so you get property autocompletion and type-checking with nothing generated and nothing that can go stale.

A `schema` is required. Every frontmatter or data property of your collection entries must be defined using a `remix/data-schema` type:

```ts
// app/content.ts
import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

export let content = await createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({ pattern: "**/*.md", base: "app/data/blog" }),
        schema: s.object({
            title: s.string(),
            description: s.string(),
            draft: s.defaulted(s.boolean(), false),
            pubDate: coerce.date(),
            updatedDate: s.optional(coerce.date()),
            tags: s.array(s.string()),
        }),
    }),
    dogs: c.collection({
        loader: loaders.file("app/data/dogs.json"),
        schema: s.object({
            breed: s.string(),
            temperament: s.array(s.string()),
        }),
    }),
}));
```

An entry's `id` is not part of its `data`, so the schema does not declare one. The `file()` loader removes the `id` from each array item before validation, and an object's keys never reach the data at all.

Frontmatter is parsed as YAML, so `pubDate: 2026-01-02` is already a `Date` and `tags: [a, b]` is already an array. `coerce` matters for the fields YAML leaves as strings, such as a quoted date, and for data from an API where everything is a string.

### Defining Datatypes

`remix/data-schema` is one [Standard Schema](https://standardschema.dev) validator, and any other one works, because that is all a schema is asked for. [Using collections without Remix](/guides/content-loaders#using-collections-without-remix) shows the same collections declared with Zod.

### Defining Collection References

Collection entries can also "reference" other related entries.

With `c.reference()`, you can define a property in a collection schema as an entry from another collection. It is a schema that accepts a string `id` and produces `{ collection, id }`, and it composes wherever a schema goes, including inside `s.array()` and `s.optional()`.

A common example is a blog post that references reusable author profiles stored as JSON, or related post URLs stored in the same collection:

```ts
// app/content.ts
import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";

export let content = await createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({ base: "app/content/blog", pattern: "**/*.{md,mdx}" }),
        schema: s.object({
            title: s.string(),
            // Reference a single author from the `authors` collection by `id`
            author: c.reference("authors"),
            // Reference an array of related posts from the `blog` collection by `id`
            relatedPosts: s.array(c.reference("blog")),
        }),
    }),
    authors: c.collection({
        loader: loaders.glob({ pattern: "**/*.json", base: "app/data/authors" }),
        schema: s.object({
            name: s.string(),
            portfolio: s.string(),
        }),
    }),
}));
```

This example blog post specifies the `id`s of related posts and the `id` of the post author:

```yaml
---
title: "Welcome to my blog"
author: ben-holmes # references `app/data/authors/ben-holmes.json`
relatedPosts:
    - about-me # references `app/content/blog/about-me.md`
    - my-year-in-review # references `app/content/blog/my-year-in-review.md`
---
```

These references are transformed into objects containing a `collection` key and an `id` key, which you hand straight to the referenced collection to [query the related data](#accessing-referenced-data).

A reference is checked for its collection, not for its entry. Naming a collection that does not exist fails when `createContent()` runs:

```text
Unknown collection "wrtiers" referenced by createContent; known collections are blog, authors.
```

Pointing at an entry that does not exist is only discovered on lookup, where `getEntry()` resolves to `undefined`.

## Included Loaders

Pitlane provides two built-in loaders (`glob()` and `file()`) for fetching your local content at build time. Pass the location of your data in your project or on your filesystem, and these loaders will automatically handle your data and update the persistent data store content layer.

### The `glob()` Loader

The `glob()` loader fetches entries from directories of Markdown, MDX, JSON, or YAML files from anywhere on the filesystem. If you store your content entries locally as separate files, such as a directory of blog posts, then the `glob()` loader is all you need to access your content.

This loader requires a `pattern` of entry files to match <!-- using glob patterns supported by [micromatch](https://github.com/micromatch/micromatch#matching-features), --> and a `base` file path of where your files are located. A unique `id` for each entry will be automatically generated from its file name, but you can define custom IDs if needed.

```ts
// app/content.ts
import { createContent } from "@pitlane/content";
import { glob } from "@pitlane/content/loaders";

export let content = await createContent(c => ({
    blog: c.collection({
        loader: glob({ pattern: "**/*.md", base: "./app/data/blog" }),
        // ...
    }),
}));
```

#### Defining custom IDs

When using the `glob()` loader, every entry `id` is the matched file path relative to `base`, with the extension removed. `app/content/blog/2026/hello.mdx` under `base: "app/content/blog"` becomes `2026/hello`. Nothing is slugified or lowercased. The `id` is exactly what you named the file, and it is what you pass to `getEntry()` to query the entry directly from your collection. Because it is a path, a nested directory gives you a nested URL when [creating pages from your content](#generating-routes-from-content).

To derive the `id` from something else, pass a `generateId()` function to the `glob()` loader. `entry` is the matched path with its extension still on, and `data` is the entry's parsed frontmatter. `base` is the directory the pattern resolved against. An `id` read from a `slug` field in the frontmatter is the "permalink" of other tools:

```md
---
title: My Blog Post
slug: my-custom-id/supports/slashes
---

Your blog post content here.
```

```ts
// app/content.ts
import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";

export let content = await createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({
            pattern: "**/*.{md,mdx}",
            base: "app/content/blog",
            // Prefer a frontmatter `slug`, falling back to the path-based default
            generateId: ({ data, entry }) => (data.slug as string) ?? entry.replace(/\.mdx?$/, ""),
        }),
        // ...
    }),
}));
```

The schema decides whether `slug` survives into `entry.data`. A key the schema does not declare is dropped, so add `slug: s.optional(s.string())` when a template needs to read it.

### The `file()` Loader

The `file()` loader fetches multiple entries from a single local file defined in your collection. The `file()` loader will automatically detect and parse (based on the file extension) a single array of objects from JSON and YAML files.

```ts
// app/content.ts
import { createContent } from "@pitlane/content";
import { file } from "@pitlane/content/loaders";

export let content = await createContent(c => ({
    dogs: c.collection({
        loader: file("app/data/dogs.json"),
        // ...
    }),
}));
```

Each entry object in the file must have a unique `id` key property so that the entry can be identified and queried. Unlike the `glob()` loader, the `file()` loader will not automatically generate IDs for each entry.

You can provide your entries as an array of objects with an `id` property, or in object form where the unique `id` is the key:

```jsonc
// app/data/dogs.json
// Specify an `id` property in each object of an array
[
    { "id": "poodle", "coat": "curly", "shedding": "low" },
    { "id": "afghan", "coat": "short", "shedding": "low" },
]
```

```jsonc
// app/data/dogs.json
// Each key will be used as the `id`
{
    "poodle": { "coat": "curly", "shedding": "low" },
    "afghan": { "coat": "silky", "shedding": "low" },
}
```

#### Parsing other data formats

Support for parsing single JSON, YAML, and TOML files into collection entries with the `file()` loader is built-in (unless you have a nested JSON document). To load your collection from unsupported file types, such as `.csv`, you will need to create a parser function. This function can be made async if required (e.g. to fetch files from the web, or if your parser is asynchronous).

The following example shows importing a third-party CSV parser then passing a custom `parser` function to the `file()` loader:

```ts
// app/content.ts

import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import { parse as parseCsv } from "csv-parse/sync";

export let content = await createContent(c => ({
    cats: c.collection({
        loader: loaders.file("app/data/cats.csv", {
            parser: text => parseCsv(text, { columns: true, skipEmptyLines: true }),
        }),
        // ...
    }),
}));
```

#### Nested `.json` documents

The `parser()` argument can be used to load a single collection from a nested JSON document. For example, this JSON file contains multiple collections:

```jsonc
// app/data/pets.json
{ "dogs": [{}], "cats": [{}] }
```

You can separate these collections by passing a custom `parser()` function to the `file()` loader for each collection, using Pitlane's built-in JSON parsing:

```ts
// app/content.ts
import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";

export let content = await createContent(c => ({
    dogs: c.collection({
        loader: loaders.file("app/data/pets.json", {
            parser: text => JSON.parse(text).dogs,
        }),
        // ...
    }),
    cats: c.collection({
        loader: loaders.file("app/data/pets.json", {
            parser: text => JSON.parse(text).cats,
        }),
        // ...
    }),
}));
```

## Custom Loaders

Anything that is not a local file is a loader you write, and the shape of the object is the declaration. A `ContentLoader` has a `load()` method that fills a store, and a `LiveLoader` has `loadCollection()` and `loadEntry()` methods that answer one query at a time. Either is passed to `c.collection()` the same way as `glob()` and `file()`:

```ts
// app/content.ts
import { createContent } from "@pitlane/content";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

import { releases } from "./loaders/releases.ts";

export let content = await createContent(c => ({
    releases: c.collection({
        loader: releases({ repository: "pitlane-tools/pitlane" }),
        schema: s.object({
            tag: s.string(),
            name: s.string(),
            publishedOn: coerce.date(),
            prerelease: s.boolean(),
        }),
    }),
}));
```

A custom loader gets everything a built-in one gets: schema validation, `getCollection()` and `getEntry()`, and `render()` when its entries carry a Markdown or MDX body. [Creating a Content Loader](/guides/content-loaders) covers both interfaces, with worked loaders for CSV files, RSS feeds, the GitHub API, and a headless CMS.

## Querying Collections

Every collection on the `content` object has two methods to query it and return one or more entries.

- `getCollection()` fetches an entire collection and returns an array of entries.
- `getEntry()` fetches a single entry from a collection by its `id`, or resolves to `undefined` when nothing has that `id`.

```ts
import { content } from "../content.ts";

// Get all entries from a collection
let allBlogPosts = await content.blog.getCollection();

// Get a single entry from a collection by `id`
let poodleData = await content.dogs.getEntry("poodle");
```

Every entry carries the same five things:

| Field        | What it is                                                             |
| ------------ | ---------------------------------------------------------------------- |
| `id`         | the entry's unique identifier within its collection                    |
| `collection` | the key this entry came from                                           |
| `data`       | the frontmatter or entry data, parsed and validated by the schema      |
| `filePath`   | the file it was read from, when it came from one                       |
| `render()`   | resolves to the entry's `Content` component and its list of `headings` |

`getCollection()` returns entries sorted by `id` ascending. The order does not depend on the filesystem, so the same content always renders the same way. To return entries in any other order, such as blog posts sorted by date, sort them yourself:

```ts
let posts = (await content.blog.getCollection()).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
);
```

:::: vite

With `contentLayer()` in the Vite config, every build-time collection is resolved during the build and its entries are inlined into the bundle. A query at request time reads nothing from disk. A [live collection](#live-collections) is the exception and runs its loader per read.

::::

:::: no-build

A collection reads its files the first time something queries it, and keeps the result for the life of the process. Relative paths resolve against the directory you start the server from. A failed load is not kept, so the next query tries again.

::::

### Using Content in Components

After querying your collections, you can access each entry's content and metadata directly inside your components. A list of links to your blog posts, showing each entry's frontmatter through its `data` property:

```tsx
// app/actions/blog.tsx
import { createController } from "remix/router";

import { content } from "../content.ts";
import { routes } from "../routes.ts";

export default createController(routes, {
    actions: {
        async blog({ render }) {
            let posts = await content.blog.getCollection();
            return await render(
                <>
                    <h1>My posts</h1>
                    <ul>
                        {posts.map(post => (
                            <li>
                                <a href={`/blog/${post.id}`}>{post.data.title}</a>
                            </li>
                        ))}
                    </ul>
                </>,
            );
        },
    },
});
```

### Rendering Body Content

Once queried, you can render Markdown and MDX entries to HTML by calling the entry's `render()` method. It resolves to a `Content` component and a list of all rendered headings:

```tsx
// app/actions/blog.tsx
async post({ params, render }) {
    let post = await content.blog.getEntry(params.slug);
    if (!post) return new Response("Not found", { status: 404 });

    let { Content, headings } = await post.render();
    return await render(
        <article>
            <h1>{post.data.title}</h1>
            <p>Published on: {post.data.pubDate.toDateString()}</p>
            <TableOfContents headings={headings} />
            <Content />
        </article>,
    );
},
```

Nothing parses Markdown until you call `render()`, so listing a collection's titles never pays for the bodies it does not show. Each heading is `{ depth, slug, text }`, and the `slug` matches the `id` on the rendered heading, so a link to `#install` lands on it.

Props on `<Content />` reach an MDX document, which is how you replace the elements it renders with components of your own:

```tsx
<Content components={{ h2: Heading, a: Link }} />
```

Calling `render()` on an entry with no body, such as one from a `.json` file, is an error rather than an empty component, because a blank page is the harder bug to find:

```text
Entry "authors/ada" has no renderable content.
```

::: vite

A `.md` or `.mdx` body is compiled during the build by the `satteri()` plugin [configured above](#configuring-vite), and `render()` hands back the compiled result.

:::

::::: no-build

Sätteri compiles the body when `render()` is called, and the result is cached with the entry, so a second render of the same post costs nothing. The heading list needs no setup: `@pitlane/content` registers the plugin that produces it on `.md` and `.mdx` alike. Extra Sätteri plugins go through the loader:

```ts
loaders.glob({
    pattern: "**/*.md",
    base: "app/content/blog",
    satteri: { hastPlugins: [myPlugin()] },
});
```

:::: warning

MDX needs a host that allows `new Function` in order to compile MDX for a request evaluates the compiled body at request time. Node, Bun, and Deno all allow this.

Markdown has no such requirement and renders anywhere Sätteri runs.

::::

:::::

#### Passing content as props

A component can also take an entire collection entry as a prop.

Use the `CollectionEntry` type to correctly type your component's props. It takes the collection itself rather than its name, so it inherits every property of that collection's schema and cannot drift from it:

```tsx
// app/ui/blog-card.tsx
import type { CollectionEntry } from "@pitlane/content";
import type { Handle } from "remix/ui";

import type { content } from "../content.ts";

export function BlogCard(handle: Handle<{ post: CollectionEntry<typeof content.blog> }>) {
    // `post` matches your `blog` collection's schema type
    return () => <h2>{handle.props.post.data.title}</h2>;
}
```

Change the schema and the component stops type-checking.

### Filtering Collection Queries

`getCollection()` takes an optional "filter" callback that allows you to filter your query based on an entry's `id` or `data` properties.

You can use this to filter by any content criteria you like, such as a `draft` property that keeps unfinished blog posts off your blog:

```ts
// Filter out content entries with `draft: true`
let publishedBlogEntries = await content.blog.getCollection(({ data }) => {
    return data.draft !== true;
});
```

You can also keep draft pages visible in development but out of production:

:::: vite

```ts
// Filter out content entries with `draft: true` only when building for production
let blogEntries = await content.blog.getCollection(({ data }) => {
    return import.meta.env.PROD ? data.draft !== true : true;
});
```

::::

:::: no-build

```ts
// Filter out content entries with `draft: true` only in production
let blogEntries = await content.blog.getCollection(({ data }) => {
    return process.env.NODE_ENV === "production" ? data.draft !== true : true;
});
```

::::

The filter argument also supports filtering by nested directories within a collection. Since the `id` includes the full nested path, you can filter by the start of each `id` to only return items from a specific nested directory:

```ts
// Filter entries by sub-directory in the collection
let englishDocsEntries = await content.docs.getCollection(({ id }) => {
    return id.startsWith("en/");
});
```

### Accessing Referenced Data

To access [references defined in your schema](#defining-collection-references), first query your collection entry. The references are available on the returned `data` object as `{ collection, id }` values: `entry.data.author`, `entry.data.relatedPosts`.

Then pass each value to the referenced collection's `getEntry()`. A reference type-checks only against the collection it names, so handing `post.data.author` to `content.tags.getEntry()` is a compile error. There is no separate helper for an array of references. Look each one up:

```tsx
// app/actions/blog.tsx
async post({ params, render }) {
    // First, query a blog post
    let post = await content.blog.getEntry(params.slug);
    if (!post) return new Response("Not found", { status: 404 });

    // Retrieve a single referenced entry: the blog post's author.
    // Equivalent to `content.authors.getEntry("ben-holmes")`
    let author = await content.authors.getEntry(post.data.author);

    // Retrieve an array of referenced entries: all the related posts
    let relatedPosts = await Promise.all(
        post.data.relatedPosts.map(reference => content.blog.getEntry(reference)),
    );

    return await render(
        <article>
            <h1>{post.data.title}</h1>
            <p>Author: {author?.data.name}</p>

            <h2>You might also like:</h2>
            {relatedPosts.map(
                related => related && <a href={`/blog/${related.id}`}>{related.data.title}</a>,
            )}
        </article>,
    );
},
```

A reference is not checked for existence, so each lookup can resolve to `undefined`. That is where a pointer at a deleted or misspelled entry surfaces.

## Generating Routes from Content

Nothing creates a page for a collection entry on its own. A route with a parameter, and a controller action that looks the parameter up, is what turns entries into pages:

```ts
// app/routes.ts
import { get, route } from "remix/routes";

export let routes = route({
    blog: get("/blog"),
    post: get("/blog/:slug"),
});
```

```tsx
// app/actions/blog.tsx
import { createController } from "remix/router";

import { content } from "../content.ts";
import { routes } from "../routes.ts";

export default createController(routes, {
    actions: {
        async post({ params, render }) {
            let post = await content.blog.getEntry(params.slug);
            if (!post) return new Response("Not found", { status: 404 });

            let { Content } = await post.render();
            return await render(
                <article>
                    <h1>{post.data.title}</h1>
                    <Content />
                </article>,
            );
        },
    },
});
```

An entry's `id` is a path, so `app/content/blog/hello-world.md` has an `id` of `hello-world` and is served at `/blog/hello-world`. An `id` with a `/` in it, whether from a nested directory or a [custom `id`](#defining-custom-ids), needs a route pattern that accepts one, such as `/blog/*slug`.

That is the whole story for a page rendered on demand: the entry is looked up when the page is requested. To publish the collection as static HTML instead, hand the same paths to prerendering.

:::: vite

`remix({ prerender })` renders those pages during `vite build`. Pass a function, and the paths come from the collection itself:

```ts
// vite.config.ts
import { content } from "./app/content.ts";

remix({
    async prerender({ getStaticPaths }) {
        let posts = await content.blog.getCollection();
        return [...getStaticPaths(), ...posts.map(post => `/blog/${post.id}`)];
    },
});
```

[Prerendering](/guides/prerendering) covers the other shapes that option takes.

::::

:::: no-build

The [prerendering guide](/guides/prerendering-no-build) covers how to use `@pitlane/crawler` to walk the app from a script and writes each response to disk, and a collection's `id`s are the paths to hand it.

::::

## Live Collections

A live collection fetches its data at request time rather than once. That is the choice for data that changes while the server runs, such as inventory, prices, or draft content an editor expects to see without a deploy, and it costs a fetch per request in exchange.

Live collections use the same `createContent()` and the same `c.collection()`, and are queried with the same `getCollection()` and `getEntry()`. What makes a collection live is its loader. A [`LiveLoader`](/guides/content-loaders#writing-a-liveloader) has `loadCollection()` and `loadEntry(id)` methods in place of `load()`, and each one returns its entries directly. There are no built-in live loaders, so every live collection uses one you write for your data source:

```ts
// app/content.ts
import { createContent } from "@pitlane/content";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

import { cms } from "./loaders/cms.ts";

export let content = await createContent(c => ({
    articles: c.collection({
        loader: cms({ endpoint: "https://cms.example.com/api", token: process.env.CMS_TOKEN }),
        schema: s.object({
            title: s.string(),
            updatedOn: coerce.date(),
        }),
    }),
}));
```

The `schema` is validated on every read, because a live source can change its mind between one request and the next.

Errors reach your action the same way a build-time collection's do. A loader that throws rejects the query, with the collection named in the error, and `getEntry()` resolves to `undefined` when `loadEntry()` does:

```tsx
async article({ params, render }) {
    let article = await content.articles.getEntry(params.slug);
    if (!article) return new Response("Not found", { status: 404 });

    let { Content } = await article.render();
    return await render(<Content />);
},
```

`loadCollection()` takes no arguments. Filter with the callback `getCollection()` accepts, and when the filtering has to happen at the source, put it in the loader's options and declare a second collection:

```ts
export let content = await createContent(c => ({
    articles: c.collection({ loader: cms({ endpoint, token }), schema: article }),
    drafts: c.collection({ loader: cms({ endpoint, token, status: "draft" }), schema: article }),
}));
```

Both kinds of collection can exist in the same `createContent()` call, so each data source gets the kind that fits it. What changes once a collection is live:

:::: vite

- **`contentLayer()` leaves it alone.** There is no single execution for the build to run, so the loader runs per read wherever the application is deployed, and its source has to be reachable from there.
- **Bodies render at request time.** Markdown needs `satteri` installed as a runtime dependency rather than a dev one, as noted under [Install](#install). MDX also needs `new Function`, which Cloudflare Workers forbids, so a live collection cannot serve `.mdx` there.

::::

:::: no-build

- **Nothing is memoized.** A build-time collection reads its source on the first query and keeps the result. A live one asks its loader every time.
- **Schema failures surface on every read** rather than once, so a schema that is expensive to run is a cost paid per request.

::::

## Hot Reloading for Your Content

::: vite

The `contentLayer()` plugin watches every path the loaders report. Editing, adding, or deleting a content file rebuilds the affected collection and reloads the page, so nothing here needs a restart. A `LiveLoader` re-reads on every request anyway and has nothing to watch.

:::

::::: no-build

Add one line beside `createContent()`:

```ts
// app/content.ts
import { hotContent } from "@pitlane/content/hot";

export let content = await createContent(c => ({ ... }));

await hotContent(content);
```

This modifier is safe to leave in place for production. `hotContent()` does nothing unless the process is supervised by `remix/node-hmr`: `hmr.ts` supervises `server.ts` and proxies requests to it, started with `NODE_ENV=development`. Save an edited post and the collection it belongs to is discarded, then the page reloads. A collection whose files did not change keeps what it had.

::: warning

A new content file needs a restart `remix/node-hmr` reports a file change only for a path it was given, so a post you have just created stays invisible until the server restarts. Edits and deletions to an existing post reload the page as part of HMR.

:::

:::::

## Reference

<!-- - [Creating a Content Loader](/guides/content-loaders): reading from anywhere other than the filesystem -->

- [`@pitlane/content`](/package/content/): `createContent()` and the types
- [`@pitlane/content/loaders`](/package/content/loaders): `glob()` and `file()`

::: vite

- [`@pitlane/content/satteri`](/package/content/satteri): the `headings()` and `rawStyles()` plugins
- [`@pitlane/content/vite`](/package/content/vite): the `contentLayer()` plugin

:::

::: no-build

- [`@pitlane/content/hot`](/package/content/hot): `hotContent()`

:::

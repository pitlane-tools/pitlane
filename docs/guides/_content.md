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

::: vite

When writing a custom [`LiveLoader`](/guides/content-loaders#writing-a-liveloader) that returns a Markdown body which renders at request time even in a bundled application, make sure to declare `satteri` as a runtime dependency instead of a dev dependency.

[`@pitlane/dev`](/guides/vite-plugin) is assumed here and installs itself the same way, as a dev dependency.

:::

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

When using the `glob()` loader with Markdown, MDX, JSON, or YAML files, every content entry `id` is automatically generated in a URL-friendly format based on the content filename. This unique `id` is used to query the entry directly from your collection. It is also useful when creating new pages and URLs from your content.

You can override a single entry’s generated `id` by adding your own `slug` property to the file frontmatter or data object for JSON files. This is similar to the “permalink” feature of other web frameworks.

```md title="app/blog/1.md"
---
title: My Blog Post slug: my-custom-id/supports/slashes
---

Your blog post content here.
```

```jsonc
// app/categories/1.json
{
    "title": "My Category",
    "slug": "my-custom-id/supports/slashes",
    "description": "Your category description here.",
}
```

You can also pass options to the `glob()` loader's `generateID()` helper function when you define your build-time collection to adjust how `id`s are generated. For example, you may wish to revert the default behavior of converting uppercase letters to lowercase for each collection entry:

```js
// app/content.ts
import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";

export let content = await createContent(c => ({
    authors: c.collection({
        /*
         * Retrieve all JSON files in your authors directory while retaining
         * uppercase letters in the ID.
         */
        loader: loaders.glob({
            pattern: "**/*.json",
            base: "app/data/authors",
            generateId: ({ entry }) => entry.replace(/\.json$/, ""),
        }),
        // ...
    }),
}));
```

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

Support for parsing single JSON, YAML, and TOML files into collection entries with the `file()` loader is built-in (unless you have a [nested JSON document](#nested-json-documents)). To load your collection from unsupported file types, such as `.csv`, you will need to create a [parser function](/en/reference/content-loader-reference/#parser). This function can be made async if required (e.g. to fetch files from the web, or if your parser is asynchronous).

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

You can separate these collections by passing a custom `parser()` function to the `file()` loader for each collection, using Astro's built-in JSON parsing:

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
            parser: text => JSON.parse(text).cats }),
        }),
        // ...
    }),
}));
```

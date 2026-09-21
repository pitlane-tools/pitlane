# @pitlane/content

Schema-validated, cross-referenced content collections for [Remix 3](https://remix.run).

Reads Markdown, MDX, JSON, and YAML into collections a controller queries like a
database. Frontmatter is validated against a schema, one entry can reference
another, and the types come from the schema rather than from generated code.

```sh
npm install @pitlane/content
```

Requires Node `^20.19.0 || >=22.12.0`. All three peer dependencies are
optional: `remix` for `render()`, `satteri` for compiling Markdown and MDX
bodies, and `vite` 8 or newer for `contentLayer()`. With a Vite build,
`satteri` and `vite-plugin-satteri` are dev dependencies; without a build,
`satteri` is a runtime dependency. A collection of only JSON or YAML files
needs no Sätteri setup at all.

```ts
import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

export let content = createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({ pattern: "**/*.mdx", base: "app/content/blog" }),
        schema: s.object({
            title: s.string(),
            publishedOn: coerce.date(),
            author: c.reference("authors"),
        }),
    }),
    authors: c.collection({
        loader: loaders.file("app/content/authors.json"),
        schema: s.object({ name: s.string() }),
    }),
}));
```

```ts
let posts = await content.blog.getCollection();
let post = await content.blog.getEntry(params.slug);
if (post) {
    let { Content, headings } = await post.render();
    let author = await content.authors.getEntry(post.data.author);
}
```

`getEntry()` returns `undefined` when no entry has the requested ID.

`createContent()` returns synchronously without loading entries. Import the
returned object wherever you need it; reads and rendering stay asynchronous.

The loaders are ordinary runtime code, which covers Node, Bun, Deno, and
container hosts. For a host with no filesystem, add `contentLayer()` from
`@pitlane/content/vite` and the build resolves the collections ahead of time,
inlining entry data and compiling Markdown bodies into the bundle. The
collection declarations do not change.

## Entry points

| Entry point                | Exports                                     |
| -------------------------- | ------------------------------------------- |
| `@pitlane/content`         | `createContent` and the collection types    |
| `@pitlane/content/loaders` | `glob`, `file`                              |
| `@pitlane/content/satteri` | `headings` and `rawStyles`, Sätteri plugins |
| `@pitlane/content/vite`    | `contentLayer`, the build-time plugin       |

## Without Remix

The loaders, schema validation, and query methods work with any
[Standard Schema](https://standardschema.dev) validator without importing Remix.
Rendering returns a Remix component, so it requires Remix. Rendering Markdown
or MDX also needs `satteri` unless `contentLayer()` compiled the collection
during the build.

## Documentation

- [Content](https://pitlane.tools/guides/content), for an application with a
  Vite build
- [Content (No Build)](https://pitlane.tools/guides/content-no-build), for an
  application that runs without one
- [Custom loaders](https://pitlane.tools/guides/content#custom-loaders)
- [API reference](https://pitlane.tools/package/content/)

## License

MIT

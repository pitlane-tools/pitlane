# @pitlane/content

Schema-validated, cross-referenced content collections for [Remix 3](https://remix.run).

Reads Markdown, MDX, JSON, and YAML into collections a controller queries like a
database. Frontmatter is validated against a schema, one entry can reference
another, and the types come from the schema rather than from generated code.

```sh
npm install @pitlane/content
```

```ts
import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

export let content = await createContent(c => ({
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
let { Content, headings } = await post.render();
let author = await content.authors.getEntry(post.data.author);
```

The loaders are ordinary runtime code, which covers Node, Bun, Deno, and
container hosts. For a host with no filesystem, add `content()` from
`@pitlane/content/vite` and the build resolves the collections ahead of time,
inlining entry data and compiling Markdown bodies into the bundle. The
collection declarations do not change.

## Entry points

| Entry point                | Exports                                  |
| -------------------------- | ---------------------------------------- |
| `@pitlane/content`         | `createContent` and the collection types |
| `@pitlane/content/loaders` | `glob`, `file`                           |
| `@pitlane/content/satteri` | `headings`, a Sätteri MDAST plugin       |
| `@pitlane/content/vite`    | `content`, the build-time plugin         |

## Documentation

- [Content](https://pitlane.tools/guides/content)
- [Content (no build)](https://pitlane.tools/guides/content-no-build)
- [Creating a content loader](https://pitlane.tools/guides/content-loaders)
- [API reference](https://pitlane.tools/package/content/)

## License

MIT

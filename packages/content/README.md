# @pitlane/content

Schema-validated, cross-referenced content collections for [Remix](https://remix.run).

Reads Markdown, MDX, JSON, and YAML into collections a controller queries like a database. Frontmatter is validated against a schema, one entry can reference another, and the types come from the schema rather than from generated code.

```sh
npm install @pitlane/content
```

Requires Node `^20.19.0 || >=22.12.0`. All three peer dependencies are optional: `remix` for `render()`, `satteri` for compiling Markdown and MDX bodies, and `vite` 8 or newer for `contentLayer()`. With a Vite build, `satteri` and `vite-plugin-satteri` are dev dependencies; without a build, `satteri` is a runtime dependency. A collection of only JSON or YAML files needs no Sätteri setup at all.

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

`createContent()` returns synchronously without loading entries. Import the returned object wherever you need it; reads and rendering stay asynchronous.

The loaders are ordinary runtime code, which covers Node, Bun, Deno, and container hosts. For a host with no filesystem, add `contentLayer()` from `@pitlane/content/vite-plugin` and the build resolves the collections ahead of time, inlining entry data and compiling Markdown bodies into the bundle. The collection declarations do not change.

## Configuring Vite

With a Vite build, Markdown and MDX need two build-only dependencies. [`@pitlane/vite-plugin-remix`](https://pitlane.tools/guides/vite-plugin) is assumed and installs the same way:

```sh
npm install --save-dev satteri vite-plugin-satteri
```

Register the Sätteri plugin and `contentLayer()` in your Vite config, before `remix()`:

```ts
// vite.config.ts
import { headings, rawStyles } from "@pitlane/content/satteri";
import { contentLayer } from "@pitlane/content/vite-plugin";
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite";
import satteri from "vite-plugin-satteri";

export default defineConfig({
    plugins: [
        satteri({
            mdx: { jsxImportSource: "remix/component" },
            mdastPlugins: [headings()],
            hastPlugins: [rawStyles()],
        }),
        contentLayer(),
        remix(),
    ],
});
```

`satteri()` compiles Markdown and MDX bodies during the build. `jsxImportSource: "remix/component"` is required, because it is what makes a compiled MDX file a Remix component rather than a React one. `headings()` collects the heading list that `render()` returns, and `rawStyles()` keeps the CSS inside a `<style>` element intact, which any content with a highlighted code block produces.

`rawStyles()` passes that CSS to Remix through `unsafeHTML()`, so a compiled MDX file that has a `<style>` element imports `unsafeHTML` from `remix/component`. The CSS is neither sanitized nor escaped, and a `</style>` inside it ends the element early, so register the plugin only for content you would already publish as written.

`contentLayer()` executes `app/content.ts` in Node during the build and inlines every collection's entries into the bundle, so a deployed application never reads the filesystem. Name a module at another path with `contentLayer({ entry: "app/collections.ts" })`. A collection of only JSON or YAML files needs `contentLayer()` alone, with none of the Sätteri setup.

The [content guide](https://pitlane.tools/guides/content#configuring-vite) covers this setup in full.

## Entry points

| Entry point                    | Exports                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `@pitlane/content`             | `createContent` and the collection types                     |
| `@pitlane/content/loaders`     | `glob`, `file`                                               |
| `@pitlane/content/satteri`     | `headings` and `rawStyles`, Sätteri plugins                  |
| `@pitlane/content/vite-plugin` | `contentLayer`, the build-time plugin                        |
| `@pitlane/content/hot`         | `hotContent`, which reloads the browser when content changes |

`hotContent()` is for an application that runs from source with no build. It does nothing unless `remix/node-hmr` supervises the process, so it can stay in production code.

### Internal entry points

Four more entry points exist so that a plugin for a bundler other than Vite can reuse the pieces `contentLayer()` is built from. They are internal and unstable: they have no reference pages, and they can change in any release.

- `@pitlane/content/internal/manifest` is the module a build plugin replaces with the collections it prebuilt. As published, it declares that nothing was prebuilt, so without a plugin every collection falls through to its loader.
- `@pitlane/content/internal/prebuild` is the channel between the build plugin and `createContent()`. `openPrebuild()` and `closePrebuild()` bracket evaluating the content module, and the returned channel carries the collections, watched paths, and pending loads recorded in between.
- `@pitlane/content/internal/codegen` writes the manifest module as JavaScript source with `manifestModule()`, and exports `BODY_PREFIX`, the prefix of the virtual modules that carry each entry's body.
- `@pitlane/content/internal/mdx` exports `readEsm()`, which separates the imports in an MDX document's top-level ESM block from the rest of it.

## Without Remix

The loaders, schema validation, and query methods work with any [Standard Schema](https://standardschema.dev) validator without importing Remix. Rendering returns a Remix component, so it requires Remix. Rendering Markdown or MDX also needs `satteri` unless `contentLayer()` compiled the collection during the build.

## Documentation

- [Content](https://pitlane.tools/guides/content), for an application with a Vite build
- [Content (No Build)](https://pitlane.tools/guides/content-no-build), for an application that runs without one
- [Custom loaders](https://pitlane.tools/guides/content#custom-loaders)
- [API reference](https://pitlane.tools/package/content/)

For AI agents and other LLM tools, the documentation is also published as Markdown. [`llms.txt`](https://pitlane.tools/llms.txt) indexes every page, [`llms-full.txt`](https://pitlane.tools/llms-full.txt) holds them all in one file, and every page has a Markdown twin at its URL plus `.md`, or plus `index.md` when the URL ends in `/`, such as [`https://pitlane.tools/guides/content.md`](https://pitlane.tools/guides/content.md).

## License

MIT

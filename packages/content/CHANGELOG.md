# @pitlane/content

## 0.1.1

Published 2026-09-21. [npm](https://www.npmjs.com/package/@pitlane/content/v/0.1.1) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/content%400.1.1) · [Source](https://github.com/pitlane-tools/pitlane/commit/b725843491ad0c36c61c83d44466134f76dbd615).

Documentation only. No code changed.

- The npm description is one line now: "Schema-validated content collections for Remix." The old one led with `createContent()` and ran well past what a registry listing shows.
- The README quick start guards the entry it reads. `getEntry()` answers `undefined` when no entry has the requested id, and the sample called `render()` on the result regardless, so a route copied out of it threw on the first unknown slug.
- The install section states the supported Node range and what each optional peer is for: `remix` for `render()`, `satteri` for compiling Markdown and MDX bodies, `vite` 8 or newer for `contentLayer()`. A collection of JSON or YAML files alone needs no Sätteri setup.
- Link the content guide, the no-build guide, and the custom-loaders section separately. Replace the unpublished `/guides/content-loaders` URL with `/guides/content#custom-loaders`.

## 0.1.0

Published 2026-09-21. [npm](https://www.npmjs.com/package/@pitlane/content/v/0.1.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/content%400.1.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/31aae9c3c941238fbb94769e578e320179dc8284).

Initial release.

- `createContent` returns typed collection handles synchronously without loading entries. Reads and rendering remain asynchronous; declaration errors throw synchronously.
- An entry's data is validated against its collection's schema as it loads, before any query returns it. Any Standard Schema validator does that work, `remix/data-schema` and Zod included, and the entry type is inferred from the schema rather than generated: `CollectionEntry<typeof content.blog>` names one. A failure reports the entry, the collection, the file it came from, and every issue.
- `getCollection`, `getCollection(filter)`, and `getEntry` over entries sorted by id; `c.reference(collection)` for typed pointers between collections.
- `render()` resolves an entry's Markdown or MDX to a Remix component and its heading list, parsing nothing until it is called.
- Without a bundler, `render()` also resolves an MDX document's own imports relative to the document. A namespace import and `import.meta` are refused by name, since neither survives the function body an MDX document compiles to here.
- Two loader interfaces: `ContentLoader` resolves a whole collection in one execution and can be prebuilt, `LiveLoader` answers one query at a time and runs on every read. `loaders.glob` and `loaders.file` implement the first. `glob` reads Markdown, MDX, JSON, and YAML, one entry per file; `file` reads a single JSON or YAML file holding many entries, and takes a `parser` for any other format.
- `contentLayer()` from `@pitlane/content/vite` loads `ContentLoader` collections after evaluating their declarations and inlines them into the bundle. It waits for loading and validation before emitting, and watches the loaders' sources in dev.
- `headings()` from `@pitlane/content/satteri` produces the heading list on both rendering paths. `rawStyles()` sits beside it and hands a `<style>` element's CSS to Remix as markup, which is what keeps an Expressive Code theme from reaching the page escaped into rules that match nothing. `render()` applies both; a Vite build passes them to `vite-plugin-satteri`.
- `hotContent()` from `@pitlane/content/hot` reloads the browser when a file behind a collection changes, for an application that runs from source with no build. It does nothing unless `remix/node-hmr` is supervising the process, so it can stay in production code. A file created after startup still needs a restart.
- Every peer dependency is optional, `remix` included. Reading and validating data imports neither it nor `satteri`; `render()` loads Remix only when something asks for a component, and names the entry that needed it if Remix is not installed. Node `^20.19.0 || >=22.12.0`.
- The prebuild channel, the manifest emitter, and the MDX import reader ship as `@pitlane/content/internal/prebuild`, `/internal/codegen`, and `/internal/mdx`, so a plugin for a bundler other than Vite can reuse them.

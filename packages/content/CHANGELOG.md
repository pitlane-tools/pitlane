# @pitlane/content

## 0.1.1

Documentation only. No code changed.

- The npm description is one line now: "Schema-validated content collections for Remix." The old one led with `createContent()` and ran well past what a registry listing shows.
- The README quick start guards the entry it reads. `getEntry()` answers `undefined` when no entry has the requested id, and the sample called `render()` on the result regardless, so a route copied out of it threw on the first unknown slug.
- The install section states the supported Node range and what each optional peer is for: `remix` for `render()`, `satteri` for compiling Markdown and MDX bodies, `vite` 8 or newer for `contentLayer()`. A collection of JSON or YAML files alone needs no Sätteri setup.
- Link the content guide, the no-build guide, and the custom-loaders section separately. Replace the unpublished `/guides/content-loaders` URL with `/guides/content#custom-loaders`.

## 0.1.0

Initial release.

- `createContent` returns typed collection handles synchronously without loading entries. Reads and rendering remain asynchronous; declaration errors throw synchronously.
- `getCollection`, `getCollection(filter)`, and `getEntry` over entries sorted by id; `c.reference(collection)` for typed pointers between collections.
- `render()` resolves an entry's Markdown or MDX to a Remix component and its heading list, parsing nothing until it is called.
- Two loader interfaces: `ContentLoader` resolves a whole collection in one execution and can be prebuilt, `LiveLoader` answers one query at a time and runs on every read. `loaders.glob` and `loaders.file` implement the first.
- `contentLayer()` from `@pitlane/content/vite` loads `ContentLoader` collections after evaluating their declarations and inlines them into the bundle. It waits for loading and validation before emitting, and watches the loaders' sources in dev.
- `headings()` from `@pitlane/content/satteri` produces the heading list on both rendering paths.

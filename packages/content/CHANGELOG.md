# @pitlane/content

## 0.1.0

Initial release.

- `createContent` declares collections at runtime, validated by any Standard
  Schema, with types inferred rather than generated.
- `getCollection`, `getCollection(filter)`, and `getEntry` over entries sorted
  by id; `c.reference(collection)` for typed pointers between collections.
- `render()` resolves an entry's Markdown or MDX to a Remix component and its
  heading list, parsing nothing until it is called.
- Two loader interfaces: `ContentLoader` resolves a whole collection in one
  execution and can be prebuilt, `LiveLoader` answers one query at a time and
  runs on every read. `loaders.glob` and `loaders.file` implement the first.
- `content()` from `@pitlane/content/vite` resolves `ContentLoader` collections
  during the build and inlines them, so a host with no filesystem serves the
  same collections, and watches the loaders' sources in dev.
- `headings()` from `@pitlane/content/satteri` produces the heading list on both
  rendering paths.

# @pitlane/content

## 0.1.0

Initial release.

- `createContent` returns typed collection handles synchronously without loading entries. Reads and rendering remain asynchronous; declaration errors throw synchronously.
- `getCollection`, `getCollection(filter)`, and `getEntry` over entries sorted by id; `c.reference(collection)` for typed pointers between collections.
- `render()` resolves an entry's Markdown or MDX to a Remix component and its heading list, parsing nothing until it is called.
- Two loader interfaces: `ContentLoader` resolves a whole collection in one execution and can be prebuilt, `LiveLoader` answers one query at a time and runs on every read. `loaders.glob` and `loaders.file` implement the first.
- `contentLayer()` from `@pitlane/content/vite` loads `ContentLoader` collections after evaluating their declarations and inlines them into the bundle. It waits for loading and validation before emitting, and watches the loaders' sources in dev.
- `headings()` from `@pitlane/content/satteri` produces the heading list on both rendering paths.

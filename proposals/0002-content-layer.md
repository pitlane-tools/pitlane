---
id: proposal.0002
title: Typed Content Collections
authors: [markmals, Claude]
status: draft
pull-request: https://github.com/pitlane-tools/pitlane/pull/16
issues: []
supersedes: []
---

# Typed Content Collections

## Summary

`@pitlane/content` turns local Markdown, MDX, and data files into schema-validated,
cross-referenced collections a Remix controller can query. Collections are declared at runtime with
`createContent`, and a Vite plugin bakes them into the bundle for hosts without a filesystem.

## Motivation

A Remix 3 application with a blog, a changelog, or a documentation section has no supported way to
treat those files as data. Today it reaches for one of three workarounds, and each one costs
something the others do not:

- **Read the filesystem in a controller.** `readFile` plus a hand-rolled frontmatter split. Nothing
  validates the frontmatter, so a post that misspells `publishedOn` renders a page with
  `undefined` in it rather than failing. Cloudflare Workers has no filesystem, so this pins the app
  to a Node host.
- **Import each file by hand.** `import post from "./content/hello.mdx"` is typed and bundled, but
  the index page needs every post, so the list is maintained by hand and drifts the moment someone
  adds a file.
- **Install an existing content layer.** [`@withsprinkles/content-layer`](https://github.com/withsprinkles/content-layer)
  does this job well and was written for exactly this gap. Collections are declared in
  `app/content.config.ts`, queried through a `sprinkles:content` virtual module, and typed by a
  `.d.ts` the plugin writes into `.sprinkles/`. The loading mechanism is sound and this proposal
  adopts it. What it costs is the API on top: `getCollection("blog")` takes a string, so the types
  have to be generated to mean anything, and a generated `.d.ts` can disagree with the schema it
  came from.

None of the three gives the two things a content layer exists to provide: **the frontmatter is
validated against a schema**, and **one entry can reference another**. VISION.md has published an
API for this since the package list was written, and nothing implements it.

## Proposed solution

Ship `@pitlane/content` as a runtime package. Collections are declared by a function, validated by
`remix/data-schema`, and read through the object that function returns:

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
            summary: s.string(),
            publishedOn: coerce.date(),
            author: c.reference("authors"),
        }),
    }),
    authors: c.collection({
        loader: loaders.file("app/content/authors.json"),
        schema: s.object({ name: s.string(), avatar: s.string() }),
    }),
}));
```

```ts
let posts = await content.blog.getCollection();
let post = await content.blog.getEntry(params.slug);
let { Content, headings } = await post.render();
let author = await content.authors.getEntry(post.data.author);
```

Types come from inference. `post.data.title` is a `string` because the schema says so, and
`content.authors.getEntry(post.data.author)` type-checks because `c.reference("authors")` produced a
`Reference<"authors">`. Nothing is generated, so nothing can be stale.

**The loaders are ordinary runtime code.** `loaders.glob` walks `node:fs`, takes whatever pattern it
is handed, and has no idea a bundler exists. That is enough for Node, Bun, Deno, container hosts,
scripts, and the package's own tests.

For a host with no filesystem, `content()` from `@pitlane/content/vite` **runs those same loaders in
Node during the build and bakes the result into the bundle** — entry data as plain values, Markdown
bodies as modules the bundler compiles. Application code is identical either way. Adding a host
edits the Vite config; it never edits a collection.

[Sätteri](https://satteri.bruits.org) renders the Markdown, composed rather than wrapped: the
`satteri` package when a collection renders at runtime, `vite-plugin-satteri` when the build
compiled it ahead of time.

```text
a .mdx file gains a heading → content.blog.getEntry(slug) → render() → { Content, headings }
```

## Detailed design

### Package shape

`@pitlane/content`, at `packages/content`, with four public entry points:

| Entry point                | Exports                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pitlane/content`         | `createContent`, and the `Collection`, `CollectionEntry`, `ContentLoader`, `LoaderContext`, `LoadedEntry`, `Reference`, `Heading`, `RenderedEntry` types |
| `@pitlane/content/loaders` | `glob`, `file`                                                                                                                                           |
| `@pitlane/content/satteri` | `headings`, a Sätteri MDAST plugin                                                                                                                       |
| `@pitlane/content/vite`    | `content`, the build-time plugin                                                                                                                         |

One internal entry point, `@pitlane/content/internal/manifest`, exists so the plugin has something
to replace. It ships as `export default null`.

`dependencies` is `{ "yaml": "^2" }` — YAML frontmatter and `.yaml` data files need a parser, and
neither Remix nor the platform provides one. `@pitlane/content/vite` adds `vite` as a peer and
nothing else; serializing baked values is a few dozen lines and does not want a dependency.

`remix` is a peer dependency. `satteri` is an **optional** peer dependency (`^0.9.4`, caret-pinned
because Sätteri is pre-1.0 and breaks on minor bumps). Only `render()` on an unbaked Markdown entry
and `@pitlane/content/satteri` import it, so an application whose content is baked never installs
it.

### `createContent`

```ts
function createContent<T extends Record<string, CollectionDefinition>>(
    build: (c: ContentBuilder) => T,
): Promise<Content<T>>;

interface ContentBuilder {
    collection<S extends StandardSchemaV1>(input: {
        loader: ContentLoader;
        schema: S;
    }): CollectionDefinition<S>;
    reference<C extends string>(collection: C): ReferenceSchema<C>;
}
```

- `createContent` calls `build` once and **performs no I/O**. It returns as soon as it has wired the
  collections up, so a module that declares content does nothing asynchronous at import time. This
  is not an optimization: Cloudflare Workers forbids asynchronous I/O in global scope, and
  `createContent` is called at module scope.
- A collection whose name appears in the baked manifest reads from it. The manifest is inlined, so
  that is a synchronous lookup with no loader involved.
- Every other collection **populates on first access**, from `getCollection` or `getEntry`. The
  result is memoized for the life of the process, and concurrent callers share one in-flight load
  rather than starting several.
- It returns an object with one property per key in `build`'s return value. Each is a `Collection`.
- A collection that fails to populate rejects the access that triggered it, with the error annotated
  by collection name. The failure is **not** memoized, so the next access retries — one timed-out
  fetch should not leave a collection broken until the process restarts. A collection is either
  fully populated or throws; a half-populated one is never observable.
- `c.reference(name)` records `name` on the builder. After `build` returns, `createContent`
  compares every recorded name against the keys of the returned object and throws
  `Unknown collection "<name>" referenced by createContent; known collections are <keys>.` when one
  does not exist. This catches a typo at startup rather than at the first `getEntry`.

### Collections and entries

```ts
interface Collection<Data> {
    getCollection(
        filter?: (entry: CollectionEntry<Data>) => unknown,
    ): Promise<CollectionEntry<Data>[]>;
    getEntry(id: string | Reference<string>): Promise<CollectionEntry<Data> | undefined>;
}

interface CollectionEntry<Data> {
    id: string;
    collection: string;
    data: Data;
    filePath?: string;
    render(): Promise<RenderedEntry>;
}

interface RenderedEntry {
    Content: (handle: Handle<Record<string, unknown>>) => () => RemixNode;
    headings: Heading[];
}

interface Heading {
    depth: number;
    slug: string;
    text: string;
}
```

- `getCollection()` returns every entry sorted by `id`, ascending, using `Array.prototype.sort`'s
  default string comparison. The order is stable across runs so prerendered output and tests do not
  depend on filesystem or glob ordering, and it does not depend on whether the collection was baked.
- `getCollection(filter)` returns the entries for which `filter` returns a truthy value, in the same
  order.
- `getEntry` accepts a bare id or a reference object. Given `{ collection, id }` it ignores
  `collection` — the receiver already fixes it, and the type parameter is what prevents passing a
  `Reference<"blog">` to `content.authors.getEntry`. It resolves to `undefined` for an unknown id.
- Both methods are `async` because that is the API VISION.md publishes and because `render` must be
  async regardless. They resolve from memory.

### `render`

`render()` resolves to a `Content` component and the entry's headings. It renders lazily: nothing
parses Markdown until an entry is rendered, so loading a collection to list its titles never pays
for bodies it does not show.

- **A baked `.mdx` entry** carries a compiled module. `Content` is a Remix factory wrapping the MDX
  function: `handle => () => MDXContent(handle?.props ?? {})`. MDX compiles to a plain function of
  props while a Remix component is a factory returning a render function, so the wrapper bridges
  the two. Props passed to `<Content />` reach the MDX content, which is how `components` overrides
  work.
- **A baked `.md` entry** carries an HTML string. `Content` renders a single `<div>` carrying it
  through `remix/ui`'s `innerHTML` prop. The wrapper element is unavoidable: `innerHTML` is an
  element prop, so the markup needs an element to land on.
- **An unbaked Markdown entry** renders through `satteri` on first call and caches the result —
  `markdownToHtml` for `.md`, `evaluate` with `remix/ui/jsx-runtime` for `.mdx` — producing the
  same two shapes.
- **An entry with no body** — everything `loaders.file` produces, and every `.json`, `.yaml`, or
  `.yml` entry from `loaders.glob` — rejects with
  `Entry "<collection>/<id>" has no renderable content.` It does not resolve to an empty component:
  calling `render()` on a data entry is a mistake, and hiding it produces a blank page instead of
  an error.

### The loader contract

```ts
interface ContentLoader {
    name: string;
    load(context: LoaderContext): Promise<void> | void;
    bake?: boolean;
    watchedPaths?(): string[];
}

interface LoaderContext {
    collection: string;
    parseData<D>(input: { id: string; data: unknown; filePath?: string }): Promise<D>;
    store: { set(entry: LoadedEntry): void };
}

interface LoadedEntry {
    id: string;
    data: unknown;
    filePath?: string;
    body?: { format: "md" | "mdx"; source: string };
}
```

A loader reads its source, calls `parseData` for each entry, and calls `store.set`. The interface is
public, so an application can write a loader over a database, a CMS, or anything else, and two
implementations ship.

A loader never renders. It reports the raw `source` and its `format`, and `render()` decides what to
do with it. That is what lets one loader serve both the runtime and the build: the build wants the
source so the bundler can compile it, and the runtime wants it so Sätteri can.

`bake` declares that the build may resolve this loader once and inline the result. It defaults to
**false**, and `loaders.glob` and `loaders.file` set it to `true`. `watchedPaths` only matters for a
baked loader, since it is what `content()` watches in order to re-bake.

The default is false because of which way the two mistakes fail. A filesystem loader that forgets
`bake: true` fails loudly on a filesystem-less host, naming the fix. A remote loader wrongly baked
fails silently: its content freezes at the moment of the build and never updates again, and nothing
anywhere reports a problem. Defaults belong on the side of the loud failure.

`parseData` validates against the collection's schema and returns the parsed value. On failure it
throws an `Error` whose message names the collection, the entry id, the file path when there is one,
and one line per Standard Schema issue in `  - <path>: <message>` form. For a baked collection that
happens during the build, so an invalid entry never reaches a page; for a runtime one it happens on
first access, which is the earliest the data exists.

Two `store.set` calls with the same `id` is a conflict, not a merge: the second throws
`Duplicate entry id "<id>" in collection "<collection>".`

### `loaders.glob` and `loaders.file`

```ts
loaders.glob(options: {
    pattern: string | string[];
    base?: string;
    generateId?: (options: GenerateIdOptions) => string;
    satteri?: CompileOptions;
}): ContentLoader

loaders.file(fileName: string, options?: {
    parser?: (text: string) => Record<string, unknown> | unknown[];
}): ContentLoader
```

Plain runtime functions over `node:fs/promises`. `pattern` is an ordinary value — computed, read
from an environment variable, or assembled in a loop — because nothing about it is analysed
statically. `base` defaults to `.` and is relative to the project root. An id is the file path
relative to `base` with its extension stripped and `\` normalised to `/`; `generateId` replaces that
derivation.

| Extension       | Becomes                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| `.md`, `.mdx`   | frontmatter is `data`, the remaining text is `body.source`, `body.format` the suffix |
| `.json`         | `JSON.parse` of the whole file is `data`; no body                                    |
| `.yaml`, `.yml` | parsed with `yaml`; no body                                                          |
| anything else   | skipped by `glob`; `loaders.file` requires `options.parser`                          |

Frontmatter is the leading `---`-fenced block, parsed with `yaml`. `@pitlane/content` parses it
itself, in one place, rather than reading the `frontmatter` export `vite-plugin-satteri` also
produces — so a baked and an unbaked collection cannot disagree about an entry's `data`. The
compiled module is used for its component, never for its metadata.

`loaders.file` reads one file holding many entries. An array result requires each item to carry a
string `id`, which is removed from `data`; an item without one throws naming its index. An object
result uses its keys as ids.

`options.satteri` configures the runtime rendering path and is forwarded to whichever Sätteri entry
point the format selects. `@pitlane/content/satteri`'s `headings` plugin is prepended to
`options.satteri.mdastPlugins` and `features.frontmatter` is forced on; everything else is the
application's. A baked entry was compiled by `vite-plugin-satteri` instead, so `options.satteri`
does not apply to it — `content()` warns when both are configured, because a plugin list that only
takes effect on some hosts is a trap.

Rendering an unbaked Markdown entry without `satteri` installed throws
`Rendering "<path>" needs the optional peer dependency "satteri"; install it, or add content() from @pitlane/content/vite so the build compiles this collection.`

`.mdx` rendered at runtime is Node-only by construction: `satteri.evaluate` compiles to a function
body and runs it through `new Function`, which Cloudflare Workers forbids. That is not a new
restriction, because a collection reaching that path already needed `node:fs`.

### `@pitlane/content/vite` — the `content()` plugin

```ts
function content(options?: { entry?: string }): Plugin;
```

`entry` names the module that declares the collections, defaulting to `app/content.ts`. It is an
ordinary application module — controllers import `content` from it — not a configuration file the
plugin owns. The plugin needs to be told which module it is, and that is the whole of its
configuration.

The plugin bakes in four steps:

1. **Execute the entry in Node, in bake mode.** `createRunnableDevEnvironment` from Vite runs
   `entry` through Vite's own module runner, so TypeScript, aliases, and `vite.config.ts`
   resolution all apply. `createContent` sees the bake flag and populates **only** collections
   whose loader sets `bake: true`, eagerly, with the filesystem available. Every other collection
   is left alone, so the build makes no network calls and needs no runtime credentials.
2. **Read what loaded.** `createContent` records each populated collection on a module-scoped
   registry inside `@pitlane/content`, which the plugin reads from the same realm afterwards. The
   entry module therefore needs no particular export shape and no annotation — only to have been
   imported.
3. **Emit a manifest.** A virtual module replaces `@pitlane/content/internal/manifest`. Each entry
   contributes its `id`, `filePath`, and `data` as JavaScript literals — `Date` as
   `new Date("…")`, nested objects and arrays structurally — so a `coerce.date()` schema survives
   the trip as a `Date` rather than a string. A collection that was not baked contributes nothing,
   and its absence is what tells the runtime to use the loader.
4. **Emit a module per body.** An entry with a `body` gets a virtual module whose id ends in its
   format, `\0pitlane-content/entry/<collection>/<id>.mdx`, loading as the raw source. The manifest
   imports it statically, so Vite resolves it, `vite-plugin-satteri` compiles it, and the component
   lands in the bundle. This is the step no amount of runtime cleverness can replace: a component is
   code, and only the bundler can turn source into code.

#### A custom loader still runs at runtime

A loader an application writes itself — over a CMS, an API, a `remix/data-table` database — leaves
`bake` at its default, so `content()` skips it entirely and it behaves identically on every host:
the collection populates on first access, inside whichever request touched it, and re-populates
after the process or isolate is recycled.

Two properties of the design exist for this case specifically, and neither is optional.

**Nothing loads at module scope.** Cloudflare Workers rejects asynchronous I/O in global scope —
its documentation is explicit that "asynchronous tasks such as `fetch` must be executed within a
handler", and that bindings are reachable at the top level but their methods are not. Since
`createContent` is called at module scope, an eager design would make a remote loader throw
`Disallowed operation called within global scope` on import, and a KV- or D1-backed loader with it.
Populating on first access is what puts that I/O inside a request.

**`bake` is opt-in.** Baking a remote loader would run the fetch during `vite build` and freeze
whatever came back into the bundle, so a post published afterwards would never appear and nothing
would report it. The build therefore never touches a loader that has not asked to be baked.

A custom loader _may_ set `bake: true` deliberately, and for a fully static site that is the point:
snapshot a CMS at build time, ship no runtime dependency on it, and redeploy to update. That is a
choice the loader's author makes, with the freeze as the understood consequence.

What a runtime collection gives up is the build-time guarantee. Its schema violations surface on
first access rather than failing the build, its content is a per-process snapshot rather than a
per-request read, and `render()` on a Markdown body it returns needs `satteri` at runtime — which
on Workers means `.md` only, since `.mdx` evaluation needs `new Function`. A collection that must be
fresh on every request is not a content collection; it is a controller reading a database, and
Remix already does that.

**The entry module is executed at build time, so it must be importable in Node.** Collection
declarations only: no `cloudflare:workers` imports, no request-scoped state, no side effects that
need a live server. A module-level import of a CMS client is fine — what is not fine is calling it
before a request exists, which the lazy population above already rules out. This is the design's
one real constraint, it is the same constraint the prior art's config file carries, and `content()`
reports the module and the underlying error when the import fails rather than continuing with an
empty manifest.

#### Reaching a runtime with neither source

A bundled build without `content()` leaves the manifest empty, so a `bake: true` collection falls
through to its loader and finds no `node:fs`. That surfaces from the first access, loudly, naming
the fix:

```text
Collection "blog" has no baked content and no filesystem to read.
Add content() from "@pitlane/content/vite" to your Vite config.
```

An empty collection is the one outcome this design refuses. It renders as a blog with no posts,
which looks like a content problem and is a configuration problem.

### `@pitlane/content/satteri` — the shared `headings` plugin

```ts
function headings(): MdastPluginEntry;
```

A Sätteri MDAST plugin factory. For each document it collects every heading as
`{ depth, slug, text }`, where `text` is `ctx.textContent(node)` and `slug` is that text lowercased,
with non-alphanumerics collapsed to `-`, trimmed of leading and trailing `-`, and suffixed `-1`,
`-2`, … on collision within the document. It sets each heading's `id` to the slug so anchors work,
and in its `after` hook, on an MDX document, appends an `mdxjsEsm` node carrying
`export const headings = [...]`.

One plugin serves both rendering paths, which is what makes them agree:

```ts
// vite.config.ts
import { content } from "@pitlane/content/vite";
import { headings } from "@pitlane/content/satteri";
import { remix } from "@pitlane/dev";
import satteri from "vite-plugin-satteri";

export default defineConfig({
    plugins: [
        satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()] }),
        content(),
        remix(),
    ],
});
```

`jsxImportSource: "remix/ui"` is required, and `satteri()` must precede `remix()`.

**Known limitation.** A baked `.md` entry has `headings: []`. `vite-plugin-satteri` emits only
`frontmatter` and an HTML string for Markdown, and the plugin has nowhere to put a heading list that
survives into the module. The workaround is `.mdx`, which is what the guide will recommend for any
page that needs a table of contents. The other three combinations — `.md` and `.mdx` rendered at
runtime, `.mdx` baked — all produce headings.

This is the one place the two rendering paths differ in output, and it is the strongest argument for
`.mdx` as the default authoring format.

### Code highlighting

`@pitlane/content` owns no highlighting API. Highlighting is a Sätteri HAST plugin the application
supplies, and both rendering paths accept one, so the supported answer is
[`satteri-expressive-code`](https://github.com/bruits/satteri/tree/main/packages/satteri-expressive-code)
— the Sätteri equivalent of `rehype-expressive-code`, giving
[Expressive Code](https://expressive-code.com) frames, line markers, and a copy button over
[Shiki](https://shiki.style) themes:

```ts
import expressiveCode from "satteri-expressive-code";

let code = expressiveCode({ themes: ["github-dark", "github-light"] });

// baked by the build
satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()], hastPlugins: [code] });

// rendered at runtime
loaders.glob({ pattern: "**/*.md", base: "app/content/blog", satteri: { hastPlugins: [code] } });
```

Expressive Code's plugins are async, which makes Sätteri's entry points return a promise. Every
call site in this package already awaits them, so nothing changes. The plugin emits its own
`<style>`; placing that is the application's concern and the guide covers it.

Adding a Pitlane-owned highlighting option in front of this would buy nothing — it would forward
the same plugin list through one more name, and go stale whenever Expressive Code or Shiki gains an
option.

### References

```ts
type Reference<C extends string> = { collection: C; id: string };
function reference<C extends string>(collection: C): ReferenceSchema<C>;
```

`c.reference` is built with `remix/data-schema`'s `createSchema`, so it is a Standard Schema v1
schema that composes inside `s.object`, `s.array`, and `s.optional` like any other. It accepts a
string and outputs `{ collection, id }`; a non-string input fails with
`Expected a reference id for collection "<name>"`. It does **not** check that the target entry
exists, and under lazy population it could not: the referenced collection may be unpopulated at the
moment the reference is validated, and populating it to check would turn reading one entry into
loading every collection it points at. An unresolvable reference surfaces as `getEntry` resolving
to `undefined`.

### Reloading

With `content()` installed, the plugin watches every path the loaders report through
`watchedPaths()`. A change under one of them re-executes the entry module, rebuilds the manifest,
invalidates it along with the affected body modules, and triggers a reload — so adding, editing, and
deleting a post all take effect without a restart. That is a strict improvement over watching the
module graph, which only ever sees files something already imported.

Without `content()` a collection reads the filesystem once, when something first accesses it, and a
later content change needs a restart. No cache invalidation and no digest tracking ships here.

## Compatibility

No compatibility impact. `@pitlane/content` is a new package at `0.1.0` with no dependents, and
nothing in the repository changes. `satteri` and `vite-plugin-satteri` are the application's
dependencies, so a project already using them keeps its own versions.

**VISION.md disagrees with this design in five places.** Each is the published code sample being
illustrative rather than executable; all five want the human's agreement before implementation, and
VISION.md is corrected in phase 5.

| VISION.md says                                                         | This proposal says                                                     | Why                                                                                                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `s.date()`                                                             | `coerce.date()`                                                        | `remix/data-schema` has no `date` primitive. `coerce.date()` is the spelling that parses a frontmatter string into a `Date`.                      |
| `loaders.glob({ pattern: "app/content/**/*.{md,mdx}", base: "blog" })` | `base` is the directory patterns resolve against, as in the prior art  | `base: "blog"` alongside a full-path pattern reads as a collection prefix, which nothing implements. One meaning for `base` is enough.            |
| `loaders.file("app/content/authors.jsonc")`                            | `.json`, `.yaml`, and `.yml` built in; `.jsonc` needs `options.parser` | JSONC needs a third parser for comments YAML already allows. The sample becomes `authors.json`.                                                   |
| `import { createContent } from "pitlane/content"`                      | `@pitlane/content`                                                     | The umbrella vends no subpaths yet — VISION.md's own [Reserved names](../VISION.md#reserved-names) says a package that exists is imported scoped. |
| Nothing about how content reaches a Worker                             | `content()` bakes the collections at build time                        | The published sample only shows filesystem loaders, which cannot run on Cloudflare Workers, the flagship target.                                  |

## Implications on adoption

Adopting `@pitlane/content` means installing it and writing one module that calls `createContent`.
Markdown or MDX adds `satteri` and `vite-plugin-satteri`, plus
`satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()] })` before `remix()`. A
collection of `.json` or `.yaml` files needs none of that.

Any target without a filesystem — Cloudflare Workers above all — additionally needs `content()` in
the Vite config, and its collections declared in a module that imports cleanly in Node. The
collections themselves do not change.

Version floors: `remix@^3.0.0-rc.1`, `vite@^8` for `content()`, and `satteri@^0.9.4` when Markdown
renders at runtime.

Adoption is reversible. Nothing is generated into the repository, no file is written outside
`packages/content`, and no directory layout is imposed — content lives wherever the loader is
pointed. Removing the package means deleting the module that calls `createContent`.

## Scope

- A new `packages/content` with the four public entry points above, built and tested with Vite+ in
  the same shape as `packages/crawler`.
- `createContent`, the collection and entry surface, reference resolution, and schema validation
  with its error reporting.
- Lazy per-collection population: memoized on success, retried after a failure, one in-flight load
  shared by concurrent callers, and no I/O at module scope on any host.
- The `ContentLoader` interface, its `bake` opt-in, and the `glob` and `file` implementations,
  reporting raw bodies rather than rendering them.
- Lazy `render()` over both a baked module and a runtime Sätteri call, producing the same
  `{ Content, headings }` either way.
- `content()`: executing the entry through Vite's module runner in bake mode, baking only
  `bake: true` collections, the manifest and body virtual modules, the watch-and-rebake path, and
  the loud failure when neither source exists.
- The `headings` Sätteri plugin, shared by both rendering paths, and the `satteri` pass-through that
  lets `satteri-expressive-code` configure the runtime one.
- `docs/guides/content.md`, covering both hosts, the Sätteri setup, code highlighting with
  Expressive Code, and references.
- A README and CHANGELOG for the package, and its TypeDoc config in `.typedoc/` plus its line in
  the `docs:api` task.

### Out of scope

- **A `content.config.ts` format, a public virtual module, or generated types.** `content()` names
  an ordinary application module and replaces one internal specifier. The public API is the object
  `createContent` returns, and its types are inferred — which is the whole reason the prior art's
  `.d.ts` generation is not carried over with its loading mechanism.
- **Images in frontmatter.** The prior art's `SchemaContext.image()` is a stub there and belongs
  with `@pitlane/image`, which is separately sequenced in VISION.md.
- **Incremental baking.** The plugin re-executes the entry module on a content change rather than
  diffing entries. The prior art carries a per-entry digest for this; it is worth adding when a
  real collection makes rebake latency visible, and guessing at that now would be premature.
- **Shipping a remote or database loader.** The `ContentLoader` interface is public and the runtime
  path is specified for exactly this case, so an application can write one today. Pitlane shipping
  one before a caller exists is an interface built for nobody.
- **Revalidating a runtime collection.** A populated collection is a per-process snapshot; there is
  no TTL, no background refresh, and no cache integration. Adding one is a caching design, it
  belongs with `@pitlane/cache`, and a collection that must be fresh per request is a controller
  reading a database rather than a content collection.
- **`getEntries(refs)`.** `Promise.all(refs.map(r => content.tags.getEntry(r)))` is the same thing
  spelled out of the package.
- **Runtime and streaming Markdown.** Rendering a string that is still growing — an LLM response
  arriving token by token — is a different problem with a different engine, sized below under
  **Future directions**. Nothing here forecloses it.
- **A Pitlane-owned highlighting abstraction.** Expressive Code and Shiki are configured through
  the plugin pass-through. Wrapping them would add a name without adding a capability.

## Preview

- Artifact: the pkg.pr.new build from `pkg-preview.yml` —
  `npm i https://pkg.pr.new/pitlane-tools/pitlane/@pitlane/content@<sha>`
- Reason: the change is a package's behavior, and the only way to know the API is usable is to
  install it and query a collection. `pkg-preview.yml` already publishes on every branch push, so
  the artifact costs a push. It needs one line added to that workflow's package list. Reviewing the
  guide instead would show the API described rather than the API working, and the inference-driven
  typing in particular is only real in an editor against an installed build.

## Policies and decisions checked

- `policies/` — empty apart from its README. No policy constrains this proposal.
- `decisions/` — empty apart from its README. No decision constrains this proposal.
- `VISION.md`, Development principle 3, **Runtime When Possible** — honored, and this is the
  principle the design bends furthest, so it is worth being precise. `createContent`, every query,
  and both loaders are plain runtime code that works with no bundler, and the package's core tests
  exercise all of it on the filesystem. `content()` is the "static integration added later as an
  optional optimization" the principle explicitly allows. What it is not is optional _for a
  filesystem-less target_, and the proposal says so rather than calling it optional everywhere.
- `VISION.md`, Development principle 4, **Avoid Dependencies** — one runtime dependency, `yaml`,
  for frontmatter and `.yaml` files. Sätteri is optional and composed rather than wrapped, so it is
  the application's dependency and version choice. The slugger the prior art took from
  `github-slugger` is implemented here instead, because it is a dozen lines, and `content()` takes
  no dependency at all beyond Vite.
- `VISION.md`, Development principle 5, **Demand Composition** — the loader interface is the seam,
  and the package is useful installed alone. It depends on `remix` and, optionally, on `satteri`;
  both are documented.
- `VISION.md`, [Planned package sequence](../VISION.md#planned-package-sequence) — `@pitlane/content`
  is entry 2, immediately after the shipped `@pitlane/theme`. This is the package that sequence
  calls for next.
- `VISION.md`, [Content layer](../VISION.md#content-layer--pitlanecontent) — the published API is
  implemented, with the five deviations tabled under **Compatibility**.

## Future directions

- A Markdown entry rendering without its `<div>` wrapper, by walking Sätteri's HAST into Remix nodes
  instead of passing an HTML string to `innerHTML`. It would also make element overrides work
  uniformly across `.md` and `.mdx`. It is not here because a baked `.md` entry arrives as a string
  from `vite-plugin-satteri`, so the two paths could not agree on it.
- Headings for a baked `.md` entry, once `vite-plugin-satteri` can surface a compile's data bag or
  extra exports for Markdown. That is an upstream capability, not something this package can add
  from the outside, and it is the last output difference between the two rendering paths.
- Per-entry digests, so a content change rebakes only what changed.
- Revalidation for a runtime collection — a TTL, a manual invalidate, or an integration with
  `@pitlane/cache` — so a CMS-backed collection refreshes without waiting for the process to be
  recycled. The lazy population this proposal specifies is the seam that would hang off.
- A first-party loader for a specific CMS or database, once one application wants the same one
  twice.
- A `@pitlane/content` integration in the target templates, sequenced by
  `.agents/skills/adopting-packages-into-templates/`.

### Runtime and streaming Markdown

A separate capability, investigated while writing this proposal and deliberately not built here:
rendering Markdown that is **still being written**, as when a model streams a response into the
page. Recording the findings so the next proposal does not start from nothing.

It is a different problem. This package resolves a fixed set of files once, and every engine choice
above follows from that. A streamed response is one string that grows, re-rendered tens of times a
second, with trailing constructs that are syntactically incomplete at every intermediate step — a
half-typed `**bold`, a fence with no closer.

That rules out the engine this package uses. Sätteri is a native NAPI binary that falls back to a
WASI build needing `SharedArrayBuffer`, which is not a client-side dependency; Expressive Code and
Shiki are async and an order of magnitude larger than the whole feature should be. Sending each
token to the server to re-render is a round trip per token.

[TanStack Markdown](https://github.com/TanStack/markdown) is built for exactly this case and is
the strongest current candidate: a 5.0 KB gzip parser with zero runtime dependencies, a serializable
AST, raw HTML escaped and executable URLs stripped by default, and an
[AI streaming profile](https://github.com/TanStack/markdown/blob/main/docs/guides/ai-streaming.md)
that suppresses empty trailing headings, quotes, and list items while a response is incomplete. It
holds no parser state between updates — each render reparses the accumulated string — which is why
a completing delimiter can restructure the last block without corrupting anything. It is explicitly
not a complete CommonMark, GFM, or MDX implementation, so it is a poor fit for this package and a
good one there. [TanStack Highlight](https://github.com/TanStack/highlight) pairs with it:
synchronous, class-based, 1.8 KB gzip before languages, tree-shaken per language, with themes
emitted as CSS.

Two things are missing, and both are Pitlane-shaped. Neither package ships a Remix adapter — there
are React and Octane ones, and `remix/ui` components are factories rather than functions of props,
the same shape difference this package's MDX wrapper already bridges. And Highlight ships remark,
rehype, TanStack Markdown, and Octane adapters but no Sätteri one, which is what a project would
want in order to highlight its static and streamed content through a single registration.

**Remix Frames are not sufficient on their own.** A `<Frame>` streams a server-rendered region into
the page and can be reloaded, so it covers "render a fallback, then swap in the finished response",
and `renderToStream` flushes frames as they resolve. What it does not have is a way to append to a
frame that is already open, so token-level growth still needs something on the client re-rendering
the accumulated string. Frames are the right envelope; they are not the renderer.

Sharing a dependency tree with this package means sharing three seams it already defines: the
`Heading` shape, the `RenderedEntry` contract, and a single highlighter registration. A static entry
and a streamed response rendering through the same component contract is the thing worth designing
for, and it is cheaper to do in a proposal of its own than to bolt onto this one.

## Alternatives considered

- **Populating every collection eagerly in `createContent`.** What this proposal specified until a
  custom remote loader was considered, and simpler to reason about: one `await` at module scope and
  every collection is ready. Rejected because Cloudflare Workers forbids asynchronous I/O in global
  scope — its own documentation says "asynchronous tasks such as `fetch` must be executed within a
  handler", and that a binding is reachable at the top level while its methods are not. Any loader
  doing I/O, whether over HTTP, KV, or D1, would throw
  `Disallowed operation called within global scope` when the module was imported. Lazy population
  is not a performance choice; it is the only shape that runs on the flagship target.
- **Baking every collection, with no `bake` opt-in.** Removes a field and a decision from the
  loader contract. Rejected because it is silently wrong for anything remote: the build would fetch
  once, inline the answer, and the collection would never change again without a redeploy, with no
  error to notice. It also drags build-time network access and runtime credentials into `vite build`
  for collections that never asked for either.
- **Port the prior art wholesale.** Keep `@withsprinkles/content-layer`'s shape entirely — a
  `content.config.ts`, a `sprinkles:content` virtual module, a generated `.d.ts` — and swap Sätteri
  in for `@mdx-js/rollup`. Its loading mechanism _is_ adopted here, and the parts left behind are
  the API on top: a string-keyed `getCollection("blog")` forces the types to be generated, and a
  generated `.d.ts` can disagree with the schema that produced it. Declaring collections in
  application code keeps inference, which is the one thing codegen cannot be better than.
- **`import.meta.glob` at the call site.** `loaders.modules(import.meta.glob("./content/*.mdx", { eager: true }))`,
  with the application writing the literal Vite needs. No plugin at all, and the honest version of
  a bundler-fed loader. Rejected because the mechanism then leaks into every collection: the same
  blog needs a different loader per host, which is the coupling this package exists to remove.
- **Rewriting the call site with a transform.** A Vite plugin that finds `loaders.glob({ pattern: "…" })`
  and injects `import.meta.glob` for it, the way `packages/dev/src/transform.ts` rewrites
  `clientEntry(import.meta.url, …)`. Keeps the ergonomics but demands a literal pattern, warns
  instead of working when it finds a computed one, and reimplements at parse time what the loaders
  can just do. Baking the loaders' own output has no such constraint.
- **Resolving a glob at runtime inside the loader.** The shape this design wants most: `loaders.glob`
  calls `import.meta.glob(options.pattern)` itself. It does not work, and it fails in the worst
  available way. `import.meta.glob` is a compile-time rewrite whose pattern must be a literal in the
  module being transformed, so a pattern arriving as a function argument inside a dependency
  resolves to nothing. Measured against Vite 8.1.4: a module reading
  `let pattern = "./content/*.md"; export let mods = import.meta.glob(pattern, { eager: true })`
  builds with no error, no warning, and emits `Object.assign({})` — every collection silently
  empty. This is why the build executes the loaders instead of trying to translate them, and why a
  loader with no source throws rather than returning `[]`.
- **Discovering the entry module instead of naming it.** `content()` could find modules that import
  `@pitlane/content` and call `createContent`, removing its one option. Rejected as fragile for
  what it saves: the manifest has to exist before the graph is walked, a re-export or a dynamic
  import defeats the scan, and two content modules would silently produce one manifest. One option
  with a default is cheaper to understand than a heuristic that mostly works.
- **Injecting a renderer: `createContent(build, { renderer })`.** Keeps the core dependency-free
  while still supporting runtime Markdown. Rejected as an interface built for a second caller that
  does not exist, at the cost of an extra argument in every application's content module.
- **Checking `c.reference("x")` against sibling collection keys at definition time.** The keys are
  not known inside the builder callback, so this needs either a two-call API or the codegen the
  prior art uses. The runtime check after `build` returns catches the same typo at startup, and the
  type parameter catches a mismatched reference at the use site.
- **TanStack Markdown as this package's engine.** A 5.0 KB gzip parser with zero dependencies that
  runs anywhere, including a Worker, would remove the optional peer dependency and the Node-only
  rendering path. Rejected because it does not implement MDX, and a content layer that cannot put a
  component in a post is not the capability VISION.md describes. It states plainly that it is not a
  complete CommonMark, GFM, or MDX implementation and spends its budget on determinism and size
  instead — the right trade for a streamed response, the wrong one for a blog archive.

## Open questions

None.

## Acknowledgments

[`@withsprinkles/content-layer`](https://github.com/withsprinkles/content-layer) by Mark Malstrom is
the prior art this proposal is measured against, and its loading mechanism is adopted rather than
reinvented: run the loaders in Node at build time, serialize the entries, and carry each Markdown
body into the bundle as a virtual module the bundler compiles. Its loader contract, `reference()`
schema, and Remix MDX component wrapper are all carried forward too. Its collection model in turn
follows [Astro's content layer](https://docs.astro.build/en/guides/content-collections/).

[Sätteri](https://satteri.bruits.org), from the [Bruits](https://bruits.org) collective, is the
Markdown and MDX engine on both rendering paths. Its `after` lifecycle hook, documented with a
table-of-contents example, is what lets one plugin serve both.

[TanStack Markdown](https://github.com/TanStack/markdown) and
[TanStack Highlight](https://github.com/TanStack/highlight) were evaluated for the streaming case
and shaped **Future directions**; their published bundle sizes and AI streaming profile are what
made it clear that case wants its own engine rather than a setting on this one.

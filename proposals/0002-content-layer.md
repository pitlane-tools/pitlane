---
id: proposal.0002
title: Typed Content Collections
authors: [markmals, Claude]
status: returned-for-revisions
pull-request: https://github.com/pitlane-tools/pitlane/pull/16
issues: []
supersedes: []
---

# Typed Content Collections

## Summary

`@pitlane/content` turns local Markdown, MDX, and data files into schema-validated,
cross-referenced collections a Remix controller can query. Collections are declared at runtime with
`createContent`, and a Vite plugin prebuilds them into the bundle for hosts without a filesystem.

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
Node during the build and prebuilds the collection into the bundle** — entry data as plain values, Markdown
bodies as modules the bundler compiles. Application code is identical either way. Adding a host
edits the Vite config; it never edits a collection.

[Sätteri](https://satteri.bruits.org) renders the Markdown, composed rather than wrapped: the
`satteri` package when a collection renders at runtime, `vite-plugin-satteri` when the build
compiled it ahead of time.

Both hosts watch the files the loaders report, so editing a post while the application is running
reaches the browser without a restart: `content()` rebuilds the manifest, and `hotContent` from
`@pitlane/content/hot` registers the files with the watcher `remix/node-hmr` is already running.

```text
a .mdx file gains a heading → content.blog.getEntry(slug) → render() → { Content, headings }
```

## Detailed design

### Package shape

`@pitlane/content`, at `packages/content`, with five public entry points:

| Entry point                | Exports                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pitlane/content`         | `createContent`, and the `Collection`, `CollectionEntry`, `ContentLoader`, `LoaderContext`, `LoadedEntry`, `Reference`, `Heading`, `RenderedEntry` types |
| `@pitlane/content/loaders` | `glob`, `file`                                                                                                                                           |
| `@pitlane/content/satteri` | `headings`, a Sätteri MDAST plugin                                                                                                                       |
| `@pitlane/content/vite`    | `content`, the build-time plugin                                                                                                                         |
| `@pitlane/content/hot`     | `hotContent`, the development watcher for a host with no bundler                                                                                         |

One internal entry point, `@pitlane/content/internal/manifest`, exists so the plugin has something
to replace. It ships as `export default null`.

`dependencies` is `{ "yaml": "^2" }` — YAML frontmatter and `.yaml` data files need a parser, and
neither Remix nor the platform provides one. `@pitlane/content/vite` adds `vite` as a peer and
nothing else; serializing prebuilt values is a few dozen lines and does not want a dependency.

`remix` is a peer dependency. `satteri` is an **optional** peer dependency (`^0.9.4`, caret-pinned
because Sätteri is pre-1.0 and breaks on minor bumps). Only `render()` on a runtime-resolved Markdown entry
and `@pitlane/content/satteri` import it, so an application whose content is prebuilt never installs
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
- Each collection is wired according to the kind of loader it was given, which `createContent`
  determines by whether the loader has a `load` method:
    - A **`ContentLoader`** collection whose name appears in the prebuilt manifest reads from it. The
      manifest is inlined, so that is a synchronous lookup with no loader involved.
    - A **`ContentLoader`** collection with no manifest entry runs its loader on **first access**,
      from `getCollection` or `getEntry`. The result is memoized for the life of the process, and
      concurrent callers share one in-flight load rather than starting several.
    - A **`LiveLoader`** collection is never prebuilt and never memoized. `getCollection` calls
      `loadCollection` and `getEntry` calls `loadEntry`, every time.
- It returns an object with one property per key in `build`'s return value. Each is a `Collection`,
  and the two kinds are indistinguishable to a caller.
- A `ContentLoader` collection that fails to populate rejects the access that triggered it, with the
  error annotated by collection name. The failure is **not** memoized, so the next access retries —
  one timed-out fetch should not leave a collection broken until the process restarts. A collection
  is either fully populated or throws; a half-populated one is never observable.
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
  depend on filesystem or glob ordering, and it does not depend on whether the collection was prebuilt.
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

- **A prebuilt `.mdx` entry** carries a compiled module. `Content` is a Remix factory wrapping the MDX
  function: `handle => () => MDXContent(handle?.props ?? {})`. MDX compiles to a plain function of
  props while a Remix component is a factory returning a render function, so the wrapper bridges
  the two. Props passed to `<Content />` reach the MDX content, which is how `components` overrides
  work.
- **A prebuilt `.md` entry** carries an HTML string. `Content` renders a single `<div>` carrying it
  through `remix/ui`'s `innerHTML` prop. The wrapper element is unavoidable: `innerHTML` is an
  element prop, so the markup needs an element to land on.
- **A runtime-resolved Markdown entry** renders through `satteri` on first call and caches the
  result — `markdownToHtml` for `.md`, a `function-body` compile for `.mdx` — producing the same
  two shapes.
- **An entry with no body** — everything `loaders.file` produces, and every `.json`, `.yaml`, or
  `.yml` entry from `loaders.glob` — rejects with
  `Entry "<collection>/<id>" has no renderable content.` It does not resolve to an empty component:
  calling `render()` on a data entry is a mistake, and hiding it produces a blank page instead of
  an error.

#### Components imported by an MDX entry

An MDX file imports components. That is most of why an application chooses `.mdx` over `.md`, and
it has to work on both hosts or the format is only half supported.

With `content()` the bundler does it: the body is a real module, its imports are ordinary imports,
and `@pitlane/dev`'s `clientEntry` transform gives a browser component its asset URL. Nothing there
is new.

Without a bundler nothing resolves them, and the failure is silent. Sätteri's `function-body`
output reads each imported binding off the runtime object it is handed —
`const { Badge } = arguments[0];` — and `satteri.evaluate` supplies only
`{ Fragment, jsx, jsxs, jsxDEV, useMDXComponents }`. Every imported component is therefore
`undefined`, and `jsx(undefined, …)` renders nothing: no error, no warning, a missing section.
That is measured, not inferred.

So `render()` resolves the imports itself:

1. Collect the document's `mdxjsEsm` nodes, which Sätteri already parses, and read the specifier
   and bindings out of each.
2. Resolve each specifier against the entry's `filePath` and `await import()` it. A relative
   specifier resolves relative to the file; a bare or subpath specifier resolves the way Node
   resolves it from that directory, so `#/ui/public/counter.tsx` means what it means in a
   controller.
3. Compile with `mdxToJs(source, { outputFormat: "function-body" })` and call the result with the
   JSX runtime plus those bindings.

`import` in an MDX file therefore means what it means everywhere else, and the same file renders
identically whether the bundler compiled it or Sätteri did.

A specifier that does not resolve fails the render naming the file, the specifier, and the
underlying error, rather than rendering a hole. An import Sätteri cannot parse fails the same way.

This does not widen the host requirement. Runtime `.mdx` already needs `new Function`, so it was
already Node, Bun, and Deno only, and resolving its imports needs the module loader those already
have.

**A `clientEntry` component needs nothing from this package.** `clientEntry(entryId, component)`
tags a component with a browser-reachable module URL, and the server renderer emits the hydration
marker from that tag. Whether the component reached the tree through a controller or through an
MDX import is not a distinction the renderer makes. What the application owes is what it owes for
any browser module: the component lives where its asset server can serve it, which for
`remix/assets` means an `app/**/public/**` path, and the document renders `<ImportMap>` so the
browser can resolve the bare specifiers the served module keeps.

### The two loader kinds

A loader declares what it is by **which interface it implements**, and nothing else. There is no
flag, no option, and no environment check in application code.

```ts
interface ContentLoader {
    name: string;
    load(context: LoaderContext): Promise<void> | void;
    watchedPaths?(): string[];
}

interface LiveLoader<Data = Record<string, unknown>> {
    name: string;
    loadCollection(): Promise<LiveEntry<Data>[]>;
    loadEntry(id: string): Promise<LiveEntry<Data> | undefined>;
}
```

A **`ContentLoader` resolves a whole collection by writing into a store.** Handed a store, it fills
it. That makes its output a value: run it once and the entries can be serialized, cached, or
inlined into a bundle. `loaders.glob` and `loaders.file` are `ContentLoader`s.

A **`LiveLoader` answers one query at a time.** There is no store to fill, so there is nothing to
serialize; the only way to get entries out of it is to ask it, which means asking it every time.

That is the whole discrimination. `c.collection({ loader })` accepts either and branches on whether
the object has `load`. A `ContentLoader` can be prebuilt because its shape says a single execution
produces the complete answer. A `LiveLoader` cannot be prebuilt because its shape says it does not have
one. Nothing has to be declared twice, and a loader cannot be configured into lying about which it
is — the contract it satisfies _is_ the claim.

This is
[Astro's split](https://docs.astro.build/en/reference/content-loader-reference/) between an object
loader's `load()` and a live loader's `loadCollection()` / `loadEntry()`, and it is the right answer
to a question this proposal previously answered with a boolean.

|                   | `ContentLoader`                            | `LiveLoader`                                        |
| ----------------- | ------------------------------------------ | --------------------------------------------------- |
| Shape             | `load(context)` fills a store              | `loadCollection()` / `loadEntry(id)` return entries |
| With `content()`  | executed during the build, entries inlined | untouched; runs per request                         |
| Without a bundler | executed on first access                   | runs per request                                    |
| Markdown bodies   | rendered ahead of time when prebuilt       | rendered at runtime, so no MDX on Workers           |
| Data freshness    | fixed at build, or at first access         | every query                                         |
| Ships here        | `glob`, `file`                             | none; the interface is public                       |

Choosing between them is choosing what the data _is_, which is the decision an author is actually
qualified to make. A directory of Markdown is a `ContentLoader`. A CMS whose editors expect to see a
change without a deploy is a `LiveLoader`. A CMS an application is content to snapshot per release
is a `ContentLoader` over `fetch` — and that is a legitimate choice rather than a mistake, which is
exactly why it should not be inferred from the environment.

**Terminology.** A collection whose entries `content()` resolved during the build and inlined into
the bundle is **prebuilt**. One whose loader runs in the serving process is **runtime-resolved**.
Both are `ContentLoader` collections; the difference is only who ran the loader. A `LiveLoader`
collection is **live** and is neither.

This is deliberately not called _prerendering_. In Pitlane that word already means
`remix({ prerender })` walking routes with `@pitlane/crawler` and writing HTML, which is a
different operation at a different layer — a prebuilt collection is data in a bundle, not a page on
disk, and the two compose rather than overlap.

#### The `ContentLoader` context

```ts
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

interface LiveEntry<Data> {
    id: string;
    data: Data;
    body?: { format: "md" | "mdx"; source: string };
}
```

A loader reads its source, calls `parseData` for each entry, and calls `store.set`.

Neither kind of loader renders. Both report the raw `source` and its `format`, and `render()`
decides what to do with it. That is what lets one `ContentLoader` serve both the build and the
runtime: the build wants the source so the bundler can compile it, and the runtime wants it so
Sätteri can. It is also why a `LiveLoader` can carry Markdown at all.

`watchedPaths` is what `content()` watches in order to rebuild the manifest in dev; it reports
directories, which is what Vite's watcher expands, and a loader that omits it is simply not
watched there. The host with no bundler watches the entries' own file paths instead, for the
reason given under **Reloading**.

`parseData` validates against the collection's schema and returns the parsed value. On failure it
throws an `Error` whose message names the collection, the entry id, the file path when there is one,
and one line per Standard Schema issue in `  - <path>: <message>` form. A prebuilt collection fails the
build; any other collection fails the access that triggered it, which is the earliest the data
exists. Live entries are validated the same way, on every query.

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
produces — so a prebuilt and a runtime-resolved collection cannot disagree about an entry's `data`. The
compiled module is used for its component, never for its metadata.

`loaders.file` reads one file holding many entries. An array result requires each item to carry a
string `id`, which is removed from `data`; an item without one throws naming its index. An object
result uses its keys as ids.

`options.satteri` configures the runtime rendering path and is forwarded to whichever Sätteri entry
point the format selects. `@pitlane/content/satteri`'s `headings` plugin is prepended to
`options.satteri.mdastPlugins` and `features.frontmatter` is forced on; everything else is the
application's. A prebuilt entry was compiled by `vite-plugin-satteri` instead, so `options.satteri`
does not apply to it — `content()` warns when both are configured, because a plugin list that only
takes effect on some hosts is a trap.

Rendering a runtime-resolved Markdown entry without `satteri` installed throws
`Rendering "<path>" needs the optional peer dependency "satteri"; install it, or add content() from @pitlane/content/vite so the build compiles this collection.`

`.mdx` rendered at runtime is Node-only by construction: the compile produces a function
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

The plugin prebuilds in four steps:

1. **Execute the entry in Node, in prebuild mode.** `createRunnableDevEnvironment` from Vite runs
   `entry` through Vite's own module runner, so TypeScript, aliases, and `vite.config.ts`
   resolution all apply. `createContent` sees the prebuild flag and populates **only** its
   `ContentLoader` collections, eagerly, with the filesystem available. A `LiveLoader` has no
   `load` to call, so the build cannot execute it even in principle — which is why the build makes
   no network calls on its behalf and needs none of its credentials.
2. **Read what loaded.** `createContent` records each populated collection on a module-scoped
   registry inside `@pitlane/content`, which the plugin reads from the same realm afterwards. The
   entry module therefore needs no particular export shape and no annotation — only to have been
   imported.
3. **Emit a manifest.** A virtual module replaces `@pitlane/content/internal/manifest`. Each entry
   contributes its `id`, `filePath`, and `data` as JavaScript literals — `Date` as
   `new Date("…")`, nested objects and arrays structurally — so a `coerce.date()` schema survives
   the trip as a `Date` rather than a string. A collection that was not prebuilt contributes nothing,
   and its absence is what tells the runtime to use the loader.
4. **Emit a module per body.** An entry with a `body` gets a virtual module whose id ends in its
   format, `\0pitlane-content/entry/<collection>/<id>.mdx`, loading as the raw source. The manifest
   imports it statically, so Vite resolves it, `vite-plugin-satteri` compiles it, and the component
   lands in the bundle. This is the step no amount of runtime cleverness can replace: a component is
   code, and only the bundler can turn source into code.

#### A live loader still runs at runtime

A `LiveLoader` an application writes itself — over a CMS, an API, a `remix/data-table` database —
is untouched by `content()`, because there is no `load` for the build to call. It behaves
identically on every host: `getCollection` calls `loadCollection`, `getEntry` calls `loadEntry`,
inside whichever request asked.

Two properties of the design exist for this case, and neither is optional.

**Nothing loads at module scope.** Cloudflare Workers rejects asynchronous I/O in global scope —
its documentation is explicit that "asynchronous tasks such as `fetch` must be executed within a
handler", and that bindings are reachable at the top level but their methods are not. Since
`createContent` is called at module scope, populating anything eagerly would make a live loader
throw `Disallowed operation called within global scope` on import, and a KV- or D1-backed loader
with it.

**The build cannot reach a live loader by accident.** Prebuilding one would run the fetch during
`vite build` and freeze whatever came back, so a post published afterwards would never appear and
nothing would report it. Under a boolean that was a mistake waiting to be made; under two
interfaces it is unrepresentable.

Snapshotting a remote source at build time is still available, and still a legitimate choice — for
a fully static site it is the point. It is expressed by writing a `ContentLoader` over `fetch`
instead, which says "one execution produces the complete answer" in the only place that claim
belongs.

What a live collection gives up is everything that depends on having the data early: its schema
violations surface per query rather than failing the build, there is no digest or memoization, and
`render()` on a Markdown body it returns needs `satteri` at runtime — which on Workers means `.md`
only, since `.mdx` evaluation needs `new Function`. Astro documents the same three limitations for
its live collections, and the third is the one people are surprised by.

**The entry module is executed at build time, so it must be importable in Node.** Collection
declarations only: no `cloudflare:workers` imports, no request-scoped state, no side effects that
need a live server. A module-level import of a CMS client is fine — what is not fine is calling it
before a request exists, which the lazy population above already rules out. This is the design's
one real constraint, it is the same constraint the prior art's config file carries, and `content()`
reports the module and the underlying error when the import fails rather than continuing with an
empty manifest.

#### Reaching a runtime with neither source

A bundled build without `content()` leaves the manifest empty, so a `ContentLoader` collection falls
through to its loader and finds no `node:fs`. That surfaces from the first access, loudly, naming
the fix:

```text
Collection "blog" has no prebuilt content and no filesystem to read.
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

**Known limitation.** A prebuilt `.md` entry has `headings: []`. `vite-plugin-satteri` emits only
`frontmatter` and an HTML string for Markdown, and the plugin has nowhere to put a heading list that
survives into the module. The workaround is `.mdx`, which is what the guide will recommend for any
page that needs a table of contents. The other three combinations — `.md` and `.mdx` rendered at
runtime, `.mdx` prebuilt — all produce headings.

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

// prebuilt by content()
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

A content file that changes while the application is running takes effect without a restart, on
both hosts. The mechanism differs because the two hosts have different watchers; the observable
behavior does not.

#### With `content()`

The plugin watches every path the loaders report through `watchedPaths()`. A change under one of
them re-executes the entry module, rebuilds the manifest, invalidates it along with the affected
body modules, and sends Vite's `full-reload` — so adding, editing, and deleting a post all take
effect. That is a strict improvement over watching the module graph, which only ever sees files
something already imported.

#### Without a bundler

`@pitlane/content/hot` exports one function:

```ts
function hotContent(content: Content<Record<string, unknown>>): Promise<void>;
```

Called once, beside `createContent`:

```ts
// app/content.ts
import { createContent } from "@pitlane/content";
import { hotContent } from "@pitlane/content/hot";
import * as loaders from "@pitlane/content/loaders";

export let content = await createContent(c => ({ ... }));

await hotContent(content);
```

That one line is correct in every environment, because `hotContent` decides for itself whether
there is anything to do. It resolves immediately, having done nothing, unless
`process.env.REMIX_NODE_HMR` is set, meaning the process is supervised by `remix/node-hmr`. A
production `start` and a Worker take that path, so nothing about shipping changes and
`remix/node-hmr/runtime` is never imported outside development. The import is dynamic for the
same reason `satteri` is: a static one would follow the package into every bundle.

Within a supervised process it watches the collections that have files to watch: a
`ContentLoader` collection reading from a manifest has none, and a `LiveLoader` never reports a
path, so both are skipped without being special-cased — they simply contribute nothing.

When it does apply, `hotContent` opens its own `BrowserHmrChannel` through
`createBrowserHmrChannel()` from `remix/node-hmr/runtime` and subscribes to each eligible
collection. **Registration follows population rather than preceding it.** A collection that
nothing has read yet has loaded no files, so there is nothing to watch; `hotContent` is called
one line after `createContent`, before any request, and registering there would register an
empty set. Each collection instead reports its file set every time it finishes populating, and
`hotContent` sends the delta to `updateWatchedFiles()` — the first read of a collection is what
puts its files under the watcher, and every reload refreshes them.

The file set is the entries' own `filePath`s, resolved against the content root, not the
directories `watchedPaths()` reports. The supervisor matches a file event against the exact paths
a channel registered, so a directory registers nothing that can ever match: `content()` watches
directories because Vite's watcher expands them, and this host cannot. The consequence is the
limitation below — a file that no entry came from is not watched, and a file that does not exist
yet came from no entry.

On an event the supervisor forwards:

1. Discard the affected collection's memoized population, so the next read re-runs its loader.
2. Return `{ type: "reload" }`, which the browser HMR client turns into a page reload.

A reload does not re-register anything by hand. The population it triggers reports its own file
set, which is how a post that was renamed or deleted leaves the watch set and a rebuilt
collection keeps it honest.

The channel is the process's existing watcher rather than a second one. `updateWatchedFiles` adds
the files to the parent's chokidar instance, which already watches the server's module graph, and
the supervisor forwards their events to this channel's handler. No new dependency and no new
watcher: a collection of a thousand files contributes a thousand paths to a watcher that is
already running.

Invalidation is per collection, not global. Two collections that share a directory both reload
when a file under it changes; a collection whose files did not change keeps its population and its
render cache.

What `hotContent` reaches for is an internal handle, not a public method: each `ContentLoader`
collection carries a symbol-keyed `{ invalidate(), onPopulated(listener) }` beside its queries,
named in `symbols.ts` alongside the two the prebuild channel already uses. `onPopulated` is how
the file set arrives without `hotContent` forcing a load, and `invalidate` is the only way to
discard one. The public `Collection` type grows neither — a collection that can be emptied by
anyone holding it is a different contract from the one this proposal specifies, and nothing
outside development should want it.

A reload that fails behaves exactly as a first load that fails: the memoized population stays
discarded, the error surfaces at the next read rather than at the watcher, and fixing the file
reloads it again. An author who saves a post with broken frontmatter sees the error on the page,
not in a terminal they were not watching.

**Editing works. Adding a file does not, on this host.** The supervisor forwards a file event only
when the path is one the channel registered, and a file that does not exist yet cannot be
registered — so creating a post is invisible until the process restarts, while editing or deleting
one is not. This is a property of `remix/node-hmr`, not a choice here: `add` and `unlink` events
are filtered against the registered set exactly as `change` events are. The guide says so plainly
rather than letting an author discover it, `content()` has no such gap, and **Future directions**
records the upstream change that would close it.

The page reloads rather than refreshing in place. A soft refresh — re-fetching the top frame and
reconciling, the way a hot-accepted server module behaves — is not reachable: the browser HMR
client dispatches exactly three payloads, and only `server:update`, which the supervisor emits
after a restart it performed itself, reaches an application listener. A channel event can be
`reload` or a module update, and content is not a module on this host.

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
| Nothing about how content reaches a Worker                             | `content()` prebuilds the collections at build time                    | The published sample only shows filesystem loaders, which cannot run on Cloudflare Workers, the flagship target.                                  |

## Implications on adoption

Adopting `@pitlane/content` means installing it and writing one module that calls `createContent`.
Markdown or MDX adds `satteri` and `vite-plugin-satteri`, plus
`satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()] })` before `remix()`. A
collection of `.json` or `.yaml` files needs none of that.

An application served without a bundler adds `await hotContent(content)` beside `createContent`
if it wants a content edit to reach the browser while it runs. It is one line, it is safe in
production, and skipping it costs a restart per edit rather than an error.

Any target without a filesystem — Cloudflare Workers above all — additionally needs `content()` in
the Vite config, and its collections declared in a module that imports cleanly in Node. The
collections themselves do not change.

Version floors: `remix@^3.0.0-rc.1`, `vite@^8` for `content()`, and `satteri@^0.9.4` when Markdown
renders at runtime.

Adoption is reversible. Nothing is generated into the repository, no file is written outside
`packages/content`, and no directory layout is imposed — content lives wherever the loader is
pointed. Removing the package means deleting the module that calls `createContent`.

## Scope

- A new `packages/content` with the five public entry points above, built and tested with Vite+ in
  the same shape as `packages/crawler`.
- `createContent`, the collection and entry surface, reference resolution, and schema validation
  with its error reporting.
- Lazy per-collection population: memoized on success, retried after a failure, one in-flight load
  shared by concurrent callers, and no I/O at module scope on any host.
- The two loader interfaces, the structural discrimination between them, and the `glob` and `file`
  implementations of `ContentLoader`, reporting raw bodies rather than rendering them.
- Lazy `render()` over both a prebuilt module and a runtime Sätteri call, producing the same
  `{ Content, headings }` either way.
- Resolution of an MDX entry's own `import`s on the runtime path, so a component an MDX file imports
  renders on a host with no bundler, and a `clientEntry` component among them hydrates through the
  application's asset server.
- `content()`: executing the entry through Vite's module runner in prebuild mode, prebuilding only
  `ContentLoader` collections, the manifest and body virtual modules, the watch-and-rebuild path, and
  the loud failure when neither source exists.
- The `headings` Sätteri plugin, shared by both rendering paths, and the `satteri` pass-through that
  lets `satteri-expressive-code` configure the runtime one.
- `hotContent`: the development watcher for a host with no bundler — the channel it opens, the
  files it registers, per-collection invalidation through the internal handle, the reload it
  returns, and the no-op path every other environment takes.
- **Two demos, one application surface each, proving the API does not change with the
  environment.** `demos/content-vite` runs `@pitlane/dev` with `content()` and
  `vite-plugin-satteri`; `demos/content-runtime` runs no bundler at all, serving browser modules
  through `remix/assets` and rendering content with `satteri` at request time. Both declare the
  same collections with the same `loaders.glob` and `loaders.file` calls, and each must serve
  Markdown, MDX, and JSON. Each MDX entry imports two components — one server-only, one
  `clientEntry` — so both demos prove component imports work on both hosts. `demos/content-runtime`
  must also pick up an edit to a `.md`, `.mdx`, and `.json` entry under its own `dev` command,
  without a restart. The bundled demo cannot demonstrate the same thing, because `vp dev` fails
  for it on a pre-existing plugin defect filed as issue #19; `content()`'s watch path is covered
  instead by `tests/reload.test.ts`, which drives a real Vite dev server through an add, a
  delete, an edit, and a broken edit. They are the proof the unification is real rather than
  described, and a diff of their `app/content.ts` files is the reviewable artifact.
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
- **Incremental prebuilding.** The plugin re-executes the entry module on a content change rather than
  diffing entries. The prior art carries a per-entry digest for this; it is worth adding when a
  real collection makes rebuild latency visible, and guessing at that now would be premature.
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
- **A watcher this package owns.** `hotContent` contributes files to the watcher the host already
  runs, and does nothing on a host that runs none. A `chokidar` dependency, or an `fs.watch` loop
  of our own, would give `@pitlane/content` a second opinion about which files matter and a
  lifecycle nobody asked it to manage.
- **Refreshing a page in place on a content change.** Both hosts reload. Re-rendering without
  losing browser state needs an application-level event, and on a host with no bundler the HMR
  client has nowhere to deliver one. Reloading on both is the behavior that is the same on both.
- **Reloading in production.** `hotContent` is a development affordance. A content change on a
  running production server is revalidation, which is excluded above and belongs with
  `@pitlane/cache`.

## Preview

- Artifact: the pkg.pr.new build from `pkg-preview.yml` —
  `npm i https://pkg.pr.new/pitlane-tools/pitlane/@pitlane/content@<sha>`
- Reason: the change is a package's behavior, and the only way to know the API is usable is to
  install it and query a collection. `pkg-preview.yml` already publishes on every branch push, so
  the artifact costs a push. It needs one line added to that workflow's package list. Reviewing the
  guide instead would show the API described rather than the API working, and the inference-driven
  typing in particular is only real in an editor against an installed build.
- The two demos are the second half of the preview, and the half that exercises the claim this
  design is built around. Run `demos/content-vite` and `demos/content-runtime` side by side, see
  Markdown, MDX, and JSON served by both, and diff their `app/content.ts`. If that diff is empty,
  the API does not change with the environment. If it is not, this proposal is wrong.
- Reloading is exercised in the same pass, and it is the part worth doing by hand. Run
  `pnpm dev` in `demos/content-runtime`, edit a post's frontmatter, its body, and the authors
  file, and watch each page come back with the change while the terminal shows no restart. Then
  create a post and watch nothing happen, which is the limitation this proposal asks to ship.

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
  uniformly across `.md` and `.mdx`. It is not here because a prebuilt `.md` entry arrives as a string
  from `vite-plugin-satteri`, so the two paths could not agree on it.
- Headings for a prebuilt `.md` entry, once `vite-plugin-satteri` can surface a compile's data bag or
  extra exports for Markdown. That is an upstream capability, not something this package can add
  from the outside, and it is the last output difference between the two rendering paths.
- Per-entry digests, so a content change rebuilds only what changed.
- A newly created content file reloading on a host with no bundler, once `remix/node-hmr` can
  forward an `add` inside a directory it is already watching, or expose a way to publish an event
  to browser clients directly. Either closes the gap from the outside; `hotContent` would register
  the directories instead of the files and lose its special case. Worth raising upstream with the
  demo as the reproduction.
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
- **A `prebuild?: boolean` on one loader interface.** What this proposal specified before Astro's
  design was read: one `ContentLoader`, with a flag saying whether the build may resolve it.
  Rejected because a flag puts the claim in the wrong place. It is a second declaration that can
  disagree with the loader's actual behavior, it invites configuring a loader into lying, and it
  forces a defaults argument — false is safe for remote loaders and wrong for filesystem ones, so
  either choice mis-serves half its users. Two interfaces carry the same information in the one
  place that cannot be inconsistent with itself: a loader that can be resolved once exposes a way
  to resolve it once.
- **Astro's split query API.** Astro pairs its two loader kinds with two query APIs —
  `getCollection()` against the data store, `getLiveCollection()` against a live loader — because,
  in its words, this ensures "you always know which type of collection you are working with". The
  loader split is adopted; the query split is not. Astro's reasoning is sound for Astro, where a
  build-time collection genuinely cannot fail at request time and a live one cannot render MDX at
  all. Here both are already async and already able to throw, and the MDX restriction is a property
  of the host rather than of the collection — `.mdx` renders at runtime on Node and not on Workers,
  whichever loader produced it. Splitting the query API would therefore encode a distinction that
  is not true at that layer, and it would break the property this proposal is for: a controller
  that reads `content.blog` should not have to know how `blog` gets its bytes.
- **Inferring the kind from the environment.** Decide at runtime: prebuild when a bundler is present,
  go live when it is not. Rejected because the environment does not know the answer. Whether a CMS
  should be snapshotted per release or read per request is a product decision, and the same
  application may want both from the same CMS in different collections.
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
  can just do. Prebuilding the loaders' own output has no such constraint.
- **Resolving a glob at runtime inside the loader.** The shape this design wants most:
  `loaders.glob` calls `import.meta.glob(options.pattern)` itself. It does not work, and it fails in
  the worst available way. `import.meta.glob` is a compile-time rewrite whose pattern must be a
  literal in the module being transformed, so a pattern arriving as a function argument inside a
  dependency resolves to nothing. Measured against Vite 8.1.4: a module reading
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
- **`hotContent` taking the channel as an argument.** `hotContent(content, channel)` would let the
  application share the one its asset server already opened, saving a second EventSource
  registration. Rejected because it puts `createBrowserHmrChannel` and its
  `process.env.REMIX_NODE_HMR` guard in every application's content module, to save an object the
  supervisor is designed to hand out per owner. Channels are independent by contract and are
  closed by whoever opened them; the package opening its own is the shape that matches.
- **Wiring the watcher inside `createContent` with no second call.** One fewer line for the
  application, and the line it removes is the one that is easy to forget. Rejected because
  `createContent` is the isomorphic entry point: giving it a branch that reaches for
  `remix/node-hmr/runtime` puts a Node-only import behind a runtime condition in the module every
  Worker bundle contains, and bundlers disagree about whether that is reachable. A separate entry
  point is the only way the dependency is provably absent from a production bundle.
- **A digest per entry, so a reload re-reads only the file that changed.** The same argument as
  incremental prebuilding, and the same answer: a collection small enough to fit an editor's
  attention re-reads in milliseconds, and the machinery costs more than it saves until a real
  collection makes the latency visible.
- **Holding the whole feature until `remix/node-hmr` can forward a directory's `add`.** It would
  ship one behavior instead of one behavior with a footnote. Rejected on the human's decision: it
  trades a rare annoyance for a constant one, because until then every content edit on a host
  with no bundler needs a restart, and it makes this package's release wait on someone else's.
  The asymmetry ships documented, and **Future directions** records what closes it.

## Open questions

None. The one that was open — whether to ship without a reload when a content file is created on
a host with no bundler — was decided in favor of shipping it, documented in the guide and in
**Reloading** above.

## Acknowledgments

[Astro's content layer](https://docs.astro.build/en/guides/content-collections/) is where this
design's central idea comes from. Astro distinguishes an
[object loader](https://docs.astro.build/en/reference/content-loader-reference/) implementing
`load()` against a data store from a
[live loader](https://docs.astro.build/en/reference/content-loader-reference/#the-liveloader-object)
implementing `loadCollection()` and `loadEntry()`, and that structural split is what lets a
collection's nature be stated once — by the contract it satisfies — instead of configured. Its
`renderMarkdown` loader-context helper, and its `retainBody` and `deferRender` options, also shaped
how bodies and rendering are separated here.

[`@withsprinkles/content-layer`](https://github.com/withsprinkles/content-layer) by Mark Malstrom is
the prior art this proposal is measured against, and its loading mechanism is adopted rather than
reinvented: run the loaders in Node at build time, serialize the entries, and carry each Markdown
body into the bundle as a virtual module the bundler compiles. Its loader contract, `reference()`
schema, and Remix MDX component wrapper are all carried forward too. Its collection model in turn
follows Astro's.

[Sätteri](https://satteri.bruits.org), from the [Bruits](https://bruits.org) collective, is the
Markdown and MDX engine on both rendering paths. Its `after` lifecycle hook, documented with a
table-of-contents example, is what lets one plugin serve both.

[TanStack Markdown](https://github.com/TanStack/markdown) and
[TanStack Highlight](https://github.com/TanStack/highlight) were evaluated for the streaming case
and shaped **Future directions**; their published bundle sizes and AI streaming profile are what
made it clear that case wants its own engine rather than a setting on this one.

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
cross-referenced collections a Remix controller can query. Content is defined at runtime with
`createContent`, so there is no config file, no virtual module, and no generated types.

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
  does this job well and was written for exactly this gap. It is a Vite plugin: content is declared
  in `app/content.config.ts`, queried through a `sprinkles:content` virtual module, and typed by a
  `.d.ts` file the plugin writes into `.sprinkles/`. That shape works, and the cost is that the
  package cannot run outside Vite at all, the module specifier resolves to nothing a reader can
  open, and the types are a build artifact rather than an inference.

None of the three gives the two things a content layer exists to provide: **the frontmatter is
validated against a schema**, and **one entry can reference another**. VISION.md has published an
API for this since the package list was written, and nothing implements it.

## Proposed solution

Ship `@pitlane/content` as a runtime package. Collections are built by a function, validated by
`remix/data-schema`, and read through the object that function returns:

```ts
import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

export let content = await createContent(c => ({
    blog: c.collection({
        loader: loaders.modules(import.meta.glob("./content/blog/*.mdx", { eager: true }), {
            base: "./content/blog",
        }),
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

The **loader is the portability seam**. `loaders.modules` is handed a record the bundler already
resolved, so its content is inlined and the collection works on Cloudflare Workers with no
filesystem and no cold-start I/O. `loaders.glob` and `loaders.file` read `node:fs` instead, for
container hosts, for the dev server, and for scripts. Both produce the same entries, and swapping
one for the other is the only edit a host change requires.

[Sätteri](https://satteri.bruits.org) is the Markdown engine on both paths, composed rather than
wrapped: `vite-plugin-satteri` compiles the bundled path, and the `satteri` package renders the
filesystem path.

```text
a .mdx file gains a heading → content.blog.getEntry(slug) → render() → { Content, headings }
```

## Detailed design

### Package shape

`@pitlane/content`, at `packages/content`, with three entry points:

| Entry point                | Exports                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pitlane/content`         | `createContent`, and the `Collection`, `CollectionEntry`, `ContentLoader`, `LoaderContext`, `LoadedEntry`, `Reference`, `Heading`, `RenderedEntry` types |
| `@pitlane/content/loaders` | `glob`, `file`, `modules`                                                                                                                                |
| `@pitlane/content/satteri` | `headings`, a Sätteri MDAST plugin                                                                                                                       |

`dependencies` is `{ "yaml": "^2" }` — YAML frontmatter and `.yaml` data files need a parser, and
neither Remix nor the platform provides one. `remix` is a peer dependency. `satteri` is an
**optional** peer dependency (`^0.9.4`, caret-pinned because Sätteri is pre-1.0 and breaks on minor
bumps): only `@pitlane/content/loaders`' filesystem paths and `@pitlane/content/satteri` import it,
so an application that loads content through `loaders.modules` never installs it.

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

- `createContent` calls `build` once, then runs every collection's loader **concurrently** and
  awaits all of them. It resolves once every entry is loaded and validated.
- It returns an object with one property per key in `build`'s return value. Each is a `Collection`.
- If a collection's loader throws, `createContent` rejects with that error, annotated with the
  collection name. Loading is all-or-nothing: a half-populated content object is never returned.
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
  depend on filesystem or glob ordering.
- `getCollection(filter)` returns the entries for which `filter` returns a truthy value, in the same
  order.
- `getEntry` accepts a bare id or a reference object. Given `{ collection, id }` it ignores
  `collection` — the receiver already fixes it, and the type parameter is what prevents passing a
  `Reference<"blog">` to `content.authors.getEntry`. It resolves to `undefined` for an unknown id.
- Both methods are `async` because that is the API VISION.md publishes and because `render` must be
  async regardless. They resolve from memory.

### `render`

`render()` resolves to a `Content` component and the entry's headings.

- For an entry whose rendered source is a **component** (any `.mdx` file), `Content` is a Remix
  factory wrapping the compiled MDX function: `handle => () => MDXContent(handle?.props ?? {})`.
  MDX compiles to a plain function of props, while a Remix component is a factory that returns a
  render function, so the wrapper is what bridges the two. Props passed to `<Content />` reach the
  MDX content, which is how `components` overrides work.
- For an entry whose rendered source is **HTML** (any `.md` file), `Content` renders a single
  `<div>` carrying the HTML through `remix/ui`'s `innerHTML` prop. The wrapper element is
  unavoidable: `innerHTML` is an element prop, so the markup needs an element to land on.
- For an entry with **no** rendered source — every entry a `file` loader produces, and every
  `.json`, `.yaml`, or `.yml` entry a `glob` loader produces — `render()` rejects with
  `Entry "<collection>/<id>" has no renderable content.` It does not resolve to an empty component:
  calling `render()` on a data entry is a mistake, and hiding it produces a blank page instead of an
  error.

### The loader contract

```ts
interface ContentLoader {
    name: string;
    load(context: LoaderContext): Promise<void> | void;
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
    rendered?: { kind: "component"; component: MdxContent } | { kind: "html"; html: string };
    headings?: Heading[];
}
```

A loader reads its source, calls `parseData` for each entry, and calls `store.set`. The interface is
public, so an application can write a loader over a database, a CMS, or anything else, and three
implementations ship.

`parseData` validates against the collection's schema and returns the parsed value. On failure it
throws an `Error` whose message names the collection, the entry id, the file path when there is one,
and one line per Standard Schema issue in `  - <path>: <message>` form. `createContent` therefore
fails on the first invalid entry rather than skipping it.

Two loaders calling `store.set` with the same `id` is a conflict, not a merge: the second call
throws `Duplicate entry id "<id>" in collection "<collection>".`

### `loaders.modules` — the bundled path

```ts
loaders.modules(modules: Record<string, unknown>, options?: { base?: string; generateId?: (path: string) => string }): ContentLoader
```

Takes the record `import.meta.glob(pattern, { eager: true })` returns. Because the argument is a
plain record, the loader has no bundler dependency and its tests pass object literals.

- The default id is the record key with `options.base` (when given) and the file extension stripped,
  and any leading `./` or `/` removed. `options.generateId` replaces that derivation and receives
  the raw key.
- Each value is read as a module namespace:
    - `frontmatter`, when present, is the entry's unvalidated data; otherwise `{}`.
    - `default` being a function means a component entry. `default` being a string means an HTML
      entry. Any other `default` throws
      `Module "<key>" exports a default of type <type>; expected a component or an HTML string.`
    - `headings`, when present and an array, becomes the entry's headings; otherwise `[]`.
      These are exactly the shapes `vite-plugin-satteri` emits: `.mdx` compiles to
      `export const frontmatter` plus a component default, and `.md` to `export const frontmatter` plus
      an HTML-string default.
- A record value that is itself a function is a non-eager glob. That case throws
  `loaders.modules requires import.meta.glob(..., { eager: true }).` rather than treating the
  importer as a component. Lazy globs are not supported: `getCollection` would have to await every
  module to expose `data`, which is what eager loading already does, only later.

### `loaders.glob` — the filesystem path

```ts
loaders.glob(options: {
    pattern: string | string[];
    base?: string;
    generateId?: (options: GenerateIdOptions) => string;
    satteri?: CompileOptions;
}): ContentLoader
```

Walks `base` (default `.`) with `node:fs/promises`' `glob`, resolving each pattern against it. The
default id is the path relative to `base` with its extension stripped and `\` normalised to `/`.

| Extension       | Behavior                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `.md`           | `satteri.markdownToHtml` with `features: { frontmatter: true }`; YAML frontmatter becomes `data`, the HTML becomes an `html` rendered source   |
| `.mdx`          | `satteri.evaluate` with `remix/ui/jsx-runtime`; the module's `frontmatter` becomes `data` and its default export a `component` rendered source |
| `.json`         | `JSON.parse`; the parsed object is `data`, and the entry has no rendered source                                                                |
| `.yaml`, `.yml` | parsed with `yaml`; the parsed object is `data`, and the entry has no rendered source                                                          |
| anything else   | skipped                                                                                                                                        |

`options.satteri` is forwarded to whichever Sätteri entry point the extension selects, so a
filesystem collection configures the engine exactly as the bundled path configures
`vite-plugin-satteri`. `@pitlane/content/satteri`'s `headings` plugin is prepended to
`options.satteri.mdastPlugins`, and `features.frontmatter` is forced on; everything else is the
application's.

Encountering a `.md` or `.mdx` file without `satteri` installed throws
`Rendering "<path>" needs the optional peer dependency "satteri"; install it, or load this collection with loaders.modules.`

`.mdx` on this path is Node-only by construction: `satteri.evaluate` compiles to a function body and
runs it through `new Function`, which Cloudflare Workers forbids. That is not a new restriction —
the loader already needs `node:fs` — but it is the reason `loaders.modules` exists.

### `loaders.file` — a single data file

```ts
loaders.file(fileName: string, options?: { parser?: (text: string) => Record<string, unknown> | unknown[] }): ContentLoader
```

Reads one file containing many entries. `.json` is parsed with `JSON.parse`, `.yaml` and `.yml` with
`yaml`, and any other extension requires `options.parser`; without one it throws
`No parser for "<ext>"; pass options.parser to loaders.file.`

An array result requires each item to carry a string `id`, which is removed from `data`; an item
without one throws naming its index. An object result uses its keys as ids. Entries from this loader
never have a rendered source.

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

One plugin serves both paths, which is what makes them agree:

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { headings } from "@pitlane/content/satteri";
import satteri from "vite-plugin-satteri";

export default defineConfig({
    plugins: [
        satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()] }),
        remix(),
    ],
});
```

`jsxImportSource: "remix/ui"` is required, and `satteri()` must precede `remix()`.

**Known limitation.** A `.md` file loaded through `loaders.modules` has `headings: []`.
`vite-plugin-satteri` emits only `frontmatter` and the HTML string for Markdown, and the plugin has
nowhere to put a heading list that survives into the module. The workaround is `.mdx`, which is what
the guide will recommend for any page that needs a table of contents. The other three combinations —
`.md` and `.mdx` through `loaders.glob`, `.mdx` through `loaders.modules` — all produce headings.

### Code highlighting

`@pitlane/content` owns no highlighting API. Highlighting is a Sätteri HAST plugin the application
supplies, and both loading paths already accept one, so the supported answer is
[`satteri-expressive-code`](https://github.com/bruits/satteri/tree/main/packages/satteri-expressive-code)
— the Sätteri equivalent of `rehype-expressive-code`, giving
[Expressive Code](https://expressive-code.com) frames, line markers, and a copy button over
[Shiki](https://shiki.style) themes:

```ts
import expressiveCode from "satteri-expressive-code";

let code = expressiveCode({ themes: ["github-dark", "github-light"] });

// bundled path
satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()], hastPlugins: [code] });

// filesystem path
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
exists: collections load concurrently, so the referenced collection may not have finished when the
reference is validated. An unresolvable reference surfaces as `getEntry` resolving to `undefined`.

### Reloading

There is none, beyond what Vite already does. `loaders.modules` is part of the module graph, so
editing a `.mdx` file invalidates the content module and the dev server reloads it. `loaders.glob`
and `loaders.file` read the filesystem once at startup, so a content change needs a restart. No
watcher, no cache invalidation, and no digest tracking ships here.

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
| Nothing about how content reaches a Worker                             | `loaders.modules` is the bundled path                                  | The published sample only shows filesystem loaders, which cannot run on Cloudflare Workers, the flagship target.                                  |

## Implications on adoption

Adopting `@pitlane/content` means installing it, and — for Markdown or MDX — also `satteri` and
`vite-plugin-satteri`, adding `satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()] })`
before `remix()`, and writing one module that calls `createContent`. A collection of `.json` or
`.yaml` files needs none of the Sätteri setup.

Version floors: `remix@^3.0.0-rc.1` and, when Markdown is used, `satteri@^0.9.4`.

Adoption is reversible. Nothing is generated, no file is written outside `packages/content`, and no
directory layout is imposed — content lives wherever the loader is pointed. Removing the package
means deleting the module that calls `createContent`.

## Scope

- A new `packages/content` with the three entry points above, built and tested with Vite+ in the
  same shape as `packages/crawler`.
- `createContent`, the collection and entry surface, reference resolution, and schema validation
  with its error reporting.
- The `ContentLoader` interface and the `glob`, `file`, and `modules` implementations.
- The `headings` Sätteri plugin, shared by the filesystem and bundled paths, and the plugin
  pass-through that lets `satteri-expressive-code` configure both.
- `docs/guides/content.md`, covering both paths, the Sätteri setup, code highlighting with
  Expressive Code, and references.
- A README and CHANGELOG for the package, and its TypeDoc config in `.typedoc/` plus its line in
  the `docs:api` task.

### Out of scope

- **A `content()` Vite plugin, a `content.config.ts`, a virtual module, or generated types.** The
  runtime API is the whole point; a build-time duplicate of it is a second way to do the same thing.
- **Images in frontmatter.** The prior art's `SchemaContext.image()` is a stub there and belongs
  with `@pitlane/image`, which is separately sequenced in VISION.md.
- **Incremental loading, digests, and content caching.** The prior art carries a digest per entry to
  skip unchanged files. There is no cache to invalidate here, so there is nothing for a digest to
  do yet.
- **A file watcher.** Vite already reloads the bundled path, and a watcher over the filesystem path
  is a second reload mechanism for a case the dev server does not have.
- **Remote and database loaders.** The `ContentLoader` interface is public so they can be written;
  shipping one before a caller exists is an interface built for nobody.
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
- `VISION.md`, Development principle 3, **Runtime When Possible** — honored. `createContent` and
  every query are plain runtime calls, and the package's core tests pass object literals to
  `loaders.modules` with no bundler. Vite is an optional producer of those objects, never a
  prerequisite.
- `VISION.md`, Development principle 4, **Avoid Dependencies** — one runtime dependency, `yaml`,
  for frontmatter and `.yaml` files. Sätteri is optional and composed rather than wrapped, so it is
  the application's dependency and version choice. The slugger the prior art took from
  `github-slugger` is implemented here instead, because it is a dozen lines.
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
  uniformly across `.md` and `.mdx`. It is not here because it is a second renderer for output the
  bundled path cannot produce — `vite-plugin-satteri` emits a string.
- Headings for `.md` on the bundled path, once `vite-plugin-satteri` can surface a compile's data
  bag or extra exports for Markdown. That is an upstream capability, not something this package can
  add from the outside.
- Loaders over remote sources, once an application needs one.
- A `@pitlane/content` integration in the target templates, sequenced by
  `.agents/skills/adopting-packages-into-templates/`.

### Runtime and streaming Markdown

A separate capability, investigated while writing this proposal and deliberately not built here:
rendering Markdown that is **still being written**, as when a model streams a response into the
page. Recording the findings so the next proposal does not start from nothing.

It is a different problem. This package resolves a fixed set of files once, at startup, and every
engine choice above follows from that. A streamed response is one string that grows, re-rendered
tens of times a second, with trailing constructs that are syntactically incomplete at every
intermediate step — a half-typed `**bold`, a fence with no closer.

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
not a complete CommonMark, GFM, or MDX implementation, so it is a poor fit for the static path and
a good one here. [TanStack Highlight](https://github.com/TanStack/highlight) pairs with it:
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

- **Port the prior art's Vite plugin.** Keep `@withsprinkles/content-layer`'s shape — a plugin, a
  `content.config.ts`, a `sprinkles:content` virtual module, a generated `.d.ts` — and swap Sätteri
  in for `@mdx-js/rollup`. It is proven, it has one loading mode, and it gets HMR for free. Rejected
  because it contradicts the `createContent` API VISION.md publishes and Development principle 3,
  because a generated `.d.ts` can go stale in a way inference cannot, and because the package would
  be unusable outside Vite.
- **Filesystem loaders only, with no bundled path.** The most literal reading of VISION.md's sample:
  `createContent` on the server, `node:fs` everywhere, no `import.meta.glob`. Simpler, one loading
  mode, no Vite-ism at the call site. Rejected because Cloudflare Workers has no filesystem, so the
  flagship target could serve content only through prerendered routes, and because MDX would be
  impossible to support portably.
- **Filesystem loaders that never render, with all Markdown going through the bundler.**
  `@pitlane/content` would ship zero runtime dependencies and exactly one rendering path. Rejected
  because rendering Markdown outside Vite is worth supporting and because VISION.md's
  `loaders.glob` over `.md` files would have to be withdrawn rather than corrected.
- **Injecting a renderer: `createContent(build, { renderer })`.** Keeps the core dependency-free
  while still supporting filesystem Markdown. Rejected as an interface built for a second caller
  that does not exist, at the cost of an extra argument in every application's content module.
- **Checking `c.reference("x")` against sibling collection keys at definition time.** The keys are
  not known inside the builder callback, so this needs either a two-call API or the codegen the
  prior art uses. The runtime check after `build` returns catches the same typo at startup, and the
  type parameter catches a mismatched reference at the use site.
- **TanStack Markdown as this package's engine.** A 5.0 KB gzip parser with zero dependencies that
  runs anywhere, including a Worker, would remove the optional peer dependency and both of the
  Node-only branches. Rejected because it does not implement MDX, and a content layer that cannot
  put a component in a post is not the capability VISION.md describes. It states plainly that it is
  not a complete CommonMark, GFM, or MDX implementation and spends its budget on determinism and
  size instead — the right trade for a streamed response, the wrong one for a blog archive.

## Open questions

None.

## Acknowledgments

[`@withsprinkles/content-layer`](https://github.com/withsprinkles/content-layer) by Mark Malstrom is
the prior art this proposal is measured against; its loader contract, `reference()` schema, and
Remix MDX component wrapper are all carried forward. Its collection model in turn follows
[Astro's content layer](https://docs.astro.build/en/guides/content-collections/).

[Sätteri](https://satteri.bruits.org), from the [Bruits](https://bruits.org) collective, is the
Markdown and MDX engine on both loading paths. Its `after` lifecycle hook, documented with a
table-of-contents example, is what lets one plugin serve both.

[TanStack Markdown](https://github.com/TanStack/markdown) and
[TanStack Highlight](https://github.com/TanStack/highlight) were evaluated for the streaming case
and shaped **Future directions**; their published bundle sizes and AI streaming profile are what
made it clear that case wants its own engine rather than a setting on this one.

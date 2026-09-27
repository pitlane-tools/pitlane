# @pitlane/content

## 0.2.2

### Patch Changes

- 6be8e56: Documentation only. No code changed.

    - Every README now says where the documentation is published as Markdown for AI agents and other LLM tools: `https://pitlane.tools/llms.txt` indexes every page, `https://pitlane.tools/llms-full.txt` holds them all in one file, and any page URL with `.md` appended returns that page as Markdown.
    - The `@pitlane/content` README gains the Vite setup the content guide describes. That setup covers the `satteri` and `vite-plugin-satteri` dev dependencies, and a `vite.config.ts` registering `satteri()` with `jsxImportSource: "remix/ui"`, `headings()`, `rawStyles()`, and `contentLayer()` before `remix()`. Before this, the README named `contentLayer()` but not the plugins it has to sit beside, and an MDX file compiled without `jsxImportSource: "remix/ui"` is a React component rather than a Remix one.
    - The `@pitlane/content` entry-point table lists `@pitlane/content/hot`, and the README describes the four `@pitlane/content/internal/*` entry points as internal and unstable, with what each one is for: reuse by a plugin for a bundler other than Vite.

- d4dfade: Documentation comments, plus two type-only exports from `@pitlane/content`. No runtime behavior changed.

    - `@pitlane/content` now exports the `Content` and `ReferenceSchema` types. `Content<T>` is what `createContent()` returns, and `ReferenceSchema<C>` is what `c.reference(collection)` returns. Both already appeared in those signatures; now code can import them by name.
    - The TSDoc that editors show and the reference at pitlane.tools is built from now covers more. `remix()` and `createContent()` have examples. The package entry points and the main functions link to their guides. `RemixPluginOptions`, `PrerenderConfig`, `PrerenderOption`, `CrawlOptions`, `D1DatabaseOptions`, `D1DriverOptions`, `D1Meta`, `D1PreparedStatement`, and `D1Result` have summaries. Every `@pitlane/content` entry point and the `@pitlane/theme/default` and `@pitlane/theme/dtcg` entry points have module summaries.
    - `loaders.file()` describes the file shapes it accepts and when `options.parser` is required. `ThemeResult.extend()` describes what its patch may hold. `DefaultTheme` lists its top-level token groups.

    `@pitlane/dev/assets` documents each `?assets` import form and `pitlane:dev`, and has its own reference page.

## 0.2.1

### Patch Changes

- f2fa73e: Read a heading's `text`, and the `id` made from it, from what the heading shows on the page. Three kinds of heading change, and an anchor written by hand against one of them needs checking once:

    - Inline HTML now contributes its words and not its tags. `## <span>Visible</span> text` was `<span>Visible</span> text` with the `id` `spanvisiblespan-text`, and is now `Visible text` with `visible-text`.
    - An image no longer contributes its alt text, which matches GitHub and Astro. `## [A](url) ![Cat photo](cat.png)` was `a-cat-photo` and is now `a-`, keeping the space before the image as GitHub does.
    - In MDX, an expression that is a single string literal now contributes its value. `## Hello {"world"}` was `hello-` and is now `hello-world`, and `## The {"{"} key` reads `The { key`. Any other expression, such as `{name}`, still contributes nothing.

    Headings without inline HTML, images, or expressions keep their `text` and `id`.

## 0.2.0

### Minor Changes

- 87ec1f6: Give headings the ids GitHub gives them. `headings()` now lowercases a heading, removes every character outside letters, marks, digits, and connector punctuation, and turns each space into a hyphen without collapsing or trimming any of them — the algorithm GitHub uses, and the one Astro's `rehype-heading-ids` uses through the same `github-slugger` package. `## Databases & Data Loading` was `databases-data-loading` and is now `databases--data-loading`; `## Jenni’s Quesadillas` was `jenni-s-quesadillas` and is now `jennis-quesadillas`.

    A heading containing punctuation or symbols can therefore get a different `id` than it did before — `## Hello World!` keeps `hello-world`, but `## Databases & Data Loading` does not — so an anchor written by hand against the old ids needs checking once. In exchange, a table of contents carried over from GitHub or Astro keeps landing without being rewritten. A heading that slugs to nothing at all, such as `## 🎉`, still falls back to `heading` rather than to the empty `id` GitHub produces, and a later `## Heading` in the same document then takes `heading-1`.

### Patch Changes

- f8b0db5: Keep content prebuilds from deleting the running app's optimized browser dependencies. This fixes `504 (Outdated Optimize Dep)` errors that could leave MDX updates and client-side navigation broken until the dev server restarted.
- 98e8a77: Vite no longer warns that it cannot analyze a dynamic import in `@pitlane/content` when an app using `contentLayer()` starts its dev server. The runtime import of a document's resolved dependencies is now marked `/* @vite-ignore */`, since its target is only known at request time.

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

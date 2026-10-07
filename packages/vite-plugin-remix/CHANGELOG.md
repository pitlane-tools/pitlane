# @pitlane/vite-plugin-remix

## 0.7.1

### Patch Changes

- eec2d66: `remix()` now inlines `pitlane/dev/runtime` into a server build the way it inlines `@pitlane/dev/runtime`, so an app importing the runtime through the `pitlane` umbrella never imports `@pitlane/dev` at run time.
- 387d556: Documentation only. No code changed.

    The README's compatibility table now lists what CI tests: Vite 8 (the latest 8.x), Vite+ 1.0, and Node 26. Its troubleshooting covers Vite+ 1.0's `Expected @voidzero-dev/vite-plus-core@…, but found vite@…` error. The fix is to alias `vite` to `npm:@voidzero-dev/vite-plus-core@^1.0.0` beside `vite-plus@^1.0.0`, rather than to the `@latest` core the README used to suggest.

## 0.7.0

### Minor Changes

- 07bb5f7: Require stable Remix 3 (`remix@^3.0.0`) and migrate component rendering, JSX, and hot module replacement to `remix/component` and `remix/component-hmr`.

    Update application imports from `remix/ui` to `remix/component`, including `/server` and JSX runtime subpaths, and set `jsxImportSource` to `remix/component`. Rename `remix/ui-hmr` imports and Node hooks to `remix/component-hmr`; the asset loader is now `componentHmr()`. Content rendering and theme styles use Remix's explicit `unsafeHTML()` boundary while preserving their existing escaping and trusted-content requirements.

    These releases no longer support Remix prereleases. Upgrade Remix and the affected Pitlane packages together. UI primitives and animation utilities, when used by your application, are separate `@remix-run/ui` dependencies in Remix 3.

    The Vite plugin also pre-optimizes the component and HMR runtimes together so the first hot update after a cold start preserves component state without a manual reload.

### Patch Changes

- Updated dependencies [07bb5f7]
    - @pitlane/crawler@0.3.0

## 0.6.4

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

- Updated dependencies [6be8e56]
- Updated dependencies [d4dfade]
    - @pitlane/crawler@0.2.3

## 0.6.3

### Patch Changes

- 48c5ab2: Prerender every build through the server bundle that build just produced. When two builds ran in the same process, such as a watch rebuild or consecutive builds in a test run, prerendering could reuse the first build's fetch handler and route map. This happened when both bundles had the same modification time, or when the plugin ran under Vite's module runner (for example, in Vitest). Pages could then render stale content, or a build could pass that should have failed.
- 460e23a: Recommend separate prerendered frame URLs as the default workaround for documents being served into frames. Document links use `data-rmx-src` for the static frame response, preserving fully static navigation without frame headers or runtime SSR. Document Cloudflare assets-only deployment; retain Worker-first rendering as an optional hybrid alternative. The app supplies the frame routes and link attributes. The plugin's API and generated output are unchanged.

## 0.6.2

Published 2026-09-21. [npm](https://www.npmjs.com/package/@pitlane/dev/v/0.6.2) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/dev%400.6.2) · [Source](https://github.com/pitlane-tools/pitlane/commit/b725843491ad0c36c61c83d44466134f76dbd615).

Documentation only. `remix()`, its options, `@pitlane/dev/runtime`, and the `?assets=` protocol are unchanged.

- The npm description is now "Vite plugin for Remix development and production builds."
- The compatibility table claimed Node "24 LTS, 26" and now records Node 24, the version CI runs. The supported range is `^20.19.0 || >=22.12.0`, which the install section states beside the `remix` and `vite` peers.
- The README opens with what the plugin builds and serves instead of how it is positioned, and a Documentation section collects the four guides, the six deploy guides, and the API reference.
- The published manifest names `@pitlane/crawler@^0.2.2`, its documentation release. The manifest here carries `workspace:^` and the release workflow packs with pnpm, which rewrites it to the version the monorepo resolved, so crawler publishes first.

## 0.6.1

Published 2026-09-10. [npm](https://www.npmjs.com/package/@pitlane/dev/v/0.6.1) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/dev%400.6.1) · [Source](https://github.com/pitlane-tools/pitlane/commit/dc4844ff683fb1eb6b61f6ab9fe960b8a6c93b44).

Target Remix `3.0.0-rc.2`.

- Component HMR no longer instruments a PascalCase export that is not a Remix component setup. `remix/ui-hmr` matches any exported PascalCase function whose body returns something, so an `export async function` had its body moved into a plain arrow, where the `await` no longer parsed and the browser failed the module and every importer with `SyntaxError: Unexpected reserved word`. A generator broke the same way on `yield`, a helper returning an element was rewritten to return a function, and a `clientEntry()` setup with no render function threw inside the transform. The plugin now checks the shape itself and leaves the module alone when one of them is present, warning when a real component in that file loses its hot swap as a result.
- `vite build` was never affected, because both HMR transforms are `apply: "serve"`. A file that loses its hot swap gets it back when the offending export moves to a `.ts` file or loses its PascalCase name. Reported as [#15](https://github.com/pitlane-tools/pitlane/issues/15) and fixed in [`cb09083`](https://github.com/pitlane-tools/pitlane/commit/cb0908312733cd66207e58079b9419a63c80de26); the tag, and so the source link above, sits on a later release commit whose `packages/dev` tree is identical.
- The `remix` peer stays at `^3.0.0-rc.1`, which already admits rc.2. Tested against Vite 8.1 (Rolldown), Vite+ 0.2 (`vp`), and `remix@3.0.0-rc.2`, across the node, cloudflare, hmr, spa, and prerender fixtures.
- Now depends on `@pitlane/crawler@^0.2.1`, its rc.2 release. The manifest carries `workspace:^` and the release workflow packs with pnpm, which rewrites it to the version the monorepo resolved, so crawler publishes first.

## 0.6.0

Published 2026-09-01. [npm](https://www.npmjs.com/package/@pitlane/dev/v/0.6.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/dev%400.6.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/2617cd3d0e4c074878f34a96c6175116f926cf05).

Target Remix `3.0.0-rc.1`.

- Raised the `remix` peer dependency to `^3.0.0-rc.1` (from `^3.0.0-beta.10`). The plugin itself is unchanged: `remix()`, its `prerender` option, and `@pitlane/dev/runtime` all behave as they did in 0.5.1.
- Now depends on `@pitlane/crawler@^0.2.0`, its Remix rc.1 release. The manifest carries `workspace:^` and the release workflow packs with pnpm, which rewrites it to the version the monorepo resolved. 0.5.1 shipped `^0.1.0`, which `0.2.0` does not satisfy, so the crawler release only reaches `remix({ prerender })` users through this bump.
- Two rc.1 breaking changes land in the app code this plugin's guides document, not in the plugin. The documented `app/entry.browser.ts` reads the frame-targeting attributes off a submit button, and rc.1 renamed all of them into the `data-rmx-*` namespace, so `rmx-target`, `rmx-src`, and `rmx-reset-scroll` become `data-rmx-target`, `data-rmx-src`, and `data-rmx-reset-scroll`. Nothing raises an error when they are missed: rc.1's runtime matches only the prefixed names, so a stale attribute is inert and frame navigation silently falls back to a document load. `createAssetServer` also replaced `fileMap` with directory-based `mounts`, which affects an app that configures its own asset server rather than letting this plugin do it.
- Documentation corrections ride along, in the README and in the TSDoc that feeds both the shipped types and the generated API page. The `serverHandler` option listed `@netlify/vite-plugin` among the plugins that own dev-time request handling, so a reader who followed it set `serverHandler: false` and lost SSR in dev; Netlify's plugin emulates platform primitives around the dev server and leaves SSR to the app's fetch handler, so the default stands there. The compatibility table's Node row changed from 25 to 26 ([`4004079`](https://github.com/pitlane-tools/pitlane/commit/4004079cee5f36c5792e45a5c3961ca06695a239)). The `clientEntry()` rewrite has matched `let`, `const`, and `var` from the start, since neither it nor the HMR arrow normalization reads the declaration kind; only the documentation said `const` ([`d1ce87d`](https://github.com/pitlane-tools/pitlane/commit/d1ce87d39893b50beaf90211556528a465b00a8e)).
- Tested against Vite 8.1 (Rolldown), Vite+ 0.2 (`vp`), and `remix@3.0.0-rc.1`, across the node, cloudflare, hmr, and prerender fixtures.

## 0.5.1

Published 2026-08-25. [npm](https://www.npmjs.com/package/@pitlane/dev/v/0.5.1) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/dev%400.5.1) · [Source](https://github.com/pitlane-tools/pitlane/commit/32f35dbe84f958389cc18fd366299d6ee166fef6).

Fixes an unusable 0.5.0 on npm.

- 0.5.0 was published with `"@pitlane/crawler": "workspace:^"` in its dependencies, so every install failed with `EUNSUPPORTEDPROTOCOL` on npm and `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` on pnpm. The release workflow packed with `npm publish`, which has no idea what pnpm's `workspace:` protocol means and ships it verbatim. It now packs with pnpm, which rewrites the range to the version it resolved to, and fails the job if any `workspace:` specifier survives into the tarball. Nothing about the code changed; 0.5.0 is deprecated and this is the same release with a manifest that installs.
- Latent until now: `@pitlane/crawler` is the first workspace dependency any published Pitlane package has had.

## 0.5.0

Published 2026-08-25. [npm](https://www.npmjs.com/package/@pitlane/dev/v/0.5.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/dev%400.5.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/a4f462e245d943c00d5e851cbe6768bb8fdacf48).

Build-time prerendering.

npm marks this version deprecated: its published `workspace:` dependency was not rewritten to an npm version range. Use 0.5.1 for the installable release of the features below.

- `remix({ prerender })` renders paths to static HTML during `vite build` and writes them into the client output, so a host answers those URLs and the server never sees them. The API mirrors React Router's: `true` for every static path in the route map, an array for an explicit list, a function receiving `getStaticPaths()` for a list that mixes static and dynamic paths, or an object adding `concurrency`. `spider` is one option beyond that set — it follows the links each rendered page contains, which suits a site whose pages all reach each other.
- There is no second rendering path. The build sends a `Request` through the same fetch handler production runs, after both environments are built and the assets manifest is written, so the HTML on disk names real hashed chunks rather than dev URLs.
- `getStaticPaths()` reads the `routes` named export of the built server entry. A Remix 3 router exposes no route table, but the route map it is built from is an ordinary object, so exporting it is all the app has to do. A build that asks for static paths without that export fails with a message saying so.
- A path that answers with a redirect is logged and skipped rather than failing the build. `prerender: true` asks for every static path in the route map, and a `/` that points at the real landing path is an ordinary thing to find in there; there is no document to write for one, and the app still answers it at runtime. Under `spider` the redirect is followed instead, because that is what following links means. Any other failing response still stops the build, since a listed path that 404s is a stale list and a spidered one is a dead internal link.
- Bundles built for another runtime prerender too, with no extra configuration. Node cannot import a Workers bundle, so when the import fails the build starts the project's own preview server and renders through that: `@cloudflare/vite-plugin` boots workerd with the app's real bindings, and any platform plugin contributing a preview server works the same way. On that path the route map is read from the module the server entry gets it from, since the bundle holding the export is the thing that will not load.
- Prerendered output is written relative to Vite's `base`: an app whose routes live under `/repo/` still writes `blog/index.html`, because the host mounts the client directory at the base.
- `remix({ server: false, prerender })` throws. Prerendering renders through the server entry, and SPA mode builds no server.
- The crawler is a new package, [`@pitlane/crawler`](https://pitlane.tools/package/crawler/), installable on its own. It brings back the `crawl()` API from [remix-run/remix#11150](https://github.com/remix-run/remix/pull/11150).

## 0.4.0

Published 2026-08-22. [npm](https://www.npmjs.com/package/@pitlane/dev/v/0.4.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/dev%400.4.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/cf6d9c7755568660c3be8e0b2eed852922cc55fa).

SPA mode.

- `remix({ server: false })` targets client-rendered apps. No server environment is configured, nothing builds to `dist/ssr`, and `vite build` emits a static site from `index.html`. What remains is the part a SPA still wants: component HMR through the `remix/ui-hmr` browser transform, including the arrow-form normalization, so edits hot-swap in place and keep live component state. Every `server*` option goes with it, and `clientEntry` too, and `<HMR />` from `pitlane:dev` resolves to the inert component — there is no server data to revalidate.
- The option is named for what it removes. React Router spells the same switch `ssr: false`, which reads like it only turns off server rendering; it does not, in either plugin. An app that wants browser-rendered UI in front of routes that still run per request keeps `server: true` and writes a server entry that answers data and a shell.
- SPA mode works under Vite's experimental bundled dev mode (`experimental.bundledDev` / `vite dev --experimentalBundle`), component hot-swap included. Server-rendered apps do not: bundled dev serves only bundle entrypoints, so the client module URLs an SSR render writes into its HTML have nothing behind them. That is upstream's Phase 4 (server environments), still a prototype.

## 0.3.0

Published 2026-08-19. [npm](https://www.npmjs.com/package/@pitlane/dev/v/0.3.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/dev%400.3.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/2f67f63718dcba3fa4dcce02f24f0ed054ea0b66).

Dev-time hot module replacement.

- Component HMR: component and `clientEntry()` exports hot-swap in place during `vite dev`, preserving live island state, via the `remix/ui-hmr` browser and server transforms. Both named-function and arrow forms work — arrow-form component/`clientEntry()` exports are normalized to named function expressions before instrumentation, so idiomatic Remix code hot-swaps with no source changes.
- Server-data HMR: editing a server-only module re-fetches the current page through the app's fetch handler and reconciles the new server-rendered HTML into the DOM, keeping hydrated island state — the Remix 3 analog of React Router's loader/action revalidation, driven through the frame runtime. A changed file the client graph serves as a script is left to component HMR instead. Only `js` client modules count as client-served: plugins that scan sources for their own purposes register non-script nodes for ordinary server files (Tailwind's content scanner, for one), which previously classified every server module as client-owned and silenced server-data HMR for the whole app.
- Revalidating is one line in the document, `<HMR />` from the new `pitlane:dev` module. It is a hydrated island, so it holds a component handle and revalidates with `handle.frames.top.reload()`; `remix/ui` hands the top frame to components only, so nothing the plugin injects could reach it. A frame reload produces no history entry and fires no `navigate` event, which leaves apps that intercept navigation themselves working unchanged. Needs no environment guard: in a build, and in apps with no client runtime to hydrate it, the specifier resolves to a component that renders nothing and carries no client code. Types come with `@pitlane/dev/assets`.
- Revalidation waits a beat after a server change before refetching, so it cannot reach the fetch handler while the server entry is still half-applied (which served a dev error page on slower runtimes like workerd), and a burst of saves coalesces into one refetch.
- `@pitlane/dev/runtime` imports now inline this package's real runtime module rather than a hand-written copy of `mergeAssets`, so every export stays in one place. What that module imports is bundled too, which keeps the built server free of any dev-dependency import.

## 0.2.0

Published 2026-08-18. [npm](https://www.npmjs.com/package/@pitlane/dev/v/0.2.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/dev%400.2.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/f6be34e6116aaac178a017eb0fd86083f90b23dc).

Target Remix `3.0.0-beta.10`.

- Raised the `remix` peer dependency to `^3.0.0-beta.10` (from `^3.0.0-beta.5`). Remix beta.6 removed the legacy package-aligned `remix/*` import aliases, so beta.5 and earlier are no longer supported.
- `run()` from `remix/ui` now ships a default frame resolver and takes `(src, options)`, so the documented `app/entry.browser.ts` no longer needs a hand-written `resolveFrame`. The plugin itself is unchanged.
- Tested against Vite 8.1 (Rolldown), Vite+ 0.2 (`vp`), and `remix@3.0.0-beta.10`.
- The upgrade landed in [`bb53224`](https://github.com/pitlane-tools/pitlane/commit/bb53224b4a3464bb4cf2bc320780de08821d16b3); the source commit above is the version bump that released it alongside `@pitlane/theme@0.2.0`.

## 0.1.1

Published 2026-07-24. [npm](https://www.npmjs.com/package/@pitlane/dev/v/0.1.1) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/dev%400.1.1) · [Source](https://github.com/pitlane-tools/pitlane/commit/7d8d15e9114babdfa81a7f4443e7f38257d194fd).

No changes to the plugin. First release published through the tokenless trusted-publishing pipeline — this version and everything after it carries an npm provenance attestation (0.1.0 was published locally while the pipeline was bootstrapped).

## 0.1.0

Published 2026-07-24. [npm](https://www.npmjs.com/package/@pitlane/dev/v/0.1.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/dev%400.1.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/be5c532553cd0584a988ebe9846122904ea74b09).

Initial release.

- `remix()` — Remix 3 build orchestration for any Vite or Vite+ project: SSR-before-client multi-environment builds into `dist/ssr` + `dist/client`, dev serving through the app's default-exported fetch handler, and a preview server for the production build.
- `clientEntry()` hydration transform: named-export components become hydratable islands; `import.meta.url` resolves to production asset URLs.
- The `?assets=` import protocol plus `mergeAssets` from `@pitlane/dev/runtime`, with ambient types via `@pitlane/dev/assets`.
- Platform-agnostic by construction: composes with `@cloudflare/vite-plugin`, `@netlify/vite-plugin`, and `nitro/vite`, or the built handler runs directly on Node, Bun, and Deno. The assets manifest is written eagerly and synthesized from bundle captures when an orchestrator bundles the SSR output itself; runtime helpers are inlined into builds; dev responses are normalized for runtimes with strict `node:http` semantics.
- Peers are `vite@>=7.0.0` and `remix@^3.0.0-beta.5`, on Node `^20.19.0 || >=22.12.0`.
- Tested against Vite 8.1 (Rolldown), Vite+ 0.2 (`vp`), and `remix@3.0.0-beta.5` across the eight [pitlane-tools/templates](https://github.com/pitlane-tools/templates) deploy targets.

The package landed in [#2](https://github.com/pitlane-tools/pitlane/pull/2). npm records `be5c532` as the `gitHead`, a publish-workflow fix committed after that merge; its `packages/dev` tree is identical to the merge, so the source link above is the exact source.

# @pitlane/dev

## 0.5.1

Fixes an unusable 0.5.0 on npm.

- 0.5.0 was published with `"@pitlane/crawler": "workspace:^"` in its
  dependencies, so every install failed with `EUNSUPPORTEDPROTOCOL` on npm and
  `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` on pnpm. The release workflow packed with
  `npm publish`, which has no idea what pnpm's `workspace:` protocol means and
  ships it verbatim. It now packs with pnpm, which rewrites the range to the
  version it resolved to, and fails the job if any `workspace:` specifier
  survives into the tarball. Nothing about the code changed; 0.5.0 is
  deprecated and this is the same release with a manifest that installs.
- Latent until now: `@pitlane/crawler` is the first workspace dependency any
  published Pitlane package has had.

## 0.5.0

Build-time prerendering.

- `remix({ prerender })` renders paths to static HTML during `vite build` and
  writes them into the client output, so a host answers those URLs and the
  server never sees them. The API mirrors React Router's: `true` for every
  static path in the route map, an array for an explicit list, a function
  receiving `getStaticPaths()` for a list that mixes static and dynamic paths,
  or an object adding `concurrency`. `spider` is one option beyond that set —
  it follows the links each rendered page contains, which suits a site whose
  pages all reach each other.
- There is no second rendering path. The build sends a `Request` through the
  same fetch handler production runs, after both environments are built and the
  assets manifest is written, so the HTML on disk names real hashed chunks
  rather than dev URLs.
- `getStaticPaths()` reads the `routes` named export of the built server entry.
  A Remix 3 router exposes no route table, but the route map it is built from
  is an ordinary object, so exporting it is all the app has to do. A build that
  asks for static paths without that export fails with a message saying so.
- A path that answers with a redirect is logged and skipped rather than failing
  the build. `prerender: true` asks for every static path in the route map, and
  a `/` that points at the real landing path is an ordinary thing to find in
  there; there is no document to write for one, and the app still answers it at
  runtime. Under `spider` the redirect is followed instead, because that is
  what following links means. Any other failing response still stops the build,
  since a listed path that 404s is a stale list and a spidered one is a dead
  internal link.
- Bundles built for another runtime prerender too, with no extra
  configuration. Node cannot import a Workers bundle, so when the import
  fails the build starts the project's own preview server and renders through
  that: `@cloudflare/vite-plugin` boots workerd with the app's real bindings,
  and any platform plugin contributing a preview server works the same way. On
  that path the route map is read from the module the server entry gets it
  from, since the bundle holding the export is the thing that will not load.
- Prerendered output is written relative to Vite's `base`: an app whose routes
  live under `/repo/` still writes `blog/index.html`, because the host mounts
  the client directory at the base.
- `remix({ server: false, prerender })` throws. Prerendering renders through the
  server entry, and SPA mode builds no server.
- The crawler is a new package,
  [`@pitlane/crawler`](https://pitlane.tools/package/crawler/), installable on
  its own. It brings back the `crawl()` API from
  [remix-run/remix#11150](https://github.com/remix-run/remix/pull/11150).

## 0.4.0

SPA mode.

- `remix({ server: false })` targets client-rendered apps. No server
  environment is configured, nothing builds to `dist/ssr`, and `vite build`
  emits a static site from `index.html`. What remains is the part a SPA still
  wants: component HMR through the `remix/ui-hmr` browser transform, including
  the arrow-form normalization, so edits hot-swap in place and keep live
  component state. Every `server*` option goes with it, and `clientEntry` too,
  and `<HMR />` from `pitlane:dev` resolves to the inert component — there is
  no server data to revalidate.
- The option is named for what it removes. React Router spells the same switch
  `ssr: false`, which reads like it only turns off server rendering; it does
  not, in either plugin. An app that wants browser-rendered UI in front of
  routes that still run per request keeps `server: true` and writes a server
  entry that answers data and a shell.
- SPA mode works under Vite's experimental bundled dev mode
  (`experimental.bundledDev` / `vite dev --experimentalBundle`), component
  hot-swap included. Server-rendered apps do not: bundled dev serves only
  bundle entrypoints, so the client module URLs an SSR render writes into its
  HTML have nothing behind them. That is upstream's Phase 4 (server
  environments), still a prototype.

## 0.3.0

Dev-time hot module replacement.

- Component HMR: component and `clientEntry()` exports hot-swap in place
  during `vite dev`, preserving live island state, via the `remix/ui-hmr`
  browser and server transforms. Both named-function and arrow forms work —
  arrow-form component/`clientEntry()` exports are normalized to named
  function expressions before instrumentation, so idiomatic Remix code
  hot-swaps with no source changes.
- Server-data HMR: editing a server-only module re-fetches the current page
  through the app's fetch handler and reconciles the new server-rendered HTML
  into the DOM, keeping hydrated island state — the Remix 3 analog of React
  Router's loader/action revalidation, driven through the frame runtime. A
  changed file the client graph serves as a script is left to component HMR
  instead. Only `js` client modules count as client-served: plugins that scan
  sources for their own purposes register non-script nodes for ordinary server
  files (Tailwind's content scanner, for one), which previously classified
  every server module as client-owned and silenced server-data HMR for the
  whole app.
- Revalidating is one line in the document, `<HMR />` from the new `pitlane:dev`
  module. It is a hydrated island, so it holds a component handle and
  revalidates with `handle.frames.top.reload()`; `remix/ui` hands the top frame
  to components only, so nothing the plugin injects could reach it. A frame
  reload produces no history entry and fires no `navigate` event, which leaves
  apps that intercept navigation themselves working unchanged. Needs no
  environment guard: in a build, and in apps with no client runtime to hydrate
  it, the specifier resolves to a component that renders nothing and carries no
  client code. Types come with `@pitlane/dev/assets`.
- Revalidation waits a beat after a server change before refetching, so it
  cannot reach the fetch handler while the server entry is still half-applied
  (which served a dev error page on slower runtimes like workerd), and a burst
  of saves coalesces into one refetch.
- `@pitlane/dev/runtime` imports now inline this package's real runtime module
  rather than a hand-written copy of `mergeAssets`, so every export stays in
  one place. What that module imports is bundled too, which keeps the built
  server free of any dev-dependency import.

## 0.2.0

Target Remix `3.0.0-beta.10`.

- Raised the `remix` peer dependency to `^3.0.0-beta.10` (from
  `^3.0.0-beta.5`). Remix beta.6 removed the legacy package-aligned `remix/*`
  import aliases, so beta.5 and earlier are no longer supported.
- `run()` from `remix/ui` now ships a default frame resolver and takes
  `(src, options)`, so the documented `app/entry.browser.ts` no longer needs a
  hand-written `resolveFrame`. The plugin itself is unchanged.
- Tested against Vite 8.1 (Rolldown), Vite+ 0.2 (`vp`), and
  `remix@3.0.0-beta.10`.

## 0.1.1

No changes to the plugin. First release published through the tokenless
trusted-publishing pipeline — this version and everything after it carries an
npm provenance attestation (0.1.0 was published locally while the pipeline was
bootstrapped).

## 0.1.0

Initial release.

- `remix()` — Remix 3 build orchestration for any Vite or Vite+ project:
  SSR-before-client multi-environment builds into `dist/ssr` + `dist/client`,
  dev serving through the app's default-exported fetch handler, and a preview
  server for the production build.
- `clientEntry()` hydration transform: named-export components become
  hydratable islands; `import.meta.url` resolves to production asset URLs.
- The `?assets=` import protocol plus `mergeAssets` from
  `@pitlane/dev/runtime`, with ambient types via `@pitlane/dev/assets`.
- Platform-agnostic by construction: composes with
  `@cloudflare/vite-plugin`, `@netlify/vite-plugin`, and `nitro/vite`, or the
  built handler runs directly on Node, Bun, and Deno. The assets manifest is
  written eagerly and synthesized from bundle captures when an orchestrator
  bundles the SSR output itself; runtime helpers are inlined into builds; dev
  responses are normalized for runtimes with strict `node:http` semantics.
- Tested against Vite 8.1 (Rolldown), Vite+ 0.2 (`vp`), and
  `remix@3.0.0-beta.5` across the eight
  [pitlane-tools/templates](https://github.com/pitlane-tools/templates)
  deploy targets.

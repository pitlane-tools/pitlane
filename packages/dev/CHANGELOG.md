# @pitlane/dev

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

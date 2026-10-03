---
id: proposal.0005
title: Client Entry Resolution
authors: [markmals]
status: draft
pull-request:
issues: []
supersedes: []
---

# Client Entry Resolution

## Summary

`@pitlane/dev` keys every `clientEntry()` island with a bundler-stable `file:` identity and resolves it at render time through Remix's own `resolveClientEntry` contract, so `render({ assets })` works under a bundler exactly as it does under `remix/assets` and islands gain `modulepreload` hints. The plugin owns its asset manifest, `?assets=` imports, and dev server handler directly instead of through `@hiogawa/vite-plugin-fullstack`.

## Motivation

Remix 3 renders a hydrated component by calling `resolveClientEntry(entryId, component)` on the server and serializing the result into `#rmx-data` for the browser. Under `remix/assets` the entry id is the source file's `file:` URL and the asset server turns it into a fingerprinted href, `modulepreload` hints, and an import map. Under `@pitlane/dev` the entry id is already the final hashed URL: a build-time transform replaces `import.meta.url` with a manifest lookup, and the renderer's default resolver splits it on `#`. The two integrations answer the same question at different times, and the Pitlane answer is the poorer one in four ways.

- **Islands get no preload hints.** The manifest knows each island chunk's reachable JS, and the transform discards it. The one production consumer that has hit this, [Kody](https://github.com/kentcdodds/kody), hand-computes `modulepreload` hrefs from `ImportedAssets.js` and forwards them through its own `resolveClientEntry` ([`ssr-render.tsx`](https://github.com/kentcdodds/kody/blob/main/packages/worker/src/app/ssr-render.tsx)).
- **The server bundle carries one virtual manifest import per island.** Every island module in the SSR build prepends `import … from "<id>?assets=client"`, so the island count is also the count of virtual modules the server build must resolve, and a second orchestrator that bundles the SSR output (observed with Nitro) can lose the manifest the imports point at. `build.ts` re-synthesizes it by regex-scanning the built chunks.
- **Pitlane apps cannot use Remix's standard renderer the standard way.** `render({ assets })` from `remix/middleware/render` is the documented integration for client entries, and Pitlane apps leave `assets` out because Pitlane has nothing shaped like an asset server to pass. Switching an app between No Build and Pitlane means rewriting its render wiring.
- **The integration depends on a dormant package.** `@hiogawa/vite-plugin-fullstack` was last published 2025-12-22, its default branch last moved 2026-01-08, it declares `peerDependencies.vite: ^7` while this repository runs Vite 8 and Vite+ 1.0, and it carries the only advisory in Pitlane's production dependency graph (`srvx`, moderate), used solely to adapt a fetch handler to Node for the dev server. Pitlane already duplicates about a third of it as the Nitro fallback.

Anyone shipping islands with `@pitlane/dev` pays the first cost on every page. Anyone deploying through a second bundler pays the second. The third is paid at adoption time, and by Pitlane's own docs, which document a Pitlane-specific wiring where Remix's would do. The fourth is a liability that grows with every Vite release.

## Domain grounding

### Established context

Read from the installed `@remix-run/component@1.0.0`, `@remix-run/render-middleware@1.0.0`, and `@remix-run/assets@1.0.0` sources; line references are to `src/`.

- `clientEntry(entryId, component)` stores the id as `component.$entryId` and nothing else (`runtime/client-entries.ts:108-118`). **The server renderer is the only reader of `$entryId`** (`server/stream.ts:1069`). The browser hydrates from the `moduleUrl` and `exportName` the server serialized into `#rmx-data` and uses `${moduleUrl}#${exportName}` as the component's identity (`runtime/frame.ts:1277`).
- `renderToStream(node, { resolveClientEntry })` calls the hook once per distinct component per render, after the tree has rendered, with `(entryId, component)`, and expects `{ href, exportName, preloads?, importMap? }` (`server/stream.ts:71-74, 99-105, 1107-1135`). Without a hook, `resolveDefaultClientEntry` splits the id on its last `#`, uses the prefix verbatim as `href`, and falls back to `component.name` for the export (`:1079-1105`).
- `preloads` become `<link data-rmx-module-preload rel="modulepreload">` tags hoisted into the document head, including out of frame responses (`:1140-1146, 1316-1330`). `importMap` is merged into the managed `<ImportMap>`; an empty `imports` object yields no delta and emits nothing (`:1470-1496, 1498-1521`).
- The `render()` middleware does not expose the hook. It installs its own resolver, parameterized only by `assets?: Pick<AssetServer, 'getScriptEntry'>` (`render-middleware/lib/render-ui.ts:53-59, 86-87`). For an id whose prefix starts with `file:` it requires `assets` and returns `assets.getScriptEntry(prefix)` merged with the export name; any other id passes through as `href` (`:200-226`). Its error when `assets` is missing reads: "clientEntry() cannot use a file: source entry ID without an asset server. Pass the asset server to render({ assets })."
- `ScriptEntry` is `{ href: string; preloads: string[]; importMap: { imports: Record<string, string>; scopes?: … } }` (`assets/lib/asset-server.ts:298-305`, `scripts/compiler.ts:52-55`). `getPreloads` lists the entry module itself first, then its static graph shallowest-first (`scripts/compiler.ts:227-256`).
- The upstream migration guidance for custom pipelines is explicit: resolve client entries with `getScriptEntry()` and include `importMap` and `preloads` in the object returned from `resolveClientEntry()` ([rc.2 release notes](https://github.com/remix-run/remix/pull/11802)).
- Vite's module runner sets `import.meta.url` to the module's `file://` URL in dev (`vite/dist/node/module-runner.js:791-796`). A production SSR chunk's `import.meta.url` is the chunk's own location, which many source modules share; one consumer reports it empty on Cloudflare Workers (Kody, `ssr-render.tsx` comment; not verified against workerd documentation).

### Relevant constraints and principles

- **Bundling destroys source identity on the server.** The asset server's model is one source file per served module, so a `file:` URL is both an identity and a lookup key. After bundling, no runtime value identifies the source module; the identity has to be written into the code at transform time. What is open is only whether the transform writes the final answer or a stable key.
- **`component.name` is not a safe export name.** Minification renames functions; the export name is only reliable when the transform reads it from the export declaration and writes it into the id as a `#` fragment.
- **A module becomes a client chunk only because the build was told to emit it.** Discovery of islands happens while bundling the server environment; the client build must run after it and emit a chunk for each discovered module with `preserveSignature: "exports-only"` so the named export survives.
- **The entry id never reaches the browser, but the href does.** Consumer tests parse `#rmx-data` and assert `moduleUrl` and `exportName` (Kody, `ssr-render.node.test.ts`). The key's shape is Pitlane's business; the href's is a contract.
- **Virtual ids do not exist outside Vite.** Kody maintains alias-swapped stub pairs for `pitlane:dev` and for every `?assets=` import so that Vitest without the plugin and the Wrangler/esbuild graph can bundle ([commit f4b3565](https://github.com/kentcdodds/kody/commit/f4b35651c6dcc0550c54813427a078bd7aeaa7e6)). Any new public surface that is only a virtual id adds to that burden.
- **Vision principle 3, Runtime When Possible.** Resolving an island at render time through a runtime API is the direction the vision prefers; the transform remains only where the bundler makes it unavoidable.

### Quality bar

- One identity scheme for islands that is identical in dev and build, reproducible across machines, and never contains a runtime-specific value.
- Islands get `preloads` through the renderer's existing head hoisting, not a Pitlane reimplementation of it.
- `render({ assets })` from `remix/middleware/render` works with a value `@pitlane/dev` provides, and a direct `renderToStream` caller needs a three-line hook.
- One manifest, one import of it in the server bundle, derivable from the captured output bundles so prerendering and second-orchestrator builds keep working.
- The dev server, `?assets=` imports, dev stylesheet links, and HMR behave as they do today; the existing end-to-end suite is the specification for that half.

### Remaining uncertainty

- Whether Vite's `?t=<timestamp>` cache-busting on island hrefs matters once the resolver computes dev URLs without it. Pitlane's component HMR swaps components in place rather than re-importing island URLs, and a fresh document has a fresh module map, so the expectation is no; the HMR end-to-end suite decides.
- Whether Vite's full-bundle dev mode (`--bundled` in the e2e harness) changes how dev URLs for islands are formed. The harness already runs it; it decides.

## Existing baseline

Three specimens.

**`@pitlane/dev` today.** `transform.ts` rewrites `export let Name = clientEntry(import.meta.url, …)`: in server environments it prepends `import ___clientEntryAssets from "<id>?assets=client"` and writes `___clientEntryAssets.entry + "#Name"`; in the client environment it writes `import.meta.url + "#Name"`. `@hiogawa/vite-plugin-fullstack` answers `?assets=client`: in dev with the module's dev-server URL, in build with a manifest lookup, and the act of loading that virtual module during the SSR build is what marks the module as a chunk the client build must emit. After both builds it writes `__fullstack_assets_manifest.js` into the SSR output and copies SSR-emitted assets into the client output; `build.ts:160-239` does the same again when the upstream write did not land. Worth keeping: the AST-based call matching and export-name extraction, the SSR-first sequencing, the `ImportedAssets` shape and `?assets=` convention that documents are written against, and the manifest-from-captured-bundles logic. Incidental: the client-environment rewrite, which nothing reads; the per-island virtual import; the fallback duplication; and `hmr-component.ts` answering `?assets=client` for its own virtual island because the transform asks every island to.

**`remix/assets` with `render({ assets })`.** The reference integration this proposal adopts the shape of: `clientEntry(import.meta.url, …)` is left alone, the resolver is a function of the id, and the document gets preloads and import maps from the same object. Its identity scheme assumes unbundled source, which is the one thing Pitlane cannot adopt.

**Kody.** The largest open-source Remix 3 app runs on `@pitlane/dev` and shows the seams: a hand-written `resolveClientEntry` that forwards `preloads` computed from `?assets=client`, stub modules for every Pitlane virtual id, and SSR tests that pin `#rmx-data`.

## Proposed solution

Make the island id a stable key, and make `@pitlane/dev` the thing that resolves it, in the shape Remix already defines.

```text
export let Counter = clientEntry(import.meta.url, …)   in app/components/counter.tsx
  → transform (every environment):  clientEntry("file:app/components/counter.tsx#Counter", …)
  → render({ assets }) sees "file:" and calls assets.getScriptEntry("file:app/components/counter.tsx")
  → dev:   { href: "/app/components/counter.tsx", preloads: [], importMap: { imports: {} } }
  → build: { href: "/assets/counter-Bx1.js", preloads: ["/assets/counter-Bx1.js", "/assets/chunk-9k.js"], importMap: { imports: {} } }
  → #rmx-data: { moduleUrl: "/assets/counter-Bx1.js", exportName: "Counter" }
  → <head>: <link rel="modulepreload" href="/assets/counter-Bx1.js"> …
```

The app's render wiring becomes the upstream one:

```ts
import { assets } from "@pitlane/dev/runtime";
import { render } from "remix/middleware/render";

createRouter({ middleware: [render({ assets })] });
```

Behind that, `@pitlane/dev` owns the pieces fullstack supplied: the `?assets=` import, dev stylesheet links, the manifest, the dev server handler. Not fullstack's API, which Pitlane never exposed, but its functionality, rebuilt around the manifest the resolver reads.

## Detailed design

### The island key

- The transform matches `export <let|const|var> Name = clientEntry(import.meta.url, …)` at module top level, as today. The first argument becomes the string literal `"file:" + key + "#" + Name`, where `key` is the module's path relative to the Vite root in POSIX form. A module outside the root keeps the `../` segments `path.relative` produces. A module whose id is not a file (a virtual module, such as the dev HMR island) uses its Vite dev URL as `key` (`/@id/…`), which only arises in dev because the island is inert in a build.
- The same literal is written in every environment, server and client. `import.meta.url` is never left in a `clientEntry()` call the transform matched.
- Default exports, aliased callees, non-exported calls, and calls with fewer than two arguments are left untouched, as today.
- The transform records, for every match in a server environment, the pair `(key, moduleId)` in a plugin-level registry. In a client environment it records nothing.

### The resolver

- `@pitlane/dev/runtime` exports `assets: { getScriptEntry(filePath: string): Promise<ScriptEntry> }`, structurally compatible with `Pick<AssetServer, "getScriptEntry">` from `remix/assets` so it is accepted by `render({ assets })`. The package does not depend on `remix/assets` for the type; `ScriptEntry` is declared locally with the same shape.
- `getScriptEntry` accepts the id with or without its `file:` prefix and with or without a `#fragment`; both are stripped before lookup. The middleware passes `file:` plus the key; a direct caller may pass the key.
- In dev, `getScriptEntry(key)` returns `{ href, preloads: [], importMap: { imports: {} } }` where `href` is the Vite URL for the key: `base + key` for a key under the root, `base + "/@fs/" + absolute path` for a key beginning with `../`, and `base + key` unchanged for a key that already begins with `/`.
- In build, `getScriptEntry(key)` reads the manifest record for `key` in the `client` environment and returns `{ href: record.entry, preloads: record.js.map(asset => asset.href), importMap: { imports: {} } }`. `preloads` begins with the entry chunk itself, matching `remix/assets`.
- If the key has no manifest record, `getScriptEntry` throws an `Error` naming the key and stating that the module was not a client entry in this build.
- Outside a Vite-built or Vite-served module graph, `getScriptEntry` throws an `Error` stating that no asset manifest is available and that the server must be built or served by `remix()` from `@pitlane/dev`. It does not pass the key through as an href.
- The implementation reads from a single internal module, `@pitlane/dev/runtime/manifest`, whose published file throws as above; the plugin resolves that specifier to a generated module in dev and to the emitted manifest in build. Application code never imports it.
- A direct `renderToStream` caller resolves an island with `{ ...(await assets.getScriptEntry(entryId)), exportName }`, taking `exportName` from the fragment. The vite-plugin guide shows this; the package exports no second helper for it.

### The manifest

- The manifest is the record, per environment and per key, of `{ entry?: string; js: { href: string }[]; css: { href: string }[] }`, with the same semantics `ImportedAssets` has today: `entry` and `js` only for the `client` environment, `css` for any.
- Keys are recorded from two sources during the server build: the transform registry (islands), and every `?assets=` import loaded (the browser entry and whatever else a document reads). A key recorded from either source for the `client` environment is emitted as a chunk in the client build with `preserveSignature: "exports-only"`.
- After the last environment builds, the plugin writes `__pitlane_assets_manifest.js` into the server output directory, computing each record from the captured bundles: the chunk containing the module, its transitive static imports for `js`, and the CSS those chunks import for `css`, prefixed with the client environment's `base` or the result of `experimental.renderBuiltUrl` when that returns a string. SSR-emitted assets are copied into the client output directory, as today.
- The server bundle references the manifest through one import, rewritten in `renderChunk` to a path relative to the importing chunk. There is no fallback write; this is the only path, and it is what prerendering and a second orchestrator consume.
- SSR environments build before the client environment, as today, because the client build needs the registry the server build fills.

### `?assets=` imports and the dev server

- `import assets from "<module>?assets=client"`, `?assets=ssr`, and bare `?assets` keep their current meaning and `ImportedAssets` shape, and `mergeAssets` keeps its behavior. The implementation moves into `@pitlane/dev`.
- In the client environment every `?assets=` import resolves to the empty result, as today.
- In dev, a server environment's `?assets=<env>` import returns `entry` (client only) as the module's dev URL, `js` empty, and `css` (non-client only) as the stylesheet URLs reachable from the module through the environment's module graph, each tagged `data-vite-dev-id`. The Vite client patch that lets those `<link>` tags coexist with Vite's injected styles, and the CSS self-accept patch, move into the plugin with attribution.
- The dev server handler keeps serving requests through the first server environment's entry `default.fetch`, adapted with `createRequestListener` from `remix/node-fetch-server`. `serverHandler: false` keeps disabling it.
- The client build keeps a fallback input when `clientEntry` is `false`, so a server-only configuration with islands still produces a client build.
- `import.meta.vite.assets()` is not supported; it never was in Pitlane's documentation.

### HMR

- The dev HMR island in `hmr-component.ts` no longer answers `?assets=client` for itself; its key resolves through the dev rule for virtual ids.
- Component HMR, server-data HMR, and the `pitlane:dev` module are unchanged.

### Dependencies

- `@hiogawa/vite-plugin-fullstack` is removed from `@pitlane/dev`'s dependencies. No replacement dependency is added; `remix/node-fetch-server` is already a peer.

## Compatibility

Breaking for any app that renders an island.

- An island's `#rmx-data` entry carries a `file:` id to the resolver, so an app that calls `render()` without `assets` fails at its first island render with the upstream error quoted above. The fix is one import and one option: `render({ assets })` with `assets` from `@pitlane/dev/runtime`. An app with its own `renderToStream` call adds the three-line `resolveClientEntry` from the guide.
- The serialized `moduleUrl` in `#rmx-data` is unchanged in build (the hashed chunk URL) and unchanged in dev (the module's dev URL) for file-backed islands.
- `?assets=` imports, `ImportedAssets`, `mergeAssets`, `pitlane:dev`, and every `remix()` option keep their current meaning. An app that imported `@hiogawa/vite-plugin-fullstack` directly has to add it to its own dependencies; Pitlane never documented doing so.
- The manifest file name in the server output changes from `__fullstack_assets_manifest.js` to `__pitlane_assets_manifest.js`. Nothing documented reads it by name.
- Plugin names reported by Vite change from `fullstack:*` to `pitlane-remix-*`.

The changeset is a minor bump of `@pitlane/dev` with the break stated in its body, following the package's 0.x practice.

## Implications on adoption

- Apps add `render({ assets })` or the three-line hook. Templates that depend on `@pitlane/dev` adopt the change through `.agents/skills/adopting-packages-into-templates/`.
- An app can move between No Build and Pitlane by swapping which `assets` it passes to `render()`; the document and render wiring are otherwise the same.
- Reversible by pinning the previous `@pitlane/dev` minor.

## Scope

- The transform change, the registry, the resolver on `@pitlane/dev/runtime`, and the internal manifest module.
- `?assets=` imports, dev stylesheet links, the manifest writer, SSR-asset copying, the client fallback input, and the dev server handler implemented in `@pitlane/dev`; removal of the fullstack dependency and of the fallback manifest synthesis.
- Tests: transform unit tests updated for the literal key; unit tests for the manifest writer and resolver; the node end-to-end fixture asserting the island's `moduleUrl` is its hashed chunk and a `modulepreload` link for it is present; the existing dev, HMR, Cloudflare, prerender, and SPA suites green.
- Guides: the client entries section of the vite-plugin guide rewritten around `render({ assets })` and the direct-caller hook; the package README; a changeset.
- `VISION.md` updated in phase 5 where it says the plugin wraps fullstack and describes the transform's output.

### Out of scope

- Import map generation. Pitlane bundles; nothing in a Pitlane build needs an import map, and the resolver returns an empty one so the renderer emits nothing.
- Moving `pitlane:dev` to a real package specifier. The same friction Kody reports applies to it, but it is a separate change with its own compatibility story.
- Per-route preloads for lazily imported client areas, which Kody computes by merging `?assets=client` results. `?assets=` keeps supporting that; it is not island resolution.
- `getScriptEntry` for the browser entry and other non-island modules; see Open questions.

## Preview

- Artifact: the pkg.pr.new build of `@pitlane/dev` from `pkg-preview.yml`, installed into a copy of `packages/dev/tests/fixtures/node-app` with `render({ assets })` wired, run with `vite dev` and `vite build && vite preview`, inspecting `#rmx-data` and the document head.
- Reason: the change is package behavior with a server-rendered surface; the fixture is the smallest app that exercises islands in both modes, and the guide change rides along on the docs preview for prose only.

## Policies and decisions checked

- `decision.0001` Static Documentation Delivery — the docs site is prerendered and served statically; this proposal changes how `@pitlane/dev` resolves islands, which the docs build exercises through `remix({ prerender })`, and does not alter delivery.
- `policies/` is empty.
- `VISION.md` §`@pitlane/dev` — states that the plugin wraps `@hiogawa/vite-plugin-fullstack` and that the server transform resolves to the client asset URL. Both sentences become false and are updated in phase 5; the section's five concerns are otherwise unchanged. Principle 3, Runtime When Possible, favors this direction.

## Future directions

- `assets.getScriptEntry("app/entry.browser.ts")` and `assets.getHref("app/styles.css")` answering for the browser entry and stylesheets would let a Pitlane document be written exactly as a `remix/assets` document, with `<ImportMap>`, preloads, and the script tag all from one object, and would make `?assets=client` for the browser entry optional.
- `pitlane:dev` offered as a real specifier the plugin swaps, for the same non-Vite-graph reason the resolver is.

## Alternatives considered

- **Keep the transform writing final URLs and let apps add `resolveClientEntry` themselves** — the Kody pattern. Costs each app a hand-written resolver and a `?assets=client` import per island to get preloads, keeps the per-island virtual imports, and leaves fullstack in place. Rejected: it solves the symptom in every app instead of the cause in the plugin.
- **Resolver on a virtual module such as `pitlane:assets`** — matches the `pitlane:dev` convention. Rejected on Kody's evidence: every virtual id in application code is one more stub pair for graphs Vite does not build. A real specifier whose published file throws is honest outside Vite and swapped inside it.
- **Keep `@hiogawa/vite-plugin-fullstack` and build the registry beside it** — the smallest diff. Rejected: discovery would exist twice, the dependency's drift and advisory remain, and the Nitro fallback would still have to understand fullstack's manifest.
- **Absolute `file:///…` keys, as the module runner produces in dev** — needs no path computation in dev. Rejected: a build-machine path baked into `dist/ssr` makes builds non-reproducible across machines and says nothing the root-relative path does not.
- **Pitlane's own `render()` middleware** — would expose the full `resolveClientEntry` hook. Rejected: it duplicates upstream's frame resolution and error handling and is exactly the Pitlane-specific wiring this proposal removes; the `assets` option is the seam upstream designed for bundlers.

## Open questions

- [NEEDS CLARIFICATION: Should `assets.getScriptEntry` also answer for the browser entry (the `clientEntry` option) in this proposal, so a document can take its script href and preloads from the same object `render()` uses, or does that wait for a later change once the island path has shipped?]
- [NEEDS CLARIFICATION: The resolver's dev href for an island omits Vite's `?t=` HMR timestamp. If the HMR end-to-end suite shows a stale island after a server-only change, is appending the module's `lastHMRTimestamp` acceptable, or should the island path never depend on the module graph?]

## Acknowledgments

Mark Dalgleish, for pointing at `resolveClientEntry` as the bundler seam at Remix Jam 2026. Kent C. Dodds's Kody, for being the production app that showed where the current integration pinches.

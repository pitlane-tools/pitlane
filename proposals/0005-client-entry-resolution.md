---
id: proposal.0005
title: Client Entry Resolution
authors: [markmals]
status: draft
pull-request: https://github.com/pitlane-tools/pitlane/pull/58
issues: []
supersedes: []
---

# Client Entry Resolution

## Summary

`@pitlane/dev` exposes an `assets` object with the `remix/assets` method surface — `getScriptEntry`, `getHref`, `getPreloads`, `getImportMap` — plus `getStylesheets` for CSS imported by server-rendered components, so a Pitlane document and `render({ assets })` are written exactly as under No Build. Islands resolve at render time through Remix's `resolveClientEntry`, `?assets=` imports go away, and the plugin owns its manifest and dev server instead of `@hiogawa/vite-plugin-fullstack`.

## Motivation

Remix 3 has one documented way for a document to name its browser assets and for the renderer to hydrate an island: an asset server object. `app/assets.ts` constructs it, the document reads `assets.getScriptEntry(entry)` for the script tag and `assets.getHref(path)` for stylesheets, and `render({ assets })` resolves every `clientEntry(import.meta.url, …)` through `assets.getScriptEntry` when it sees a `file:` id. Pitlane answers the same questions with a different vocabulary — `?assets=client` and `?assets=ssr` imports, an `ImportedAssets` shape, `mergeAssets`, and a build-time transform that writes the final island URL into the server bundle. The result is worse than the upstream shape in four ways.

- **Islands get no preload hints.** The build knows each island chunk's reachable JS and the transform discards it. The one production consumer that has hit this, [Kody](https://github.com/kentcdodds/kody), hand-computes `modulepreload` hrefs from `ImportedAssets.js` and forwards them through its own `resolveClientEntry` ([`ssr-render.tsx`](https://github.com/kentcdodds/kody/blob/main/packages/worker/src/app/ssr-render.tsx)).
- **A document cannot move between No Build and Pitlane.** The upstream template's `document.tsx` reads `href`, `preloads`, and `importMap` from one object; a Pitlane document imports `?assets=` modules and merges them. Switching bundling strategy means rewriting the document and the render wiring, which is the opposite of what a Vite alternative to `remix/assets` should cost.
- **Every island and every `?assets=` import is a virtual module in the server bundle.** Island modules each prepend `import … from "<id>?assets=client"`, so a second orchestrator that bundles the SSR output (observed with Nitro) can lose the manifest those imports point at, and Pitlane re-synthesizes it by regex-scanning built chunks. Kody maintains alias-swapped stub modules for every `?assets=` import so Vitest without the plugin and the Wrangler bundler can resolve its graph ([commit f4b3565](https://github.com/kentcdodds/kody/commit/f4b35651c6dcc0550c54813427a078bd7aeaa7e6)).
- **The integration depends on a dormant package.** `@hiogawa/vite-plugin-fullstack` was last published 2025-12-22, its default branch last moved 2026-01-08, it declares `peerDependencies.vite: ^7` while this repository runs Vite 8 and Vite+ 1.0, and it carries the only advisory in Pitlane's production dependency graph (`srvx`, moderate), used solely to adapt a fetch handler to Node for the dev server.

## Domain grounding

### Established context

Read from the installed `@remix-run/component@1.0.0`, `@remix-run/render-middleware@1.0.0`, `@remix-run/assets@1.0.0`, and `@remix-run/cli@1.0.0` sources; line references are to `src/`.

- `clientEntry(entryId, component)` stores the id as `component.$entryId` and nothing else (`component/runtime/client-entries.ts:108-118`). **The server renderer is the only reader of `$entryId`** (`component/server/stream.ts:1069`). The browser hydrates from the `moduleUrl` and `exportName` the server serialized into `#rmx-data` and uses `${moduleUrl}#${exportName}` as the component's identity (`component/runtime/frame.ts:1277`).
- `renderToStream(node, { resolveClientEntry })` calls the hook once per distinct component per render, after the tree has rendered, and expects `{ href, exportName, preloads?, importMap? }` (`stream.ts:71-74, 99-105, 1107-1135`). Without a hook, the default resolver splits the id on its last `#`, uses the prefix verbatim as `href`, and falls back to `component.name` for the export (`:1079-1105`).
- `preloads` become `<link data-rmx-module-preload rel="modulepreload">` tags hoisted into the document head, including out of frame responses (`:1140-1146, 1316-1330`). `importMap` merges into the managed `<ImportMap>`; an empty `imports` object yields no delta and emits nothing (`:1470-1496, 1498-1521`).
- The `render()` middleware does not expose the hook. It takes `assets?: Pick<AssetServer, "getScriptEntry">` (`render-middleware/lib/render-ui.ts:53-59`). For an id whose prefix starts with `file:` it requires `assets` and returns `assets.getScriptEntry(prefix)` merged with the export name; any other id passes through as `href` (`:200-226`). Its error when `assets` is missing reads: "clientEntry() cannot use a file: source entry ID without an asset server. Pass the asset server to render({ assets })."
- The asset server's consumer surface is `getScriptEntry(path) → { href, preloads, importMap }`, `getHref(path, options?) → string`, `getPreloads(path | path[]) → string[]`, `getImportMap(path | path[])`, `getAssets()`, `getAssetDetails()`, and `fetch(request)` (`assets/lib/asset-server.ts:311-349`; README §Script Entries, §Hrefs, §Preloads). Paths are root-relative, absolute, or `file://` URLs. `ScriptEntry` is `{ href: string; preloads: string[]; importMap: { imports: Record<string, string>; scopes?: … } }` (`:298-305`, `scripts/compiler.ts:52-55`). `getPreloads` lists each entry module first, then its static graph shallowest-first (`scripts/compiler.ts:227-256`).
- The CLI template's `app/assets.ts` exports `assets` and `scriptEntry = await assets.getScriptEntry(entry)`; `document.tsx` renders `<ImportMap value={importMap} />`, one `modulepreload` link per preload, and `<script type="module" src={href}>` (`cli/template/app/assets.ts`, `app/actions/document.tsx`).
- Upstream's migration guidance for custom pipelines: resolve client entries with `getScriptEntry()` and include `importMap` and `preloads` in the object returned from `resolveClientEntry()` ([rc.2 release notes](https://github.com/remix-run/remix/pull/11802)).
- Vite's dev server serves a CSS file requested with `Accept: text/css` — which is what a `<link rel="stylesheet">` sends — as plain CSS by adding `?direct` (`vite/dist/node/chunks/node.js:20199`), and its client swaps matching `<link>` tags on `css-update`. A stylesheet referenced only by a link tag needs no Pitlane dev machinery.
- Vite's module runner sets `import.meta.url` to the module's `file://` URL in dev (`vite/dist/node/module-runner.js:791-796`). A production SSR chunk's `import.meta.url` is the chunk's own location, which many source modules share; one consumer reports it empty on Cloudflare Workers (Kody, `ssr-render.tsx` comment; not verified against workerd documentation).

### Relevant constraints and principles

- **Bundling destroys source identity on the server.** The asset server's model is one source file per served module, so a `file:` URL is both an identity and a lookup key. After bundling, no runtime value identifies the source module; the identity has to be written into the code at transform time.
- **A bundler must know its inputs before the build.** Upstream's methods take runtime strings and compile whatever they name. Under Vite, a file the client build never emitted has no production URL. Vite's precedent for closing this is static analysis of literal arguments (`new URL("./x", import.meta.url)`, `import.meta.glob`); a dynamic argument needs an explicit declaration.
- **`component.name` is not a safe export name.** Minification renames functions; the export name is reliable only when the transform reads it from the export declaration and writes it into the id as a `#` fragment.
- **A module becomes a client chunk only because the build was told to emit it.** Discovery happens while bundling the server environment; the client build runs after it and emits each discovered module with `preserveSignature: "exports-only"` so the named export survives.
- **The entry id never reaches the browser, but hrefs do.** Consumer tests parse `#rmx-data` and assert `moduleUrl` and `exportName` (Kody, `ssr-render.node.test.ts`).
- **Virtual ids do not exist outside Vite.** Any surface that is only a virtual id or import query is one more stub pair for graphs Vite does not build.
- **Vision principle 3, Runtime When Possible.** Methods callable at runtime, with build-time analysis as the optimization that makes them work under a bundler, is the direction the vision prefers.

### Quality bar

- A document written against the `remix/assets` template runs under Pitlane with its asset construction changed and nothing else.
- One identity scheme for islands, identical in dev and build, reproducible across machines, never containing a runtime-specific value.
- Islands get `preloads` through the renderer's existing head hoisting.
- One manifest, one import of it in the server bundle, derivable from captured output bundles so prerendering and second-orchestrator builds keep working.
- Dev serving, dev stylesheet links, and HMR behave as they do today; the existing end-to-end suite is the specification for that half.

### Remaining uncertainty

- Whether Vite's `?t=<timestamp>` cache-busting on island hrefs matters once the resolver computes dev URLs without it. Component HMR swaps components in place rather than re-importing island URLs, and a fresh document has a fresh module map, so the expectation is no; the HMR end-to-end suite decides.
- Whether emitting a stylesheet as a client-build chunk through `this.emitFile({ type: "chunk" })` yields a CSS asset and no JS chunk the way a CSS entry in `rollupOptions.input` does. Vite's pure-CSS-chunk handling is written for any chunk, so the expectation is yes; the implementation's manifest test decides.
- Whether Vite's full-bundle dev mode (`--bundled` in the e2e harness) changes how dev URLs are formed. The harness already runs it; it decides.

## Existing baseline

Three specimens.

**`@pitlane/dev` today.** `transform.ts` rewrites `export let Name = clientEntry(import.meta.url, …)`: in server environments it prepends `import ___clientEntryAssets from "<id>?assets=client"` and writes `___clientEntryAssets.entry + "#Name"`; in the client environment it writes `import.meta.url + "#Name"`. `@hiogawa/vite-plugin-fullstack` answers `?assets=`: in dev with the module's dev-server URL and the CSS reachable from it in the server graph, in build with a manifest lookup; loading `?assets=client` during the SSR build is what marks a module as a chunk the client build must emit. After both builds it writes `__fullstack_assets_manifest.js` into the SSR output and copies SSR-emitted assets to the client output; `build.ts:160-239` does the same again when the upstream write did not land. Worth keeping: the AST-based call matching and export-name extraction, the SSR-first sequencing, server-graph CSS collection with `data-vite-dev-id` links and the Vite client patch that lets them coexist with injected styles, and the manifest-from-captured-bundles logic. Incidental: the `?assets=` vocabulary, the client-environment rewrite that nothing reads, the per-island virtual import, the fallback duplication, and `hmr-component.ts` answering `?assets=client` for its own virtual island.

**`remix/assets` with `render({ assets })`.** The reference this proposal adopts the shape of: one object, a document that reads it, a renderer that resolves islands through it. Its identity scheme assumes unbundled source, which is the one thing Pitlane cannot adopt, and its constructor options describe compilation and serving that Vite config already owns.

**Kody.** The largest open-source Remix 3 app runs on `@pitlane/dev` and shows the seams: a hand-written `resolveClientEntry` that forwards `preloads` computed from `?assets=client`, per-route preloads assembled by merging several `?assets=client` results, stub modules for every Pitlane virtual id, and SSR tests that pin `#rmx-data`.

## Proposed solution

Give Pitlane the asset server's method surface, backed by the build instead of a compiler, and let the renderer's own contract resolve islands.

```ts
// app/assets.ts
import { assets } from "@pitlane/dev/runtime";

export { assets };
export const scriptEntry = await assets.getScriptEntry("app/entry.browser.ts");
```

```tsx
// app/document.tsx — the remix CLI template, unchanged
let { href, importMap, preloads } = scriptEntry;
<ImportMap value={importMap} />
{preloads.map(preloadHref => <link key={preloadHref} rel="modulepreload" href={preloadHref} />)}
<link rel="stylesheet" href={await assets.getHref("app/styles.css")} />
<script type="module" src={href} />
```

```ts
// app/entry.server.ts
createRouter({ middleware: [staticFiles("./dist/client"), render({ assets })] });
```

Islands need nothing from the app:

```text
export let Counter = clientEntry(import.meta.url, …)   in app/components/counter.tsx
  → transform (every environment):  clientEntry("file:app/components/counter.tsx#Counter", …)
  → render({ assets }) sees "file:" and calls assets.getScriptEntry("file:app/components/counter.tsx")
  → dev:   { href: "/app/components/counter.tsx", preloads: [], importMap: { imports: {} } }
  → build: { href: "/assets/counter-Bx1.js", preloads: ["/assets/counter-Bx1.js", "/assets/chunk-9k.js"], importMap: { imports: {} } }
  → #rmx-data: { moduleUrl: "/assets/counter-Bx1.js", exportName: "Counter" }
  → <head>: <link rel="modulepreload" href="/assets/counter-Bx1.js"> …
```

The build learns what the document names the same way Vite learns what `new URL("./x", import.meta.url)` names: literal arguments to these methods in server code register the files as client inputs. `?assets=` imports, `ImportedAssets`, and `mergeAssets` are removed, and `@hiogawa/vite-plugin-fullstack` with them.

## Detailed design

### The `assets` object

- `@pitlane/dev/runtime` exports `assets`, typed as `Assets`, and the types `Assets` and `ScriptEntry`. `Assets` is structurally compatible with `Pick<AssetServer, "getScriptEntry" | "getHref" | "getPreloads" | "getImportMap">` from `remix/assets` without depending on that package for the types.
- Every method accepts a root-relative path, an absolute path, or a `file:` URL, with or without a `#fragment`, and normalizes it to the file's path relative to the Vite root in POSIX form — the key. `file:` is stripped before normalization, so the `render()` middleware's `file:<key>` ids and a document's `"app/entry.browser.ts"` reach the same lookup.
- `getScriptEntry(path)` returns `{ href, preloads, importMap: { imports: {} } }`: in dev, `href` is the key's dev URL and `preloads` is `[]`; in build, `href` is the key's emitted chunk URL and `preloads` is that chunk followed by its transitive static imports, shallowest-first, matching `remix/assets`.
- `getHref(path)` returns the key's dev URL in dev and its emitted URL in build: a chunk URL for a script, a CSS asset URL for a stylesheet, an asset URL for any other file. It takes no `transform` option; passing one is a type error.
- `getPreloads(path | path[])` returns, in build, the union of each key's preload list in argument order, deduplicated by href; a stylesheet key contributes its own URL. In dev it returns `[]`.
- `getImportMap(path | path[])` returns `{ imports: {} }`. A Pitlane build has no import map to emit; the method exists so a document written for `remix/assets` type-checks and renders.
- `getStylesheets(path)` is Pitlane's extension. It returns the hrefs of every stylesheet reachable from the key through `import` statements: in dev, through the server environment's module graph, as dev URLs the plugin's Vite client patch can reconcile with the styles Vite injects; in build, through the chunk graph of every environment that bundled the module, deduplicated by href. CSS imported only by browser-side modules is injected by Vite in dev and reported here in build.
- A dev URL is `base + key` for a key under the root, `base + "/@fs/" + absolutePath` for a key beginning with `../`, and the key itself when it already begins with `/` (the form used for virtual ids).
- If a key has no record in the build manifest, the method throws an `Error` naming the key and the call, stating that the file was not registered as a client asset, and pointing at `remix({ assets })` for paths that are not literal in source.
- Outside a Vite-built or Vite-served module graph, every method throws an `Error` stating that no asset manifest is available and that the server must be built or served by `remix()` from `@pitlane/dev`. Nothing passes a key through as an href.
- The methods read from one internal module, `@pitlane/dev/runtime/manifest`, whose published file throws as above; the plugin resolves that specifier to a generated module in dev and to the emitted manifest in build. Application code never imports it.
- A direct `renderToStream` caller resolves an island with `{ ...(await assets.getScriptEntry(entryId)), exportName }`, taking `exportName` from the fragment; the vite-plugin guide shows this, and the package exports no second helper.

### The island key

- The transform matches `export <let|const|var> Name = clientEntry(import.meta.url, …)` at module top level, as today. The first argument becomes the string literal `"file:" + key + "#" + Name`. A module whose id is not a file (the dev HMR island) uses its Vite dev URL as the key, which only arises in dev because that island is inert in a build.
- The same literal is written in every environment. `import.meta.url` never survives a matched call.
- Default exports, aliased callees, non-exported calls, and calls with fewer than two arguments are left untouched, as today.

### Registration

- The plugin keeps a registry of `(key, environment)` pairs naming the files the client build must emit. It is filled during server-environment builds from three sources and read by the client build.
- **Islands.** Every `clientEntry()` match in a server environment registers its module for the `client` environment.
- **Literal method arguments.** In every server-environment module, a call expression whose callee is a member named `getScriptEntry`, `getHref`, `getPreloads`, or `getStylesheets` and whose first argument is a string literal, or an array literal of string literals, registers each path. A path that does not resolve to a file from the root is a build error naming the module and the call. A non-literal argument registers nothing and is not an error.
- **Configuration.** `remix({ assets: string[] })` registers each root-relative path, for arguments that are computed at runtime.
- The `clientEntry` option is registered as it is today, as the client build's input.
- A registered script is emitted in the client build with `this.emitFile({ type: "chunk", id, preserveSignature: "exports-only" })`; a stylesheet as a chunk whose only module is CSS, so the build emits its CSS asset; any other file as an asset named by the client environment's `assetFileNames`.
- SSR environments build before the client environment, as today, because the client build reads the registry the server build fills.

### The manifest

- The manifest records, per environment and per key, `{ entry?: string; js: string[]; css: string[] }`: `entry` the URL of the key's chunk or asset, `js` the chunk and its transitive static imports, `css` the stylesheets those chunks import — each prefixed with the client environment's `base`, or the string `experimental.renderBuiltUrl` returns when it returns one.
- After the last environment builds, the plugin writes `__pitlane_assets_manifest.js` into the server output directory from the captured bundles, and copies SSR-emitted assets into the client output directory, as today. There is no fallback write; this is the only path, and it is what prerendering and a second orchestrator consume.
- The server bundle references the manifest through one import, rewritten in `renderChunk` to a path relative to the importing chunk.

### Dev serving and stylesheets

- The dev server handler keeps serving requests through the first server environment's entry `default.fetch`, adapted with `createRequestListener` from `remix/node-fetch-server`. `serverHandler: false` keeps disabling it.
- The Vite client patch that lets server-graph stylesheet links coexist with Vite's injected styles moves into the plugin with attribution. Links carry plain hrefs; the patch maps a link's pathname back to a module id using the root the plugin writes into it. The CSS self-accept patch moves with it.
- The client build keeps a fallback input when `clientEntry` is `false`, so a server-only configuration with islands still produces a client build.

### Removals

- `?assets`, `?assets=client`, and `?assets=ssr` imports are not resolved; an import with that query fails as any unknown query does. `ImportedAssets` and `mergeAssets` are removed from `@pitlane/dev/runtime`; the wildcard module declarations are removed from `@pitlane/dev/assets`, which keeps the `pitlane:dev` declaration.
- `hmr-component.ts` no longer answers `?assets=client` for its island.
- `@hiogawa/vite-plugin-fullstack` is removed from `@pitlane/dev`'s dependencies. No replacement dependency is added.

## Compatibility

Breaking for every app that renders a document or an island through `@pitlane/dev`.

| Today | After |
| --- | --- |
| `import clientAssets from "./entry.browser.ts?assets=client"` → `.entry` | `(await assets.getScriptEntry("app/entry.browser.ts")).href` |
| `clientAssets.js` → `modulepreload` links | `.preloads` from the same call, or `assets.getPreloads([...])` |
| `import serverAssets from "./entry.server.tsx?assets=ssr"` → `.css` | `await assets.getStylesheets("app/entry.server.tsx")` |
| `mergeAssets(clientAssets, serverAssets)` | arrays; `getPreloads` and `getStylesheets` deduplicate |
| `render()` | `render({ assets })` |
| hand-written `resolveClientEntry` forwarding preloads | delete it |

- An app that calls `render()` without `assets` fails at its first island render with the upstream error quoted above.
- The serialized `moduleUrl` in `#rmx-data` is unchanged in build (the hashed chunk URL) and unchanged in dev (the module's dev URL) for file-backed islands.
- `pitlane:dev` and every existing `remix()` option keep their meaning; `assets` is a new option.
- The manifest file in the server output is renamed to `__pitlane_assets_manifest.js`, and plugin names reported by Vite change from `fullstack:*` to `pitlane-remix-*`. Nothing documented reads either by name.

The changeset is a minor bump of `@pitlane/dev` with the break and the migration table in its body, following the package's 0.x practice.

## Implications on adoption

- Every app migrates its document and render wiring once, by the table above. Templates that depend on `@pitlane/dev` adopt the change through `.agents/skills/adopting-packages-into-templates/`.
- An app moves between No Build and Pitlane by changing how `app/assets.ts` constructs `assets`; the document and `render({ assets })` are the same in both.
- Reversible by pinning the previous `@pitlane/dev` minor.

## Scope

- The `assets` object and its types on `@pitlane/dev/runtime`; the internal manifest module; the transform change for island keys and literal-argument registration; the `assets` option.
- The manifest writer, SSR-asset copying, dev stylesheet collection with the Vite client patches, the client fallback input, and the dev server handler implemented in `@pitlane/dev`; removal of `?assets=`, `ImportedAssets`, `mergeAssets`, the fallback manifest synthesis, and the fullstack dependency.
- Tests: transform unit tests for the literal key and for registration from literal arguments; unit tests for the manifest writer and each `assets` method in dev and build; the node end-to-end fixture asserting the document's script and stylesheet hrefs, an island's hashed `moduleUrl`, and its `modulepreload` link; the dev, HMR, Cloudflare, prerender, and SPA suites migrated to the object and green.
- Guides: the asset and client-entry sections of the vite-plugin guide rewritten around `assets`, the HMR and SPA guides' `?assets=` references updated, the package README; a changeset.
- `VISION.md` updated in phase 5 where it says the plugin wraps fullstack and describes the transform's output.

### Out of scope

- Import map generation. A Pitlane build has no import map to emit; `getImportMap` and `importMap` are empty for source compatibility.
- `assets.fetch`, `getAssets`, and `getAssetDetails`. Vite serves in dev and `staticFiles` in production; inspection is Vite's.
- File transforms through `getHref`'s `transform` option. Image transforms are the concern of the planned image packages.
- Moving `pitlane:dev` to a real package specifier. The same non-Vite-graph friction applies to it, but it is a separate change with its own compatibility story.

## Preview

- Artifact: the pkg.pr.new build of `@pitlane/dev` from `pkg-preview.yml`, installed into a copy of `packages/dev/tests/fixtures/node-app` migrated to `assets` and `render({ assets })`, run with `vite dev` and `vite build && vite preview`, inspecting the document head and `#rmx-data`.
- Reason: the change is package behavior with a server-rendered surface; the fixture is the smallest app that exercises a document, a stylesheet, and an island in both modes. The guide changes ride on the docs preview for prose only.

## Policies and decisions checked

- `decision.0001` Static Documentation Delivery — the docs site is prerendered and served statically; this proposal changes how `@pitlane/dev` names assets and resolves islands, which the docs build exercises through `remix({ prerender })`, and does not alter delivery. The docs app's own document migrates to `assets` as part of scope.
- `policies/` is empty.
- `VISION.md` §`@pitlane/dev` — states that the plugin wraps `@hiogawa/vite-plugin-fullstack` and that the server transform resolves to the client asset URL. Both sentences become false and are updated in phase 5. Principle 3, Runtime When Possible, favors this direction: the methods are runtime calls, and static analysis is the optimization that makes them work under a bundler.

## Future directions

- `pitlane:dev` offered as a real specifier the plugin swaps, for the same non-Vite-graph reason the resolver is.
- `getHref` accepting a `transform` option once an image package defines what a transform is under Vite.

## Alternatives considered

- **Keep `?assets=` and add `assets` beside it** — a softer upgrade. Rejected: two vocabularies for one question, both to document and test, and the second one would be the one Pitlane already knows is worse.
- **Keep the transform writing final URLs and let apps add `resolveClientEntry` themselves** — the Kody pattern. Rejected: it solves the symptom in every app instead of the cause in the plugin.
- **`createAssets(options)` instead of an exported singleton** — mirrors upstream's constructor. Rejected: there is nothing to pass; root, base, minification, source maps, and HMR are Vite config, and an empty-argument constructor invites options that duplicate it. `app/assets.ts` still exists in both worlds and still exports `assets`.
- **Configuration-only registration** — `remix({ assets })` for every non-entry file. Rejected as the sole mechanism: every stylesheet is written twice, and a forgotten entry fails only in production. It stays as the mechanism for dynamic arguments.
- **A virtual module such as `pitlane:assets`** — matches the `pitlane:dev` convention. Rejected on Kody's evidence: every virtual id in application code is one more stub pair for graphs Vite does not build.
- **Absolute `file:///…` keys** — need no path computation in dev. Rejected: a build-machine path baked into `dist/ssr` makes builds non-reproducible across machines and says nothing the root-relative path does not.
- **Pitlane's own `render()` middleware** — would expose the full `resolveClientEntry` hook. Rejected: it duplicates upstream's frame resolution and error handling, and the `assets` option is the seam upstream designed for bundlers.
- **Folding server-graph CSS into `getPreloads`** — fewer methods. Rejected: a document would have to tell stylesheet links from module preloads by extension, and the two are rendered differently.

## Open questions

- [NEEDS CLARIFICATION: The resolver's dev href for an island omits Vite's `?t=` HMR timestamp. If the HMR end-to-end suite shows a stale island after a server-only change, is appending the module's `lastHMRTimestamp` acceptable, or should the island path never depend on the module graph?]

## Acknowledgments

Mark Dalgleish, for pointing at `resolveClientEntry` as the bundler seam at Remix Jam 2026. Kent C. Dodds's Kody, for being the production app that showed where the current integration pinches.

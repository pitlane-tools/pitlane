---
id: proposal.0005
title: Assets Package
authors: [markmals]
status: draft
pull-request: https://github.com/pitlane-tools/pitlane/pull/58
issues: [https://github.com/pitlane-tools/pitlane/issues/52]
supersedes: []
---

# Assets Package

## Summary

A new `@pitlane/assets` package: a framework-neutral replacement for `@hiogawa/vite-plugin-fullstack`'s asset integration, with an explicit resolver instead of query imports. Its `assets()` Vite plugin discovers browser inputs, collects environment-specific asset metadata, and supplies the manifest; `createAssetResolver(manifest)` resolves script URLs, stylesheets, preloads, and import maps without importing a framework. All seven upstream fullstack examples form the compatibility matrix. Request serving, rendering, hydration, and component HMR remain with the application, framework, or runtime.

Remix is a first-class consumer, not a dependency of the neutral core. A second package, `@pitlane/vite-plugin-fetch-server`, owns the framework-neutral Vite development request bridge. `@pitlane/dev` is renamed to `@pitlane/vite-plugin-remix`; it keeps `clientEntry()` recognition, export-name encoding, and Remix HMR and composes both neutral plugins. The resolver remains structurally compatible with `remix/assets`. The extractions, rename, caller migrations, and fullstack removal are one coordinated cutover, with no deprecated forwarding package.

Chunk import maps are disabled by default. Applications opt in through `chunkImportMap: true` and deliver the map before their module scripts. A proposed framework-neutral HTML helper handles serialization without requiring Remix's `<ImportMap>`; its contract remains open for review below.

Manifest generation is also a public, bundler-neutral library at `@pitlane/assets/build`. The Vite adapter uses it, and an Rsbuild integration example shows how another integration author can translate their bundler's output into its input. Pitlane does not ship or maintain an Rsbuild adapter. This is a build-based asset pipeline; `remix/assets` remains the no-build solution.

## Motivation

Remix 3 has one documented way for a document to name its browser assets and for the renderer to hydrate an island: an asset server object. `app/assets.ts` constructs it, the document reads `assets.getScriptEntry(entry)` for the script tag and `assets.getHref(path)` for stylesheets, and `render({ assets })` resolves every `clientEntry(import.meta.url, …)` through `assets.getScriptEntry` when it sees a `file:` id. Pitlane answers the same questions with a different vocabulary — `?assets=client` and `?assets=ssr` imports, an `ImportedAssets` shape, `mergeAssets`, and a build-time transform that writes the final island URL into the server bundle. The result is worse than the upstream shape in four ways.

- **Islands get no preload hints.** The build knows each island chunk's reachable JS and the transform discards it. The one production consumer that has hit this, [Kody](https://github.com/kentcdodds/kody), hand-computes `modulepreload` hrefs from `ImportedAssets.js` and forwards them through its own `resolveClientEntry` ([`ssr-render.tsx`](https://github.com/kentcdodds/kody/blob/main/packages/worker/src/app/ssr-render.tsx)).
- **A document cannot move between No Build and Pitlane.** The upstream template's `document.tsx` reads `href`, `preloads`, and `importMap` from one object; a Pitlane document imports `?assets=` modules and merges them. Switching bundling strategy means rewriting the document and the render wiring, which is the opposite of what a Vite alternative to `remix/assets` should cost.
- **Every island and every `?assets=` import introduces a virtual id into the application graph.** Island modules each prepend `import … from "<id>?assets=client"`, so a second orchestrator that bundles the SSR output (observed with Nitro) can lose the manifest those imports point at, and Pitlane re-synthesizes it by regex-scanning built chunks. Kody maintains alias-swapped stub modules for every `?assets=` import, plus a worker-typecheck stub, so Vitest without the plugin and the Wrangler bundler can resolve its graph ([commit f4b3565](https://github.com/kentcdodds/kody/commit/f4b35651c6dcc0550c54813427a078bd7aeaa7e6)). That historical specimen also stubs `pitlane:dev`; PR #61 has already removed that HMR virtual module from Pitlane's main branch.
- **The integration depends on a dormant package.** `@hiogawa/vite-plugin-fullstack` was last published 2025-12-22, its default branch last moved 2026-01-08, it declares `peerDependencies.vite: ^7` while this repository runs Vite 8 and Vite+ 1.0, and it carries the only advisory in Pitlane's production dependency graph (`srvx`, moderate), used solely to adapt a fetch handler to Node for the dev server.

There is also a packaging reason. The vision asks that new features be attempted as new packages first and that each package be useful when installed directly. Asset resolution under Vite is a product of its own: React, Preact, Vue, Remix, and plain HTML applications need the same browser URLs and dependency metadata. Replacing fullstack must preserve that framework-neutral boundary rather than turn it into a Remix-only package.

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
- Remix renamed its component runtime during prerelease: the umbrella's `remix/ui` subpath became `remix/component`, `remix@3.0.0` exports no `./ui`, and `@remix-run/ui` on npm is now a different package (UI primitives, created 2026-04-29, depending on `@remix-run/component`). The precedent is a hard rename at 0.x, not a deprecated parallel package.
- Vite's experimental [`build.chunkImportMap`](https://vite.dev/config/build-options#build-chunkimportmap), introduced in 8.1, delegates stable chunk identifiers and import rewriting to Rolldown and emits `importmap.json`. Its [caching optimization](https://vite.dev/guide/features#chunk-import-map-optimization) prevents content-hash changes from cascading through importing JS chunks; CSS and asset changes can still invalidate their directly referencing chunk. It requires `import.meta.resolve` support and does not support combining the option with `experimental.renderBuiltUrl`.
- A controlled build comparison using the installed Vite 8.3.1 changed one of two explicitly separated dependencies: with chunk import maps enabled, the application and lazy importer retained identical bytes and filenames, and only the changed dependency's map target changed. Without the option, both importers changed. The installed Remix `<ImportMap>` rendered the generated map before the module script. This establishes build and serialization compatibility, not browser cache-hit or complete Pitlane integration proof.
- Rolldown's [`chunk-import-map` plugin](https://github.com/rolldown/rolldown/blob/main/crates/rolldown_plugin_chunk_import_map/src/lib.rs) derives each map key from the chunk's own filename pattern, filling every `[hash]` slot with a hash of the chunk's identity instead of its content: the absolute facade module id for an entry chunk, or the chunk name for a shared chunk, falling back to its smallest module id when that name is already taken. Importers reference the key, so `/assets/counter-DaW9bIKe.js → /assets/counter-CoQZhlRe.js` reads as identity, then current content. Chunks whose filename has no `[hash]` are left out of the map. Under Vite, keys follow `output.entryFileNames` and `chunkFileNames`, the map's filename is configurable through `build.rolldownOptions.experimental.chunkImportMap.fileName`, and Rolldown's `baseUrl` is overwritten with the config's `base`; the identity hash input cannot be configured. Keys cannot be original source paths the way `remix/assets` keys are, because a bundled shared chunk has no single source file.
- A probe on the installed Vite 8.3.2 built identical source from two checkout directories. With chunk import maps enabled, the entry chunk, which dynamically imports an island chunk, had different bytes and filenames in each directory, because the island's key hashes its absolute path; with the option disabled, the outputs were identical. Builds from different checkout paths therefore lose cache hits on every chunk importing an entry or island chunk. No upstream issue tracking this was found.
- [Vite 8 exports `parseSync` and the `ESTree` types through its public API](https://github.com/vitejs/vite/blob/v8.0.0/packages/vite/src/node/index.ts); [Vite 7 instead exports Rollup's `parseAst` and `parseAstAsync`](https://github.com/vitejs/vite/blob/v7.3.0/packages/vite/src/node/index.ts). Pitlane currently imports `oxc-parser` directly in `transform.ts`, `hmr.ts`, and `route-map.ts`; the last parses raw TypeScript server entries from disk, before Vite transforms them.
- A local parser probe on plain Vite 8.3.2 and Vite+'s Vite 8.3.1 parsed five TypeScript/TSX inputs, including the Cloudflare and HMR fixture server entries, without errors. Top-level node kinds and source offsets matched the existing parser, and the inspected `clientEntry(import.meta.url, …)` argument and JSX structure were preserved. This supports replacing the direct parser dependency; it does not establish minimum-version or end-to-end HMR compatibility.
- Upstream fullstack at [`28e9540`](https://github.com/hi-ogawa/vite-plugin-fullstack/tree/28e9540a68529c58842e9a3bf17d2193a065d524) separates browser-entry emission from metadata lookup: `?assets=client` requests an entry; `?assets=ssr` observes server assets without emitting server code for the browser; bare `?assets` combines client and current-server metadata for shared modules. Its seven examples cover React, Workers, data fetching, Preact islands, React Router, an older Remix DOM integration, and Vue Router with SSG.
- An isolated, framework-free probe using the installed fullstack 0.0.11 and Vite+ served a client module and server-imported stylesheet in dev, then built and executed a server with hashed client JS and copied server CSS. Explicitly emitting that server module into the client build with `preserveSignature: "exports-only"` produced browser-targeted code that failed on `node:fs.readFileSync` when invoked. This establishes the need to distinguish asset observation from browser-entry emission; it is not evidence of a completed `@pitlane/assets` implementation.
- Vite's [Environment API](https://vite.dev/guide/api-environment-frameworks) distinguishes in-process runnable environments from runtimes that communicate across a transport. A Node closure over the dev module graph is not a portable manifest for a Worker. Runtime support for `fetch` handlers also does not by itself connect request handling to Vite's transformed modules and invalidation.
- Remix's [`node-fetch-server`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server) exports `createRequestListener` for an existing Node HTTP server. The direct `@remix-run/node-fetch-server@1.0.0` package has no runtime dependencies. A local HTTP probe using that direct import preserved the URL/query, method, body, response status/header, streamed body, and handler receiver, and ignored an untrusted forwarded host by default. This verifies conversion-library reuse, not the proposed Vite bridge's invalidation or error integration.
- The HTML standard defines [import maps](https://html.spec.whatwg.org/multipage/webappapis.html#import-maps) as inline JSON in a `script` element. Its [script-content restrictions](https://html.spec.whatwg.org/multipage/scripting.html#restrictions-for-contents-of-script-elements) still apply: JSON string escaping alone does not prevent a literal closing-script sequence from ending the element. JSON Unicode escapes for `<` preserve the parsed strings without exposing those sequences to the HTML parser.
- The HMR migration in [PR #61](https://github.com/pitlane-tools/pitlane/pull/61), merged as `d79cde6`, established a Vite-specific constraint: its client queues HMR messages and awaits promises returned by custom listeners. An inline async listener awaiting a frame reload therefore prevents the next server update from superseding it. The browser regression failed with that listener and passed with the void-returning `revalidate(app)` helper. Remix owns cancellation and stale-result suppression; Pitlane needs no browser queue. These are verified properties of the merged HMR baseline, not proposed asset behavior.

### Relevant constraints and principles

- **Bundling destroys source identity on the server.** The asset server's model is one source file per served module, so a `file:` URL is both an identity and a lookup key. After bundling, no runtime value identifies the source module; the identity has to be written into the code at transform time.
- **A bundler must know its inputs before the build.** Upstream's methods take runtime strings and compile whatever they name. Under Vite, a file the client build never emitted has no production URL. Vite's precedent for closing this is static analysis of literal arguments (`new URL("./x", import.meta.url)`, `import.meta.glob`); a dynamic argument needs an explicit declaration.
- **`component.name` is not a safe export name.** Minification renames functions; the export name is reliable only when the transform reads it from the export declaration and writes it into the id as a `#` fragment.
- **A module becomes a client chunk only because the build was told to emit it.** Discovery happens while bundling the server environment; the client build runs after it and emits each discovered module with `preserveSignature: "exports-only"` so the named export survives.
- **The entry id never reaches the browser, but hrefs do.** Consumer tests parse `#rmx-data` and assert `moduleUrl` and `exportName` (Kody, `ssr-render.node.test.ts`).
- **Virtual ids do not exist outside Vite.** Any surface that is only a virtual id or import query is one more stub pair for graphs Vite does not build.
- **Runtime code imported by the app must reach the built server.** `@pitlane/dev` is a dev dependency and bundles its runtime into `dist/ssr` through `ssr.resolve.noExternal` (`packages/dev/src/build.ts:331`). A package whose object application code imports has to arrive the same way, or be a runtime dependency.
- **Vision principles 3, 5, and 6.** Runtime When Possible: methods callable at runtime, with build-time analysis as the optimization. Demand Composition: attempt new features as new packages first; every package useful when installed directly; tightly coupled modules that change together stay together. Distribute Cohesively: each concern an independent `@pitlane/*` package, re-vended by the umbrella. The planned package sequence keeps prerendering inside `@pitlane/dev` ("there is no separate `@pitlane/prerender` package", `VISION.md:178`).
- **Repository precedent for a build plugin that swaps a runtime module.** `@pitlane/content` exports its plugin from `@pitlane/content/vite` and publishes `@pitlane/content/internal/manifest`, "the module a build plugin replaces with the collections it prebuilt. As published, it declares that nothing was prebuilt."
- **The umbrella re-exports every public export.** [decision.0003](../decisions/0003-umbrella-package.md) generates `pitlane/*` subpaths from `packages/pitlane/manifest.json`, pins each package exactly, lifts peers at the narrowest range and keeps a peer required when any package requires it, and releases the umbrella only when a Changesets note names `pitlane`. A package whose behavior depends on how the app imports it must treat `pitlane/<its subpath>` as itself: `runtimeInline()` already resolves `pitlane/dev/runtime` like `@pitlane/dev/runtime`, `@pitlane/content` bundles all of `pitlane` in server builds because Vite externalizes per package, and messages choose a specifier by reading the `Symbol.for("pitlane.umbrella.packages")` set the umbrella's modules populate. App-facing guides use `pitlane/<name>`; package READMEs keep `@pitlane/<name>` (`VISION.md`, Packaging strategy).
- **[decision.0002](../decisions/0002-installed-documentation-for-agents.md) makes the umbrella the installed home of agent documentation.** Once that ships, the `pitlane` tarball carries every published guide as Markdown, each package README beside its subpath, and a generated `INDEX.md`; the skill and `AGENTS.md` line in apps name no API. The documentation is not shipped yet. Repository agent references in `.agents/docs/` (`cookbook.md`, `vite-plugin-remix.md`) still teach `?assets=`, `mergeAssets`, and fullstack.
- **Vision key principle, Remix idioms.** "Platform primitives are adapters you construct … not magic globals. Configuration is explicit." `createAssetServer(options)` is constructed in `app/assets.ts`; a Pitlane equivalent that appears pre-made from a package import is the global the principle names.
- **Vision principle 4, Avoid Dependencies.** The [October dependency audit](../docs/internal/dependency-audit-2026-10.md) identifies fullstack and the separate parser as liabilities in `@pitlane/dev`. This proposal owns the required integration and reuses Vite's parser, rather than copying the whole upstream plugin into `dev`. Dependency removal supports the change; the document, preload, and module-resolution problems above justify the public API break.

### Quality bar

- A document written against the `remix/assets` template runs under Pitlane with its asset construction changed and nothing else.
- `@pitlane/assets` works with plain Vite and no Remix dependency. All seven upstream examples exercise the same asset API; none needs a Pitlane adapter for its framework. Existing framework rendering, hydration, router selection, and HMR wiring remain the framework's responsibility.
- One identity scheme for islands, identical in dev and build, reproducible across machines, never containing a runtime-specific value.
- Islands get `preloads` through the renderer's existing head hoisting.
- One manifest, one import of it in the server bundle, derivable from captured output bundles so prerendering and second-orchestrator builds keep working.
- No virtual id in application code: every Pitlane import resolves in a graph Vite did not build, and behaves honestly there. The one module the plugin swaps is public, so a graph Vite did not build can supply its own.
- Observing a server module's stylesheets never turns that module into a browser entry. Filesystem-discovered routes do not need a second, manually synchronized list of asset paths.
- Import maps are opt-in. Without opting in, ordinary module scripts work without import-map HTML, a browser map manager, or a Remix component.
- Dev serving, dev stylesheet links, and HMR behave as they do today; the existing end-to-end suite is the specification for that half.

### Remaining uncertainty

- Whether Vite's `?t=<timestamp>` cache-busting on island hrefs matters once the resolver computes dev URLs without it. Component HMR swaps components in place rather than re-importing island URLs, and a fresh document has a fresh module map, so the expectation is no; the HMR end-to-end suite decides.
- Whether emitting a stylesheet as a client-build chunk through `this.emitFile({ type: "chunk" })` yields a CSS asset and no JS chunk the way a CSS entry in `rollupOptions.input` does. Vite's pure-CSS-chunk handling is written for any chunk, so the expectation is yes; the manifest test decides.
- Whether Vite's full-bundle dev mode (`--bundled` in the e2e harness) changes how dev URLs are formed. The harness already runs it; it decides.

## Existing baseline

Five specimens.

**`@pitlane/dev` after PR #61, merged but unreleased.** `transform.ts` rewrites `export let Name = clientEntry(import.meta.url, …)`: in server environments it prepends `import ___clientEntryAssets from "<id>?assets=client"` and writes `___clientEntryAssets.entry + "#Name"`; in the client environment it writes `import.meta.url + "#Name"`. `@hiogawa/vite-plugin-fullstack` answers `?assets=`: in dev with the module's dev-server URL and the CSS reachable from it in the server graph, in build with a manifest lookup; loading `?assets=client` during the SSR build is what marks a module as a chunk the client build must emit. After both builds it writes `__fullstack_assets_manifest.js` into the SSR output and copies SSR-emitted assets to the client output; `build.ts` does the same again when the upstream write did not land. Worth keeping: AST-based call matching and export-name extraction, SSR-first sequencing, server-graph CSS collection with `data-vite-dev-id` links and the Vite client patch that lets them coexist with injected styles, manifest-from-captured-bundles logic, and `remix()` as the one plugin an app registers. Incidental: the `?assets=` vocabulary, the client-environment rewrite that nothing reads, the per-island virtual import, and the fallback duplication.

The HMR island, `hmr-component.ts`, and `pitlane:dev` are gone on main. The plugin broadcasts only `server:update` after the existing 50ms trailing debounce for server-only edits. Browser entries import `revalidate` from the real, browser-safe `@pitlane/dev/hmr` subpath and call `import.meta.hot.on("server:update", () => revalidate(app))`. The helper returns `void`, waits for `app.ready()` internally, reloads `app.frames.top`, and catches/logs failures; Remix supersedes older reloads. The umbrella mirrors it as `pitlane/dev/hmr`. There is no alias for `pitlane:server-update`, browser queue, or runtime-module swap. Component HMR is unchanged.

The [templates companion #12](https://github.com/pitlane-tools/templates/pull/12) is draft and unmerged. At `7c906cf`, its seven SSR starters use the helper and all nine CI jobs pass against the pinned `pkg.pr.new` candidate `24f908f`; GitHub Pages stays SPA-only. Neither the HMR change nor a new `@pitlane/dev` version has been released. Publication and template merging are held until this assets cutover and its related changes are ready.

**`remix/assets` with `render({ assets })`.** The reference this proposal adopts the shape of: one object, a document that reads it, a renderer that resolves islands through it. Its identity scheme assumes unbundled source, which is the one thing Pitlane cannot adopt, and its constructor options describe compilation and serving that Vite config already owns.

**`@pitlane/content`.** The repository's precedent for the package shape: runtime at the root, plugin at `/vite`, a published manifest module the plugin replaces, and a README that documents the package without `remix()`. Where `content` keeps that module internal because `createContent()` imports it for the app, this package makes it public because the app imports it itself.

**Kody.** The largest open-source Remix 3 app runs on `@pitlane/dev` and shows the seams: a hand-written `resolveClientEntry` that forwards `preloads` computed from `?assets=client`, per-route preloads assembled by merging several `?assets=client` results, stub modules for `pitlane:dev` and every `?assets=` import, a worker-typecheck stub, and SSR tests that pin `#rmx-data`.

**Fullstack's seven examples.** The [upstream examples](https://github.com/hi-ogawa/vite-plugin-fullstack/tree/28e9540a68529c58842e9a3bf17d2193a065d524/examples) supply their own renderers, routers, hydration, framework plugins, and hosting. Fullstack supplies asset metadata and optionally a Node request bridge. Preserve those as two composable packages: `@pitlane/assets` for metadata and `@pitlane/vite-plugin-fetch-server` for development requests. The query imports, merged wrapper objects, and repeated build-order setup are not requirements of the domain.

## Proposed solution

Provide framework-neutral asset resolution backed by Vite's development graph and build outputs. Keep browser-entry emission distinct from observing assets of an already-built module, and keep framework concepts out of the core. Compose that core into `remix()` while retaining the upstream Remix renderer contract.

The first example follows a Remix app because it establishes compatibility with the existing consumer. The standalone example and seven-example matrix then establish the broader package contract.

```text
app/
├── assets.ts          constructs the asset resolver
├── counter.tsx        an island
├── document.tsx       the remix CLI template's document
├── entry.browser.ts   the browser entry
├── entry.server.tsx   the router, passing the resolver to render()
├── routes.ts
└── styles.css
vite.config.ts
```

### The app

`app/assets.ts` is where a No Build app calls `createAssetServer(options)`. Under Pitlane it constructs a resolver from the manifest the build writes, and resolves the browser entry and the stylesheet once, at module load:

```ts
// app/assets.ts
import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

export let assets = createAssetResolver(manifest);

export let scriptEntry = await assets.getScriptEntry("app/entry.browser.ts");
export let stylesheetHref = await assets.getHref("app/styles.css");
```

These two literals register browser outputs: `getScriptEntry` requests a script entry and `getHref` requests an asset URL. Computed browser entries use `assets({ include })`. Metadata methods such as `getStylesheets` and `getPreloads` observe the captured graphs; they do not turn a server module into a browser entry.

The document is the remix CLI template's, plus one stylesheet link. Nothing in it is Pitlane's:

```tsx
// app/document.tsx
import type { Handle, RemixNode } from "remix/component";
import { ImportMap } from "remix/component/server";

import { scriptEntry, stylesheetHref } from "./assets.ts";

export interface DocumentProps {
    children?: RemixNode;
    title?: string;
}

export function Document(handle: Handle<DocumentProps>) {
    return () => {
        let { children, title = "Counter" } = handle.props;
        let { href, importMap, preloads } = scriptEntry;

        return (
            <html lang="en">
                <head>
                    <meta charSet="utf-8" />
                    <title>{title}</title>
                    <link rel="stylesheet" href={stylesheetHref} />
                    <ImportMap value={importMap} />
                    {preloads.map(preloadHref => (
                        <link key={preloadHref} rel="modulepreload" href={preloadHref} />
                    ))}
                    <script type="module" src={href} />
                </head>
                <body>{children}</body>
            </html>
        );
    };
}
```

The island is written as it is today, with `import.meta.url` as its entry id:

```tsx
// app/counter.tsx
import { clientEntry, on } from "remix/component";

export let Counter = clientEntry(import.meta.url, function Counter(handle) {
    let count = 0;

    return () => (
        <button
            mix={[
                on("click", () => {
                    count++;
                    handle.update();
                }),
            ]}
        >
            Count: {count}
        </button>
    );
});
```

The router passes the same `assets` object to Remix's own `render()` middleware. There is no Pitlane renderer and no hand-written `resolveClientEntry`:

```tsx
// app/entry.server.tsx
import { render } from "remix/middleware/render";
import { staticFiles } from "remix/middleware/static";
import { createRouter, type MiddlewareContext } from "remix/router";

import { assets } from "./assets.ts";
import { Counter } from "./counter.tsx";
import { Document } from "./document.tsx";
import { routes } from "./routes.ts";

let renderMiddleware = render({ assets });
type AppContext = MiddlewareContext<[typeof renderMiddleware]>;

declare module "remix" {
    interface RouterTypes {
        context: AppContext;
    }
}

export let router = createRouter<AppContext>({
    middleware: [staticFiles("./dist/client"), renderMiddleware],
});

router.map(routes.home, ({ render }) =>
    render(
        <Document>
            <Counter />
        </Document>,
    ),
);

export default router;
```

The config changes its package import, not its composition: `remix()` installs the assets plugin and, when enabled, the Fetch-server bridge:

```ts
// vite.config.ts
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix()],
});
```

Moving this app to No Build switches to `remix/assets`, including its asset server and serving integration. Compatibility with its document and `render({ assets })` contract is preserved; `@pitlane/assets` does not supply a second no-build implementation.

An app that installs the `pitlane` umbrella writes the same files with umbrella specifiers:

```ts
// app/assets.ts, through the umbrella
import { createAssetResolver } from "pitlane/assets";
import manifest from "pitlane/assets/manifest";
```

`vite.config.ts` imports `remix` from `pitlane/vite-plugin-remix`, and a plain-Vite config imports `assets` from `pitlane/assets/vite-plugin`.

### What happens to the island

The Remix integration in `@pitlane/vite-plugin-remix` rewrites the island's entry id to the same literal in every environment, an identity with no machine path and no runtime value in it. The neutral assets plugin does not recognize `clientEntry()` or encode export names:

```diff
-export let Counter = clientEntry(import.meta.url, function Counter(handle) {
+export let Counter = clientEntry("file:app/counter.tsx#Counter", function Counter(handle) {
```

When the page renders `<Counter />`, `render({ assets })` sees the `file:` prefix and calls `assets.getScriptEntry("file:app/counter.tsx")`. The resolver strips `file:` to the key `app/counter.tsx`, finds it in the manifest, and returns a `ScriptEntry`. Under `vite dev`, the href is the module's dev URL:

```ts
import type { ScriptEntry } from "@pitlane/assets";

let counterInDev: ScriptEntry = {
    href: "/app/counter.tsx",
    preloads: [],
    importMap: { imports: {} },
};
```

After `vite build`, `href` is the emitted chunk and `preloads` lists that chunk followed by its static imports. By default, `importMap` remains `{ imports: {} }`. The following example explicitly enables `remix({ assets: { chunkImportMap: true } })`: `importMap` is then the complete map Vite generated for the client build. Each map key is the chunk's filename with a stable identity hash in place of its content hash. Hashes here are illustrative:

```ts
import type { ScriptEntry } from "@pitlane/assets";

let counterInBuild: ScriptEntry = {
    href: "/assets/counter-BuA5dl53.js",
    preloads: ["/assets/counter-BuA5dl53.js", "/assets/component-D4xq9a1E.js"],
    importMap: {
        imports: {
            "/assets/component-Kp3vQ8sN.js": "/assets/component-D4xq9a1E.js",
            "/assets/counter-Bj6c-xfy.js": "/assets/counter-BuA5dl53.js",
            "/assets/entry.browser-DwBno1Lm.js": "/assets/entry.browser-ClAcATfe.js",
        },
    },
};
```

Remix's renderer hoists the preloads into the head and writes the island's hydration record. The built page carries:

```html
<link data-rmx-module-preload rel="modulepreload" href="/assets/counter-BuA5dl53.js" />
<link data-rmx-module-preload rel="modulepreload" href="/assets/component-D4xq9a1E.js" />
<!-- … -->
<script type="application/json" id="rmx-data">
    {
        "h": {
            "h1": {
                "moduleUrl": "/assets/counter-BuA5dl53.js",
                "exportName": "Counter",
                "props": {}
            }
        }
    }
</script>
```

Islands get preload hints they do not get today, and the serialized `moduleUrl` stays an emitted chunk URL rather than an import-map identifier.

Chunk import maps are opt-in for the client build. With `remix({ assets: { chunkImportMap: true } })`, a dependency's new hash changes its map entry instead of the bytes of every chunk importing it, subject to the caching limits below. The default uses ordinary Vite chunk references and returns `{ imports: {} }`, as development always does. Applications using `experimental.renderBuiltUrl` or targeting browsers without the required map features leave the option disabled.

### Without Remix

A React, Preact, Vue, or plain-HTML app uses the runtime exactly as shown in `app/assets.ts`, but feeds the returned URLs and stylesheet lists to its own document renderer. It installs neither the Remix framework nor its Vite integration. A standalone Vite development server composes the two neutral plugins:

```ts
import { assets } from "@pitlane/assets/vite-plugin";
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
import { defineConfig } from "vite";

export default defineConfig({
    environments: {
        client: { build: { outDir: "dist/client" } },
        ssr: {
            build: {
                outDir: "dist/server",
                rolldownOptions: { input: "src/http.ts" },
            },
        },
    },
    plugins: [assets(), fetchServer({ entry: "src/http.ts" })],
});
```

`assets()` discovers browser inputs, orders the server build before the client build, collects asset metadata, and writes the manifest. `fetchServer({ entry: "src/http.ts" })` sends application requests through the explicitly named server module loaded by Vite's module runner. The filename and directory belong to the application, not the plugin. Neither plugin supplies a renderer, router, hydration protocol, or component HMR. Add the framework's ordinary Vite plugin when it needs one. When Cloudflare or another integration already owns request serving, omit the Fetch-server plugin and keep `assets()`.

The same resolver works for a Remix application that supplies its own entry registration and identity integration. `assets()` alone does not transform `clientEntry()`; `remix()` is the ready-made Remix composition.

### Framework-neutral compatibility matrix

The seven [upstream examples at `28e9540`](https://github.com/hi-ogawa/vite-plugin-fullstack/tree/28e9540a68529c58842e9a3bf17d2193a065d524/examples) are behavioral baselines, not a promise to preserve their query-import API or old dependency versions. Preserve the non-Remix examples' rendering models. Replace the legacy Remix example with an example targeting the released `remix@3.0.0` API:

| Example | Behavior to preserve |
| --- | --- |
| `basic` | React hydration, browser-entry URLs, server-imported CSS, and React's own refresh preamble. Server-only code stays out of client output. |
| `cloudflare` | The same React asset behavior through the Cloudflare Vite environment. Cloudflare owns requests; no Node graph object or asset-package server adapter enters the Worker. |
| `data-fetching` | Client-entry and shared/server CSS metadata alongside the existing oRPC and TanStack Query integration, with no asset-layer involvement in data fetching. |
| `island` | Preact's existing custom island transform and hydration runtime consume generic browser-entry metadata; CSS and preload hints remain correct. |
| `react-router` | Matched-route assets from `import.meta.glob` discovery. Adding or removing a page requires no second asset list; unrelated routes are not preloaded. |
| `remix` | Use released `remix@3.0.0`, `clientEntry()`, and `render({ assets })` through `@pitlane/vite-plugin-remix`. Verify document assets, island hydration, preloads, current frame navigation, and HMR. Do not preserve `@remix-run/dom`, `hydrated()`, or legacy frame conventions. |
| `vue-router` | Matched-route CSS and preloads, scoped-style HMR, and the existing SSG plugin consuming the completed build manifest. |

Run all seven in dev and production with maps disabled, then verify opted-in maps with each example's own document. Exercise navigation, hydration, and CSS updates against the framework versions specified above. Non-Remix Node fixtures compose `fetchServer({ entry })` directly, with each fixture supplying its server module path; the Remix example uses `remix()` to compose assets and serving; Cloudflare keeps its existing request integration. Generic asset integration may replace old query-import plumbing in custom island transforms, but those transforms remain outside the neutral packages.

### What goes away

`?assets=` imports, `ImportedAssets`, and `mergeAssets` are removed, and `@hiogawa/vite-plugin-fullstack` goes with them. The `@pitlane/dev` package becomes `@pitlane/vite-plugin-remix`, with no compatibility re-export. Component-free HMR and removal of `pitlane:dev` are already merged through [PR #61](https://github.com/pitlane-tools/pitlane/pull/61), not implementation work for this proposal. Preserve that baseline while renaming its `/hmr` import path. Its [templates companion #12](https://github.com/pitlane-tools/templates/pull/12) remains draft and preview-backed until the coordinated release; an intermediate HMR release or template merge is not a prerequisite.

## Detailed design

### Packages and dependency boundaries

- **`@pitlane/assets`**, in `packages/assets`, exports `createAssetResolver`, the proposed `renderImportMap` helper, and Pitlane-owned runtime types from its root. `/manifest` exports the manifest value the build integration supplies; as published it is `{ mode: "unavailable" }`. `/build` exports the bundler-neutral manifest generator and its input types. `/vite-plugin` exports `assets(options?)`. Only `/vite-plugin` imports or requires Vite; the other entry points and their declarations work without Vite, Rolldown, Rsbuild, or Remix installed.
- **`@pitlane/vite-plugin-fetch-server`**, in `packages/vite-plugin-fetch-server`, exports `fetchServer(options)` from its root, with a required `entry` path. It depends directly on `@remix-run/node-fetch-server` for Node HTTP conversion, not on the Remix umbrella, router, renderer, or component runtime. It has no dependency on `@pitlane/assets`.
- **`@pitlane/vite-plugin-remix`** replaces `@pitlane/dev`, including renaming `packages/dev` to `packages/vite-plugin-remix`. Its root exports `remix()`; its browser-safe `/hmr` subpath retains `revalidate(app): void` from PR #61. There is no `/runtime` subpath: the old runtime's asset helpers are removed. `/hmr` must not import the Node/Vite plugin root or pull build tooling into browser code. It composes both neutral plugins and owns Remix entry identity, export-name encoding, existing component/server-data HMR integration, prerendering, preview, and SPA mode. No `@pitlane/dev` alias, compatibility package, deprecated export, or duplicate implementation remains.
- The Vite integration entry points retain a common minimum of Vite 8.1, covering the public parser and optional chunk-import-map feature. Vite is an optional peer of `@pitlane/assets`, needed only for `/vite-plugin`, and a required peer of both plugin-only packages. Vite+ is verified through its `vite` alias. `AssetResolver` remains structurally compatible with `Pick<AssetServer, "getScriptEntry" | "getHref" | "getPreloads" | "getImportMap">` without importing Remix.
- `parseSync` and `ESTree` from Vite replace Pitlane's direct `oxc-parser` dependency. Generic literal-entry analysis lives in the assets adapter; the Remix entry transform, HMR, and route-map analysis stay in the renamed Remix plugin. `magic-string` remains behind the plugin implementations, not in the runtime or generator's published types.
- Runtime packages expose their Vite plugin at `/vite-plugin`, matching the `vite-plugin-` names of plugin-only packages. Migrate existing `/vite` exports, including `@pitlane/content/vite`, to `/vite-plugin` in the same cutover; mirror the rename through the umbrella. Update package exports, all callers, guides, installed documentation, tests, demos, templates, and changesets. Keep plugin function names unchanged and retain no old-path aliases. Baseline references above describe the old published paths, not the proposed API.

### Reaching the packages through the umbrella

- Decision.0003 maps the four assets entry points to `pitlane/assets`, `pitlane/assets/manifest`, `pitlane/assets/build`, and `pitlane/assets/vite-plugin`; the fetch plugin to `pitlane/vite-plugin-fetch-server`; and the renamed Remix plugin to `pitlane/vite-plugin-remix` and `pitlane/vite-plugin-remix/hmr`.
- `packages/pitlane/manifest.json` renames `pitlane/dev` and `pitlane/dev/hmr`, removes `pitlane/dev/assets` and `pitlane/dev/runtime`, and adds the five neutral-package subpaths. `vp run generate` rewrites modules, exports, dependencies, and lifted peers. From the post-HMR baseline the total changes from 16 to 19; existing plugin-subpath renames do not change that count. The lifted Vite peer remains required at `>=8.1.0`.
- The assets plugin swaps both `@pitlane/assets/manifest` and `pitlane/assets/manifest`. Swapped modules are excluded from dependency optimization, and server builds mark the affected scoped runtime packages and `pitlane` as `noExternal` so the swaps are not bypassed. There is no HMR runtime-module swap.
- Errors choose scoped or umbrella specifiers through the existing `Symbol.for("pitlane.umbrella.packages")` convention. Manifest errors point at `pitlane/assets/vite-plugin` for umbrella consumers; no message recommends an obsolete `pitlane/dev` import.

### Conceptual boundary: entries and observations

A browser entry is a module that must be emitted with an addressable URL and its exported API intact. An asset observation asks which emitted JavaScript and CSS a module already present in an environment requires. These are different operations.

- The entry registry contains browser inputs only. Literal `getScriptEntry` and `getHref` arguments in server source register inputs; computed entry paths need an existing entry or `assets({ include: string[] })`, whose values are root-relative paths. Existing Vite client inputs are also entries.
- `getStylesheets`, `getPreloads`, and `getImportMap` observe graph metadata. Calling `getStylesheets("app/entry.server.ts")` must never compile that server module for the browser.
- The metadata index includes modules in the captured environment graphs, including routes discovered through Vite's `import.meta.glob`. Computed lookups for those modules need no second route list. Browser code does not receive the server manifest; a universal route table may share source keys, but actual server-asset lookups stay on the server.
- A registered script is emitted with `preserveSignature: "exports-only"`; a stylesheet as a pure-CSS chunk; another asset according to the build's asset naming. Metadata observation preserves existing chunk ownership and does not expose server-only exports.
- Other plugins use Vite's ordinary input and `this.emitFile` mechanisms. The Remix plugin collects matched islands during server transforms and emits those modules in the client build. The assets adapter captures them like any other browser entry. Custom island integrations can do the same without the core recognizing their framework.
- `assets({ serverEnvironments })` identifies the server environments, default `["ssr"]`. Each server receives a manifest identifying its own environment; default stylesheet queries combine that environment with the client, not every unrelated server graph.

### Bundler-neutral manifest generation

**Proposed public contract:** `createAssetManifest(build)` from `@pitlane/assets/build` converts normalized build output into a serializable build manifest. This is a library for integration authors, not a parser for Vite's private output format and not a compiler. The Vite adapter must call this public function; it cannot retain a separate, more capable generator.

The adapter supplies facts only its bundler knows:

- Named environments and their client/server roles.
- Stable, root-relative source-module keys, excluding machine-specific checkout paths.
- Emitted chunk identities and filenames; source modules belonging to each chunk; ordered static chunk dependencies; and associated CSS files. Dynamic edges remain distinct from static ones.
- Browser-entry source keys and their emitted entry files, plus emitted non-script assets. A server module's membership does not imply a browser entry.
- The public asset base or adapter-resolved public URLs and an optional import map produced by the bundler.

The library owns the common computation: cycle-safe, deterministic static dependency traversal; entry-first, shallowest-first JavaScript preloads; stylesheet collection and href deduplication; source-key indexing; consistent URL resolution; and construction of the manifest consumed by `createAssetResolver`. It rejects conflicting source-entry mappings, missing referenced output nodes, and incomplete graphs with diagnostics naming the environment and key. It does not inspect source files, invent dependency edges, generate import maps, or write files. The adapter owns graph extraction, entry emission, build sequencing, filesystem output, and development invalidation.

Source-to-output mappings may be many-to-many. A module split across multiple chunks must not lose dependencies because an adapter selected only the first chunk. A runtime entry URL remains a single browser-loadable ES module; an adapter whose bundler needs extra startup scripts must represent that startup through its emitted entry rather than pass an IIFE/runtime sequence off as an ES module. Preloads are hints, not substitutes for required script execution.

The exported input types must use Pitlane-owned records rather than `OutputBundle`, `viteMetadata`, or Rspack `Stats`. The implementation proposal for their exact field layout remains open below; the observable semantics in this section are required.

#### Integration-author example

Ship a complete, exercised Rsbuild integration example in the adapter-author guide, not a published or supported `@pitlane/assets/rsbuild` plugin. It extracts a real compilation's source/chunk/entry/CSS relationships, passes the normalized graph to `createAssetManifest`, writes the returned manifest, and consumes it through `createAssetResolver`. The example targets a declared browser-ES-module output configuration and states its limits; it does not imply coverage of every Rspack output mode.

Rsbuild's [plugin API](https://rsbuild.rs/plugins/dev/) permits access to the underlying Rspack compilation through its [environment compilation hooks](https://rsbuild.rs/plugins/dev/hooks#onafterenvironmentcompile) or a composed Rspack plugin. Use those real interfaces, not an unexplained `convertStats()` placeholder or a hand-authored final manifest. Capture all required environments before generating the combined artifact. The example proves that an external author can implement the translation without importing Vite or copying Pitlane's traversal logic.

No CLI or intermediate graph-file format is introduced now: bundler plugins already hold the graph in memory. There is no no-build example or source-serving compiler in this package; `remix/assets` owns that solution. Neither an Rsbuild dependency nor Rsbuild-specific logic enters the published generator.

### The resolver and manifest

- `createAssetResolver(manifest)` constructs an explicit resolver; there is no package-global instance. In Remix, the application passes it to `render({ assets })`; other renderers consume the same data directly.
- Methods use root-relative source keys, including the `file:app/counter.tsx` form shown above, and ignore an export fragment for asset lookup. Absolute/file-URL input normalization and out-of-root module identity remain open below; neither may make a built manifest depend on the deployed machine having the source checkout.
- `getScriptEntry(path)` returns `{ href, preloads, importMap }` for a registered browser entry. Development returns its dev URL, `[]`, and `{ imports: {} }`. A build returns the emitted entry URL, its static preloads, and the complete client map or `{ imports: {} }` when maps are disabled.
- `getHref(path)` returns the emitted URL of an entry, stylesheet, or other registered asset, or its dev URL. It has no image-transform option.
- `getPreloads(path | path[])` observes client graph metadata and returns the union in argument order, deduplicated by href. Each script contributes its chunk and static JavaScript dependencies, not their CSS. An explicitly requested stylesheet contributes its own URL, preserving the upstream API's acceptance of stylesheet arguments; callers render those separately as style preloads, never as `modulepreload`. Use `getStylesheets` for transitive stylesheet links. Development returns `[]`.
- `getStylesheets(path | path[], options?)` observes CSS without emitting browser entries. By default it combines client and current-server metadata. An explicit `{ environment: "client" }` or named server environment selects only that graph. Results are deduplicated in argument order and follow static dependencies, not every lazy route. In dev, server-graph CSS is reported as dev URLs; browser-only CSS remains Vite-injected.
- `getImportMap(path | path[])` validates the requested keys and returns the complete client map, not an entry-filtered subset. An empty array returns `{ imports: {} }`. Development and disabled builds return an empty map.
- Missing keys throw errors naming the method, source key, and environment. An observed module without an entry is distinct from an unknown module. Only missing browser-entry registration points at `assets({ include })`; a stylesheet lookup never recommends emitting a server module into the client build.
- `AssetsManifest` remains a discriminated union of `build`, `dev`, and `unavailable`. Build manifests carry environment-indexed source metadata, entry/asset URLs, static JS/CSS dependency lists, environment roles, and one shared import map. They contain JSON-compatible data, not Vite instances or functions. Development manifests carry the serialized metadata described in Development asset access, not merely a root and base.
- The public `/manifest` module exports `{ mode: "unavailable" }` outside an integration. Construction succeeds, but every resolver call throws an actionable unavailable-manifest error. Tests or other orchestrators can load a generated manifest explicitly or replace this public module; no unknown source key is silently treated as a URL.
- A graph built by another integration can import the public generator's output directly; it need not alias `/manifest` if it already has the object. Runtime and generator consumers are verified with neither Vite nor Remix installed, using actual build output rather than a no-build recipe.

### Build lifecycle

- Server environments build before the client when server analysis discovers browser entries. `assets()` contributes that order when used alone, skips environments already built by an orchestrator, and reports an error if the client was built too early. The Remix plugin composes the same lifecycle without building environments twice.
- Capture final outputs from every participating environment and pass the normalized graph to the public generator. After the required builds finish, write `__pitlane_assets_manifest.js` into each consuming server output with the correct current-server context, and copy server-emitted assets to the public client output. There is one write path, not a later fallback that scans built source text.
- Resolve the public manifest import to the generated artifact in server builds and rewrite its final relative path in the bundle. Prerendering and second orchestrators consume the same completed artifact. Browser builds do not receive server metadata or a live development provider.
- Without explicit browser inputs, the assets adapter must still permit a server-only/CSS-only application build rather than fall back to looking for `index.html`. This generic build concern is separate from the Remix plugin's SPA behavior.

### Development asset access

Consider `page.ts` importing `button.ts`, which imports `button.css`. In production, the emitted build graph records the stylesheet. During development, no final bundle exists; Vite's live graph knows which stylesheet URL belongs to the page. `{ root, base }` can construct a URL for a known file but cannot answer that transitive question.

**Recommendation for review: generate a data snapshot inside the Vite plugin and refresh it through Vite invalidation.** Keep live graph access out of the runtime resolver:

1. In Vite's process, discover the configured server graphs and registered browser inputs through transformation, without executing application modules. Include statically discoverable lazy routes as addressable metadata keys, while retaining the distinction between static and dynamic edges.
2. Generate the development manifest module with serialized per-environment records: known keys, dev entry URLs, and collected server-graph CSS URLs. Graph traversal excludes the plugin's own metadata modules and handles cycles. Its load order must not require evaluating an entry that imports the manifest being generated.
3. The application imports that module and constructs its resolver normally. `getStylesheets` reads the supplied data; it does not call into a Node object, reach a hidden global, or fetch a new HTTP endpoint. The same generated source can cross the Cloudflare module-runner transport.
4. Track the source/stylesheet dependencies and discovery inputs used by the snapshot. On a relevant edit, addition, or removal, invalidate the affected snapshot and its server consumers in the corresponding environment before the next render. Recompute the dependency set rather than retaining deleted CSS or stale route keys. Do not rely on ordinary import edges where the plugin merely inspected a graph.
5. Re-importing the server entry after invalidation refreshes module-level asset reads as well as request-time calls. Framework HMR remains responsible for requesting a new render when appropriate. A stylesheet content-only edit still uses Vite CSS HMR; changing which stylesheet a module imports also refreshes the HTML's stylesheet list.

This is a proposed mechanism, not verified implementation. Verification must cover a first request through a cyclic entry/manifest graph, module-level asset reads, adding/removing CSS imports, adding/removing globbed routes, multiple server environments, and Node and Cloudflare runners. If a snapshot cannot meet those contracts without eager application execution, revisit the mechanism before implementation approval.

Alternatives are a generated per-query metadata-module graph, with finer invalidation but more generated modules, or a live request/response channel to Vite, with cross-runtime transport and lifecycle costs. Requiring authors to name every stylesheet is not an acceptable alternative: it loses the transitive asset behavior the compatibility matrix requires.

The existing CSS-link/injected-style reconciliation and CSS self-accept patches move to the assets Vite adapter, with attribution and license notices preserved. Vue scoped styles are part of the compatibility matrix, not a reason to add a Vue runtime dependency. These patches use Vite internals; browser verification must demonstrate updates without duplicate or stale styles.

### Chunk import maps and HTML

- Maps are disabled by default. `assets({ chunkImportMap: true })` and `remix({ assets: { chunkImportMap: true } })` opt in for the client build only. An explicit plugin value wins over an explicit native client setting; absent both, the effective value is `false`. A native `true` is an explicit opt-in, and plugin `false` can override it.
- Vite generates the identifiers, rewrites imports, and emits the map. The adapter captures the actual map asset, including a custom filename, and passes it to the generator. An enabled build with no map artifact fails; a disabled build requires neither that artifact nor a map element.
- The complete map is returned so lazy modules and later islands resolve. Preloads use actual emitted URLs and remain separate from map membership. The map does not cause every route to preload.
- An effective `true` conflicts with `experimental.renderBuiltUrl` and produces a configuration error naming both options. `renderBuiltUrl` alone works with the default-disabled setting. There is no silent change to an explicit choice.
- Opted-in documents deliver the map before modulepreload links and module scripts. A Remix document may keep its managed `<ImportMap>` and frame behavior; another renderer uses ordinary import-map HTML. No Remix component, browser map manager, or polyfill is required by the package.
- Preserve root, non-root, relative, and absolute CDN deployment semantics. Normalize map delivery only where needed to preserve the identity generated imports resolve to. Test nested document routes, not only `/`.
- The feature requires browser import maps and `import.meta.resolve`. Its caching guarantee excludes changes to exports, tree-shaking, chunk membership, CSS/assets, or compiler output. Checkout-path-sensitive Vite map identifiers remain a documented open question. Chunk grouping stays in Vite configuration, not a second Pitlane grouping API.
- Production cache headers and retention of old hashed files remain deployment responsibilities. Pitlane neither sets those headers nor implements cache invalidation.

#### Proposed HTML helper

`renderImportMap({ value, nonce? }): string` is proposed at the runtime root and is available through `pitlane/assets`. The verb distinguishes rendering existing map data from constructing the data. This name and the following contract remain subject to human review.

- Return a complete inline `<script type="importmap">...</script>` string. Accept Pitlane-owned import-map data with `imports`, optional `scopes`, and optional `integrity`; preserve their contents without resolving URLs or generating mappings.
- Serialize JSON, escaping every `<` as a JSON Unicode escape, not an HTML entity. Escape the optional nonce as a quoted HTML attribute. Do not accept arbitrary raw attributes or interpolate unescaped markup.
- Return `""` when there are no effective mappings in `imports`, `scopes`, or `integrity`, including scopes whose maps are empty. Development and default-disabled builds therefore emit no map element through this helper.
- It is a stateless server-HTML serializer. It does not install maps through the DOM, merge multiple calls, track browser resolution, or attach Remix-specific attributes. Raw-HTML insertion follows the consuming framework's server-rendering API; inserting this string through client `innerHTML` is not a supported installation mechanism.
- The application owns placement before module loading and any CSP header. `nonce` supports an existing nonce policy; the helper neither generates a nonce nor rewrites the application's policy.

An isolated Chromium experiment parsed a map containing closing-script text as a literal key, imported the mapped module successfully, and round-tripped a quoted nonce without creating an extra script element. That establishes the serialization technique, not implementation or full CSP verification of this proposed helper.

### Standalone Vite Fetch server

`fetchServer(options)` requires `{ entry: string, environment?: string }`. `entry` is a non-empty path to the application's server module, resolved through [Vite's module runner](https://vite.dev/guide/api-environment-frameworks#runnabledevenvironment); `environment` defaults to `ssr`. The plugin has no filename or directory convention, performs no entry discovery, and never infers the path from Vite's build inputs. Missing or empty `entry` is a configuration error, even when the environment has a single build input or an input named `index`. The development entry is explicit and independent of the production build input.

- It applies to development only, registers as Vite's application fallback after asset middleware, and uses `appType: "custom"` unless the application explicitly supplied another value. It opens no second port and owns no build or production-preview lifecycle.
- For a runnable environment, import the entry through its runner for each request and read the current `default.fetch` after invalidation. Do not cache a handler across module updates. Invoke it with its owning object as receiver so a method using `this` remains valid.
- Adapt Node requests and Fetch responses through `createRequestListener` from the direct `@remix-run/node-fetch-server` package. Preserve the original request URL, methods, body, status, headers, streaming, and cancellation. Do not reimplement those conversions or enable trusted-proxy handling implicitly.
- Validate the selected environment and handler shape. Import, transform, and application errors must reach the Vite development error path rather than become silent fallthrough or a stale response. Already-started streaming responses and aborted requests follow the adapter's connection semantics.
- Runtime integrations that own serving, including Cloudflare's custom environment, omit this plugin. Installing it for an unsupported environment is a clear configuration error explaining that choice, not an implicit takeover or no-op.
- Support is initially the runnable-environment bridge required by the existing examples. Dispatch through Vite's separate Fetchable environment interface is not inferred from a runtime merely supporting `{ fetch }`; add such support only with a concrete consumer and verification.

The README and guide show the plugin without the assets package, without Remix, and composed with `assets()`, always with an explicit entry path. It remains useful for any Vite-transformed application exporting `{ fetch }`. Standalone verification uses a non-Remix filename and directory, covers omitted and empty entries even when build inputs exist, and confirms that an explicit entry works without a build input and is not replaced by a different build input.

### Remix-specific composition

- `remix()` from `@pitlane/vite-plugin-remix` composes `assets()` and `fetchServer({ entry: serverEntry, environment: serverEnvironments[0] })` when its existing server handler is enabled. The Remix plugin alone supplies the existing `serverEntry` default of `"app/entry.server"`; a caller's override is passed to the bridge instead. Verify both the default and a custom entry. `serverHandler: false` still disables the bridge for runtime-owned serving. Existing environment, entry, output, prerender, preview, SPA, and HMR options retain their behavior.
- The Remix transform matches exported `clientEntry(import.meta.url, component)` declarations and writes `"file:" + key + "#" + exportName` identically in every environment. Default exports, aliased callees, non-exported calls, and calls with fewer than two arguments retain the existing untouched behavior. Export-name extraction stays in this package; no special dev HMR island remains.
- The framework transform emits discovered island entries through the generic Vite entry mechanism. The assets package sees modules and graphs, never a Remix component or hydration record.
- Preserve the component-free browser-entry HMR contract merged in PR #61. Rename imports from `@pitlane/dev/hmr` to `@pitlane/vite-plugin-remix/hmr`, and from `pitlane/dev/hmr` to `pitlane/vite-plugin-remix/hmr`; do not move the helper into either neutral package. The listener remains `import.meta.hot.on("server:update", () => revalidate(app))`, inside `if (import.meta.hot)`, with existing `run()` options and module validation preserved.
- `revalidate(app)` returns `void` immediately and performs `await app.ready()` followed by `await app.frames.top.reload()` internally. It catches failures and logs `[pitlane] Failed to apply server update:` so the next edit can retry. Do not return the reload promise from the listener, add a browser queue or `WeakMap`, or duplicate Remix's cancellation and stale-response handling. A newer update must supersede a held reload without waiting for it, preserving hydrated state and producing no navigation or history entry.
- Preserve the `server:update` event name with no old-name alias, server-only classification, and 50ms trailing debounce. Component transforms remain independent of the listener. Production removes the guarded listener and unused helper code; SPA mode emits no server-data update. Neither `assets()` nor `fetchServer()` acquires Remix-specific HMR responsibilities.
- Direct `renderToStream` consumers still resolve an island through `{ ...(await assets.getScriptEntry(entryId)), exportName }`, splitting the export fragment themselves. Do not introduce a second renderer or duplicate Remix's frame-resolution behavior.

## Compatibility

Breaking for every app that renders a document or an island through `@pitlane/dev`.

| Today | After |
| --- | --- |
| `@pitlane/dev` / `pitlane/dev` | `@pitlane/vite-plugin-remix` / `pitlane/vite-plugin-remix` |
| `@pitlane/dev/hmr` / `pitlane/dev/hmr` | `@pitlane/vite-plugin-remix/hmr` / `pitlane/vite-plugin-remix/hmr`; same `revalidate(app): void` and `server:update` listener |
| `@pitlane/dev/runtime` / `pitlane/dev/runtime` | remove; migrate asset helpers to `@pitlane/assets` / `pitlane/assets` |
| Existing runtime-package `/vite` exports, including `@pitlane/content/vite` and `pitlane/content/vite` | `/vite-plugin`, including `@pitlane/content/vite-plugin` and `pitlane/content/vite-plugin`; no aliases |
| standalone `fullstack()` request serving | `fetchServer({ entry: "path/to/server.ts" })` from `@pitlane/vite-plugin-fetch-server`, with the application's actual module path; omitted when a runtime plugin owns requests |
| `import clientAssets from "./entry.browser.ts?assets=client"` → `.entry` | `(await assets.getScriptEntry("app/entry.browser.ts")).href` |
| `clientAssets.js` → `modulepreload` links | `.preloads` from the same call, or `assets.getPreloads([...])` |
| `import serverAssets from "./entry.server.tsx?assets=ssr"` → `.css` | `await assets.getStylesheets("app/entry.server.tsx", { environment: "ssr" })`, without emitting the server entry for browsers |
| `mergeAssets(clientAssets, serverAssets)` | arrays; `getPreloads` and `getStylesheets` deduplicate |
| `render()` | `render({ assets })` |
| hand-written `resolveClientEntry` forwarding preloads | delete it |
| `"types": ["@pitlane/dev/assets"]` or `["pitlane/dev/assets"]` in tsconfig | delete it |
| `import { mergeAssets } from "pitlane/dev/runtime"` (umbrella) | `createAssetResolver` from `pitlane/assets` and `pitlane/assets/manifest` |
| — | `@pitlane/assets` in `dependencies`, or `pitlane` when the app imports through the umbrella |

- The Vite peer minimum rises from 7.0 to 8.1. Vite 7 and 8.0 are unsupported even when chunk import maps are disabled; the package READMEs, guides, and changeset state the new minimum.
- Chunk import maps are disabled by default. Opting in requires delivering the returned map before modulepreload links and module scripts. Applications using only `experimental.renderBuiltUrl` or ordinary module scripts need no map-specific migration. The guide and changesets describe the opt-in and browser requirements.
- An app that calls `render()` without `assets` fails at its first island render with the upstream error quoted above.
- The serialized `moduleUrl` in `#rmx-data` remains an emitted chunk URL in build, not a logical import-map identifier, and remains the module's dev URL in development for file-backed islands. Enabling maps can change build output bytes and hashes; identical filenames across the migration are not promised.
- Every existing `remix()` option keeps its meaning; `assets` is a new option.
- The manifest file becomes `__pitlane_assets_manifest.js`. Vite plugin names identify the assets, Fetch server, and Remix integrations separately. The old fullstack and dev package imports are removed from active code and documentation.

`@pitlane/assets` and `@pitlane/vite-plugin-fetch-server` start at `0.1.0`. The renamed Remix package retains its existing changelog history and captures the breaking migration in a minor Changesets note under its new name, following 0.x practice; version preparation remains a separate release action. Publishing under the new name follows the first-publish procedure even though the implementation has history.

## Implications on adoption

- Replace `@pitlane/dev` with `@pitlane/vite-plugin-remix` in manifests, lockfiles, Vite configs, Deno import maps, package scripts, CI filters, and active guides. Rename the browser entry's `/hmr` helper import alongside the plugin root. Umbrella consumers replace `pitlane/dev` and `pitlane/dev/hmr` with `pitlane/vite-plugin-remix` and `pitlane/vite-plugin-remix/hmr`, and migrate removed `/runtime` asset helpers to `pitlane/assets`. There are no compatibility aliases.
- Applications adopt `createAssetResolver` and migrate document/render wiring by the table above. Runtime imports put `@pitlane/assets` in `dependencies`; build plugins remain development tooling. Compatibility with `remix/assets` is retained, but no no-build solution or example is added.
- Standalone Vite consumers compose the neutral packages without the Remix integration. Runtime plugins such as Cloudflare replace only the request bridge. Neither the resolver nor generator acquires a dependency on a particular renderer.
- Adoption in [`pitlane-tools/templates`](https://github.com/pitlane-tools/templates) is companion work during implementation, not a deferred follow-up. Build on the existing draft PR #12 and its component-free HMR entries rather than requiring that unreleased companion to merge first. It covers `cloudflare`, `netlify`, `vercel`, `railway-node`, `railway-bun`, `railway-deno`, `deno-deploy`, and `github-pages`.
- Settle the shared app migration in one server-rendered starter, then migrate all eight. Preserve direct-render frame behavior, provider-owned request handling, and `serverHandler: false` where applicable. GitHub Pages retains browser-only `remix({ server: false })` and does not gain an unused server resolver or request bridge.
- Keep the templates companion draft and commit pinned `pkg.pr.new` candidate dependencies while packages are unreleased, updating the pins as this implementation changes. Build and exercise every starter with those candidates, including Deno checks, island hydration, preloads, frame navigation, HMR, static assets, and the GitHub Pages non-root base. Do not leave CI depending on an unpublished semver range, and do not commit local tarball paths.
- The current preview setup permits transitive URL dependencies in seven pnpm workspace configs and uses temporary npm manifests/locks plus manual `node_modules` mode for Deno, which cannot install tarball URLs itself. These are draft-only accommodations, not changes to the released starter architecture. Before marking the companion ready or merging, replace preview pins with published ranges, remove the pnpm exceptions and temporary Deno npm files, restore Deno-native import mappings and installation, regenerate Deno locks, and require clean installs and green CI against the actual release. Deno deployment instructions remain release-only until that cutover.
- Release is explicitly held until the assets and related changes are ready; no intermediate `@pitlane/dev@0.8.0` publication is required. On separate release authorization, publish and verify installability of the two neutral packages before the renamed Remix package, then release an umbrella version only if a note explicitly names `pitlane`. All newly published names use the first-publish procedure. Retarget pending changesets for the unreleased HMR work to the renamed package so its behavior and migration are included in that release rather than scheduling an obsolete `@pitlane/dev` release.
- The umbrella manifest, generated exports, peer lifting, README, installed documentation, and tests migrate in this PR. Whether to release the umbrella is a later release-preparation decision; when released, it includes the new names and clearly documents removal of the old paths.
- This cutover is one proposal and implementation PR, not a staggered deprecation. Existing immutable releases stay available, but rolling an application back requires restoring its previous dependency names and application wiring together.

## Scope

- `packages/assets`: runtime resolver and types; public manifest module; bundler-neutral `/build` generator; proposed import-map HTML helper; Vite adapter for generic entry discovery, graph extraction, development metadata, build sequencing, manifest writing, server-asset copying, and CSS patches. No framework transform or application request server.
- Existing runtime-package plugin subpaths: migrate `/vite` to `/vite-plugin` across scoped and umbrella exports and every active consumer, with package changesets. These are renames, not added exports; the umbrella subpath count is unchanged by this part of the cutover.
- `packages/vite-plugin-fetch-server`: standalone development bridge using `@remix-run/node-fetch-server`, README, guide, tests, TypeDoc config, package preview, commit scope, and changeset. Migrate request-bridge behavior rather than retaining a second implementation.
- Rename `packages/dev` to `packages/vite-plugin-remix`, update package identity and all active consumers, retain its history, and compose both neutral plugins. Keep Remix identity transforms, HMR, prerendering, preview, and SPA behavior. Remove fullstack, the direct parser dependency, query-import APIs, the fallback manifest synthesis, and duplicate request serving.
- Umbrella: four assets subpaths, one Fetch-server subpath, renamed Remix plugin root and `/hmr` helper, removal of `pitlane/dev/assets` and `pitlane/dev/runtime`, regenerated exports/dependencies/peers, installed-documentation paths, and migration examples. Update TypeDoc configs and build orchestration, workspace references, release/preview workflow package lists, record tooling's current-package references, and commit scopes. Historical records retain their original names where describing past behavior.
- Behavior verification: generator graph traversal, cycles, shared chunks, environment separation, source-to-output multiplicity, missing references, source identity, URL bases, and absence of server-code emission from CSS observation; resolver errors and unavailable manifests; Remix entry identity and export preservation. Keep permanent tests focused on these observable boundaries rather than copies of manifest text or plugin wiring.
- Development verification: initial and subsequent requests, module-level reads, CSS import additions/removals, globbed route additions/removals, environment-specific invalidation, stylesheet-link/injected-style coexistence, and the Node/Cloudflare boundary. Retain the existing component-HMR, server-data HMR, prerender, preview, and SPA behavior through the rename. Preserve browser regressions for hydration readiness, superseding a held reload, and recovery after failure. Exercise the built scoped and umbrella `/hmr` exports in candidate-consuming apps, not only source imports, and verify production excludes the HMR helper.
- Fetch-server verification: a framework-free app through actual Vite HTTP serving, request URL/method/body, response status/headers/streaming/cancellation, live handler replacement after a source edit, missing/ambiguous entry errors, unsupported environment diagnostics, and runtime-owned serving without the plugin. The package works alone and beside `assets()`.
- Compatibility matrix: all seven upstream examples, including their own routing/hydration models, CSS behavior, and map opt-ins. Supported-toolchain checks cover Vite 8.1.0, current Vite 8, and Vite+. Isolated strict-peer installs contain no fullstack or direct Pitlane `oxc-parser` dependency.
- Import-map verification: default-disabled builds need no map artifact or HTML; plugin/native opt-ins and precedence; absent-map errors when enabled; opt-in `renderBuiltUrl` conflict and default compatibility; custom map filenames and deployment bases; real-browser static/dynamic imports, islands, and frame navigation; dependency-only rebuild cache stability. Test the proposed HTML helper's parsed map values, safe script boundary, nonce, empty mappings, and placement without Remix.
- Integration-author verification: run the complete Rsbuild example against a pinned toolchain, generate from its real compilation output, and consume the result without Vite or Remix installed. Document the adapter's ES-module output assumptions and limits. This validates the public generator contract; it does not introduce a maintained Rsbuild plugin package or compatibility matrix.
- Guides and READMEs: neutral assets usage, public manifest generation and the Rsbuild example, Fetch-server composition, renamed Remix integration, opt-in maps and proposed HTML helper, vendor grouping, caching limits, and migration. App-facing guides use umbrella specifiers while scoped package READMEs remain standalone. Markdown exports must satisfy decision.0002.
- Migrate the docs app's document and tsconfig; HMR, SPA, umbrella, prerender, and Vite guides; active agent references; all renamed imports; `.typedoc` mappings; and obsolete fullstack advisory configuration. The vendored upstream Remix skill is unchanged.
- Demos: migrate `demos/content-vite` and `demos/theme`, removing direct fullstack imports, types, and dependencies. The theme demo uses `@pitlane/vite-plugin-remix` instead of its local duplicate plugin. Build and exercise both.
- Templates: complete the eight-starter companion and preview-to-release cutover above, building on the component-free HMR migration in draft templates PR #12. Update `VISION.md` in phase 5 with the package extractions, Remix rename, public generator boundary, and umbrella subpath count of 19. Pitlane remains a Remix meta-framework with independently useful tooling, not a multi-framework renderer or hosting engine.

### Out of scope

- Reimplementing component-free HMR, `<HMR />` removal, or the `pitlane:dev` migration. PR #61 already merged those changes; draft templates PR #12 carries their preview-backed adoption. This proposal renames the helper's package path and tests that its behavior survives the asset cutover, without requiring a separate release first.
- A Pitlane import-map generator, import rewriter, automatic vendor grouping policy, browser map manager/polyfill, or HTTP cache implementation. Bundlers generate import maps; Pitlane captures them and renders optional HTML; applications own delivery.
- A no-build compiler, no-build asset server, or no-build `@pitlane/assets` example. Use `remix/assets` for that workflow.
- A maintained non-Vite/Rolldown/tsdown bundler integration. The Rsbuild guide demonstrates the public generator for external authors; it is not a shipped adapter or promise of Rsbuild support.
- A CLI or intermediate graph-file protocol for manifest generation, and the separately deferred path-type generation/CLI proposal.
- Production hosting, deployment, preview, prerendering, or framework HMR inside `@pitlane/vite-plugin-fetch-server`. It is a Vite development request bridge.
- `assets.fetch`, `getAssets`, `getAssetDetails`, and image transforms through `getHref`. Those do not belong to this resolver.
- Further splitting Remix HMR, prerendering, preview, or SPA mode into packages. The named assets/server extractions and package rename are the restructuring in this proposal.
- The dependency audit's unrelated content, frontmatter, Satteri, and theme findings. No replacement of `yaml`, `es-module-lexer`, or `csstype`.

## Preview

- Use the existing pkg.pr.new workflow for `@pitlane/assets`, `@pitlane/vite-plugin-fetch-server`, `@pitlane/vite-plugin-remix`, and `pitlane`; update its package list as part of the cutover. Install candidates into the migrated Remix fixture, the standalone Fetch-server fixture, and all seven compatibility examples.
- Commit pinned candidate URLs in the draft templates companion so its CI exercises real artifacts throughout implementation. Green preview CI does not authorize release or merge: the adoption checklist above requires published dependencies and another green CI run before the companion leaves draft.
- The Remix fixture exercises document assets, island hydration, preloads, frame navigation, dev updates, production build, and preview. Repeat through umbrella-only imports under a strict package manager, including the manifest swap and unavailable-manifest errors.
- Neutral fixtures demonstrate the request bridge with and without assets, Cloudflare-owned serving without the bridge, matched-route asset selection, and each framework's existing hydration and CSS behavior.
- Default configurations exercise ordinary chunk loading with no map requirement. Explicitly enabled configurations exercise map delivery, static and dynamic imports, and a two-build dependency-only change. Distinguish unchanged output bytes/URLs from unmeasured browser cache-hit claims.
- Exercise the adapter-author example with the candidate `/build` generator against real Rsbuild output. Link the example and its limitations without publishing a fourth integration package.
- The readiness report links package previews, the templates companion, the docs Workers preview, and results for every required fixture/starter. No new preview mechanism is introduced. A green workflow alone is not proof of installation or behavior.

## Policies and decisions checked

- `decision.0001` Static Documentation Delivery — the docs site is prerendered and served statically; this proposal changes how assets are named and islands resolved, which the docs build exercises through `remix({ prerender })`, and does not alter delivery. The docs app's own document migrates as part of scope.
- `decision.0003` Umbrella Package — preserve generated, mirrored subpaths for the four assets entry points and both plugin packages; remove the old dev paths rather than adding aliases; lift the required Vite peer; retain scoped/umbrella equivalence; release the umbrella only when explicitly named in a Changesets note.
- `decision.0002` Installed Documentation for Agents — the new guide and README are written so the planned installed export can carry them; no skill or `AGENTS.md` line names the resolver API. The repository's own agent references are updated in scope.
- `policies/` is empty.
- `VISION.md` — explicit resolver construction preserves Remix idioms; independent runtime, generator, and plugin entry points honor Runtime When Possible and Demand Composition. Both neutral tools remain framework-adjacent while the renamed Remix integration retains framework behavior. The no-separate-prerender-package constraint is unchanged. Phase 5 updates package names and composition, not Pitlane's purpose or hosting boundary.
- `VISION.md` principle 4, Avoid Dependencies — honored by replacing fullstack with Pitlane-owned integration, reusing Vite's public parser, retaining the focused `magic-string` tooling dependency, and keeping runtime JavaScript and declarations independent of the build toolchain. The dependency audit's unrelated content and theme work remains outside this proposal.

## Future directions

- `getHref` accepting a `transform` option once an image package defines what a transform is under Vite.
- **Path-typed resolver calls.** Completion and typo errors for the strings an app passes to resolver methods, so `assets.getScriptEntry("app/entry.broswer.ts")` fails in the editor rather than at the first render. It needs its own proposal. An earlier draft of this one (`e01386b`) specified it as an opt-in plugin option that wrote `.pitlane/assets.d.ts` from the files under the Vite root, plus a `pitlane-assets typegen` command for checking without a dev server. Generated declarations change every adopting app's TypeScript setup and checking workflow, and that deserves deliberate design rather than a section of this one.

    That proposal also creates `@pitlane/cli`, makes it the umbrella's command-line interface, and gives it the type-generation command. A bin published by `@pitlane/assets` would not work for umbrella apps: package managers link bins only for direct dependencies, so an app depending on `pitlane` alone would have no command to run. Neither the vision nor decision.0003 provides for a Pitlane CLI or for the umbrella re-exporting bins today.

    Two facts from the earlier draft bound its design. A TypeScript 7 prototype narrowed all five resolver methods from an augmented named interface on the manifest module, and the narrowed resolver stayed assignable to Remix's `RenderOptions.assets`. In a pnpm layout where the app depends only on `pitlane`, augmenting `@pitlane/assets/manifest` failed with TS2882 and left paths as `string`, while augmenting `pitlane/assets/manifest` merged into the scoped interface, so generated declarations must augment a specifier the app resolves.

## Alternatives considered

- **Keep the runtime on `@pitlane/dev/runtime`** — one package, one release. Rejected: application code would import a Vite plugin package for a runtime object, the concern would stay unnamed, and a Remix app on plain Vite could not take it without `remix()`.
- **A runtime-only `@pitlane/assets`, plugin stays in `@pitlane/dev`** — mirrors `remix/assets` in imports. Rejected: a package that is only a library for `@pitlane/dev` is not useful when installed directly, which principle 5 requires.
- **A new package carrying the whole plugin, with `@pitlane/dev` left as is and deprecated** — zero break for existing users. Rejected: `assets` would be the name of build orchestration, prerendering, the preview server, HMR, and SPA mode; the deprecated package would keep the fullstack liability and double the suites to run; and Remix's own prerelease precedent was a hard rename, not a parallel package.
- **One package per remaining concern (`@pitlane/hmr`, prerender, preview, …)** — rejected: the user-requested neutral asset/server extractions earn independent use, but the remaining Remix-specific behavior stays together. This proposal does not split every internal plugin.
- **Keep `?assets=` and add `assets` beside it** — a softer upgrade. Rejected: two vocabularies for one question, both to document and test, and the second one would be the one Pitlane already knows is worse.
- **Keep the transform writing final URLs and let apps add `resolveClientEntry` themselves** — the Kody pattern. Rejected: it solves the symptom in every app instead of the cause in the plugin.
- **A pre-made `assets` export, with the manifest swapped behind it** — two earlier drafts. Rejected: it is the magic global the Remix-idioms principle names, it hides the one seam a non-Vite graph needs, and `import { assets }; export { assets }` in `app/assets.ts` is a stranger file than one that constructs what it exports. A manifest is a real argument, and the app importing it makes the swap visible.
- **`createAssets` or `createAssetsClient` as the constructor's name** — `createAssetResolver` says what the object does: it resolves paths to what a build produced, where `createAssetServer` compiles and serves. "Client" implied a server to talk to; there is none.
- **Configuration-only registration** — rejected as the sole mechanism: literal browser-entry references and existing bundler graphs already provide discoverable information. `include` remains for computed browser entries, never a duplicate list of server stylesheets or discovered routes.
- **A virtual module such as `pitlane:assets`** — matches the former `pitlane:dev` convention. Rejected on Kody's evidence: every virtual id in application code is one more stub pair for graphs Vite does not build. PR #61 already removed `pitlane:dev`; do not recreate that boundary for assets or HMR.
- **Absolute `file:///…` keys** — need no path computation in dev. Rejected: a build-machine path baked into `dist/ssr` makes builds non-reproducible across machines and says nothing the root-relative path does not.
- **Pitlane's own `render()` middleware** — would expose the full `resolveClientEntry` hook. Rejected: it duplicates upstream's frame resolution and error handling, and the `assets` option is the seam upstream designed for bundlers.
- **Automatically folding server-graph CSS into script `getPreloads` results** — rejected: script callers must be able to render every returned URL as `modulepreload`. Explicit stylesheet arguments are a separate upstream-compatible use; they do not cause script arguments to acquire CSS results.
- **Enable chunk import maps by default** — rejected: adopting asset resolution should not impose map-delivery and experimental browser constraints on every document. Plugin or native opt-in keeps that choice explicit.
- **Keep the Fetch bridge in the Remix plugin, or put it in assets** — rejected: request dispatch is framework-neutral and independent of asset resolution. A standalone package composes with either, while runtime-owned serving replaces only that capability.
- **Name the runtime package `@pitlane/vite-assets`** — rejected: Vite is one producer of the manifest. The resolver, HTML helper, and public generator do not import Vite; only the adapter lives at `/vite-plugin`. The two plugin-only packages use consistent `vite-plugin-` names.
- **Document only the final manifest schema** — rejected: external integration authors would have to copy graph traversal and asset collection. The public generator owns that logic and is used by Pitlane's Vite adapter too.
- **Ship and maintain an Rsbuild adapter** — rejected: demonstrate the translation in an exercised integration-author example without expanding the supported bundler integrations.
- **Add a manifest CLI now** — not selected: the concrete integrations already have in-memory output graphs. A CLI would add a serialization protocol without removing the bundler-specific extraction work.

## Open questions

- [NEEDS CLARIFICATION: The resolver's dev href for an island omits Vite's `?t=` HMR timestamp. If the HMR end-to-end suite shows a stale island after a server-only change, is appending the module's `lastHMRTimestamp` acceptable, or should the island path never depend on the module graph?]
- [NEEDS CLARIFICATION: Vite's chunk import-map keys include absolute source paths. For the opt-in feature, is documenting checkout-path-dependent cache stability sufficient, or must a mitigation precede support? Default-disabled builds no longer acquire this tradeoff.]
- [NEEDS CLARIFICATION: Is the proposed development metadata snapshot and invalidation model the right contract, subject to the Node/Cloudflare and discovery-order probes described above, or should per-query metadata modules be preferred?]
- [NEEDS CLARIFICATION: Approve `renderImportMap({ value, nonce? }): string`, including empty-map omission and stateless server-HTML serialization, or revise the helper's name or shape?]
- [NEEDS CLARIFICATION: Review the public generator's normalized graph model and settle the exact input/manifest type layout before implementation. The Rsbuild translation must prove that the types describe emitted assets and dependency relationships rather than Vite-specific output objects.]
- [NEEDS CLARIFICATION: Define portable keys for linked workspace/package modules outside the Vite root, including whether `../` keys are permitted or a package-relative namespace is needed. Reconcile absolute/file-URL input normalization with this identity scheme without serializing machine-specific checkout paths or relying on deployed source files.]

## Acknowledgments

Mark Dalgleish, for pointing at `resolveClientEntry` as the bundler seam at Remix Jam 2026. Kent C. Dodds's Kody, for being the production app that showed where the current integration pinches.

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

A new `@pitlane/assets` package: the Vite answer to `remix/assets`. Its `assets()` plugin keys every `clientEntry()` island with a bundler-stable `file:` identity and builds the manifest; `createAssetResolver(manifest)` returns an object with the `remix/assets` method surface, so a document and `render({ assets })` are written exactly as under No Build. `@pitlane/dev` composes it, drops `?assets=` and `pitlane:dev`, and no longer depends on `@hiogawa/vite-plugin-fullstack`.

Optional generated path types give those same resolver calls completion and typo checking without changing application imports or requiring generation at runtime.

Client builds use Vite's chunk import maps by default for cache-stable JavaScript references. Applications opt out through the plugin's `chunkImportMap` option.

## Motivation

Remix 3 has one documented way for a document to name its browser assets and for the renderer to hydrate an island: an asset server object. `app/assets.ts` constructs it, the document reads `assets.getScriptEntry(entry)` for the script tag and `assets.getHref(path)` for stylesheets, and `render({ assets })` resolves every `clientEntry(import.meta.url, …)` through `assets.getScriptEntry` when it sees a `file:` id. Pitlane answers the same questions with a different vocabulary — `?assets=client` and `?assets=ssr` imports, an `ImportedAssets` shape, `mergeAssets`, and a build-time transform that writes the final island URL into the server bundle. The result is worse than the upstream shape in four ways.

- **Islands get no preload hints.** The build knows each island chunk's reachable JS and the transform discards it. The one production consumer that has hit this, [Kody](https://github.com/kentcdodds/kody), hand-computes `modulepreload` hrefs from `ImportedAssets.js` and forwards them through its own `resolveClientEntry` ([`ssr-render.tsx`](https://github.com/kentcdodds/kody/blob/main/packages/worker/src/app/ssr-render.tsx)).
- **A document cannot move between No Build and Pitlane.** The upstream template's `document.tsx` reads `href`, `preloads`, and `importMap` from one object; a Pitlane document imports `?assets=` modules and merges them. Switching bundling strategy means rewriting the document and the render wiring, which is the opposite of what a Vite alternative to `remix/assets` should cost.
- **Every island, every `?assets=` import, and `pitlane:dev` is a virtual id in application code.** Island modules each prepend `import … from "<id>?assets=client"`, so a second orchestrator that bundles the SSR output (observed with Nitro) can lose the manifest those imports point at, and Pitlane re-synthesizes it by regex-scanning built chunks. Kody maintains alias-swapped stub modules for `pitlane:dev` and for every `?assets=` import, plus a worker-typecheck stub, so Vitest without the plugin and the Wrangler bundler can resolve its graph ([commit f4b3565](https://github.com/kentcdodds/kody/commit/f4b35651c6dcc0550c54813427a078bd7aeaa7e6)).
- **The integration depends on a dormant package.** `@hiogawa/vite-plugin-fullstack` was last published 2025-12-22, its default branch last moved 2026-01-08, it declares `peerDependencies.vite: ^7` while this repository runs Vite 8 and Vite+ 1.0, and it carries the only advisory in Pitlane's production dependency graph (`srvx`, moderate), used solely to adapt a fetch handler to Node for the dev server.

There is also a packaging reason. The vision asks that new features be attempted as new packages first and that each package be useful when installed directly. Asset resolution under Vite is a product of its own — a Remix app on plain Vite environments can want island hydration and the document object without the rest of `remix()` — and it is the one concern of `@pitlane/dev` that application code imports at runtime. Today it has no name.

The resolver's path strings should also be discoverable while writing a document, not only checked when a build resolves them. A filesystem-derived union can catch `"app/entry.broswer.ts"` before a build and suggest files the app has not referenced yet. That is an optional authoring aid, not another way to register or publish assets.

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
- [TypeScript module augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation) can extend a named interface but cannot augment a default export directly. A named type registry can therefore supply path information to the manifest's default-exported value without changing the application's import.
- An isolated TypeScript 7 prototype narrowed all five resolver methods, including array arguments, from an augmented manifest declaration and rejected misspelled paths. The narrowed resolver remained assignable to the installed Remix `RenderOptions.assets` type, while a custom manifest could retain unrestricted string typing. A required declaration listed in `tsconfig.files` produced a missing-file error before generation. This establishes the type mechanism, not filesystem discovery or editor refresh.
- [React Router's generated route types](https://reactrouter.com/how-to/route-module-type-safety) demonstrate the workflow boundary: a dev plugin can refresh declarations automatically, but standalone typechecking needs generation first. TypeScript does not run Vite plugins.

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
- **Vision key principle, Remix idioms.** "Platform primitives are adapters you construct … not magic globals. Configuration is explicit." `createAssetServer(options)` is constructed in `app/assets.ts`; a Pitlane equivalent that appears pre-made from a package import is the global the principle names.
- **Vision principle 4, Avoid Dependencies.** The [October dependency audit](../docs/internal/dependency-audit-2026-10.md) identifies fullstack and the separate parser as liabilities in `@pitlane/dev`. This proposal owns the required integration and reuses Vite's parser, rather than copying the whole upstream plugin into `dev`. Dependency removal supports the change; the document, preload, and module-resolution problems above justify the public API break.
- **Source paths, registered assets, and emitted URLs are different sets.** The type catalog describes existing source files that an author can name. Registration selects what the build emits; the manifest resolves those selections to URLs. Type generation must not turn every suggested source file into a browser asset or infer correctness from the strings already written in calls.

### Quality bar

- A document written against the `remix/assets` template runs under Pitlane with its asset construction changed and nothing else.
- `@pitlane/assets` is useful with plain Vite environments and no `remix()`: the README shows that configuration and it is tested.
- One identity scheme for islands, identical in dev and build, reproducible across machines, never containing a runtime-specific value.
- Islands get `preloads` through the renderer's existing head hoisting.
- One manifest, one import of it in the server bundle, derivable from captured output bundles so prerendering and second-orchestrator builds keep working.
- No virtual id in application code: every Pitlane import resolves in a graph Vite did not build, and behaves honestly there. The one module the plugin swaps is public, so a graph Vite did not build can supply its own.
- Dev serving, dev stylesheet links, and HMR behave as they do today; the existing end-to-end suite is the specification for that half.
- Opted-in projects get path completion and typo errors before a full build, with refreshed types after files are added, removed, or renamed. Runtime resolution and consumers that do not opt in require no generated declaration.

### Remaining uncertainty

- Whether Vite's `?t=<timestamp>` cache-busting on island hrefs matters once the resolver computes dev URLs without it. Component HMR swaps components in place rather than re-importing island URLs, and a fresh document has a fresh module map, so the expectation is no; the HMR end-to-end suite decides.
- Whether emitting a stylesheet as a client-build chunk through `this.emitFile({ type: "chunk" })` yields a CSS asset and no JS chunk the way a CSS entry in `rollupOptions.input` does. Vite's pure-CSS-chunk handling is written for any chunk, so the expectation is yes; the manifest test decides.
- Whether Vite's full-bundle dev mode (`--bundled` in the e2e harness) changes how dev URLs are formed. The harness already runs it; it decides.

## Existing baseline

Four specimens.

**`@pitlane/dev` today.** `transform.ts` rewrites `export let Name = clientEntry(import.meta.url, …)`: in server environments it prepends `import ___clientEntryAssets from "<id>?assets=client"` and writes `___clientEntryAssets.entry + "#Name"`; in the client environment it writes `import.meta.url + "#Name"`. `@hiogawa/vite-plugin-fullstack` answers `?assets=`: in dev with the module's dev-server URL and the CSS reachable from it in the server graph, in build with a manifest lookup; loading `?assets=client` during the SSR build is what marks a module as a chunk the client build must emit. After both builds it writes `__fullstack_assets_manifest.js` into the SSR output and copies SSR-emitted assets to the client output; `build.ts:160-239` does the same again when the upstream write did not land. `hmr-component.ts` serves `pitlane:dev`, a virtual module exporting the `HMR` island in dev and an inert component in a build. Worth keeping: the AST-based call matching and export-name extraction, the SSR-first sequencing, server-graph CSS collection with `data-vite-dev-id` links and the Vite client patch that lets them coexist with injected styles, the manifest-from-captured-bundles logic, and `remix()` as the one plugin an app registers. Incidental: the `?assets=` vocabulary, the client-environment rewrite that nothing reads, the per-island virtual import, the fallback duplication, the island answering `?assets=client` for itself, and `pitlane:dev` being a virtual id rather than a module the plugin swaps.

**`remix/assets` with `render({ assets })`.** The reference this proposal adopts the shape of: one object, a document that reads it, a renderer that resolves islands through it. Its identity scheme assumes unbundled source, which is the one thing Pitlane cannot adopt, and its constructor options describe compilation and serving that Vite config already owns.

**`@pitlane/content`.** The repository's precedent for the package shape: runtime at the root, plugin at `/vite`, a published manifest module the plugin replaces, and a README that documents the package without `remix()`. Where `content` keeps that module internal because `createContent()` imports it for the app, this package makes it public because the app imports it itself.

**Kody.** The largest open-source Remix 3 app runs on `@pitlane/dev` and shows the seams: a hand-written `resolveClientEntry` that forwards `preloads` computed from `?assets=client`, per-route preloads assembled by merging several `?assets=client` results, stub modules for `pitlane:dev` and every `?assets=` import, a worker-typecheck stub, and SSR tests that pin `#rmx-data`.

## Proposed solution

Give Pitlane the asset server's method surface, backed by a Vite build instead of a compiler, as its own package; let the renderer's own contract resolve islands; compose the package into `remix()`.

The rest of this section follows one small server-rendered app through the change: a document, a stylesheet, and one island.

```text
app/
├── assets.ts          constructs the resolver; the only Pitlane-specific file
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

The two string literals are also how the build learns what to emit, the way Vite learns what `new URL("./x", import.meta.url)` names: a literal argument to a resolver method in server code registers that file as a client build input. A path computed at runtime is registered with `assets({ include })` instead.

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

The Vite config does not change. `remix()` composes the assets plugin:

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix()],
});
```

Moving this app to No Build changes how `app/assets.ts` constructs `assets`, and serves `/assets/*` through `assets.fetch` instead of `staticFiles("./dist/client")`. The document, the island, and `render({ assets })` stay as they are.

### What happens to the island

The plugin rewrites the island's entry id to the same literal in every environment, an identity with no machine path and no runtime value in it:

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

After `vite build`, `href` is the emitted chunk, `preloads` lists that chunk followed by its static imports, and `importMap` is the complete map Vite generated for the client build. Each map key is the chunk's filename with a stable identity hash in place of its content hash, so it looks like a second hashed filename; importers reference the key, and only the target changes when a chunk's content does. Hashes here are illustrative:

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

Chunk import maps are on by default for the client build, so a dependency's new hash changes its map entry instead of the bytes of every chunk importing it. An app that needs `experimental.renderBuiltUrl`, or targets browsers without import-map support, opts out with `remix({ assets: { chunkImportMap: false } })`, and `importMap` is then `{ imports: {} }`, as it always is in dev.

With `remix({ assets: { types: true } })`, the resolver's methods accept only the app's source paths, so `assets.getScriptEntry("app/entry.broswer.ts")` is a type error before any build runs. The imports in `app/assets.ts` stay the same.

### Without `remix()`

A Remix app on plain Vite environments takes the same package without the rest of `@pitlane/dev`. The app files above are unchanged; only the config differs:

```ts
// vite.config.ts
import { assets } from "@pitlane/assets/vite";
import { defineConfig } from "vite";

export default defineConfig({
    environments: {
        client: {},
        ssr: {
            build: {
                rolldownOptions: { input: "app/entry.server.tsx" },
            },
        },
    },
    plugins: [assets()],
});
```

`assets()` keys islands, registers inputs, orders the server build before the client build, and writes the manifest. Serving requests in dev, prerendering, and component HMR stay in `remix()`.

### What goes away

`?assets=` imports, `ImportedAssets`, `mergeAssets`, and `pitlane:dev` are removed, and `@hiogawa/vite-plugin-fullstack` goes with them. `HMR` moves to `import { HMR } from "@pitlane/dev/runtime"`. Compatibility maps each removed form to its replacement.

## Detailed design

### Packages

- **`@pitlane/assets`** is a new workspace package, `packages/assets`, with three entry points. `@pitlane/assets` is the runtime: `createAssetResolver` and the types `AssetResolver`, `ScriptEntry`, and `AssetsManifest`. It imports nothing from Vite. `@pitlane/assets/manifest` is the module the plugin replaces: its default export is an `AssetsManifest`, and as published it declares that no manifest is available. It is a default export rather than named exports because `AssetsManifest` is a discriminated union, which only one value can carry, and because a JSON module has only a default export, so a graph Vite did not build can alias the specifier to a manifest file. `@pitlane/assets/vite` is the plugin: `assets(options?)`.
- `vite` is an optional peer dependency of `@pitlane/assets`, required for `@pitlane/assets/vite` and the type-generation command, not for the runtime or manifest entry points. Both `@pitlane/assets/vite` and `@pitlane/dev` require Vite 8.1 or later, with `vite: ">=8.1.0"` as their packages' peer range; Vite remains a required peer of `@pitlane/dev`. The common minimum covers both the public parser and the default-on chunk-import-map feature. Vite+ is verified explicitly through its `vite` alias. `remix` is not a dependency of `@pitlane/assets`; `AssetResolver` is structurally compatible with `Pick<AssetServer, "getScriptEntry" | "getHref" | "getPreloads" | "getImportMap">` from `remix/assets` without importing it.
- **`@pitlane/dev`** depends on `@pitlane/assets` and registers `assets()` inside `remix()`. `remix({ assets })` forwards that option object to the plugin. `@pitlane/dev/runtime` exports `HMR`. `@pitlane/dev/assets` is removed.
- The umbrella re-vends `@pitlane/assets` as `pitlane/assets`, beside `pitlane/dev`.
- `@pitlane/assets` also publishes the `pitlane-assets` executable for standalone type generation. The `/manifest` entry point exports the named, type-only `AssetTypeRegistry` interface used by generated declarations; the runtime manifest remains its default export.

### Dependency boundary and parsing

- The root and `/manifest` entry points expose Pitlane-owned runtime and manifest contracts. Their JavaScript and published declarations work without Vite installed and do not import Vite, Rolldown, parser, or `magic-string` types. The `/vite` entry point may expose Vite's native plugin type; its AST and source-editing details remain internal.
- The assets island transform and literal-argument registration analysis use `parseSync` from `vite`, with AST types from Vite's `ESTree` export. The HMR and route-map analysis remaining in `@pitlane/dev` use the same public API, including when parsing raw TypeScript or TSX.
- `oxc-parser` is removed from `@pitlane/dev` and is not added to `@pitlane/assets`. This removes Pitlane's separate published-package parser dependency, not Oxc used transitively by Remix or by repository tooling.
- `magic-string` remains the source-editing library behind the plugin implementations. No replacement third-party integration dependency is introduced for fullstack.

### The resolver

- `createAssetResolver(manifest)` returns an `AssetResolver<Path>` inferred from an `AssetsManifest<Path>`. Both types default `Path` to `string` for unrestricted runtime use. The app constructs the resolver once in `app/assets.ts` from the manifest `@pitlane/assets/manifest` exports, exactly where a No Build app constructs its asset server, and passes it to `render({ assets })` and its document. The package exports no pre-made resolver.

- At runtime, every method accepts a root-relative path, an absolute path, or a `file:` URL, with or without a `#fragment`, and normalizes it to the file's path relative to the Vite root in POSIX form — the key. `file:` is stripped before normalization, so the `render()` middleware's `file:<key>` ids and a document's `"app/entry.browser.ts"` reach the same lookup. Optional generated typing narrows application call sites to canonical source keys without changing this runtime protocol.
- `getScriptEntry(path)` returns `{ href, preloads, importMap }`: in dev, `href` is the key's dev URL, `preloads` is `[]`, and `importMap` is `{ imports: {} }`; in build, `href` is the key's emitted chunk URL, `preloads` is that chunk followed by its transitive static imports, shallowest-first, matching `remix/assets`, and `importMap` is the client-build map described below.
- `getHref(path)` returns the key's dev URL in dev and its emitted URL in build: a chunk URL for a script, a CSS asset URL for a stylesheet, an asset URL for any other file. It takes no `transform` option; passing one is a type error.
- `getPreloads(path | path[])` returns, in build, the union of each key's preload list in argument order, deduplicated by href; a stylesheet key contributes its own URL. In dev it returns `[]`.
- `getImportMap(path | path[])` validates the requested keys by the same lookup rules as the other methods and returns the complete client-build import map, not an entry-filtered subset. An empty argument array returns `{ imports: {} }`. In dev, or with chunk import maps disabled, it returns `{ imports: {} }`.
- `getStylesheets(path)` is Pitlane's extension. It returns the hrefs of every stylesheet reachable from the key through `import` statements: in dev, through the server environment's module graph, as dev URLs the plugin's Vite client patch can reconcile with the styles Vite injects; in build, through the chunk graph of every environment that bundled the module, deduplicated by href. CSS imported only by browser-side modules is injected by Vite in dev and reported here in build.
- A dev URL is `base + key` for a key under the root, `base + "/@fs/" + absolutePath` for a key beginning with `../`, and the key itself when it already begins with `/` (the form used for virtual ids).
- If a key has no record in the manifest, the method throws an `Error` naming the key and the call, stating that the file was not registered as a client asset, and pointing at `assets({ include })` for paths that are not literal in source.
- A client constructed from the published `@pitlane/assets/manifest` — a graph the plugin neither built nor served — throws an `Error` from every method stating that no asset manifest is available and that the module must be built or served with `assets()` from `@pitlane/assets/vite`, or replaced with a manifest of the app's own. Construction itself succeeds, so importing `app/assets.ts` in such a graph is not what fails. Nothing passes a key through as an href.
- A manifest from any source is accepted: a graph Vite did not build can alias `@pitlane/assets/manifest` to a manifest file a previous build wrote, or construct the client from one it loads itself. That is the path for tests and for Kody's Wrangler-bundled harness.
- A direct `renderToStream` caller resolves an island with `{ ...(await assets.getScriptEntry(entryId)), exportName }`, taking `exportName` from the fragment; the guide shows this, and the package exports no second helper. With generated typing enabled, the adapter uses an explicitly widened `AssetResolver` reference for this dynamic renderer input.

### Optional generated path types

#### Public types

- `assets({ types: true })` enables generation; `types` defaults to `false`. `remix({ assets: { types: true } })` forwards it. The normal `createAssetResolver(manifest)` call infers the generated union without a handwritten union, an extra application import, or an explicit generic argument.
- Generated declarations augment `AssetTypeRegistry` in `@pitlane/assets/manifest` with a `paths` property whose type is the union of canonical source keys. An absent property means generation is not in use and the published manifest carries `string`; a generated empty catalog uses `paths: never`, not a fallback to unrestricted strings. The registry is local to the application's TypeScript program. Separate Vite roots use separate typechecking projects rather than merging their catalogs.
- All five resolver methods accept only the inferred keys in their typed application-facing signatures; array-taking methods also accept readonly arrays of those keys. A misspelled literal, an unknown array element, or an arbitrary `string` is a type error. There is no catch-all `string` overload or union member that would erase this restriction. The union checks source paths, not whether a particular file is a script or whether it was registered for a build.
- The typed resolver remains structurally compatible with Remix's asset interface. Renderer adapters and callers intentionally handling arbitrary strings can assign it to `AssetResolver` with its default `string` parameter; absolute paths, `file:` ids, fragments, and runtime lookup errors retain their existing behavior. This widening is explicit at the application boundary, not hidden in an overload on every method.
- A caller supplying its own manifest can carry its own path union or use the unrestricted default. Generated path information is type-only: it adds no runtime field or import, changes none of the serialized manifest modes, and never makes generation necessary to execute the resolver.

For a project with these two source files, the generated declaration is equivalent to:

```ts
import "@pitlane/assets/manifest";

declare module "@pitlane/assets/manifest" {
    interface AssetTypeRegistry {
        paths: "app/entry.browser.ts" | "app/styles.css";
    }
}
```

#### Source catalog and registration

- Discover existing files beneath the resolved Vite root using the same canonical key normalization as registration. Exclude dependency and version-control directories, Vite's cache directory, every environment's build output directory, and `.pitlane`; respect configured watcher ignores. Explicit `assets({ include })` files are also cataloged after resolution, including files outside the root represented by `../` keys. The catalog contains file paths, not development-only virtual ids.
- Discovery is independent of previous build outputs and literal call arguments. An existing but unused source file is suggested before any build or method call names it. A missing file does not enter the union merely because a call or an include entry spells its name.
- Catalog membership does not register, compile, emit, or expose a file. The registration rules below remain authoritative: literal calls register inputs, islands register their modules, and computed arguments still need `assets({ include })`. A correctly typed but unregistered computed path still fails the runtime manifest lookup.

#### Generation lifecycle

- Write `.pitlane/assets.d.ts` relative to the resolved Vite root. With `types: true`, generate at dev startup and before a build, and refresh during dev when relevant files are added, removed, or renamed. Configuration changes rebuild the catalog. Sort and deduplicate keys, and do not rewrite identical declarations on ordinary content edits.
- The generator never evaluates application modules or runs the client/server builds to discover paths. Both automatic generation and the standalone command use the same catalog and declaration writer. Discovery or write failures surface as errors; generation must not report success while leaving an old catalog in place.
- `pitlane-assets typegen [root] [--config <file>]` loads the selected Vite configuration, requires `assets({ types: true })` directly or through `remix()`, writes the declaration, and exits without listening on a port or building the app. Missing or disabled asset type generation is a command error explaining how to enable it.

#### Project setup

- Opted-in TypeScript projects list `.pitlane/assets.d.ts` in `tsconfig.files`, relative to that config, and gitignore the generated file. Deno projects use the equivalent required declaration reference. A missing declaration must fail the checker rather than silently widen paths to `string`; the generation command runs before standalone `tsc` or `deno check`, including on a clean checkout.
- Templates supply the plugin option, declaration reference, ignore rule, and generation-before-typecheck task. Existing apps make this one-time opt-in explicitly; the plugin does not rewrite their TypeScript configuration or task files. Disabling the feature removes that setup as well as the plugin option, so stale declarations cannot continue narrowing calls.

### The island key

- The plugin's transform matches `export <let|const|var> Name = clientEntry(import.meta.url, …)` at module top level. The first argument becomes the string literal `"file:" + key + "#" + Name`. A module whose id is not a file (the dev HMR island) uses its Vite dev URL as the key, which only arises in dev because that island is inert in a build.
- The same literal is written in every environment. `import.meta.url` never survives a matched call.
- Default exports, aliased callees, non-exported calls, and calls with fewer than two arguments are left untouched.

### Registration

- The plugin keeps a registry of `(key, environment)` pairs naming the files the client build must emit. It is filled during server-environment builds from three sources and read by the client build.
- **Islands.** Every `clientEntry()` match in a server environment registers its module for the `client` environment.
- **Literal method arguments.** In every server-environment module, a call expression whose callee is a member named `getScriptEntry`, `getHref`, `getPreloads`, or `getStylesheets` and whose first argument is a string literal, or an array literal of string literals, registers each path. A path that does not resolve to a file from the root is a build error naming the module and the call. A non-literal argument registers nothing and is not an error.
- **Configuration.** `assets({ include: string[] })` registers each root-relative path, for arguments that are computed at runtime. `remix({ assets: { include } })` forwards it.
- A registered script is emitted in the client build with `this.emitFile({ type: "chunk", id, preserveSignature: "exports-only" })`; a stylesheet as a chunk whose only module is CSS, so the build emits its CSS asset; any other file as an asset named by the client environment's `assetFileNames`.
- `assets({ serverEnvironments })` names the environments treated as server, default `["ssr"]`, as `remix()`'s option does today; `remix()` forwards its own.

### Build ordering

- Server environments must build before the client environment, because the client build reads the registry the server build fills. `remix()` orders them, as today.
- `assets()` on its own contributes a `buildApp` handler that builds each server environment, then the client environment, skipping any environment already built. When another orchestrator has already built the client environment before any server environment, the plugin throws an `Error` naming the ordering requirement.
- The plugin marks `@pitlane/assets` as `noExternal` in server environments, so the runtime and the manifest import are bundled into the server output and the built server never requires the package at runtime.

### The manifest

- `AssetsManifest` is a discriminated union. A build manifest is `{ mode: "build"; base: string; environments: Record<string, Record<string, { entry?: string; js: string[]; css: string[] }>> }`, keyed by environment and then by key: `entry` the URL of the key's chunk or asset, `js` the chunk and its transitive static imports, `css` the stylesheets those chunks import — each prefixed with the client environment's `base`, or the string `experimental.renderBuiltUrl` returns when it returns one. A dev manifest is `{ mode: "dev"; root: string; base: string }`, which is all the dev URL rule needs. The published module exports `{ mode: "unavailable" }`.
- The build manifest additionally carries `importMap: { imports: Record<string, string> }`, containing the client build's generated map or `{ imports: {} }` when disabled. It is stored once, not copied into every entry record. The URL customization described above applies only when chunk import maps are disabled.
- After the last environment builds, the plugin writes `__pitlane_assets_manifest.js` into the server output directory from the captured bundles, and copies SSR-emitted assets into the client output directory. There is no fallback write; this is the only path, and it is what prerendering and a second orchestrator consume.
- The plugin resolves `@pitlane/assets/manifest` in server environments: in a build to a module whose default export is the written manifest, as one import rewritten in `renderChunk` to a path relative to the importing chunk; in dev to a generated module exporting the dev manifest. In the client environment the published module is used as is.

### Chunk import maps and caching

- `assets()` enables Vite's chunk import maps for the `client` environment by default. `assets({ chunkImportMap: false })` opts out; `remix({ assets: { chunkImportMap: false } })` forwards the same option. The option is a boolean and affects only the client build, never forwarding the setting to server environments or changing development's empty import map.
- An explicit plugin `chunkImportMap` value takes precedence over the native client-build setting. Without a plugin value, an explicitly configured native client-build value is respected; otherwise the effective value is `true`. Vite's own default of `false` is not an explicit opt-out. Applications do not need to configure `environments.client.build.chunkImportMap` to use or disable the feature.
- Vite owns identifier generation, import rewriting, and map generation. The plugin captures the final client output's import-map asset, respecting a configured Rolldown import-map filename, and includes its contents in the server manifest. An enabled build with no generated map fails with an error naming the missing artifact rather than silently returning an empty map. Opting out restores ordinary Vite chunk references and `{ imports: {} }` from the resolver without changing its method surface.
- `getScriptEntry()` and `getImportMap()` expose the complete map so dynamic imports and islands not present in the initial render remain resolvable. Map entries alone do not preload their targets. Static preload traversal remains separate and uses actual emitted chunk URLs; script hrefs, island `moduleUrl`s, and preload hrefs never become logical chunk identifiers.
- The document renders Remix's `<ImportMap value={importMap} />` before modulepreload links and module scripts. The map is inline HTML, not a browser fetch of `importmap.json`. Resolved islands carry the same map through `render({ assets })`; Remix owns merging, frame-delivered mappings, and conflicts with mappings already installed in a document. Pitlane adds no second renderer or browser map manager.
- Map keys and targets retain Vite's configured deployment base; they must resolve correctly on nested document routes. Verification covers root, non-root, relative, and absolute CDN bases rather than assuming document-relative map paths can be copied unchanged. Any normalization needed for delivery preserves the identity that generated module imports resolve to.
- An effective `chunkImportMap: true` together with `experimental.renderBuiltUrl` is a configuration error naming both options and explaining the plugin-level opt-out. This includes otherwise-default configurations that set only `renderBuiltUrl`: the plugin does not silently disable maps. Apps needing URL customization set `assets({ chunkImportMap: false })` or its `remix()` equivalent.
- Guides state that the default build uses an experimental Vite feature requiring browser import maps and `import.meta.resolve`. Apps targeting browsers without that support opt out; Pitlane does not silently inject a compatibility polyfill. Remix's separate multiple-import-map compatibility requirements continue to apply to streamed frame mappings.
- Chunk grouping stays in Vite's `build.rolldownOptions.output.codeSplitting` configuration. The guide shows explicit groups for React, React DOM, Zod, and TanStack Query, including the decision about their transitive dependencies. Dependencies remain bundled and tree-shaken, not external bare imports. Pitlane supplies neither an automatic package-boundary policy nor a duplicate grouping option.
- The guarantee is removal of invalidation caused solely by an imported JS chunk's content hash changing. Tree-shaking, export changes, changed chunk membership, and compiler output can still change other chunks. Production serving remains responsible for immutable caching of hashed artifacts, current HTML carrying the map, and retaining old artifacts for existing documents; this package sets no HTTP cache headers.

The opt-out is the same with either plugin:

```ts
assets({ chunkImportMap: false });
remix({ assets: { chunkImportMap: false } });
```

### Dev stylesheets

- The Vite client patch that lets server-graph stylesheet links coexist with Vite's injected styles moves into `@pitlane/assets/vite`. Links carry plain hrefs; the patch maps a link's pathname back to a module id using the root the plugin writes into it. The CSS self-accept patch moves with it. Reused upstream code retains attribution and the required copyright and license notices in source and distributed artifacts.
- These patches depend on Vite client internals. Pitlane owns their compatibility after removing fullstack; dependency removal does not make them public Vite APIs. Browser verification must show stylesheet edits updating the page and server-rendered links coexisting with client-injected styles without duplicate stylesheets or stale styles across the supported verification matrix.

### `@pitlane/dev`

- `remix()` registers `assets()` and keeps everything else it does: environments and output directories, the `clientEntry` and `serverEntry` inputs, the client fallback input when `clientEntry` is `false`, the SSR-first `buildApp`, prerendering, the preview server, abort-error suppression, SPA mode, component HMR, server-data HMR.
- The dev server handler serves requests through the first server environment's entry `default.fetch`, adapted with `createRequestListener` from `remix/node-fetch-server`. `serverHandler: false` keeps disabling it.
- `HMR` is exported from `@pitlane/dev/runtime`. The published module exports a component that renders nothing. In dev, the plugin resolves `@pitlane/dev/runtime` for server and client environments to a module whose `HMR` is the island that revalidates the page when a server-only module changes, as `pitlane:dev` does today. In a build the published module is used as is, so a production bundle carries no HMR code. `pitlane:dev` is not resolved.
- Each concern inside `remix()` remains a separately named plugin in the array it returns, so a later move of one into its own package is a move rather than a rewrite.

### Removals

- `?assets`, `?assets=client`, and `?assets=ssr` imports are not resolved; an import with that query fails as any unknown query does. `ImportedAssets` and `mergeAssets` are removed. `@pitlane/dev/assets` and its ambient declarations are removed along with the old tsconfig `types` entry. Optional generated path typing uses the separate declaration reference described above.
- `build.ts` loses the fallback manifest synthesis and the fullstack builder shims.
- `@hiogawa/vite-plugin-fullstack` and `oxc-parser` are removed from `@pitlane/dev`'s dependencies. `@pitlane/assets` is added as a Pitlane dependency; no replacement third-party integration dependency is added.

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
| `import { HMR } from "pitlane:dev"` | `import { HMR } from "@pitlane/dev/runtime"` |
| `"types": ["@pitlane/dev/assets"]` in tsconfig | delete it |
| — | `@pitlane/assets` in `dependencies` |

- The Vite peer minimum rises from 7.0 to 8.1. Vite 7 and 8.0 are unsupported even when chunk import maps are disabled; the package READMEs, guides, and changeset state the new minimum.
- Chunk import maps are enabled by default in the client build. Documents must deliver the returned map before modulepreload links and module scripts. Applications using `experimental.renderBuiltUrl` or targeting browsers without the required import-map features explicitly opt out through the plugin; the migration guide and changeset call out this default.
- An app that calls `render()` without `assets` fails at its first island render with the upstream error quoted above.
- The serialized `moduleUrl` in `#rmx-data` remains an emitted chunk URL in build, not a logical import-map identifier, and remains the module's dev URL in development for file-backed islands. Enabling maps can change build output bytes and hashes; identical filenames across the migration are not promised.
- Every existing `remix()` option keeps its meaning; `assets` is a new option.
- The manifest file in the server output is renamed to `__pitlane_assets_manifest.js`, and plugin names reported by Vite change from `fullstack:*` to `pitlane-assets-*` and `pitlane-remix-*`. Nothing documented reads either by name.
- Generated path typing is opt-in. Existing JavaScript consumers and TypeScript consumers without generation retain unrestricted runtime strings; opting in rejects noncanonical spellings and arbitrary strings at application call sites unless the caller explicitly uses the broader runtime interface.

`@pitlane/assets` ships at `0.1.0`. The `@pitlane/dev` changeset is a minor bump with the break and the migration table in its body, following the package's 0.x practice.

## Implications on adoption

- Every server-rendered app migrates its document and render wiring once, by the table above, and adds `@pitlane/assets` as a dependency.
- An app moves between No Build and Pitlane by changing how `app/assets.ts` constructs `assets`; the document and `render({ assets })` are the same in both.
- A Remix app on plain Vite environments can adopt `@pitlane/assets/vite` alone.
- Adoption in [`pitlane-tools/templates`](https://github.com/pitlane-tools/templates) is a companion branch and pull request prepared during implementation, not a post-release follow-up. The branch uses the package branch's name and follows `.agents/skills/adopting-packages-into-templates/`. It covers all eight starters: `cloudflare`, `netlify`, `vercel`, `railway-node`, `railway-bun`, `railway-deno`, `deno-deploy`, and `github-pages`.
- Settle the server-rendered migration in one starter, then replicate the shared app changes: construct the resolver in `app/assets.ts`, migrate document asset references, and wire island resolution into the renderer. Existing direct `renderToStream` adapters use the resolver pattern above while preserving their frame-resolution behavior. Update dependency ranges, Deno `npm:` imports, affected ambient declarations, and READMEs. Runtime imports put `@pitlane/assets` in `dependencies` or the Deno imports map; `@pitlane/dev` remains build-time tooling. The GitHub Pages starter keeps `remix({ server: false })` and its browser-only rendering; it adopts the compatible tooling without adding an unused server resolver.
- Server-rendered templates enable generated path typing and include its declaration and generation task, including the Deno-native starters. Their typecheck workflow generates from a clean checkout without a prior dev session or production build. GitHub Pages does not add unused resolver type generation.
- Build every starter against the candidate packages, including the Deno build/check tasks, using local package artifacts before publication. Exercise the built server-rendered starters' document asset URLs, island hydration, preload links, and frame navigation, plus the GitHub Pages SPA and its non-root deployment base. Remove local artifact overrides and their lockfile changes before committing; the companion branch declares the intended published ranges.
- `@pitlane/assets`'s first publish is manual, as every first publish is; `@pitlane/dev` releases after it, since its manifest pins the resolved version. Merge the templates companion only after both released packages are installable from npm, then verify clean installs and builds without local overrides.
- Reversible by pinning the previous `@pitlane/dev` minor.

## Scope

- `packages/assets`: `createAssetResolver`, the generic types, the manifest module and type registry, and the plugin with its transform, registry, build-ordering handler, manifest writer, SSR-asset copying, dev stylesheet collection, and the Vite client patches. Optional source-path cataloging, declaration generation, and the `pitlane-assets typegen` command. README documenting use with and without `remix()`. TypeDoc config in `.typedoc/`, the package added to `pkg-preview.yml`, `.agents/commit-scopes`, and the umbrella's pins.
- `@pitlane/dev`: `remix()` composing `assets()` and forwarding `assets` and `serverEnvironments`; the dev server handler on `remix/node-fetch-server`; `HMR` on `@pitlane/dev/runtime` with the dev swap; HMR and route-map parsing through Vite; removal of `?assets=`, `ImportedAssets`, `mergeAssets`, `@pitlane/dev/assets`, `pitlane:dev`, the fallback manifest synthesis, the fullstack builder shims, and the fullstack and direct parser dependencies.
- Tests: transform unit tests for the literal key and for registration from literal arguments; unit tests for `createAssetResolver` with dev, build, and unavailable manifests, and for the manifest writer; a plain-Vite fixture exercising `assets()` without `remix()`; the node end-to-end fixture asserting the document's script and stylesheet hrefs, an island's hashed `moduleUrl`, and its `modulepreload` link; the dev, HMR, Cloudflare, prerender, and SPA suites migrated to the resolver and `@pitlane/dev/runtime` and green.
- Compatibility verification: plain Vite 8.1.0, the current Vite 8 release, and Vite+ exercise dev, build, preview, raw TypeScript route-map discovery, component HMR, and stylesheet-link/injected-style coexistence. Isolated installs of the packaged candidates with strict peer checking must produce a valid dependency tree without fullstack or a direct Pitlane `oxc-parser` dependency. A separate consumer with no Vite installed imports the runtime and manifest entry points, typechecks against their published declarations, and resolves entries from a supplied manifest.
- Import-map verification: default-enabled builds and plugin-level opt-out with `assets()` alone and through `remix()`; explicit native-setting fallback and plugin-over-native precedence; server environments and development unchanged; resolver key errors and empty input; a two-build dependency-only change preserving app and lazy-importer bytes and filenames while changing the dependency target; document ordering and real browser execution of static imports, dynamic imports, island hydration, and frame-introduced islands; the deployment bases listed above; custom map filenames; missing-map errors; the default `renderBuiltUrl` conflict and successful build after opting out; prerender and second-orchestrator consumption of the captured map.
- Type-generation verification: inferred scalar and readonly-array arguments across all five methods; typo and arbitrary-string errors; empty-catalog strictness; compatibility with Remix and explicitly widened renderer adapters; custom and untyped manifests without generated files or Vite installed. Exercise a clean-checkout typegen/check sequence, required-file failure before generation, editor completion and add/remove/rename refresh, exclusions and explicit outside-root includes, deterministic no-op regeneration, and equivalent command/plugin output. Prove an unused cataloged file is not emitted and a typed but unregistered computed input still fails lookup.
- Guides: a new guide for `@pitlane/assets`; the asset and client-entry sections of the vite-plugin guide rewritten to point at it; the HMR and SPA guides' `?assets=` and `pitlane:dev` references updated; both package READMEs; the docs app's own document migrated; changesets.
- The assets guide explains default-on client chunk import maps, the plugin-level opt-out and native-setting precedence, explicit vendor groups, inline map delivery, browser requirements, caching limits, deployment headers, and retention of old hashed artifacts. It distinguishes map completeness from preloading and chunk grouping from cache-stable references.
- The assets guide documents optional strict typing, one-time project setup, the standalone generation command, the source-catalog/registration distinction, runtime-interface widening, and disabling generation without stale declarations. Examples retain the same application imports with typing enabled or disabled.
- Demos: migrate `demos/content-vite` and `demos/theme` to the resolver and Pitlane-owned imports; remove direct fullstack imports, dependencies, and ambient types. The theme demo adopts `@pitlane/dev` instead of its local `remix.plugin.ts`; delete that plugin and dependencies made obsolete by its removal. Build and exercise both migrated demos.
- Templates: the companion `pitlane-tools/templates` migration, all eight starters' verification, and release ordering described under Implications on adoption are required scope.
- `VISION.md` updated in phase 5: the package list and sequence gain `@pitlane/assets`; the `@pitlane/dev` section stops saying it wraps fullstack, describes the transform's output through the new package, and replaces its direct `oxc-parser` claim with Vite's public parser.

### Out of scope

- A Pitlane import-map generator, import rewriter, automatic vendor grouping policy, entry-specific map filtering, HTTP caching implementation, or browser import-map polyfill. Vite generates the map; Pitlane captures and exposes it; Remix delivers it.
- `assets.fetch`, `getAssets`, and `getAssetDetails`. Vite serves in dev and `staticFiles` in production; inspection is Vite's.
- File transforms through `getHref`'s `transform` option. Image transforms are the concern of the planned image packages.
- Splitting HMR, prerendering, the preview server, or SPA mode into their own packages. HMR changes together with dev serving and the island transform in both directions, and the vision keeps prerendering in `@pitlane/dev`.
- The audit's content integration, Satteri type boundary, frontmatter date behavior, and theme dependency-wording changes. No replacement of `yaml`, `es-module-lexer`, or `csstype`.

## Preview

- Artifact: the pkg.pr.new builds of `@pitlane/assets` and `@pitlane/dev` from `pkg-preview.yml`, installed into a copy of `packages/dev/tests/fixtures/node-app` migrated to `assets` and `render({ assets })`, run with `vite dev` and `vite build && vite preview`, inspecting the document head and `#rmx-data`; and the same package installed into a plain-Vite copy with `assets()` alone.
- With the default plugin configuration, exercise a lazy import and an island introduced by a frame, then compare two builds differing only in one dependency implementation. Confirm unchanged importer URLs and bytes, changed dependency mapping, and browser execution against the new map; inspect network caching separately from build-output stability. Repeat with the plugin-level opt-out and verify ordinary chunk loading and empty resolver maps.
- In the installed package preview, enable generated typing and run the standalone command before the checker on a clean fixture. Observe path completion, a misspelled-path diagnostic, and updated suggestions after adding, renaming, and removing a source file during dev; verify runtime resolution still works with generation disabled.
- The readiness report also links the templates companion PR and records the candidate package versions and each starter's exercised adoption results. Local package artifacts are a verification device, not committed dependencies or a third preview mechanism.
- Reason: the change is package behavior with a server-rendered surface; the fixture is the smallest app that exercises a document, a stylesheet, and an island in both modes, and the plain-Vite copy is the standalone claim. The guide changes ride on the docs preview for prose only.

## Policies and decisions checked

- `decision.0001` Static Documentation Delivery — the docs site is prerendered and served statically; this proposal changes how assets are named and islands resolved, which the docs build exercises through `remix({ prerender })`, and does not alter delivery. The docs app's own document migrates as part of scope.
- `policies/` is empty.
- `VISION.md` key principle, Remix idioms — honored by constructing the resolver in `app/assets.ts` from an explicit manifest rather than exporting a pre-made one. Principle 5, Demand Composition — honored by attempting the feature as a new package that is useful when installed directly, and by leaving concerns that change together inside `@pitlane/dev`. Principle 6, Distribute Cohesively — honored by the umbrella subpath `pitlane/assets`. Principle 3, Runtime When Possible — `createAssetResolver` is a runtime function of a manifest and works without a build; static analysis is the optimization that fills the manifest under a bundler. The planned sequence's "no separate `@pitlane/prerender` package" is respected. §`@pitlane/dev` says the plugin wraps fullstack and describes the transform's output; both sentences become false and are updated in phase 5.
- `VISION.md` principle 4, Avoid Dependencies — honored by replacing fullstack with Pitlane-owned integration, reusing Vite's public parser, retaining the focused `magic-string` tooling dependency, and keeping runtime JavaScript and declarations independent of the build toolchain. The dependency audit's unrelated content and theme work remains outside this proposal.
- `VISION.md` principle 3, Runtime When Possible — optional generated types narrow an existing runtime API rather than define its availability. A supplied manifest works without Vite or generated declarations; the type catalog neither registers build inputs nor becomes runtime state.

## Future directions

- `getHref` accepting a `transform` option once an image package defines what a transform is under Vite.
- Other build plugins reusing the runtime: `createAssetResolver(manifest)` is the contract, and `@pitlane/assets/manifest` is the module to replace.

## Alternatives considered

- **Keep the runtime on `@pitlane/dev/runtime`** — one package, one release. Rejected: application code would import a Vite plugin package for a runtime object, the concern would stay unnamed, and a Remix app on plain Vite could not take it without `remix()`.
- **A runtime-only `@pitlane/assets`, plugin stays in `@pitlane/dev`** — mirrors `remix/assets` in imports. Rejected: a package that is only a library for `@pitlane/dev` is not useful when installed directly, which principle 5 requires.
- **A new package carrying the whole plugin, with `@pitlane/dev` left as is and deprecated** — zero break for existing users. Rejected: `assets` would be the name of build orchestration, prerendering, the preview server, HMR, and SPA mode; the deprecated package would keep the fullstack liability and double the suites to run; and Remix's own prerelease precedent was a hard rename, not a parallel package.
- **One package per concern now (`@pitlane/hmr`, …)** — maximal composition. Rejected for this change: HMR and dev serving change together in both directions, prerendering is kept in `dev` by the vision, and each is a move later if it earns one.
- **Keep `?assets=` and add `assets` beside it** — a softer upgrade. Rejected: two vocabularies for one question, both to document and test, and the second one would be the one Pitlane already knows is worse.
- **Keep the transform writing final URLs and let apps add `resolveClientEntry` themselves** — the Kody pattern. Rejected: it solves the symptom in every app instead of the cause in the plugin.
- **A pre-made `assets` export, with the manifest swapped behind it** — two earlier drafts. Rejected: it is the magic global the Remix-idioms principle names, it hides the one seam a non-Vite graph needs, and `import { assets }; export { assets }` in `app/assets.ts` is a stranger file than one that constructs what it exports. A manifest is a real argument, and the app importing it makes the swap visible.
- **`createAssets` or `createAssetsClient` as the constructor's name** — `createAssetResolver` says what the object does: it resolves paths to what a build produced, where `createAssetServer` compiles and serves. "Client" implied a server to talk to; there is none.
- **Configuration-only registration** — `include` for every non-entry file. Rejected as the sole mechanism: every stylesheet is written twice, and a forgotten entry fails only in production. It stays as the mechanism for dynamic arguments.
- **A virtual module such as `pitlane:assets`** — matches the old `pitlane:dev` convention. Rejected on Kody's evidence: every virtual id in application code is one more stub pair for graphs Vite does not build. `pitlane:dev` goes for the same reason.
- **Absolute `file:///…` keys** — need no path computation in dev. Rejected: a build-machine path baked into `dist/ssr` makes builds non-reproducible across machines and says nothing the root-relative path does not.
- **Pitlane's own `render()` middleware** — would expose the full `resolveClientEntry` hook. Rejected: it duplicates upstream's frame resolution and error handling, and the `assets` option is the seam upstream designed for bundlers.
- **Folding server-graph CSS into `getPreloads`** — fewer methods. Rejected: a document would have to tell stylesheet links from module preloads by extension, and the two are rendered differently.
- **Generate path types from emitted assets or existing calls** — rejected: output-only types require a build before authoring and omit unused files; accepting call spellings as the catalog would let a typo define its own validity. Types come from independently discovered source files, while registration remains separate.
- **Completion hints with a catch-all `string` signature** — rejected for generated mode: they suggest paths but accept misspellings. The inferred interface is strict, with an explicit broader runtime interface for dynamic inputs.
- **Require native Vite configuration to opt in to chunk import maps** — rejected: cache-stable chunk references are the default client-build behavior. A plugin-level opt-out keeps browser-compatibility and URL-customization decisions next to the asset integration, while Vite still owns the implementation.

## Open questions

- [NEEDS CLARIFICATION: The resolver's dev href for an island omits Vite's `?t=` HMR timestamp. If the HMR end-to-end suite shows a stale island after a server-only change, is appending the module's `lastHMRTimestamp` acceptable, or should the island path never depend on the module graph?]
- [NEEDS CLARIFICATION: Vite's chunk import-map keys hash each entry chunk's absolute module path, so builds from different checkout directories produce different client bytes for chunks that import entries or islands. Is that acceptable for the default-on configuration, should Pitlane report it upstream to Rolldown and wait for root-relative hashing, or should the proposal require a deterministic build path or another mitigation?]

## Acknowledgments

Mark Dalgleish, for pointing at `resolveClientEntry` as the bundler seam at Remix Jam 2026. Kent C. Dodds's Kody, for being the production app that showed where the current integration pinches.

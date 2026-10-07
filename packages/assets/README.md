# @pitlane/assets

Framework-neutral asset resolution for server-rendered apps built with Vite or another bundler.

A server-rendered page has to name its browser entry script, its stylesheets, `modulepreload` hints, and the chunks of the islands it hydrates. Those URLs differ between `vite dev` and a production build. This package resolves source paths such as `app/entry.browser.ts` to the URLs the current dev server or build produced, through a resolver you construct from a manifest. The runtime imports no framework and no bundler. Its methods match the asset server from `remix/assets`, so it can be passed to Remix's `render({ assets })`. React, Preact, Vue, and plain HTML renderers use the returned strings directly.

```sh
npm install @pitlane/assets
```

Requires Node `^20.19.0 || >=22.12.0`. Install it as a runtime dependency, since application code imports the resolver. `vite` 8.1 or newer is an optional peer dependency, needed only for `@pitlane/assets/vite-plugin`.

| Entry point                   | Contents                                                         |
| ----------------------------- | ---------------------------------------------------------------- |
| `@pitlane/assets`             | `createAssetResolver`, `renderImportMap`, and the manifest types |
| `@pitlane/assets/manifest`    | The manifest a build integration supplies                        |
| `@pitlane/assets/build`       | `createAssetManifest`, for integrations with other bundlers      |
| `@pitlane/assets/vite-plugin` | `assets()`, the Vite integration                                 |

## Usage

Add the plugin to your Vite config:

```ts
// vite.config.ts
import { assets } from "@pitlane/assets/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [assets()],
});
```

Construct the resolver once, from the manifest the plugin supplies:

```ts
// app/assets.ts
import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

export let assets = createAssetResolver(manifest);

export let scriptEntry = await assets.getScriptEntry("app/entry.browser.ts");
export let stylesheets = await assets.getStylesheets("app/entry.server.ts");
```

`scriptEntry` is `{ href, preloads, importMap }`: the entry's URL, its chunk and static JavaScript dependencies for `modulepreload` links, and the client import map. Under `vite dev`, `href` is the dev URL, `preloads` is empty, and the map is `{ imports: {} }`.

Keys are paths from the project root. `./app/x.ts`, `/app/x.ts`, `file:app/x.ts`, and `app/x.ts#Export` all name `app/x.ts`, and a module outside the root keeps its leading `../`. A string literal passed to a resolver's `getScriptEntry` or `getHref` in server code registers that module as a browser input: a script entry for `getScriptEntry`, an emitted asset for `getHref`. The receiver must be a `createAssetResolver()` result, a top-level variable holding one, or such a variable imported, renamed, re-exported, or default-exported from another module; a namespace import, a function parameter, `this`, or another object's same-named method registers nothing. List computed paths, and keys called through those receivers, in `assets({ include: [...] })`.

| Method | Returns |
| --- | --- |
| `getScriptEntry(key)` | `{ href, preloads, importMap }` for a browser entry |
| `getHref(key)` | The URL of a browser entry, stylesheet, or other asset |
| `getPreloads(key \| key[])` | `modulepreload` URLs for scripts, and the URL of an explicitly requested stylesheet |
| `getStylesheets(key \| key[], { environment? })` | Stylesheets the modules need, from the client and current server graphs by default |
| `getImportMap(key \| key[])` | The complete client import map |

Looking up a module's stylesheets never compiles it for the browser, so `getStylesheets("app/entry.server.ts")` is safe for server code.

## Chunk import maps

Off by default. `assets({ chunkImportMap: true })` enables Vite's chunk import maps for the client build, so a dependency's new hash changes one map entry instead of every importing chunk. Deliver the map before any `modulepreload` link or module script. `renderImportMap({ value, nonce })` returns it as a `<script type="importmap">` string, with every `<` escaped so the map cannot close the element, or `""` when the map is empty:

```ts
import { renderImportMap } from "@pitlane/assets";

let html = renderImportMap({ value: scriptEntry.importMap });
```

The option requires browser support for import maps and `import.meta.resolve`, and cannot be combined with Vite's `experimental.renderBuiltUrl`.

## Without Vite

As published, `@pitlane/assets/manifest` exports `{ mode: "unavailable" }`. A resolver built from it constructs normally and rejects every lookup with instructions for supplying a manifest, so tests and type checkers can import your `app/assets.ts`.

Other bundlers produce a manifest with `createAssetManifest(build)` from `@pitlane/assets/build`. It takes a normalized description of the emitted chunks, their modules, static and dynamic imports, and stylesheets, and computes preloads, stylesheet lists, and public URLs:

```ts
import { createAssetManifest } from "@pitlane/assets/build";
import { createAssetResolver } from "@pitlane/assets";

let manifest = createAssetManifest({
    base: "/",
    environments: {
        client: {
            role: "client",
            chunks: {
                main: {
                    file: "assets/main-a1.js",
                    modules: ["src/main.ts"],
                    imports: [],
                    dynamicImports: [],
                    stylesheets: ["assets/main-b2.css"],
                },
            },
            entries: { "src/main.ts": "main" },
            assets: {},
        },
    },
});

let assets = createAssetResolver(manifest);
await assets.getScriptEntry("src/main.ts");
// { href: "/assets/main-a1.js", preloads: ["/assets/main-a1.js"], importMap: { imports: {} } }
```

## Documentation

- [Asset resolution](https://pitlane.tools/guides/assets): resolver methods, source keys, registration, Remix and non-Remix documents, chunk import maps, and errors.
- [Manifest integrations](https://pitlane.tools/guides/asset-build): the `createAssetManifest` input model for integration authors.

## License

MIT

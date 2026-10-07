---
title: Asset resolution
description: Resolve browser entries, stylesheets, preload hints, and import maps from a Vite build or dev server with pitlane/assets, in a Remix app or any other server-rendered app.
---

# Asset resolution

A server-rendered page has to name its browser assets: the script that boots the page, the stylesheets it needs, `modulepreload` hints for the chunks that script imports, and the chunk of every island it hydrates. Those URLs differ between `vite dev` and a production build, and only the bundler knows them.

`pitlane/assets` answers those questions through an asset resolver you construct from a manifest. The Vite plugin supplies the manifest. The resolver turns source paths such as `app/entry.browser.ts` into the URLs the current dev server or build produced for them. It imports nothing from Remix or any UI library, so the same object serves a Remix document, a React or Vue renderer, or a hand-written HTML string.

The resolver has the resolution methods of the asset server from `remix/assets`: `getScriptEntry`, `getHref`, `getPreloads`, and `getImportMap`, plus `getStylesheets`. A Remix document written for that asset server runs unchanged. Only the file that constructs it differs.

## Setup

The Vite adapter needs Vite 8.1 or later. The resolver and [manifest generator](/guides/asset-build) do not require Vite. An app that installs the `pitlane` umbrella already has the assets package. Without the umbrella, add `@pitlane/assets` to `dependencies`, since application code imports its runtime.

`remix()` from `pitlane/vite-plugin-remix` installs the assets plugin itself. Pass its options as `remix({ assets: { … } })`. Any other Vite app adds `assets()` directly:

```ts
// vite.config.ts
import { assets } from "pitlane/assets/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [assets()],
});
```

Then construct the resolver once, in a module of your own:

```ts
// app/assets.ts
import { createAssetResolver } from "pitlane/assets";
import manifest from "pitlane/assets/manifest";

export let assets = createAssetResolver(manifest);

export let scriptEntry = await assets.getScriptEntry("app/entry.browser.ts");
export let stylesheetHref = await assets.getHref("app/styles.css");
```

The plugin replaces `pitlane/assets/manifest` with the manifest for the current dev server or build. Each resolver method returns a promise. In `app/assets.ts` above, the document's own entry and stylesheet resolve once, when the module loads.

The scoped packages work the same way: `@pitlane/assets`, `@pitlane/assets/manifest`, and `@pitlane/assets/vite-plugin`.

## Source keys

Every method takes a source key: the module's path relative to the project root, with forward slashes. These all name the same module:

| Spelling | Why you might see it |
| --- | --- |
| `app/counter.tsx` | The plain form |
| `./app/counter.tsx` | A relative-looking path |
| `/app/counter.tsx` | A leading slash marks the project root, not the filesystem root |
| `file:app/counter.tsx` | The island identity `remix()` writes |
| `app/counter.tsx#Counter` | An export fragment, which lookups ignore |

`.` and `..` segments inside a key collapse, so `app/lib/../counter.tsx` is `app/counter.tsx`. A module outside the project root keeps its leading `..` segments. A linked workspace package might have the key `../shared/widget.ts`. That key works from any checkout directory as long as the project and the linked package keep the same relative layout.

Absolute file URLs are not keys. `file:///Users/me/app/counter.tsx` and `file:/Users/me/app/counter.tsx` throw an error asking for the portable key. A manifest never contains the build machine's checkout path, so a deployed server has nothing to compare an absolute path against.

`#` starts the export fragment, so a source file whose name contains `#` cannot be a key.

## Resolver methods

| Method | Returns |
| --- | --- |
| `getScriptEntry(key)` | `{ href, preloads, importMap }` for a browser entry |
| `getHref(key)` | The URL of a browser entry, a stylesheet, or another emitted asset |
| `getPreloads(key \| key[])` | `modulepreload` URLs for scripts |
| `getStylesheets(key \| key[], options?)` | Stylesheet URLs a module needs |
| `getImportMap(key \| key[])` | The client build's import map |

Methods that take an array return one list in argument order, with duplicate URLs removed.

### `getScriptEntry`

```ts
let { href, preloads, importMap } = await assets.getScriptEntry("app/entry.browser.ts");
```

In a build, `href` is the emitted chunk and `preloads` lists that chunk followed by its static imports, shallowest first. Dynamic imports are not preloaded. `importMap` is the complete client map when [chunk import maps](#chunk-import-maps) are on, and `{ imports: {} }` otherwise.

Under `vite dev`, `href` is the module's dev URL (`/app/entry.browser.ts`), `preloads` is `[]`, and `importMap` is `{ imports: {} }`.

### `getHref`

Returns the URL of a registered browser entry, a stylesheet, or another asset, such as an image you reference by key. Under `vite dev` it returns the dev URL.

### `getPreloads`

Each script key contributes its chunk and its static JavaScript dependencies, never their CSS, so you can render every result as `<link rel="modulepreload">`. A stylesheet key passed explicitly contributes its own URL. Render those as `<link rel="preload" as="style">`, not as `modulepreload`. Under `vite dev` the result is always `[]`.

### `getStylesheets`

Returns the stylesheets a module needs, following its static imports. A dependency's stylesheets come before the stylesheets of the module importing it. Modules loaded only through `import()`, such as lazy routes, are left out.

Every lookup reads the client build's graph and the graph of the server environment the running server was built as. A key only has to appear in one of them, and the result combines both:

```ts
let stylesheets = await assets.getStylesheets(["app/entry.server.tsx", "app/entry.browser.ts"]);
```

A server's manifest describes those two graphs and no other server environment's, in development and in a build alike. A key that only another server environment imports fails with the missing-module error. There is no option to read one graph alone: a document needs the stylesheets of both. A stylesheet lookup never turns the module into a browser entry, so asking for the CSS of `app/entry.server.tsx` does not compile your server code for the browser.

With Vite's `build.cssCodeSplit: false`, the environment emits one combined stylesheet. Lookups return that stylesheet rather than a route-specific subset. It also contains the lazy-module CSS that Vite combines into it.

Under `vite dev`, CSS from server graphs comes back as dev URLs. CSS a browser module imports is injected by Vite itself, so the client graph reports none.

### `getImportMap`

Checks that each key is part of the client graph, then returns the complete client import map, not a subset for those keys. Lazy modules and later islands need the rest of it. An empty array returns `{ imports: {} }`, as do `vite dev` and builds with chunk import maps off.

## Registering browser entries

Only a browser entry has a script URL. The plugin registers one when:

- a server module calls `getScriptEntry` or `getHref` on a resolver with a string literal, as `app/assets.ts` does above;
- you list it in `assets({ include: ["app/widgets/chart.ts"] })`, which is how a computed path gets registered;
- it is already a client input in your Vite config;
- another plugin declares it, as `remix()` does for each island. See [Declaring entries from another plugin](#declaring-entries-from-another-plugin).

A literal call counts only when its receiver is the result of `createAssetResolver()`, imported from `pitlane/assets` or `@pitlane/assets`, or a top-level variable holding that result. The variable still counts when the module copies it (`const resolver = assets`) or calls a copy of the constructor (`const make = createAssetResolver`), and when another module imports it by any name, through `export { assets } from "./assets.ts"` or `export * from "./assets.ts"`, or as a default export. A copy counts only as a plain variable, not a destructured one. Each of those names needs exactly one declaration in its module. A second one anywhere in that module, even a parameter of an unrelated function, disqualifies every call through the name. A same-named method on another object registers nothing, and neither does a `createAssetResolver` imported from another module, a call through a namespace import (`import * as`), a function parameter, or `this`. Nor does a resolver imported from a dependency that Vite externalizes, since the plugin does not read that package's source; construct the resolver in a module of your own app, or list those keys in `include`.

`getStylesheets`, `getPreloads`, and `getImportMap` only read graphs the build already has. They register nothing, and routes discovered through `import.meta.glob` need no second list.

A script registered this way is emitted with its exports intact, and a stylesheet as a CSS file. Asking for a server module's stylesheets never puts that module in the client build.

An app with no browser entries, such as a server-rendered app that only links stylesheets, still builds without an `index.html`.

### Declaring entries from another plugin

During development, plugins declare discovered browser entries through `api.setBrowserEntries()` rather than emitting chunks. Find the `pitlane-assets` plugin in `configResolved`:

```ts
import type { AssetsPluginApi } from "pitlane/assets/vite-plugin";

let api: AssetsPluginApi;

// Inside your plugin object:
configResolved(config) {
    let assetsPlugin = config.plugins.find(plugin => plugin.name === "pitlane-assets");
    if (!assetsPlugin) throw new Error("my-islands needs assets() from pitlane/assets/vite-plugin.");
    api = assetsPlugin.api;
},
```

Then, in the transform hook where your plugin already finds its islands in a server module, report them for that module:

```ts
if (this.environment.mode === "dev") {
    api.setBrowserEntries({ environment: this.environment.name, owner: id, entries: browserModules });
}
```

`environment` is the server environment doing the transform, and `owner` is the resolved id of the module being transformed. `browserModules` holds the resolved ids of the browser modules that module declares, such as `(await this.resolve(specifier, id))?.id` for each island specifier your plugin found.

- Each call replaces everything that module declared in that environment. The same module can declare different entries in `ssr` and in another server environment without either overwriting the other.
- An empty `entries` list removes the declaration. Call the method on every transform that could declare entries, including ones that find none. Otherwise a deleted island stays registered.
- A declaration counts only while its owner is part of that environment's server graph, including lazy routes. Once nothing imports the owner, or the file is deleted, its entries are dropped.

Builds keep using ordinary client inputs and `this.emitFile`. `remix()` calls this API for its islands, so a Remix app needs none of this code.

## Under `vite dev`

No bundle exists during development. The plugin builds the manifest from Vite's module graph the first time a server environment imports `pitlane/assets/manifest`. To learn which stylesheets each module imports, it transforms the server graph and the client graphs of registered browser entries without running that code, so lazy routes stay unloaded until a request needs them. The result is plain data with no live connection to Vite, so it reaches a Cloudflare worker the same way it reaches Node.

Development follows server entries imported by Vite's module runner as well as configured build inputs. The development entry can differ from the production entry without losing its asset metadata.

When you add or remove an import, a glob route, or a browser entry, the plugin invalidates that environment's manifest and every module that imports it. The next import of your server entry builds a fresh manifest and re-runs those modules, so `await assets.getStylesheets(…)` at the top of a module sees the change too. `fetchServer()` and Cloudflare's dev server re-import the entry on each request. A custom server that holds on to a handler across requests will keep serving the old one. Editing only a stylesheet's rules leaves the manifest alone, and Vite updates the CSS in place.

A stylesheet used on both sides keeps its server-rendered `<link>` instead of gaining a second browser-injected copy. This preserves the document's CSS cascade order. Rule edits update the linked stylesheet without resetting browser state.

Browser code cannot import the manifest. It describes your server graph, so a browser module that imports it throws a server-only error when it runs.

## Plugin options

| Option | Default | Meaning |
| --- | --- | --- |
| `include` | `[]` | Source keys of browser entries the server code names with computed strings |
| `serverEnvironments` | `["ssr"]` | The Vite environments that run your server. Each one's server bundle, or dev server graph, receives a manifest naming it, which `getStylesheets` reads by default alongside the client. Importing the manifest from any other server environment is an error naming the environment and this option |
| `chunkImportMap` | off | Turns on [chunk import maps](#chunk-import-maps) for the client build |

Before building the client, the plugin builds the server environments, because they reveal which modules are browser entries. A platform plugin that orchestrates builds itself, such as Cloudflare's, keeps doing so, and each environment builds once.

The plugin replaces both `pitlane/assets/manifest` and `@pitlane/assets/manifest`, so either specifier works in `app/assets.ts`.

## Public URLs and `base`

Build URLs carry Vite's `base`. With `base: "/docs/"`, an entry resolves to `/docs/assets/entry.browser-a1.js`. A CDN base such as `https://cdn.example/app/` produces absolute URLs on that host.

A relative base such as `./` produces relative URLs like `./assets/entry.browser-a1.js`, which the browser resolves against the URL of the document it is reading. A document served at a nested route, such as `/blog/hello`, would look for `/blog/assets/…`. So a server-rendered app with nested routes needs an absolute base, or a `<base href>` element pointing at the directory its assets are served from.

## With Remix

Pass the resolver to Remix's own `render()` middleware. When an island renders, Remix calls `assets.getScriptEntry("file:app/counter.tsx")` and hoists the result's preloads into the head, so islands get preload hints without any code of yours:

```tsx
// app/entry.server.tsx
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import { assets } from "./assets.ts";

let renderMiddleware = render({ assets });

export let router = createRouter({ middleware: [renderMiddleware] });
```

The document reads the browser entry like the `remix` CLI template's document does:

```tsx
// app/document.tsx
import type { Handle, RemixNode } from "remix/component";
import { ImportMap } from "remix/component/server";

import { scriptEntry, stylesheetHref } from "./assets.ts";

export function Document(handle: Handle<{ children?: RemixNode }>) {
    return () => {
        let { href, importMap, preloads } = scriptEntry;

        return (
            <html lang="en">
                <head>
                    <meta charSet="utf-8" />
                    <link rel="stylesheet" href={stylesheetHref} />
                    <ImportMap value={importMap} />
                    {preloads.map(preloadHref => (
                        <link key={preloadHref} rel="modulepreload" href={preloadHref} />
                    ))}
                    <script type="module" src={href} />
                </head>
                <body>{handle.props.children}</body>
            </html>
        );
    };
}
```

A renderer you call directly, such as `renderToStream`, resolves an island by splitting off the export name itself: `{ ...(await assets.getScriptEntry(entryId)), exportName }`.

## Without Remix

Any renderer can use the returned strings. This builds a document head as plain HTML, escaping each URL for the quoted attribute it goes into:

```ts
import { renderImportMap } from "pitlane/assets";

import { assets } from "./assets.ts";

let attribute = (text: string) =>
    text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

let entry = await assets.getScriptEntry("src/entry.client.ts");
let stylesheets = await assets.getStylesheets("src/entry.server.ts");

let head = [
    renderImportMap({ value: entry.importMap }),
    ...stylesheets.map(href => `<link rel="stylesheet" href="${attribute(href)}">`),
    ...entry.preloads.map(href => `<link rel="modulepreload" href="${attribute(href)}">`),
    `<script type="module" src="${attribute(entry.href)}"></script>`,
].join("\n");
```

Escape URLs before putting them in HTML attributes. A configured base or filename can contain a quote or `<`. JSX handles attribute escaping for you. Plain HTML strings need the `attribute` function above. `renderImportMap` escapes its own output.

### Framework examples

Five small apps under [`packages/assets/examples`](https://github.com/pitlane-tools/pitlane/tree/main/packages/assets/examples) show the resolver with a renderer that is not Remix. Each one installs `@pitlane/assets` as an ordinary dependency and serves development requests through [`fetchServer()`](/guides/fetch-server). The document is an `@remix-run/html-template` template. The build has a client and a server environment, with a verify script and a browser check run against the output.

| Example | Shows |
| --- | --- |
| `react-router` | React 19 with React Router's data router. Routes come from `import.meta.glob` with a source key each; the matched keys go to `getPreloads` and `getStylesheets` |
| `vue-router` | Vue Router with pages written in Vue's Vapor mode inside a server-rendered shell |
| `solid-router` | Solid 2.0 with Solid Router: the pages are lazy routes registered as browser entries, so Solid's own asset resolver gets each page's script URL |
| `preact-islands` | Preact islands served through `@remix-run/fetch-router`; a transform registers each island with a literal `getScriptEntry` call |
| `lit-islands` | Lit elements rendered with declarative shadow roots and hydrated in place; a registry module holds the literal `getScriptEntry` calls |

No route-specific API is involved. The manifest indexes every module the glob discovered, so a computed key works in the metadata methods. Vue Vapor and Solid 2.0 are prereleases, pinned exactly in those two examples.

## Chunk import maps

Off by default for `assets()`, and on by default under `remix()`. With them off, chunks import each other by their final URLs, and a document needs no import map.

Turning them on makes Vite give each chunk a stable identifier and rewrite imports to use it, then emit a map from those identifiers to the current hashed files. When only a dependency's code changes, its map target can change while importing chunks keep the same bytes and filenames.

```ts
assets({ chunkImportMap: true });
// the Remix plugin has them on; turn them off with:
remix({ assets: { chunkImportMap: false } });
```

Vite's own `build.chunkImportMap` in the client environment's config also sets it. When both are set, the plugin option wins, so `chunkImportMap: false` overrides a native `true`. With neither set, the plugin's default applies.

With maps on, `getScriptEntry` and `getImportMap` return the complete map. Every document must deliver it before any `modulepreload` link or module script. Remix's `<ImportMap>` component handles that, and other renderers can use [`renderImportMap`](#rendering-the-import-map).

Preloads keep listing emitted chunk URLs. An island's `moduleUrl` in the page is also the emitted chunk URL.

Requirements and limits:

- Browsers need import maps and `import.meta.resolve`.
- The option cannot be combined with Vite's `experimental.renderBuiltUrl`. The build stops with an error naming both. `renderBuiltUrl` alone works with maps off, so a Remix app that uses it passes `remix({ assets: { chunkImportMap: false } })`.
- Caching holds only for changes to a dependency's content. Changing exports, chunk membership, CSS, assets, or compiler output can still change importing chunks.
- Vite derives some identifiers from the module's absolute path. Building the same source from a different checkout directory changes every chunk that imports an entry or island chunk.
- Cache headers and keeping old hashed files available are your deployment's job.

Choose vendor groups through Vite's `environments.client.build.rolldownOptions.output.codeSplitting.groups`. `[{ name: "vendor", test: /node_modules/ }]` puts dependency modules in a vendor group. Pitlane does not choose groups for you.

## Rendering the import map

`renderImportMap({ value, nonce })` returns a complete `<script type="importmap">` element as a string:

```ts
import { renderImportMap } from "pitlane/assets";

renderImportMap({
    value: { imports: { "/assets/counter-Bj6c.js": "/assets/counter-BuA5.js" } },
    nonce: "r4nd0m",
});
// <script type="importmap" nonce="r4nd0m">{"imports":{"/assets/counter-Bj6c.js":"/assets/counter-BuA5.js"}}</script>
```

- It writes every `<` in the map as the JSON escape `\u003c`, so no key or URL can close the script element. The browser parses the same strings back.
- `nonce` is written as an escaped, quoted attribute. The helper neither generates a nonce nor sets a Content Security Policy.
- It returns `""` when the map has no mappings in `imports`, `scopes`, or `integrity`, including scopes that are all empty. That covers `vite dev` and builds with maps off, where it renders nothing.
- It serializes one map. It does not merge maps or install them in a live page. Insert the string into server-rendered HTML before your module scripts, through your renderer's raw-HTML mechanism. Setting it with client-side `innerHTML` does not install a map.

## Outside Vite

Published as is, `pitlane/assets/manifest` exports `{ mode: "unavailable" }`. Constructing a resolver from it succeeds, so importing `app/assets.ts` in a test runner or type checker does not fail. Every method call then rejects with an error explaining how to supply a manifest.

A test, or a build that Vite did not run, can pass a manifest object of its own to `createAssetResolver`, or alias `pitlane/assets/manifest` to a module that exports one. [Manifest integrations](/guides/asset-build) describes how another bundler produces one with `createAssetManifest`.

## Errors

Each error names the method, the key, and the environment it looked in.

| Message begins | Cause | Fix |
| --- | --- | --- |
| `assets.getScriptEntry("…") has no asset manifest to read` | The manifest is the published `{ mode: "unavailable" }` | Add `assets()` or `remix()` to your Vite config, or pass a manifest |
| `… found no browser entry "…" in the "client" environment. The module is in the "ssr" graph but is not registered as a browser entry.` | A server module, or one the build saw, was never registered | Pass the key to the resolver's `getScriptEntry` as a string literal, or list it in `assets({ include })` |
| `… found no browser entry "…" in the "client" environment. No environment's graph contains the module.` | Nothing in the build has that key | Check the spelling, then register it as above |
| `assets.getHref("…") found no browser entry or asset` | The key is neither a registered entry nor an emitted asset | Register it as above |
| `… found no module "…" in the "client" environment's graph` | A preload, stylesheet, or import-map lookup for a module the graphs it reads do not contain | Check the key and the environment |
| `… received an absolute file URL` | The key was `file:///…` or `file:/…` | Use the key relative to the project root |

Only a missing browser entry suggests `assets({ include })`. A stylesheet or preload lookup never asks you to emit a server module into the client build.

---
title: Manifest integrations
description: Produce an asset manifest from any bundler's output with createAssetManifest from pitlane/assets/build, and consume it through createAssetResolver without Vite.
---

# Manifest integrations

The resolver from [`pitlane/assets`](/guides/assets) reads a manifest of emitted browser URLs and per-module JavaScript and CSS dependencies. The Vite plugin produces this manifest for Vite apps. Other build systems need an integration that supplies the same information.

`createAssetManifest(build)` from `pitlane/assets/build` (or `@pitlane/assets/build`) does the shared work once you describe what your bundler emitted. It walks the dependency graph to order preloads and stylesheets, then resolves public URLs into the manifest `createAssetResolver` reads. The Vite plugin calls this same function, so a manifest from your integration behaves exactly like one from Vite.

The generator does no file I/O: your integration reads the bundler's output and writes the manifest. It adds no dependency edges of its own and generates no import map. It imports no bundler, Vite included.

## What your integration supplies

```ts
import { createAssetManifest } from "pitlane/assets/build";

let manifest = createAssetManifest({
    base: "/",
    environments: {
        client: {
            role: "client",
            chunks: {
                entry: {
                    file: "assets/entry.browser-a1.js",
                    modules: ["app/entry.browser.ts"],
                    imports: ["runtime"],
                    dynamicImports: ["counter"],
                    stylesheets: ["assets/entry.browser-c3.css"],
                },
                counter: {
                    file: "assets/counter-d4.js",
                    modules: ["app/counter.tsx"],
                    imports: ["runtime"],
                    dynamicImports: [],
                    stylesheets: ["assets/counter-e5.css"],
                },
                runtime: {
                    file: "assets/runtime-b2.js",
                    modules: ["app/runtime.ts"],
                    imports: [],
                    dynamicImports: [],
                    stylesheets: [],
                },
            },
            entries: { "app/entry.browser.ts": "entry", "app/counter.tsx": "counter" },
            assets: { "app/styles.css": "assets/styles-i9.css" },
        },
        ssr: {
            role: "server",
            chunks: {
                server: {
                    file: "entry.server.js",
                    modules: ["app/entry.server.tsx", "app/counter.tsx"],
                    imports: [],
                    dynamicImports: [],
                    stylesheets: ["assets/document-g7.css", "assets/counter-e5.css"],
                },
            },
            entries: {},
            assets: {},
        },
    },
});
```

The fields of `build`:

| Field | Contents |
| --- | --- |
| `base` | The public base relative filenames resolve against: `/`, `/docs/`, `https://cdn.example/app/`, `./`, or `""` |
| `environments` | Every environment that participated, by name. Exactly one has `role: "client"`; the others are `"server"` |
| `importMap` | The import map your bundler generated for the client, if it generated one |

Each environment has:

| Field | Contents |
| --- | --- |
| `chunks` | Every emitted JavaScript chunk, keyed by an identity you choose. Keys only need to be unique within the environment |
| `entries` | Browser-entry source keys mapped to chunk identities. Only the client environment has entries |
| `assets` | Source keys mapped to emitted non-script files, such as a stylesheet entry or an image |

Each chunk has:

| Field | Contents |
| --- | --- |
| `file` | The emitted filename, or an absolute public URL |
| `modules` | Source keys of every module the chunk contains |
| `imports` | Identities of the chunks it imports statically, in import order |
| `dynamicImports` | Identities of the chunks it loads through `import()` |
| `stylesheets` | Emitted stylesheet filenames, or absolute public URLs, the chunk requires |

All four lists are required on every chunk, even when they are empty.

### Source keys

Source keys are paths relative to the project root with forward slashes, such as `app/counter.tsx`. A module outside the root, such as a linked workspace package, keeps leading `..` segments: `../shared/widget.ts`. Convert your bundler's absolute paths and `file:///` URLs to this form before passing them in. A key the build machine's checkout path leaks into cannot match on another machine. The generator rejects absolute file URLs.

Keys are normalized the way the resolver normalizes them: `./app/a.ts`, `/app/a.ts`, and `file:app/a.ts` are all `app/a.ts`, and `.` and `..` segments inside a key collapse. Resolve symlinks the way your bundler does, consistently, so one module has one key.

### Public URLs

A `file`, stylesheet, or asset value that is relative resolves against `base`, with a `/` inserted when `base` lacks a trailing one. An absolute value is used as is. That means a value starting with `/` (including `//`) or with a URL scheme such as `https:`.

| `base` | `assets/a.js` becomes |
| --- | --- |
| `/` | `/assets/a.js` |
| `/docs/` or `/docs` | `/docs/assets/a.js` |
| `https://cdn.example/app/` | `https://cdn.example/app/assets/a.js` |
| `./` | `./assets/a.js` |
| `""` | `assets/a.js` |

## What the generator computes

For every module in every environment, it records the module's preloads and stylesheets:

- Preloads start with the chunk holding the module, followed by every chunk reachable through static `imports`, shallowest first. Chunks at the same depth keep the order your `imports` lists give them. Each URL appears once.
- Stylesheets come from the `stylesheets` of the same chunks, with a dependency's listed before those of the chunk importing it. Each URL appears once.
- Edges in `dynamicImports` must name real chunks. The generator validates those references without adding their preloads or stylesheets to the importer.
- A cycle of imports is walked once. Each chunk in it appears once.
- A module in several chunks gets the union of every chunk's results, so report every chunk that contains it.

A browser entry's preloads always start with its own entry chunk, even when your `modules` lists leave the entry module out.

Environments stay separate. A server environment's graph never contributes to the client's metadata, and a module that appears only in a server graph never becomes a browser entry. That is what lets an app ask for a server module's stylesheets without compiling the server module for the browser.

The returned manifest has `mode: "build"`, `entries` and `assets` mapped to public URLs, per-environment `modules` metadata, and `importMap` set to your bundler's map or `{ imports: {} }`. It is plain JSON-compatible data.

## Writing and consuming the manifest

The generator leaves `serverEnvironment` unset, because one build can serve several servers. Set it to the environment a server was built as when you hand that server its manifest. It decides which server graph `getStylesheets` reads by default:

```ts
import { createAssetResolver } from "pitlane/assets";

let assets = createAssetResolver({ ...manifest, serverEnvironment: "ssr" });

await assets.getScriptEntry("app/counter.tsx");
// { href: "/assets/counter-d4.js",
//   preloads: ["/assets/counter-d4.js", "/assets/runtime-b2.js"],
//   importMap: { imports: {} } }

await assets.getStylesheets("app/entry.server.tsx");
// ["/assets/document-g7.css", "/assets/counter-e5.css"]
```

Getting the manifest to the server is your integration's job. Serialize it with `JSON.stringify` into a module in the server's output. Then either alias `pitlane/assets/manifest` to that module, so application code written for the Vite plugin runs unchanged, or import the object directly and pass it to `createAssetResolver`.

Copy any files a server environment emitted, such as stylesheets imported only by server code, into the client's public output, so their URLs resolve.

## Errors

The generator stops at the first problem and names the environment and the chunk or key involved.

| Message | Cause |
| --- | --- |
| `createAssetManifest() needs exactly one client environment; found none.` | No environment has `role: "client"`, or more than one does |
| `chunk "…" in the "…" environment imports "…", which is not a chunk in that environment.` | An `imports` or `dynamicImports` edge names a missing chunk |
| `browser entry "…" in the "…" environment names chunk "…", which is not a chunk in that environment.` | An entry points at a missing chunk |
| `the "…" environment lists browser entries, but only the client environment has them.` | A server environment has `entries` |
| `chunk "…" in the "…" environment has no file.` | A chunk has no `file` |
| `chunk "…" in the "…" environment has no imports list.` | A chunk is missing one of its four lists |
| `source key "…" maps to "…" in the "…" environment and "…" in the "…" environment.` | Two spellings of one key, or two environments, name different entries or assets for it |
| `source key "…" in the "…" environment is an absolute file URL.` | A key was not normalized to a project-relative path |

The generator cannot detect a fact your integration omitted. A chunk whose `imports` list is incomplete produces incomplete preloads without an error.

## Rsbuild integration example

Pitlane has no Rsbuild plugin. The [Rsbuild example](https://github.com/pitlane-tools/pitlane/tree/main/packages/assets/examples/rsbuild) shows what an integration for another bundler looks like end to end. Its small plugin, `pitlane-assets.ts`, hands Rsbuild's real compilations to `createAssetManifest` and writes the result for a Node server, which reads it with `createAssetResolver`. The plugin is a file the application owns, not a supported Pitlane API. The example installs `@pitlane/assets` and `@rsbuild/core@2.2.12`, and neither Vite nor Remix.

### The output it assumes

The example builds two Rsbuild environments:

- `web` targets browsers with `output.module: true`. Rspack emits every chunk as an ES module and loads lazy chunks with `import()`. An entry chunk statically imports the other chunks its entrypoint needs at startup, so the entry's URL is the only module script a document needs.
- `node` targets Node as ES modules, with `output.emitCss: true` so stylesheets the server imports are written as files.

The plugin checks that the `web` compilation uses `output.module`, the `module` chunk format, and `import` chunk loading, and fails the build for any other combination. Rsbuild's generated HTML is turned off, because the server renders the document.

### What the plugin reads

In `onAfterEnvironmentCompile`, the plugin reads each environment's Rspack compilation from `stats.compilation`:

| `createAssetManifest` input | Read from the compilation |
| --- | --- |
| environment `role` | `client` for the `web` target, `server` for `node` |
| chunk identity | the chunk's id |
| `file` | the chunk's one `.js` file |
| `stylesheets` | the chunk's `.css` files |
| `modules` | every module in the chunk, with concatenated modules expanded into their parts |
| `imports` | for an entrypoint's entry chunk, the entrypoint's other chunks |
| `dynamicImports` | the chunks of every lazy chunk group whose `import()` sits in a module of this chunk |
| `entries` | each client entrypoint's entry module, mapped to its entry chunk |
| `assets` | each emitted file whose asset info names a `sourceFilename` |

Source keys are module paths relative to the project root, taken after Rspack resolves symlinks, so a linked module outside the root keeps its leading `../`. Once every environment has compiled, `onAfterBuild` passes the collected graphs to `createAssetManifest` with the `web` environment's `output.assetPrefix` as `base`. It then copies the server's stylesheets into the `web` output and writes the manifest, with `serverEnvironment: "node"`, to `dist/server/pitlane-assets-manifest.json`. The server reads that file once at startup and passes it to `createAssetResolver`.

### Limits

- Only `rsbuild build`. The development server, hot module replacement, and watch rebuilds are not translated.
- Only the browser ES module output above. Classic scripts, `output.module: false`, and runtime chunks that HTML loads with separate script tags are not handled.
- A lazily imported module's preloads name only its own chunk. Chunks Rspack loads beside it in parallel go in the importing chunk's `dynamicImports`, never in its static `imports`.
- `output.assetPrefix: "auto"` fails the build, because the manifest needs a known public base.
- Every chunk must have exactly one JavaScript file. A configuration that splits CSS into chunks of its own fails the build.
- Rspack generates no import map, so `importMap` is `{ imports: {} }` and `renderImportMap` returns an empty string.

### Run it

The example needs Node 22.18 or later, which runs its TypeScript configuration and checks directly. Copy the example directory out of the Pitlane repository, so that Node cannot find the Vite that Pitlane itself builds with, then run:

```sh
npm install
npm run check
npm start
```

`npm run check` runs the example's type check against its own `tsconfig.json`, then the build, then `npm run verify`.

`npm run verify` first confirms that neither Vite nor Remix is installed. It then reads the written manifest through `createAssetResolver` and checks each answer against the files in `dist/web`. The entry's preloads hold the entry chunk and its shared startup chunk. The lazy module is observed but is neither a preload of the entry nor a browser entry. The server's stylesheet is found through the `node` graph. The SVG resolves to its emitted file. It prints what the resolver returned. `npm start` serves the page at `http://localhost:3000/`, where the client entry inserts the logo and the **Load the lazy module** button imports the lazy chunk and its stylesheet.

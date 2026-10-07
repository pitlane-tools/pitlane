# pitlane

A composable toolkit for [Remix](https://remix.run): every Pitlane package in one install.

Build tooling, runtime packages, and provider integrations that you can also adopt independently under their `@pitlane/*` names.

```sh
npm install pitlane
```

`remix@^3.0.0` and `vite@>=8.1.0` are peer dependencies. `satteri@^0.10.5` is an optional one, needed only for Markdown and MDX content.

Each `@pitlane/*` package is available under a `pitlane/*` subpath, with the same exports:

| Import | Re-exports |
| --- | --- |
| `pitlane/vite-plugin-remix`, `pitlane/vite-plugin-remix/hmr` | [`@pitlane/vite-plugin-remix`](https://pitlane.tools/package/vite-plugin-remix/): the Vite plugin for Remix |
| `pitlane/assets`, `pitlane/assets/manifest`, `pitlane/assets/build`, `pitlane/assets/vite-plugin` | [`@pitlane/assets`](https://pitlane.tools/package/assets/): built script, stylesheet, and preload URLs for server-rendered documents |
| `pitlane/vite-plugin-fetch-server` | [`@pitlane/vite-plugin-fetch-server`](https://pitlane.tools/package/vite-plugin-fetch-server/): a Vite development server for a `fetch` handler |
| `pitlane/theme`, `pitlane/theme/schema`, `pitlane/theme/default`, `pitlane/theme/dtcg` | [`@pitlane/theme`](https://pitlane.tools/package/theme/): design tokens and type-safe styling |
| `pitlane/content`, `pitlane/content/loaders`, `pitlane/content/vite-plugin`, `pitlane/content/hot`, `pitlane/content/satteri` | [`@pitlane/content`](https://pitlane.tools/package/content/): schema-validated content collections |
| `pitlane/crawler` | [`@pitlane/crawler`](https://pitlane.tools/package/crawler/): in-memory route crawling and static path discovery |
| `pitlane/data-table-d1`, `pitlane/data-table-d1/migrations` | [`@pitlane/data-table-d1`](https://pitlane.tools/package/data-table-d1/): the Cloudflare D1 driver for Remix's data-table |

```ts
import { remix } from "pitlane/vite-plugin-remix";
import { createAssetResolver } from "pitlane/assets";
```

`pitlane` depends on an exact version of every package it re-exports. It is released by hand when enough package changes have accumulated, so a package's newest release can be ahead of the version the umbrella pins. Bare `pitlane` has no exports; import a subpath.

List `pitlane` in `dependencies` when the app imports a runtime subpath such as `pitlane/assets`, `pitlane/theme`, or `pitlane/content`. It installs every package, `@pitlane/vite-plugin-remix` and its Vite peer included, so a production install that omits dev dependencies still installs the build toolchain. An app that needs a lean production install can depend on the individual `@pitlane/*` packages instead: `@pitlane/vite-plugin-remix` as a dev dependency, the runtime packages as dependencies.

Use the [starter templates](https://github.com/pitlane-tools/templates) to create a Remix application.

## Documentation

The package carries the documentation for the version it installs, in plain Markdown, so an editor or a coding agent can read it offline from `node_modules/pitlane`:

- `INDEX.md` lists every guide with its description, and every `pitlane/*` subpath beside the README that documents it.
- `guides/` holds every guide on [pitlane.tools](https://pitlane.tools), deployment guides under `guides/deploy/`.
- `dist/<package>/README.md` is the README of each `@pitlane/*` package, beside that package's compiled subpaths: `dist/vite-plugin-remix/README.md` documents `pitlane/vite-plugin-remix` and its subpaths.

Links between these files lead to the installed copies. Links to the generated API reference lead to pitlane.tools. For exact signatures and TSDoc, follow a subpath's type declarations to its installed `@pitlane/*` package.

- [Installing Pitlane](https://pitlane.tools/guides/umbrella): subpaths, versions, and migrating from the `@pitlane/*` packages
- [Pitlane documentation](https://pitlane.tools)

## License

[MIT](https://github.com/pitlane-tools/pitlane/blob/main/LICENSE)

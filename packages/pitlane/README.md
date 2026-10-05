# pitlane

A meta-framework for [Remix](https://remix.run): every Pitlane package in one install.

```sh
npm install pitlane
```

`remix@^3.0.0` and `vite@>=8` are peer dependencies. `satteri@^0.10.5` is an optional one, needed only for Markdown and MDX content.

Each `@pitlane/*` package is available under a `pitlane/*` subpath, with the same exports:

| Import | Re-exports |
| --- | --- |
| `pitlane/dev`, `pitlane/dev/runtime`, `pitlane/dev/assets` | [`@pitlane/dev`](https://pitlane.tools/package/dev/): the Vite plugin for Remix |
| `pitlane/theme`, `pitlane/theme/schema`, `pitlane/theme/default`, `pitlane/theme/dtcg` | [`@pitlane/theme`](https://pitlane.tools/package/theme/): design tokens and type-safe styling |
| `pitlane/content`, `pitlane/content/loaders`, `pitlane/content/vite`, `pitlane/content/hot`, `pitlane/content/satteri` | [`@pitlane/content`](https://pitlane.tools/package/content/): schema-validated content collections |
| `pitlane/crawler` | [`@pitlane/crawler`](https://pitlane.tools/package/crawler/): in-memory route crawling and static path discovery |
| `pitlane/data-table-d1`, `pitlane/data-table-d1/migrations` | [`@pitlane/data-table-d1`](https://pitlane.tools/package/data-table-d1/): the Cloudflare D1 driver for Remix's data-table |

```ts
import { remix } from "pitlane/dev";
import { createTheme } from "pitlane/theme";
```

`pitlane` depends on an exact version of every package it re-exports. It is released by hand when enough package changes have accumulated, so a package's newest release can be ahead of the version the umbrella pins. Bare `pitlane` has no exports; import a subpath. To type `?assets=` imports, list `pitlane/dev/assets` in `tsconfig.json`'s `compilerOptions.types`.

List `pitlane` in `dependencies` when the app imports a runtime subpath such as `pitlane/theme` or `pitlane/content`. It installs every package, `@pitlane/dev` and its Vite peer included, so a production install that omits dev dependencies still installs the build toolchain. An app that needs a lean production install can depend on the individual `@pitlane/*` packages instead: `@pitlane/dev` as a dev dependency, the runtime packages as dependencies.

Use the [starter templates](https://github.com/pitlane-tools/templates) to create a Remix application.

## Documentation

The package carries the documentation for the version it installs, in plain Markdown, so an editor or a coding agent can read it offline from `node_modules/pitlane`:

- `INDEX.md` lists every guide with its description, and every `pitlane/*` subpath beside the README that documents it.
- `guides/` holds every guide on [pitlane.tools](https://pitlane.tools), deployment guides under `guides/deploy/`.
- `dist/<package>/README.md` is the README of each `@pitlane/*` package, beside that package's compiled subpaths: `dist/dev/README.md` documents `pitlane/dev` and its subpaths.

Links between these files lead to the installed copies. Links to the generated API reference lead to pitlane.tools. For exact signatures and TSDoc, follow a subpath's type declarations to its installed `@pitlane/*` package.

- [Installing Pitlane](https://pitlane.tools/guides/umbrella): subpaths, versions, and migrating from the `@pitlane/*` packages
- [Pitlane documentation](https://pitlane.tools)

## License

[MIT](https://github.com/pitlane-tools/pitlane/blob/main/LICENSE)

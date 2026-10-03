# pitlane

A meta-framework for [Remix](https://remix.run): every Pitlane package in one install.

```sh
npm install pitlane
```

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

`pitlane` depends on every package it re-exports, and a new release of any of them is followed by a release of `pitlane`. Installing an individual `@pitlane/*` package still works, and is the smaller install when an app needs only one.

Use the [starter templates](https://github.com/pitlane-tools/templates) to create a Remix application.

## Documentation

- [Pitlane documentation](https://pitlane.tools)

## License

[MIT](https://github.com/pitlane-tools/pitlane/blob/main/LICENSE)

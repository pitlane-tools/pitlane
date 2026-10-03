---
"pitlane": major
---

`pitlane` is now the umbrella package: one install that re-exports every `@pitlane/*` package under a `pitlane/*` subpath, with the same exports.

```ts
import { remix } from "pitlane/dev";
import { createTheme } from "pitlane/theme";
import { createContent } from "pitlane/content";
```

The subpaths are `pitlane/dev`, `pitlane/dev/runtime`, `pitlane/dev/assets`, `pitlane/theme`, `pitlane/theme/schema`, `pitlane/theme/default`, `pitlane/theme/dtcg`, `pitlane/content`, `pitlane/content/loaders`, `pitlane/content/vite`, `pitlane/content/hot`, `pitlane/content/satteri`, `pitlane/crawler`, `pitlane/data-table-d1`, and `pitlane/data-table-d1/migrations`. List `pitlane/dev/assets` in `tsconfig.json`'s `types` in place of `@pitlane/dev/assets`.

Each `pitlane` release pins an exact version of every package, and a release of any of them is followed by a release of `pitlane`. As with `remix`, there is nothing to import from bare `pitlane`; the 0.0.x entry point that threw an error pointing at `@pitlane/dev` is gone.

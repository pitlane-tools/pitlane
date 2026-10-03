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

Each `pitlane` release pins an exact version of every package, and a release of any of them is followed by a release of `pitlane`. Bare `pitlane` is no longer importable; import a subpath instead. The 0.0.x entry point, which threw an error pointing at `@pitlane/dev`, is gone.

Install `pitlane` as a dependency rather than a dev dependency when the app imports a runtime subpath such as `pitlane/theme` or `pitlane/content`. It installs every package, `@pitlane/dev` and its Vite peer included, so a production install that omits dev dependencies still installs the build toolchain; an app that needs a lean production install can depend on the scoped packages instead.

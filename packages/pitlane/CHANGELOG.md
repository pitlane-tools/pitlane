# pitlane

## 1.0.0-alpha.1

### Major Changes

- f88326c: `pitlane` is now the umbrella package: one install that re-exports every `@pitlane/*` package under a `pitlane/*` subpath, with the same exports.

    ```ts
    import { remix } from "pitlane/dev";
    import { createTheme } from "pitlane/theme";
    import { createContent } from "pitlane/content";
    ```

    The subpaths are `pitlane/dev`, `pitlane/dev/runtime`, `pitlane/dev/assets`, `pitlane/theme`, `pitlane/theme/schema`, `pitlane/theme/default`, `pitlane/theme/dtcg`, `pitlane/content`, `pitlane/content/loaders`, `pitlane/content/vite`, `pitlane/content/hot`, `pitlane/content/satteri`, `pitlane/crawler`, `pitlane/data-table-d1`, and `pitlane/data-table-d1/migrations`. List `pitlane/dev/assets` in `tsconfig.json`'s `types` in place of `@pitlane/dev/assets`.

    Each `pitlane` release pins an exact version of every package and lists them in its changelog. The umbrella is released when enough package changes have accumulated rather than after every package release, so the newest `@pitlane/*` release can be ahead of what `pitlane` pins. Bare `pitlane` is no longer importable; import a subpath instead. The 0.0.x entry point, which threw an error pointing at `@pitlane/dev`, is gone.

    Install `pitlane` as a dependency rather than a dev dependency when the app imports a runtime subpath such as `pitlane/theme` or `pitlane/content`. It installs every package, `@pitlane/dev` and its Vite peer included, so a production install that omits dev dependencies still installs the build toolchain; an app that needs a lean production install can depend on the scoped packages instead.

    App-facing guides now use the umbrella imports. The [umbrella guide](https://pitlane.tools/guides/umbrella) covers installation, migrating scoped imports, version pins, and choosing standalone packages. Installed guides and an agent documentation index are not included in this release.

### Patch Changes

- Updated dependencies [67d73ad]
- Updated dependencies [8d96c52]
- Updated dependencies [eec2d66]
- Updated dependencies [387d556]
    - @pitlane/content@0.3.1
    - @pitlane/dev@0.7.1

### Pinned packages

- `@pitlane/content@0.3.1`
- `@pitlane/crawler@0.3.0`
- `@pitlane/data-table-d1@0.3.0`
- `@pitlane/dev@0.7.1`
- `@pitlane/theme@0.5.0`

## 0.0.1

Published 2026-09-21. [npm](https://www.npmjs.com/package/pitlane/v/0.0.1) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/pitlane%400.0.1) · [Source](https://github.com/pitlane-tools/pitlane/commit/f18bf6633e09ef3475c654f018554fb8feee85b3).

Documentation and npm metadata update. The entry point is byte-identical to 0.0.0: importing `pitlane` still throws an error directing readers to `@pitlane/dev`, and the package has no umbrella subpath exports.

- Revise the planned package's positioning for Remix and state that the umbrella implementation is still coming soon.
- Replace the initial single-package README with links to the five available scoped packages, the starter templates, and the documentation.
- The final README and description come from [PR #24](https://github.com/pitlane-tools/pitlane/pull/24). The intermediate [four-package README list](https://github.com/pitlane-tools/pitlane/commit/1815d648984201020f889218ec4d98c057a407b8) was replaced before this publication and never appeared in an npm tarball.

## 0.0.0

Published 2026-07-24. [npm](https://www.npmjs.com/package/pitlane/v/0.0.0) · [Matching committed source](https://github.com/pitlane-tools/pitlane/commit/eae297fdec5245eebaf0a6b6102779631d98673a).

Initial name-reservation package. The only export throws an error directing readers to `@pitlane/dev` and the Pitlane documentation. The README points to the working Vite plugin and starter templates; no umbrella implementation was included. npm now marks this version deprecated with the reservation notice.

This publication has no recorded Git tag or GitHub release. npm records `7d8d15e` as its `gitHead`, before the reservation files were committed. The published entry point, README, and license match the files added in `eae297f`; that later commit is linked as matching source rather than as a release tag.

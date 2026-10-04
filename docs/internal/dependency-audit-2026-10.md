# Third-party dependency audit — October 2026

An audit of Pitlane's third-party dependencies, excluding `remix`, against `VISION.md` development principle #4 (**Avoid Dependencies**): choose dependencies wisely, wrap them completely behind Pitlane-owned APIs, expect to replace most of them with Pitlane packages over time, and accept necessary provider, runtime, and tooling dependencies along the way.

The principle bites hardest on dependencies that ship in published packages, so those get the detailed treatment.

## Summary

Build our own Vite integration for `@hiogawa/vite-plugin-fullstack` and `vite-plugin-satteri`. Replace `oxc-parser` with the parser Vite already ships. Keep `satteri` and `yaml`, but wrap them more tightly behind Pitlane-owned APIs. Keep `magic-string`, `es-module-lexer`, and `csstype` as they are.

## Published packages

| Dependency | Package | Recommendation |
| --- | --- | --- |
| `@hiogawa/vite-plugin-fullstack` 0.0.11 | `@pitlane/dev` | **Build our own** (move its code into `@pitlane/dev`) |
| `vite-plugin-satteri` 0.3.5 (users install it themselves) | `@pitlane/content` | **Build our own** (fold it into `contentLayer()`) |
| `oxc-parser` ^0.141 | `@pitlane/dev` | **Use Vite's `parseSync`**, if Vite 7 support is dropped |
| `satteri` ^0.10.5 (optional peer) | `@pitlane/content` | **Keep, but stop exposing its types** |
| `yaml` ^2.8.1 | `@pitlane/content` | **Keep; Pitlane should define what frontmatter parsing returns** |
| `magic-string` ^0.30.21 | `@pitlane/dev` | Keep |
| `es-module-lexer` ^2.3.1 | `@pitlane/content` | Keep |
| `csstype` ^3.2.3 | `@pitlane/theme` | Keep; fix the VISION wording |

### 1. `@hiogawa/vite-plugin-fullstack`: build our own

This is the strongest case. It is the dependency `@pitlane/dev`'s asset handling and build wiring rest on.

- **Upstream has stalled.** It is at version 0.0.11 with one maintainer. The last release was 2025-12-22, and the last commit on the standalone repository's main branch was 2026-01-08.
- **It does not support the Vite we test on.** Its peer range is `vite ^7.0.0`, but Pitlane tests on Vite 8 and `@pitlane/content` requires `>=8`. Open issue #52 shows the result: installing `@pitlane/dev` with Vite 8 produces an invalid peer warning, and strict installers would fail.
- **The conditions set for replacing it have arguably been met.** `docs/superpowers/specs/2026-07-23-pitlane-dev-design.md` (§Dependency policy) says to move its code in-house on upstream abandonment or if it blocks a Vite release we need. Both are close to true.
- **Users would not notice.** The `?assets=` convention, `@pitlane/dev/runtime`, and `@pitlane/dev/assets` are already Pitlane's own contract, and no doc names fullstack. `packages/dev/src/build.ts:112-241` already copies its private manifest format as a fallback.
- **Our own demos bypass `@pitlane/dev`.** `demos/content-vite/app/Document.tsx:1` imports `@hiogawa/vite-plugin-fullstack/runtime` directly. `demos/theme/remix.plugin.ts` hand-writes its own plugin using fullstack, `oxc-parser` 0.121, and `magic-string`.
- **Cost:** about 600 lines of its built code, roughly half of which Pitlane uses. The Vue- and RSC-specific parts can be dropped, and its dev request handler can be replaced by `remix/node-fetch-server`.
- **Risk:** the hard part is code copied from Vite internals, such as dev-server URL normalization and a stylesheet hot-reload patch. Supporting only Vite 8 means tracking one Vite line instead of two.

### 2. `vite-plugin-satteri`: build our own

- It is a 78-line wrapper around `markdownToHtml` and `mdxToJs`, also pre-1.0, and pulls in `smol-toml` and a second `yaml`.
- It is not wrapped at all. The README and `docs/app/content/_partials/content.mdx` tell users to install it themselves and register it before `remix()`.
- `@pitlane/content` already calls satteri itself in `src/render.ts`. `src/vite.ts:245` runs `markdownToHtml` a second time just to recover heading lists, because the plugin offers no way to pass them along.
- Folding it into `contentLayer()` removes a user-installed dependency, the plugin-ordering rule, and the duplicate compile.
- **This changes the documented setup**, so it needs a human decision and possibly a proposal.

### 3. `oxc-parser`: use Vite's own parser

- Today it adds a second native parser binary to every install: `remix` pulls in `oxc-parser ^0.121` and `@pitlane/dev` pulls in `^0.141`. Under 0.x caret rules those do not dedupe; both are present in `node_modules/.pnpm`.
- Pitlane uses one function, `parseSync(id, code).program`, in `src/transform.ts`, `src/hmr.ts`, and `src/route-map.ts`.
- Vite 8 / Vite+ core exports `parseSync` from `vite`. Run on TypeScript with JSX, it returned 0 errors and the same ESTree shape.
- **The blocker is the `vite >=7` peer range.** On plain Vite 7 that export is backed by Rollup's parser, which cannot handle TypeScript. `src/route-map.ts:47` parses the raw `.ts` server entry from disk, so it would break there.
- Vite 7 is declared but untested; the README and the vite-plugin guide list Vite 8 as the tested version.

### 4. `satteri`: keep, but stop exposing its types

- Replacing it means writing a Markdown and MDX compiler, which falls under the tooling exception. Astro uses it too.
- Its types still reach users: `glob()` accepts `satteri?: CompileOptions` (`src/loaders/glob.ts:55`, visible in the built `loaders.d.mts`), and `headings()` and `rawStyles()` return satteri's plugin types.
- `src/render.ts:345` already shows the better pattern: a small Pitlane-owned interface describing only what is called. Replace `CompileOptions` with a Pitlane-owned type.

### 5. `yaml`: keep, but Pitlane should own the contract

- YAML is hard to parse correctly, nothing native replaces it, and its types do not leak.
- **There is a defect.** `docs/app/content/_partials/content.mdx:233` says `pubDate: 2026-01-02` "is already a `Date`". `splitFrontmatter` returns the string `"2026-01-02"`, because the YAML 1.2 core schema `yaml` uses by default does not resolve timestamps.
- The guide describes a different library's behavior, which is what happens when a dependency's defaults define the contract instead of Pitlane. Either convert dates explicitly in the loader or correct the guide.

### 6. Keep as-is

- **`magic-string`:** adds nothing to installs, because `@remix-run/component-hmr` and fullstack already depend on `^0.30.21`. Pitlane uses only `overwrite`, `prepend`, and `generateMap`. Vite bundles its own copy but does not export it.
- **`es-module-lexer`:** no dependencies of its own, lazily loaded, fully wrapped in Pitlane-owned types, and already a dependency of `remix/assets`. Vite's parser cannot replace it because content's runtime path has no Vite.
- **`csstype`:** types only, no runtime JavaScript, and it supplies precise value types for about 300 CSS properties that Remix does not. It sits in `dependencies` and appears in `@pitlane/theme`'s public `.d.mts` (`dist/index.d.mts:4,137`), so `VISION.md`'s claim that theme has "no runtime dependencies beyond its Remix peer" is true only in the no-executable-code sense and should be reworded. Owning it later would mean generating the types from W3C CSS data; low priority.

## Test, docs, and repository tooling

All of these fall under the tooling exception, and none ships in a published package:

- **Tests:** `miniflare`, `playwright`, `@cloudflare/vite-plugin`, `fast-check`.
- **Docs site:** `expressive-code`, `shiki`, `pagefind`, `sirv`, `satteri`, `vite-plugin-satteri`, `@fontsource-variable/*`.
- **Repository tooling:** `typedoc`, `typedoc-plugin-markdown`, `markdown-it`, the MDX checker's language server and TypeScript 6, `@changesets/cli`, Vale, the two ESLint plugins, `oxc-parser` for `.omp`, `wrangler`.

Notes:

- `VISION.md` already plans `@pitlane/search` over Pagefind and an Expressive Code subpath of `@pitlane/content`. When they ship, those become published-package dependencies and need wrapping from the start.
- `wrangler` in `packages/dev` is not imported anywhere; it satisfies `@cloudflare/vite-plugin`'s peer requirement.

## Open decisions

1. **Drop Vite 7 support** (`vite >=7` to `>=8` in `@pitlane/dev`)? It is untested, fullstack supports only 7, and content already requires 8. Dropping it unblocks the `oxc-parser` change and simplifies moving fullstack in-house.
2. **Move fullstack's code into `@pitlane/dev` now?** That closes #52. The public API is unchanged.
3. **Fold `vite-plugin-satteri` into `contentLayer()`?** This changes the documented setup.
4. **File an issue for the frontmatter date defect.**

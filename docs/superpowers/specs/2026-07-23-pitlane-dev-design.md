# @pitlane/dev — Design

**Date:** 2026-07-23
**Status:** Approved
**Package:** `@pitlane/dev` v0.1.0 — the first published Pitlane package

## Overview

`@pitlane/dev` ships one export: the `remix()` Vite plugin. It wires Remix 3 into any Vite or
Vite+ project — build orchestration for the `client`/`ssr` environment pair, the
`clientEntry(import.meta.url, …)` transform, a fetch-handler dev/preview story, and a few
rough-edge fixes — while staying completely ignorant of deploy platforms.

The plugin defaults to a plain fetch-handler contract: the app's server entry default-exports an
object with `.fetch(Request): Response | Promise<Response>`. That is the entire composition seam.
Platform plugins (`@cloudflare/vite-plugin`, `@netlify/vite-plugin`, `nitro/vite`) and plain
fetch runtimes (Node via `remix/node-fetch-server`, Bun, Deno) all consume that same shape.

**The goal is composable hosting, not a universal hosting engine.**

Prior art synthesized here:

- **Vendored `remix.plugin.ts`** — six template copies (`~/Developer/Templates/remix/*`) plus the
  `remix-3-contacts` playground. Newest generation (minimal/default/bun/service-worker) is
  byte-identical and canonical; the cloudflare/playground copies differ only by a missing
  `builder: {}` stanza.
- **`.agents/docs/vite-plugin-remix.md`** — a rebuild-grade spec of the vendored plugin. One
  caveat: its Rolldown-native transform path (`meta.ast`/`meta.magicString`) is aspirational —
  it was tried in practice and reverted (unfinished types, paths never exercised), so the
  vendored `oxc-parser` + `magic-string` implementation is the proven one this design adopts.
- **TanStack Start ≥ 1.132** — the strongest external validation. TanStack shipped in-plugin
  deploy targets (`tanstackStart({ target: "netlify" })`, v1.121–1.131) and **abandoned them**
  for pure composition: the framework plugin builds a conventional `client`+`ssr` environment
  pair and guarantees a fetch-shaped server entry; platform plugins key off the `ssr` environment
  name and own dev emulation, packaging, and prod runtime. `@pitlane/dev` adopts that exact
  ownership split on day one.
- **`@hiogawa/vite-plugin-fullstack` 0.0.11** — supplies the `?assets=` import protocol, the
  asset manifest, dynamic client-entry emission, and the dev server handler. Wrapped, pinned, and
  fully hidden behind Pitlane-owned API (see §Dependency policy).

## Goals

- One provider-agnostic `remix()` plugin; sensible defaults so most `vite.config.ts` files need
  zero options.
- Generic **Vite and Vite+ both work** — dev, build, preview — with the tested range explicit.
- Fetch-handler default everywhere: the same built `dist/ssr/index.js` runs under Node, Bun,
  Deno, workerd, or any platform plugin without changes.
- Zero dependency leakage: app code imports only `@pitlane/dev/*` and documented conventions;
  no `@hiogawa/*` import ever appears in userland.
- Every release requirement in §Verification matrix is covered by an automated check or a
  documented manual gate before v0.1.0 ships.

## Non-goals (v1)

- **No deploy targets inside the plugin.** No `target:` option, no generated `wrangler.jsonc` /
  `netlify.toml`, no provisioning. TanStack tried it and walked it back; we skip the detour.
  Platform config generation is a separate future package and out of scope here.
- **No dev-server replacement.** Vite owns dev. The plugin adds middleware and transforms only.
- **No prerendering, RSC, or `serverEnvironments` beyond `ssr` semantics** — the option exists
  and is honored by the transform, but multi-server-environment orchestration (e.g. an `rsc`
  environment) is untested and undocumented in v1.
- **No umbrella `pitlane` package.** All docs and templates import `@pitlane/dev` directly.
- **No service-worker deployment guide** in v1 docs (the prior-art variant keeps working — it is
  just `serverEntry` + `serverHandler: false` — but templates and guides cover the six named
  targets first).

## Public API

### `remix(options?)` — the plugin

```ts
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite"; // or "vite-plus"

export default defineConfig({
    plugins: [remix()],
});
```

```ts
interface RemixPluginOptions {
    /** Client entry module. `false` disables the client environment (server-rendered only). */
    clientEntry?: string | false; // default "app/entry.browser"
    /** SSR entry module; built as `dist/ssr/index.js`. */
    serverEntry?: string; // default "app/entry.server"
    /** Environment names the transform treats as "server". */
    serverEnvironments?: string[]; // default ["ssr"]
    /** Serve requests through the SSR entry in dev. Set `false` when a platform
     *  plugin (Cloudflare, Netlify, Nitro) owns dev-time request handling. */
    serverHandler?: boolean; // default true
}
```

`remix()` returns a `PluginOption` array. Types import from `vite` (the peer), never `vite-plus`
— Vite+ aliases `vite` to its core, so one import path serves both toolchains.

Option semantics are unchanged from the vendored plugin so existing users migrate by replacing
`./remix.plugin.ts` with `@pitlane/dev` — nothing else. (The vision doc's
`serverHandler: false // true if not using pitlane/dev` comment was wrong; the real rule is
"false when another plugin serves dev requests" and the docs will say so.)

### `@pitlane/dev/runtime` — server/client-safe helpers

```ts
import { mergeAssets } from "@pitlane/dev/runtime";
```

Re-exports (currently delegating to `@hiogawa/vite-plugin-fullstack/runtime`) so app code never
names the dependency. `mergeAssets(...results)` dedupes `js`/`css` by href across
`?assets=` results and returns the same shape.

### `?assets=` imports — a documented Pitlane convention

```ts
import clientAssets from "#/entry.browser.ts?assets=client";
import serverAssets from "#/entry.server.tsx?assets=ssr";
// { entry?: string, js: Array<{href}>, css: Array<{href}>, merge(...) }
```

The query protocol is **Pitlane public API**; which engine implements it is an implementation
detail. Ambient module declarations ship as `@pitlane/dev/assets`:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@pitlane/dev/assets"] } }
```

This mirrors the familiar `vite/client` convention and keeps the declarations explicit instead of
leaking globals from the plugin import.

### The server entry contract

```tsx
// app/entry.server.tsx
let router = createRouter();
router.map(routes.home, home);
export default router; // anything with .fetch(Request) => Response | Promise<Response>
```

- **Dev** (`serverHandler: true`): the dev middleware imports the entry through Vite's module
  runner and calls `default.fetch`.
- **Preview**: the preview middleware imports `dist/ssr/index.js` and calls `default.fetch`.
- **Production**: the runtime consumes the same shape — `export default { fetch: router.fetch,
  queue, scheduled }` for workerd, `Deno.serve`/`deno serve` for Deno, `Bun.serve({ fetch })`,
  `createRequestListener` for Node.

The vendored preview fallback `mod.default ?? mod.router` is **dropped**: a named `router` export
never worked in dev (the fullstack handler requires `default.fetch`), so the tolerance was dead.
One contract, stated once: *the server entry default-exports a fetch handler.*

## Architecture

`remix()` returns six plugins, in order:

| # | Plugin | Concern |
| - | ------ | ------- |
| 1 | `fullstack(...)` | `?assets=` protocol, asset manifest, dynamic client-entry emission, dev server handler |
| 2 | `remix-build:compat` | coexistence guards for other build orchestrators (`order: "pre"`) |
| 3 | `remix-build` | environment defaults + SSR-then-client build sequencing |
| 4 | `remix-preview-server` | `vite preview` serves the built fetch handler |
| 5 | `remix-suppress-abort-errors` | client-disconnect noise never hits the error overlay |
| 6 | `remix-client-entry-transform` | the `clientEntry(import.meta.url, …)` rewrite |

### 3. `remix-build`

`config()` returns:

```ts
{
    builder: {},                         // vite build == multi-environment app build
    build: { assetsInlineLimit: 0 },     // every asset gets a hashed URL ?assets= can resolve
    environments: {
        ...(hasClientEntry && {
            client: { build: { outDir: "dist/client", rollupOptions: { input: clientEntry } } },
        }),
        ssr: { build: { outDir: "dist/ssr", rollupOptions: { input: { index: serverEntry } } } },
    },
}
```

`buildApp(builder)` builds `ssr` first, then `client` — the client build resolves `?assets=ssr`
against the SSR manifest, so the order is load-bearing. `builder: {}` ships unconditionally (the
one-line drift in the older cloudflare copies is resolved in favor of one canonical code path;
platform plugins that configure the builder themselves merge harmlessly).

The `ssr` name is the conventional Vite environment name platform plugins target
(`cloudflare({ viteEnvironment: { name: "ssr" } })`, Nitro's `environments.ssr`). We keep it and
never invent a proprietary name.

### 2. `remix-build:compat`

Generic multi-orchestrator coexistence; **no platform imports, all feature-detected**:

- Wraps `builder.build` to no-op on environments where `environment.isBuilt` is already true
  (native Vite `BuildEnvironment` API), so two `buildApp` orchestrators don't double-build.
- Wraps `builder.writeAssetsManifest` (fullstack's declaration-merged builder method, feature-
  detected with `in` + `typeof`) to swallow `ENOENT` only — some orchestrators relocate SSR
  assets into the client outDir before the manifest copy runs.

Empirically motivated by `@cloudflare/vite-plugin`, but written against builder semantics, not
Cloudflare. Because it registers at `order: "pre"`, plugin-array order does not matter for
correctness; docs still recommend `remix()` first for predictability.

### 4. `remix-preview-server`

`configurePreviewServer` dynamically imports `<ssr outDir>/index.js`; on success registers
`createRequestListener(request => mod.default.fetch(request))` from `remix/node-fetch-server` as
preview middleware. On import failure it returns silently — an SSR bundle targeting a non-Node
runtime (workerd) is previewed by its platform plugin instead. That failure→skip contract is
documented behavior, not an accident.

### 5. `remix-suppress-abort-errors`

Connect error middleware: `err.message === "aborted"` is swallowed, everything else propagates.
Narrow by design — the message match covers client disconnects (search-as-you-type, mid-fetch
navigation) without masking real failures.

### 6. `remix-client-entry-transform`

Rewrites `export const Name = clientEntry(import.meta.url, …)`:

- **Server environments** (name ∈ `serverEnvironments`): prepend
  `import ___clientEntryAssets from "<id>?assets=client"` once per file; each call's
  `import.meta.url` becomes `___clientEntryAssets.entry + "#Name"`.
- **Client environment**: no prepend; `import.meta.url` becomes `import.meta.url + "#Name"`.

Implementation is the **proven vendored path** — `oxc-parser` + npm `magic-string` in every
mode (dev and build, Vite and Vite+):

- Declarative `transform.filter` (`code.include: /\bclientEntry\b/`) for native-level skipping.
- `parseSync` from `oxc-parser` produces the AST; `MagicString` performs the prepend/overwrites
  and generates the sourcemap (`hires: "boundary"`).
- Matched pattern is strict: top-level `export const Name = clientEntry(import.meta.url, …)`
  with ≥ 2 arguments. Default exports, aliases, and non-exported calls are intentionally ignored
  — the `#Name` fragment requires a named export. Documented as authoring rules.

One code path everywhere means the plugin is **not** Rolldown-dependent: generic Vite
(esbuild/Rollup) and Vite+ (Rolldown) run the identical transform. This is what "generic Vite
works" means mechanically.

**Deferred optimization — Rolldown-native `meta.ast`/`meta.magicString`.** A previous attempt
to adopt the Rolldown-provided AST and native MagicString was reverted: the types were
unfinished and the paths never appeared to be exercised. We do want this once it is real —
it would drop a parse and hand sourcemaps to a background thread — but adoption is gated on
fresh research demonstrating the feature is implemented, typed, and performing in a released
rolldown-vite/Vite+ version. Until then it stays out of the shipped code entirely (not even as
a feature-detected branch), so there is exactly one transform path to test.

## Dependency policy

Per the vision: dependencies are strategic liabilities — wrap completely, expect to replace.

| Dependency | Version policy | Exposure |
| ---------- | -------------- | -------- |
| `@hiogawa/vite-plugin-fullstack` | exact-pinned (`0.0.11`) | none — re-exported via `/runtime`, `/assets` types, documented `?assets=` convention |
| `oxc-parser` | caret | none — internal to the transform |
| `magic-string` | caret | none — internal to the transform (already transitive via fullstack, so zero added install weight) |
| `vite` | peer | types only (`PluginOption`) |
| `remix` | peer (`^3.0.0-beta.5`) | dynamic import of `remix/node-fetch-server` in preview only |

**Wrap fullstack, don't inline — for now.** Findings from the source audit (0.0.11):

- ~45–50% of its ~1,240 LOC is load-bearing for our use: the `?assets=` query resolution, dev
  entry-URL computation, build-time manifest deferral + bundle-graph walk, dynamic client-entry
  `emitFile`, the dev handler, and the CSS-HMR client patch.
- The hard 20% is copied Vite internals (import-analysis URL normalization: `/@id/`, `/@fs/`,
  optimized-deps, HMR timestamps) and Vite-specific chunk metadata (`viteMetadata.importedCss`)
  — exactly the code that breaks across Vite releases. Upstream tracks those internals
  release-to-release; inlining transfers that liability to us with zero user-visible gain.
- Risk profile is real (0.0.x, single maintainer, stale README in tarball, dead RSC/Vue code) but
  contained: exact pin + our own e2e matrix means upstream churn cannot reach users unnoticed.

**Inline triggers** (any one): upstream abandonment or a breaking rewrite; Remix or Vite ships a
first-class asset-manifest/multi-environment primitive; or the pinned version blocks a Vite
release we need. The public surface (`remix()`, `/runtime`, `/assets`, `?assets=`) is designed so
inlining later is invisible to users. `srvx` (fullstack's Node bridge) is upstream's concern; if
we inline, the dev handler switches to `remix/node-fetch-server`, which we already use.

## Compatibility

- **Peer range:** `vite >= 7` (Environment API, module runner, `buildApp`, `isBuilt`). Exact
  upper bound set from the CI matrix at release time and stated in the README.
- **Tested matrix (CI, per release):** latest stable Vite × latest Vite+ (`vite` aliased to
  `@voidzero-dev/vite-plus-core`), Node LTS. The README carries a table: *tested against Vite X.Y,
  Vite+ A.B, Remix 3.0.0-betaN* — the explicit range the release checklist requires.
- **Remix:** peer `^3.0.0-beta.5`. The transform contract (`clientEntry`, `#Export` fragments,
  `run()`/`loadModule`) is beta API; each `@pitlane/dev` release names the Remix beta it tested.
- **Not required:** Rolldown (Vite+ optimization territory only), Vite+ (works on generic
  Vite), any platform SDK.
- **Single vite identity (verified empirically).** `@hiogawa/vite-plugin-fullstack` runtime-
  checks dev environments with its own vite copy (`isRunnableDevEnvironment` asserts instance
  identity). A project that resolves two vite packages — e.g. Vite+ running the server while
  fullstack's peer resolves to a plain `vite` install — fails `vite dev` with
  `AssertionError: isRunnableDevEnvironment(environment)`. Vite+ projects therefore MUST alias
  `vite` to `@voidzero-dev/vite-plus-core` via overrides (the convention every template ships);
  generic-Vite projects have one vite by construction. Documented in the README's
  troubleshooting section under that exact assertion message.

## Package layout & publishing

```
packages/dev/
├── src/
│   ├── index.ts          # remix() plugin array
│   ├── build.ts          # remix-build + compat
│   ├── preview.ts        # preview server
│   ├── transform.ts      # clientEntry transform + AST walk
│   ├── runtime.ts        # mergeAssets re-export
│   └── assets.d.ts       # ?assets= ambient declarations
├── tests/                # unit + fixture e2e (see §Verification)
├── package.json
├── tsconfig.json
└── vite.config.ts        # vp pack config (entries: index, runtime; dts via tsgo)
```

- Monorepo: add `pnpm-workspace.yaml` (`packages/*`, `demos/*`) to main — same layout the theme
  branch already uses, so the branches converge instead of colliding.
- Build: `vp pack`, ESM-only, `dist/` + `d.mts`, matching the theme package conventions.
- Manifest: `name @pitlane/dev`, `version 0.1.0`, MIT, `exports`: `.`, `./runtime`, `./assets`
  (types-only entry), `files: ["dist"]`, `repository.directory packages/dev`, homepage
  `https://docs.pitlane.tools/package/dev`.
- Publish: extend `.github/workflows/publish.yml` (theme branch) with a `publish-dev` job gated
  on release tag `@pitlane/dev@<version>`, tag/version guard, `vp install --frozen-lockfile`,
  `vp test`, `vp run build`, `npm publish --provenance --access public`.

## Verification matrix

Every release requirement maps to an automated check (A) or a documented manual gate (M):

| Requirement | How verified |
| ----------- | ------------ |
| Generic Vite dev works | A: harness child process boots the fixture dev server on plain `vite`, asserts SSR HTML, hydration data, dev module transform (dev servers run out-of-process: in-runner dev servers deadlock nondeterministically under the worker pool's native-addon threads) |
| Vite+ dev works | A: `vp build` + `vp preview` legs in-repo; `vp dev` leg lives in template CI — the single-vite-identity alias convention (see §Compatibility) only exists in standalone projects, not in this dual-vite workspace |
| Generic production build | A: programmatic `build`; assert `dist/ssr/index.js` + `dist/client/*` + manifest; run built entry, assert response |
| Preview serves built fetch handler | A: programmatic `preview`, request `/`, assert 200 + asset URLs resolve |
| Cloudflare dev in workerd | A: fixture with `@cloudflare/vite-plugin`; dev server request exercises workerd |
| Cloudflare build + preview | A: `vite build` then `vite preview` on the Cloudflare fixture; assert single build per environment (no double-build) and 200 |
| `clientEntry()` transform, both environments | A: unit tests on the transform (server + client environment outputs, multi-entry files, non-matching patterns); e2e asserts `#Export` fragment in served HTML and hydrated behavior via built output |
| CSS + JS asset references in production | A: e2e asserts `<link rel="stylesheet">`/`modulepreload` hrefs exist in `dist/client` and return 200 under preview |
| Aborted requests don't overlay | A: dev-server test fires + aborts a request, asserts no error overlay websocket payload / unhandled error |
| No dependency API leak | A: lint/grep gate in CI — templates and docs must not contain `@hiogawa`; package exports audited |
| Explicit tested compat range | A: CI matrix output is the README table; release blocked if matrix and README disagree |
| Six templates published | M: repos in `pitlane-tools` org (see §Templates), each smoke-tested by template CI (`vp build` or `vite build` green) |
| Cloudflare template deployed persistently | M: one-time `wrangler deploy` of the template app; URL recorded in template README and docs |

Test runner: `vp test` (Vitest) inside `packages/dev`; fixtures live under `tests/fixtures/*` as
minimal apps (node, cloudflare) with their own lockfile-free `package.json` linked to the
workspace. The Vite-vs-Vite+ axis is a CI matrix variable, not duplicated fixtures.

## Templates (pitlane-tools org)

Six repos, all derived from `~/Developer/Templates/remix` with the vendored plugin replaced by
`@pitlane/dev`, `vite.config` minimized, and per-target README deploy walkthroughs:

| Template | Config | Production runtime |
| -------- | ------ | ------------------ |
| `remix-node` | `remix()` | `server.ts`: `node:http` + `createRequestListener` from `remix/node-fetch-server` |
| `remix-bun` | `remix()` | `Bun.serve({ fetch: router.fetch })` |
| `remix-deno` | `remix()` | `deno serve dist/ssr/index.js` (built entry is already `{ fetch }`-shaped) |
| `remix-cloudflare` | `remix({ serverHandler: false })` + `cloudflare({ viteEnvironment: { name: "ssr" } })` | workerd; `wrangler.jsonc` `main` = server entry, `assets.directory` = `dist/client`; deployed persistent example |
| `remix-netlify` | `remix({ serverHandler: false })` + `@netlify/vite-plugin` | Netlify Functions |
| `remix-vercel` | `remix({ serverHandler: false })` + `nitro/vite` (vercel preset) | Vercel via Nitro `.output/` |

Netlify/Nitro `serverHandler` values are the expected shape (platform plugin owns dev serving,
as Cloudflare does); each template's implementation pass verifies dev/build/preview/deploy
end-to-end before the org repo is published, and any contract surprise flows back into this
spec's compatibility notes. Templates import only `@pitlane/dev` — the no-leak lint applies.

## Documentation plan

1. **Package README** (`packages/dev/README.md`) — standalone per the composition principle:
   install, options table, entry contract, per-target quickstarts (six targets, a few lines
   each), compat table, authoring rules for `clientEntry`.
2. **Docs site** — `/package/dev` reference (options, contracts, architecture) plus rewritten
   guides: *Getting Started* (Node default), *Hydration* (authoring rules + how the transform
   works), *Deployment* (per-target pages mirroring the templates).
3. **Docs cleanup (release gate):** sidebar shows only released packages (`@pitlane/dev` now,
   `@pitlane/theme` on its release) — the current sidebar lists ~50 unreleased packages and
   `@pitlane/dev` twice (`docs/.vitepress/config.ts:68,107`); site tagline
   ("… for Remix apps on Cloudflare") updated to the agnostic positioning; Cloudflare-era CLI
   guides (`cli.md`, `resources`, `secrets`, `migrations`, `deployment`) moved out of nav until
   those tools ship.

## Key decisions

| Decision | Choice | Rejected alternative |
| -------- | ------ | -------------------- |
| Platform integration | Compose with platform plugins via `ssr` env + fetch contract | In-plugin `target:` adapters (TanStack tried & reverted) |
| fullstack dependency | Wrap, exact-pin, hide behind `/runtime` + `/assets` + documented `?assets=` | Inline now (~600 LOC of Vite-internals liability, no user-visible gain) |
| Transform engine | Proven `oxc-parser` + `magic-string` path, one code path in all modes | Rolldown-native `meta.ast`/`meta.magicString` (tried previously; unfinished types, unexercised paths — revisit when finalized) |
| Type imports | `vite` peer | `vite-plus` (would break generic Vite consumers) |
| Server entry contract | default export with `.fetch` only | keep `mod.router` preview fallback (dead — dev never accepted it) |
| `builder: {}` | ship unconditionally | per-target variance (the drift the old cloudflare copy had) |
| Asset types | explicit `types: ["@pitlane/dev/assets"]` | global ambient from plugin import (implicit, surprising) |
| First package | `@pitlane/dev` (Brooks/DevRel pull) | `@pitlane/theme` (becomes fast-follow) |

## Resolved questions (design review, 2026-07-23)

1. **Tested Vite/Vite+ range** — whatever is latest at development/publish time for each; the
   CI matrix pins those versions and the README table reports them.
2. **Netlify generic plugin contract** — approved as written: verified during template
   implementation.
3. **Deno template** — mirrors the Bun template's shape: `vite dev` for development,
   runtime-native serving of the built fetch entry (`deno serve dist/ssr/index.js`) in
   production.

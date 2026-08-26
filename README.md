# Pitlane

Portable platform integration for [Remix 3](https://remix.run).

Pitlane sits between Remix and the platforms you deploy to. Your server entry default-exports a standard fetch handler and hosting composes around it — platform plugins in the same Vite plugin array, or plain runtimes (Node, Bun, Deno) running the built output directly. Swap the deploy target; the app doesn't change. Composable hosting, not a hosting engine.

## Packages

| Package                                            | Status                                                                                                                             | Description                                                                                                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@pitlane/dev`](packages/dev)                     | [![npm](https://img.shields.io/npm/v/%40pitlane%2Fdev?color=blue)](https://www.npmjs.com/package/@pitlane/dev)                     | `remix()` — the Remix 3 Vite plugin: build orchestration, the `clientEntry()` hydration transform, a dev server with component and server-data HMR, SPA mode, build-time prerendering, and preview. |
| [`@pitlane/theme`](packages/theme)                 | [![npm](https://img.shields.io/npm/v/%40pitlane%2Ftheme?color=blue)](https://www.npmjs.com/package/@pitlane/theme)                 | Type-safe styling. A schema tree and the CSS values it describes compile to a typed token accessor and a `<Theme />` component.                                                                     |
| [`@pitlane/crawler`](packages/crawler)             | [![npm](https://img.shields.io/npm/v/%40pitlane%2Fcrawler?color=blue)](https://www.npmjs.com/package/@pitlane/crawler)             | `crawl()` — walks a Remix router in memory. What `remix({ prerender })` runs, and what a sitemap, link check, or static export builds on.                                                           |
| [`@pitlane/data-table-d1`](packages/data-table-d1) | [![npm](https://img.shields.io/npm/v/%40pitlane%2Fdata-table-d1?color=blue)](https://www.npmjs.com/package/@pitlane/data-table-d1) | A Cloudflare D1 driver for `remix/data-table`: SQLite SQL over D1's async prepared-statement binding.                                                                                               |

[`pitlane`](packages/pitlane) and [`create-pitlane`](packages/create-pitlane) are published at `0.0.0` to hold their names. The umbrella will vend the scoped packages as `pitlane/<name>` subpaths, and the CLI will replace the `giget` command below. Neither ships working code yet, and every package installs and is documented on its own without them.

## Quick start

```sh
npm add -D @pitlane/dev
```

```ts
// vite.config.ts
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite"; // or "vite-plus"

export default defineConfig({
    plugins: [remix()],
});
```

Everything the plugin does orbits three files you own:

- **`vite.config.ts`** — `plugins: [remix()]`. Defaults cover the rest.
- **`app/entry.server.tsx`** — builds a router and default-exports it. The default export's `.fetch(Request)` is the contract every consumer reads: dev, preview, and whatever runs in production.
- **`app/entry.browser.ts`** — calls `run()` from `remix/ui` to hydrate `clientEntry()` components against server HTML.

`vite dev` serves the app through your router, `vite build` produces `dist/ssr` and `dist/client`, and `vite preview` serves the production build through the same fetch handler production runs. Component and server-data [HMR](https://pitlane.tools/guides/hmr) are on in dev.

Two options change the shape of the build: [`prerender`](https://pitlane.tools/guides/prerendering) renders paths to static HTML during `vite build`, and [`server: false`](https://pitlane.tools/guides/spa) drops the server entirely for a client-rendered app. See the [Vite plugin guide](https://pitlane.tools/guides/vite-plugin) for the asset runtime, the `clientEntry()` transform, and dev/preview semantics.

## Templates

The [`pitlane-tools/templates`](https://github.com/pitlane-tools/templates) monorepo ships the same Remix 3 guest book wired for eight deploy targets — Cloudflare (D1), Netlify (Netlify Database), Vercel (Neon Postgres), Railway on Node, Bun, or Deno, Deno Deploy (managed Postgres), and GitHub Pages (Service Worker + IndexedDB). Scaffold one with [giget](https://github.com/unjs/giget):

```sh
npx giget github:pitlane-tools/templates/<template> my-app
```

Because every template is the same app, diffing any two shows exactly what a platform swap touches — usually the database middleware, the deploy config, and nothing else.

## Documentation

[pitlane.tools](https://pitlane.tools) hosts everything:

- Guides: [Vite plugin](https://pitlane.tools/guides/vite-plugin) · [Styling](https://pitlane.tools/guides/styling) · [Single-page apps](https://pitlane.tools/guides/spa) · [Prerendering](https://pitlane.tools/guides/prerendering) · [Crawling](https://pitlane.tools/guides/crawler) · [HMR](https://pitlane.tools/guides/hmr) · [Cloudflare D1](https://pitlane.tools/guides/cloudflare-d1)
- API reference, generated from source: [`@pitlane/dev`](https://pitlane.tools/package/dev/) · [`@pitlane/theme`](https://pitlane.tools/package/theme/) · [`@pitlane/crawler`](https://pitlane.tools/package/crawler/) · [`@pitlane/data-table-d1`](https://pitlane.tools/package/data-table-d1/)
- Deploy guides: [Cloudflare Workers](https://pitlane.tools/deploy/cloudflare) · [Netlify](https://pitlane.tools/deploy/netlify) · [Vercel](https://pitlane.tools/deploy/vercel) · [Railway](https://pitlane.tools/deploy/railway) · [Deno Deploy](https://pitlane.tools/deploy/deno-deploy) · [GitHub Pages](https://pitlane.tools/deploy/github-pages)

## Repository

```
packages/
├── crawler/          # @pitlane/crawler — crawl() and staticPaths()
├── create-pitlane/   # create-pitlane — reserved name, the future scaffolder
├── data-table-d1/    # @pitlane/data-table-d1 — Cloudflare D1 driver
├── dev/              # @pitlane/dev — the remix() Vite plugin
├── pitlane/          # pitlane — reserved name, the future umbrella
└── theme/            # @pitlane/theme — type-safe styling
docs/                 # pitlane.tools — VitePress + TypeDoc, deployed to Cloudflare Workers
```

### Development

The repo is a pnpm workspace. Repo-level tasks run through [Mise](https://mise.jdx.dev); per-package tasks run from the package directory through [Vite+](https://viteplus.dev):

```sh
mise install                # node, pnpm, and vale; the postinstall hook installs dependencies

mise run docs:dev           # docs site (typedoc + vitepress) on http://localhost:1337
mise run check              # what CI runs: oxfmt --check, oxlint, tsc
mise run docs:prose         # vale over the hand-written docs

cd packages/dev             # per-package tests and build
vp test
vp run build
```

## License

[MIT](LICENSE)

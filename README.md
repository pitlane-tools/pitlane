# Pitlane

Portable platform integration for [Remix 3](https://remix.run).

Pitlane sits between Remix and the platforms you deploy to. Your server entry default-exports a standard fetch handler and hosting composes around it — platform plugins in the same Vite plugin array, or plain runtimes (Node, Bun, Deno) running the built output directly. Swap the deploy target; the app doesn't change. Composable hosting, not a hosting engine.

## Packages

| Package                        | Status                                                                                                         | Description                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`@pitlane/dev`](packages/dev) | [![npm](https://img.shields.io/npm/v/%40pitlane%2Fdev?color=blue)](https://www.npmjs.com/package/@pitlane/dev) | `remix()` — the Remix 3 Vite plugin: build orchestration, the `clientEntry()` hydration transform, dev server, and preview for any Vite project. |

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

`vite dev` serves the app through your router, `vite build` produces `dist/ssr` and `dist/client`, and `vite preview` serves the production build through the same fetch handler production runs. See the [Vite plugin guide](https://pitlane.tools/guides/vite-plugin) for the asset runtime, the `clientEntry()` transform, and dev/preview semantics.

## Templates

The [`pitlane-tools/templates`](https://github.com/pitlane-tools/templates) monorepo ships the same Remix 3 guest book wired for eight deploy targets — Cloudflare (D1), Netlify (Netlify Database), Vercel (Neon Postgres), Railway on Node, Bun, or Deno, Deno Deploy (managed Postgres), and GitHub Pages (Service Worker + IndexedDB). Scaffold one with [giget](https://github.com/unjs/giget):

```sh
npx giget github:pitlane-tools/templates/<template> my-app
```

Because every template is the same app, diffing any two shows exactly what a platform swap touches — usually the database middleware, the deploy config, and nothing else.

## Documentation

[pitlane.tools](https://pitlane.tools) hosts everything:

- [Using the Vite plugin](https://pitlane.tools/guides/vite-plugin) — day-to-day behavior, footguns included
- [API reference](https://pitlane.tools/package/dev/) — generated from source
- Deploy guides: [Cloudflare Workers](https://pitlane.tools/deploy/cloudflare) · [Netlify](https://pitlane.tools/deploy/netlify) · [Vercel](https://pitlane.tools/deploy/vercel) · [Railway](https://pitlane.tools/deploy/railway) · [Deno Deploy](https://pitlane.tools/deploy/deno-deploy) · [GitHub Pages](https://pitlane.tools/deploy/github-pages)

## Repository

```
packages/
└── dev/              # @pitlane/dev — the remix() Vite plugin
docs/                 # pitlane.tools — VitePress + TypeDoc, deployed to Cloudflare Workers
```

### Development

The repo is a pnpm workspace; docs tasks run from the root, package tasks from the package directory with [Vite+](https://viteplus.dev):

```sh
vp install

# Docs site (typedoc + vitepress) on http://localhost:1337
vp run docs:dev

# @pitlane/dev tests and build
cd packages/dev
vp test
vp run build
```

## License

[MIT](LICENSE)

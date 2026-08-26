# create-pitlane

This name is reserved for the **Pitlane scaffolding CLI** (`npm create pitlane`).
It is not released yet.

Scaffold a [Pitlane](https://pitlane.tools) app today with
[giget](https://github.com/unjs/giget) and
[pitlane-tools/templates](https://github.com/pitlane-tools/templates):

```sh
npx giget github:pitlane-tools/templates/<template> my-app
```

Templates: `cloudflare`, `netlify`, `vercel`, `railway-node`, `railway-bun`,
`railway-deno`, `deno-deploy`, `github-pages`.

What ships today:

- [`@pitlane/dev`](https://pitlane.tools/package/dev/) — the `remix()` Vite
  plugin.
- [`@pitlane/theme`](https://pitlane.tools/package/theme/) — type-safe styling
  with design tokens.
- [`@pitlane/data-table-d1`](https://pitlane.tools/package/data-table-d1/) — a
  Cloudflare D1 driver for Remix 3's `data-table`.
- [`@pitlane/crawler`](https://pitlane.tools/package/crawler/) — spiders a
  Remix 3 fetch router in memory; `remix({ prerender })` runs it.

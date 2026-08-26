# pitlane

This name is reserved for the **Pitlane umbrella package** — portable platform
integration for [Remix 3](https://remix.run). It is not released yet.

What ships today:

- [`@pitlane/dev`](https://pitlane.tools/package/dev/) — the `remix()` Vite
  plugin: build orchestration, the `clientEntry()` hydration transform, dev
  serving with HMR, SPA mode, build-time prerendering, and preview for any
  Vite or Vite+ project.
- [`@pitlane/theme`](https://pitlane.tools/package/theme/) — type-safe styling
  with design tokens: `createTheme({ schema, tokens, modes })` compiles to a
  typed token accessor and a `<Theme />` component.
- [`@pitlane/data-table-d1`](https://pitlane.tools/package/data-table-d1/) — a
  Cloudflare D1 driver for Remix 3's `data-table`.
- [`@pitlane/crawler`](https://pitlane.tools/package/crawler/) — spiders a
  Remix 3 fetch router in memory. The crawler behind `remix({ prerender })`,
  installable on its own.
- [`pitlane-tools/templates`](https://github.com/pitlane-tools/templates) —
  one Remix 3 guest book wired for eight deploy targets.
- [pitlane.tools](https://pitlane.tools) — documentation and deploy guides.

When the umbrella package ships, it will vendor the `@pitlane/*` packages as
`pitlane/<name>` subpath exports.

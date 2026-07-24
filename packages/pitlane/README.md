# pitlane

This name is reserved for the **Pitlane umbrella package** — portable platform
integration for [Remix 3](https://remix.run). It is not released yet.

What ships today:

- [`@pitlane/dev`](https://www.npmjs.com/package/@pitlane/dev) — the `remix()`
  Vite plugin: build orchestration, the `clientEntry()` hydration transform,
  dev serving, and preview for any Vite or Vite+ project.
- [`pitlane-tools/templates`](https://github.com/pitlane-tools/templates) —
  one Remix 3 guest book wired for eight deploy targets.
- [pitlane.tools](https://pitlane.tools) — documentation and deploy guides.

When the umbrella package ships, it will vendor the `@pitlane/*` packages as
`pitlane/<name>` subpath exports.

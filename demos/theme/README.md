# @pitlane/theme demo

A minimal [Remix 3](https://remix.run) app (Node, no database) showing `@pitlane/theme` end to end:

- **`app/theme.ts`** — one W3C DTCG token document: primitive scales, semantic aliases, both value forms (strings and structured objects), composite tokens with sub-value aliases, and a `modes.dark` override. Exports `{ token: t, raw, Theme }`.
- **`app/Document.tsx`** — renders `<Theme />` once in `<head>`; page chrome styled with branded refs (`t.color.surface`), no hand-written dark-mode media queries.
- **`app/components/button.ts`** — `tva` variants (intent × size, compound variant, defaults) and `combine` composition.
- **`app/actions/controller.tsx`** — `css()` with tuple shorthands and strict token-mapped properties, `raw()` swatch labels, `cx()` interop with plain stylesheet classes from `app/index.css`.

Dark mode is entirely CSS: `<Theme />` emits the base `:root` variables plus a `prefers-color-scheme: dark` block overriding only the semantic aliases — switch your OS appearance to see every reference flip.

## Run it

From the repo root (the demo consumes the workspace builds of `@pitlane/theme`, `@pitlane/assets`, and the Vite plugins):

```sh
vp install
vp -C packages/theme run build
vp -C packages/assets run build
vp -C packages/vite-plugin-fetch-server run build
vp -C packages/vite-plugin-remix run build
```

Then:

```sh
cd demos/theme
vp run dev     # dev server
vp run build   # production build
vp run preview # serve the production build
```

These scripts run `vp`, which loads Vite+ core. Every `vite` in this workspace is aliased to that same core, so the dev server and `@pitlane/vite-plugin-remix` share one copy of Vite.

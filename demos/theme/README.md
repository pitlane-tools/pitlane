# @pitlane/theme demo

A minimal [Remix 3](https://remix.run) app (Node, no database) showing `@pitlane/theme` end to end:

- **`app/theme.ts`** — one W3C DTCG token document: primitive scales, semantic aliases, both value forms (strings and structured objects), composite tokens with sub-value aliases, and a `modes.dark` override. Exports `{ token: t, raw, Theme }`.
- **`app/Document.tsx`** — renders `<Theme />` once in `<head>`; page chrome styled with branded refs (`t.color.surface`), no hand-written dark-mode media queries.
- **`app/components/button.ts`** — `tva` variants (intent × size, compound variant, defaults) and `combine` composition.
- **`app/actions/controller.tsx`** — `css()` with tuple shorthands and strict token-mapped properties, `raw()` swatch labels, `cx()` interop with plain stylesheet classes from `app/index.css`.

Dark mode is entirely CSS: `<Theme />` emits the base `:root` variables plus a `prefers-color-scheme: dark` block overriding only the semantic aliases — switch your OS appearance to see every reference flip.

## Run it

From the repo root (the demo consumes the workspace build of `@pitlane/theme`):

```sh
vp install
vp -C packages/theme run build
```

Then:

```sh
cd demos/theme
vp dev     # dev server
vp build   # production build
vp preview # serve the production build
```

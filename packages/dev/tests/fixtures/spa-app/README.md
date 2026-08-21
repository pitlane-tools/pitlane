# spa-app fixture

A minimal client-rendered Remix 3 app wired through the local `remix()` plugin
in SPA mode (`server: false`), used two ways:

- **Automated** — `tests/e2e/spa.browser.test.ts` boots this app against both
  dev pipelines (unbundled and bundled) and edits the files below to assert
  component HMR; `tests/e2e/spa.test.ts` covers the static build and preview.
- **Manual** — a harness you can poke by hand.

There is no server entry, no `dist/ssr`, and no hydration: `index.html` loads
`app/entry.browser.tsx`, which renders `<App />` into `#app` with `createRoot`
from `remix/ui`.

## Run it manually

From `packages/dev`:

```sh
vp run harness:spa      # unbundled dev
vp run harness:spa:bundled  # Vite's experimental bundled dev mode
```

Both boot on <http://127.0.0.1:7412>. Open it, then edit files under `app/`:

| Edit                                             | Expected                                               |
| ------------------------------------------------ | ------------------------------------------------------ |
| `app/fn-counter.tsx` — the label (function form) | Hot-swaps in place. The click count survives.          |
| `app/arrow-counter.tsx` — the label (arrow form) | Same: the plugin normalizes arrows to named functions. |
| `app/app.tsx` — the `<h1>`                       | Hot-swaps in place.                                    |

## Restoring after manual edits

The automated suite restores every file it touches. If you edit files by hand,
`git checkout tests/fixtures/spa-app` resets them.

# hmr-app fixture

A minimal Remix 3 app wired through the local `remix()` plugin, used two ways:

- **Automated** — the Playwright browser suite (`tests/e2e/hmr.browser.test.ts`)
  boots this app, drives it, and edits the files below to assert HMR behavior.
- **Manual** — a harness you can poke by hand to see HMR live.

## Run it manually

From `packages/dev`:

```sh
vp run harness
```

That boots the dev server on <http://127.0.0.1:7411> through the same
`node tests/e2e/harness/dev-server.mjs` entry the tests use (a plain Vite
`createServer`, so there is a single Vite identity — running the `vite` CLI
directly can pick up a second copy and trip the fullstack dev-server assertion).

Open the URL, then edit files under `app/` and watch the page:

| Edit                                                       | Expected                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `app/fn-counter.tsx` — the label or render (function form) | Hot-swaps in place. The click count is preserved; no reload.                                            |
| `app/document.tsx` — the `<h1>` or any server-only markup  | Re-fetches the page and reconciles it. Island click counts are preserved; no full-page reload.          |
| `app/arrow-counter.tsx` — the label (arrow form)           | Falls back to a frame reload: this island re-initializes, but sibling islands and scroll are preserved. |

The two islands are deliberately different: `FnCounter` is a named-`function`
`clientEntry`, so it is a hot-swap boundary; `ArrowCounter` is an arrow
`clientEntry`, so it is not (stable component identity needs a named function).

## Restoring after manual edits

The automated suite restores every file it touches. If you edit files by hand,
`git checkout tests/fixtures/hmr-app` resets them.

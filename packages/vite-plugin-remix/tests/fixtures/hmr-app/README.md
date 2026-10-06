# hmr-app fixture

A minimal Remix 3 app wired through the local `remix()` plugin, used two ways:

- **Automated** — the Playwright browser suite (`tests/e2e/hmr.browser.test.ts`) boots this app, drives it, and edits the files below to assert HMR behavior.
- **Manual** — a harness you can poke by hand to see HMR live.

## Run it manually

From `packages/vite-plugin-remix`:

```sh
vp run harness
```

That boots the dev server on <http://127.0.0.1:7411> through the same `node tests/e2e/harness/dev-server.ts` entry the tests use: a plain Vite `createServer`, so the plugin and server share one Vite identity.

Open the URL, then edit files under `app/` and watch the page:

| Edit | Expected |
| --- | --- |
| `app/fn-counter.tsx` — the label or render (function form) | Hot-swaps in place. The click count is preserved; no reload. |
| `app/document.tsx` — the `<h1>` or any server-only markup | Re-fetches the page and reconciles it, through the `server:update` listener in `app/entry.browser.ts`. Island click counts are preserved; no full-page reload. |
| `app/arrow-counter.tsx` — the label (arrow form) | Hot-swaps in place. The click count is preserved, just as for the function form. |

Both islands are hot-swap boundaries. `FnCounter` uses a named-function `clientEntry`, while the plugin normalizes `ArrowCounter`'s arrow form to a named function before the HMR transform runs.

## Restoring after manual edits

The automated suite restores every file it touches. If you edit files by hand, `git checkout tests/fixtures/hmr-app` resets them.

# `@pitlane/dev` HMR rollout

Working notes from the `dev-hmr` branch (PR #4, merged): what shipped and which
apps were pinned to preview builds while it was validated.

`@pitlane/dev@0.3.0` is published. Converting the apps onto it is a separate
task with its own brief: [`convert-apps-to-dev-0.3.0.md`](./convert-apps-to-dev-0.3.0.md).
That brief supersedes the rollout steps near the end of this file.

## What shipped

`@pitlane/dev@0.3.0` adds dev-time hot module replacement in two halves:

- **Component HMR** — component and `clientEntry()` exports hot-swap in place,
  preserving live island state, via the `remix/ui-hmr` browser and server
  transforms. Arrow-form exports are normalized to named function expressions
  first (`normalizeArrowComponents` in `packages/dev/src/hmr.ts`), so idiomatic
  Remix code hot-swaps with no source changes.
- **Server-data HMR** — editing a server-only module refetches the current page
  through the app's fetch handler and reconciles the new HTML into the DOM,
  keeping hydrated island state. The Remix 3 analog of React Router's
  loader/action revalidation, driven through the frame runtime.

Both are dev-only and need a client entry. Server-data HMR also needs the app to
render `<HMR />` from the `pitlane:dev` module, which is the browser half.
`remix/node-hmr` is deliberately not used: it supervises a child Node process and
provides `import.meta.hot` through module customization hooks, which duplicates
what Vite already owns.

## One limitation worth remembering

**First edit after a dependency change can be missed.** Changing the
`@pitlane/dev` dependency makes Vite rebuild its client dependency cache, and the
first edit after that reaches the server but not the browser. One reload settles
it. This is Vite's dependency prebundling, not the plugin.

An earlier limitation is gone. Revalidation used to run through `navigate()`, so
an app whose own `navigate` listener called `stopImmediatePropagation()` opted out
of it. `<HMR />` reloads the top frame directly and performs no navigation, so
those apps (`malstrom.me` was the one here) now work unmodified. Do not add the
same-URL navigation allowance that earlier notes described.

## App matrix

Every app below is on `remix@3.0.0-beta.10`, upgraded on its own default branch,
with a separate `hmr-preview` branch pinning the pkg.pr.new build. Islands mean
`clientEntry()` islands; apps without them have no component-HMR surface.

| App                     | Repo location                       | Upgrade branch  | Preview branch | Verified                                                            |
| ----------------------- | ----------------------------------- | --------------- | -------------- | ------------------------------------------------------------------- |
| `remix-3-contacts`      | `Playgrounds/remix-3-contacts`      | already beta.10 | `hmr-preview`  | server-data, arrow island, function-form island                     |
| `mapper`                | `Projects/mapper`                   | `main`          | `hmr-preview`  | component hot-swap, server-data                                     |
| `quintessential-guide`  | `Projects/quintessential-guide`     | `main`          | `hmr-preview`  | arrow island hot-swap, server-data                                  |
| `commonwealth-platform` | `Playgrounds/commonwealth-platform` | `main`          | `hmr-preview`  | server-data (no islands)                                            |
| `malstrom.me`           | `Projects/malstrom.me`              | `remix`         | `hmr-preview`  | arrow island hot-swap, server-data (needs the navigation fix above) |
| `maitre-d`              | `Projects/maitre-d`                 | `main`          | `hmr-preview`  | server-data (no islands)                                            |

Two bugs came out of this matrix and are fixed on `dev-hmr`:

- Tailwind's content scanner registers non-script (`asset`) nodes in the client
  graph for ordinary server files. The old "is this also a client module?" check
  counted those, so server-data HMR never fired in Tailwind apps. Now only `js`
  client modules count.
- Revalidating in the same tick as the hot update could hit the fetch handler
  mid-apply; workerd answered with "Expected default export … to define a
  fetch() function" and the frame reconciled an error page. The broadcast is now
  debounced, which also coalesces bursts of saves.

## Publishing 0.3.0

Done. PR #4 merged to `main` (`2f67f63`), `@pitlane/dev@0.3.0` is on npm as
`latest`, and the docs deployed to <https://pitlane.tools>.

## Converting the apps

See [`convert-apps-to-dev-0.3.0.md`](./convert-apps-to-dev-0.3.0.md). It carries
the per-app branch table, the two edits each app needs (the dependency and
`<HMR />`), the boot commands, and the verification recipe.

# `@pitlane/dev` HMR rollout

Working notes for the `dev-hmr` branch (PR #4): what shipped, which apps are
pinned to the preview, and how to move them onto the real release.

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

Both are dev-only and need a client entry. `remix/node-hmr` is deliberately not
used: it supervises a child Node process and provides `import.meta.hot` through
module customization hooks, which duplicates what Vite already owns.

## Two limitations worth remembering

1. **Revalidation needs Remix's navigation interception.** It runs through
   `navigate()` from `remix/ui`. An app whose own `navigate` listener calls
   `stopImmediatePropagation()` for every navigation never lets the frame
   runtime see it, so server-only edits leave the page untouched. `remix/ui`
   exposes no public frame-reload API, so the plugin cannot work around it. Fix
   in the app by letting same-URL replacements through:

   ```ts
   navigation.addEventListener("navigate", event => {
       if (event.navigationType === "replace" && event.destination.url === location.href) return;
       event.stopImmediatePropagation();
   });
   ```

   `malstrom.me` needs this; it is the only app in the matrix that does.

2. **First edit after a dependency change can be missed.** Re-pinning
   `@pitlane/dev` makes Vite re-optimize client deps, and the first edit after
   that lands on the server but does not reach the browser. One page reload
   settles it. This is Vite dep optimization, not the plugin.

## App matrix

Every app below is on `remix@3.0.0-beta.10`, upgraded on its own default branch,
with a separate `hmr-preview` branch pinning the pkg.pr.new build. Islands mean
`clientEntry()` islands; apps without them have no component-HMR surface.

| App | Repo location | Upgrade branch | Preview branch | Verified |
| --- | --- | --- | --- | --- |
| `remix-3-contacts` | `Playgrounds/remix-3-contacts` | already beta.10 | `hmr-preview` | server-data, arrow island, function-form island |
| `mapper` | `Projects/mapper` | `main` | `hmr-preview` | component hot-swap, server-data |
| `quintessential-guide` | `Projects/quintessential-guide` | `main` | `hmr-preview` | arrow island hot-swap, server-data |
| `commonwealth-platform` | `Playgrounds/commonwealth-platform` | `main` | `hmr-preview` | server-data (no islands) |
| `malstrom.me` | `Projects/malstrom.me` | `remix` | `hmr-preview` | arrow island hot-swap, server-data (needs the navigation fix above) |
| `maitre-d` | `Projects/maitre-d` | `main` | `hmr-preview` | server-data (no islands) |

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

1. Land PR #4 (`dev-hmr` → `main`).
2. Release `@pitlane/dev@0.3.0` the usual way. `main` carries the version bump
   and CHANGELOG entry already.
3. Roll the apps off the preview (below).

## Rolling each app off the preview

The `hmr-preview` branches exist to be reused as templates, not merged as-is —
they pin a commit-specific pkg.pr.new URL. For each app:

```sh
git switch hmr-preview
# swap the pinned preview for the release
pnpm add -D @pitlane/dev@^0.3.0      # bun add -d in mapper
git add package.json <lockfile>
git commit -m "deps: upgrade @pitlane/dev to 0.3.0"
git switch main                      # `remix` in malstrom.me
git merge hmr-preview
git branch -d hmr-preview
```

Sanity check before merging: `grep pkg.pr.new package.json` returns nothing, and
the lockfile no longer resolves `@pitlane/dev` to an `https://` URL.

Apps needing extra care:

- **`malstrom.me`** — also apply the navigation fix from limitation 1, otherwise
  server-data HMR silently does nothing. Its upgrade branch is `remix`, not
  `main`. Local `.dev.vars` supplies `AUTH_SESSION_SECRET`/`PASSWORD` to workerd;
  `.env` alone is not enough to boot dev.
- **`maitre-d`** — its beta.0 → beta.10 migration was the largest (legacy
  `remix/*` import renames, a hand-written D1 `DatabaseDriver`, migrations moved
  to SQL directories, one JS migration extracted to `db/seed-dev-menus.ts`).
  Keep `scripts/probe-outline.ts` untracked; it predates this work.
- **`mapper`** — Bun, so `bun add -d` and `bun.lock`.
- **Cloudflare apps** — booting dev runs `wrangler types`, which rewrites the
  tracked `worker-configuration.d.ts`. On `commonwealth-platform` that
  regeneration dropped the `DB: D1Database` binding (its wrangler config differs
  by branch) and bumped the workerd version. Treat the committed file as the
  source of truth and `git restore` it after a dev boot rather than committing
  the regenerated version.

## Booting each app for a manual HMR check

```sh
cd <app> && vp run dev        # malstrom.me: ./node_modules/.bin/vite dev --host
```

Ports: 1612 for everything except `maitre-d` (5173).

To verify by hand: set a marker in the console (`window.__alive = "x"`), edit an
island's rendered text and confirm the DOM updates while the marker survives,
then edit a server-only module and confirm the same. A surviving marker is the
proof that no full reload happened. Watch out for visually hidden text —
`textContent` sees it, `innerText` does not.

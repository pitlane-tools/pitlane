# Brief: convert the Remix apps to `@pitlane/dev@0.3.0`

`@pitlane/dev@0.3.0` is published on npm. Six Remix 3 apps on this machine are
still pinned to a `pkg.pr.new` preview build on an experimental branch. Your job
is to put each one on the published release, confirm HMR works, and merge the
branch into the app's base branch.

You are working in six repositories that are not this one. Nothing in this
repository needs to change.

## What 0.3.0 gives an app

Two dev-time features, both off in production builds:

- **Component HMR.** Editing a component swaps its new code in without
  remounting, so hydrated `clientEntry()` islands keep their state. Automatic,
  no app changes.
- **Server-data HMR.** Editing a server-only module (the document, a middleware,
  a route handler, a data module) refetches the current page through the app's
  fetch handler and reconciles the new HTML into the DOM, keeping island state.
  This one needs the app to render `<HMR />`.

Read <https://pitlane.tools/guides/hmr> before you start. It is the reference for
everything below.

## Each app needs two edits, not one

This is the easy thing to get wrong. Bumping the dependency alone leaves the app
building and booting fine while silently losing server-data HMR, because the
browser half is missing.

**1. The dependency.** Replace the pinned preview URL with the release:

```sh
pnpm add -D @pitlane/dev@^0.3.0      # bun add -d in mapper
```

**2. `<HMR />` in the document.** Import from `pitlane:dev` and render it once,
anywhere inside the document:

```tsx
import { HMR } from "pitlane:dev";

// ...
<body>
    <HMR />
    {/* ... */}
</body>;
```

No environment guard. In a production build the specifier resolves to a
component that renders nothing and carries no client code.

`pitlane:dev` is typed by `@pitlane/dev/assets`. Four apps already reference it;
`malstrom.me` and `maitre-d` do not, so add it there or their typecheck fails on
the import:

```jsonc
// tsconfig.json
{ "compilerOptions": { "types": ["@pitlane/dev/assets"] } }
```

## The apps

Every app is on branch `hmr-preview`, on `remix@3.0.0-beta.10`, pinned to
`https://pkg.pr.new/@pitlane/dev@1be1fd1`, with a clean tree. Every base branch
already carries the beta.10 upgrade and `@pitlane/dev@^0.2.0`, so the only change
merging brings is this one.

| App                     | Path                                            | Base branch | Document                         | Islands | Package manager |
| ----------------------- | ----------------------------------------------- | ----------- | -------------------------------- | ------- | --------------- |
| `remix-3-contacts`      | `~/Developer/Playgrounds/remix-3-contacts`      | `main`      | `app/components/Document.tsx`    | 4       | pnpm            |
| `mapper`                | `~/Developer/Projects/mapper`                   | `main`      | `app/components/MapDocument.tsx` | 2       | **bun**         |
| `quintessential-guide`  | `~/Developer/Projects/quintessential-guide`     | `main`      | `app/components/Document.tsx`    | 1       | pnpm            |
| `commonwealth-platform` | `~/Developer/Playgrounds/commonwealth-platform` | `main`      | `app/components/Document.tsx`    | 0       | pnpm            |
| `malstrom.me`           | `~/Developer/Projects/malstrom.me`              | **`remix`** | `app/components/Document.tsx`    | 3       | pnpm            |
| `maitre-d`              | `~/Developer/Projects/maitre-d`                 | `main`      | `app/components/Document.tsx`    | 0       | pnpm            |

`malstrom.me` has no `main` branch. Its integration branch is `remix`. Do not
create a `main` there.

Apps with 0 islands have no component-HMR surface. Verify server-data HMR only.

## Leftovers to clean up

The experiment left redundant commits. `hmr-preview` in `remix-3-contacts`,
`mapper`, `quintessential-guide`, and `commonwealth-platform` each carries **two**
commits with the same message, because the preview was re-pinned mid-experiment:

```
test: pin @pitlane/dev to 0.3.0 pkg.pr.new preview for HMR validation
```

`malstrom.me` and `maitre-d` have one each. None of them should survive as-is:
the end state is the app depending on `^0.3.0`, with no `pkg.pr.new` reference
anywhere. Reset the branch to its base and commit the real change once, rather
than stacking a third commit on top:

```sh
git switch hmr-preview
git reset --soft <base>     # main, or remix in malstrom.me
# make the two edits, install, verify, then:
git add package.json <lockfile> tsconfig.json <document>
git commit -m "deps: upgrade @pitlane/dev to 0.3.0"
```

Before merging, confirm the cleanup landed:

```sh
grep -r "pkg.pr.new" package.json <lockfile>   # must find nothing
```

`malstrom.me` also has a vendored plugin question already settled: it uses
`@pitlane/dev` now, and `plugins/remix.ts` was deleted during the beta.10
upgrade. Do not reintroduce it.

## Do not add the navigation allowance

Earlier notes told `malstrom.me` to let same-URL replacements through its own
`navigate` listener. That was for the old mechanism, which revalidated by
navigating. `<HMR />` reloads the top frame and performs no navigation, so
`malstrom.me` works unmodified. If you find that allowance in the app, it is
leftover experiment residue and should not be there.

## Booting each app

```sh
cd <app> && vp run dev
```

Ports: 1612 for everything except `maitre-d`, which uses 5173.

Two apps need setup before dev boots:

- **`malstrom.me`** runs `vite dev --host` directly (no `dev` task) and asserts
  `AUTH_SESSION_SECRET` at startup. Cloudflare reads worker bindings from
  `.dev.vars`, and its presence suppresses `.env`, so the values in `.env` have
  to be present in `.dev.vars` for the boot to succeed. Both files are untracked
  and hold real secrets. If you merge them, back the original up outside the
  repo, restore it byte-for-byte afterward, and never print, commit, or log the
  contents.
- **`maitre-d`** has `dependsOn: ["typegen", "db:migrate"]`, so the first boot
  runs wrangler typegen and D1 migrations. Let it.

## Verifying an app works

A hot update and a full reload both end with correct content on screen. The only
way to tell them apart is a marker that a reload destroys. In the browser
console, or through whatever browser automation you have:

```js
window.__alive = "check";
```

Then, per app:

1. **Server-data HMR.** Edit a string in a server-rendered component (the
   document, or any component the browser never imports). The DOM should update
   while `window.__alive` still reads `"check"`.
2. **Component HMR** (skip for the two apps with no islands). Click or type into
   an island to give it state, then edit that island's rendered text. The text
   should change while both the island's state and the marker survive.

Two traps that will waste your time:

- **The first edit after the dependency change is often missed.** Changing
  `@pitlane/dev` makes Vite rebuild its client dependency cache, and the first
  edit lands on the server without reaching the browser. Reload once and retry
  before concluding anything is broken.
- **Read the DOM with `textContent`, not `innerText`.** `innerText` skips
  visually hidden elements, which makes a working update look like a failure.
  `maitre-d`'s week label is visually hidden, and this exact mistake produced a
  false negative during the original work.

Also run each app's own typecheck (`vp run typecheck`, or
`./node_modules/.bin/tsc --noEmit`) and confirm it is clean before merging.

## Merging

Once an app is on `^0.3.0`, renders `<HMR />`, typechecks, and both applicable
HMR paths are confirmed:

```sh
git switch <base>          # main, or remix in malstrom.me
git merge hmr-preview
git branch -d hmr-preview
```

Fast-forward is fine and expected.

## Rules

- **Do not push.** Every repository here is someone's real project with a real
  remote. Commit locally and stop. Report what is ready to push.
- **Do not touch unrelated changes.** `maitre-d` has an untracked
  `scripts/probe-outline.ts` and `malstrom.me` has untracked `.astro/`,
  `.dev.vars`, and `.env.atproto-bootstrap.op`. All predate this work. Leave them
  exactly as they are, and never stage them.
- **Stage explicit paths.** No `git add .` or `git add -A`.
- **Cloudflare apps regenerate a tracked file.** Booting dev runs
  `wrangler types`, which rewrites `worker-configuration.d.ts`. On
  `commonwealth-platform` that regeneration previously dropped a
  `DB: D1Database` binding. Treat the committed file as the source of truth and
  `git restore` it after a boot rather than committing the regenerated version.
- **Revert your probe edits.** The strings you edit to test HMR are throwaway.
  Every app's tree should be clean at the end apart from the intended commit.
- **Stop and report on a real blocker.** A failing typecheck you cannot explain,
  an app that will not boot, or HMR that does not work after a reload is worth
  reporting rather than working around.

## Done means

For each of the six apps:

- base branch contains the upgrade, `hmr-preview` deleted
- `@pitlane/dev` is `^0.3.0`, no `pkg.pr.new` anywhere in `package.json` or the
  lockfile
- `<HMR />` renders in the document
- typecheck clean
- server-data HMR confirmed in a browser, plus component HMR where islands exist
- tree clean, pre-existing untracked files untouched, nothing pushed

Report per app: what changed, what you verified and how, the commit, and anything
you could not do.

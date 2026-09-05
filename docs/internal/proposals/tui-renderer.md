# Moving the terminal renderer to `@pitlane/tui`

Status: implemented here, unpublished. `packages/tui/` and `demos/tui/` are in
this repository as `@pitlane/tui`, and the Remix fork's copies are gone.
Publishing is what is still blocked: the host interface the package implements
is absent from every published Remix, so the package and its demo take
`@remix-run/ui` straight from the fork's built branch instead.

`@pitlane/tui` renders a Remix component tree to a terminal. It was written
against `@remix-run/ui`'s host-operation API, it works, and it is the only proof
that API survives contact with a non-DOM backend. It was also the only package
in the Remix 3 monorepo whose product behavior was owned by a third-party
dependency, which is a Pitlane shape rather than a Remix one. The sections
below are the argument for the move, kept as the record of why it happened,
with the parts that are still open marked as open.

```tsx
import type { Handle } from "@remix-run/ui";
import { Box, style, Text } from "@pitlane/tui";
import { createRoot } from "@pitlane/tui/node";
import { on } from "@remix-run/ui";

function App(handle: Handle) {
    let count = 0;
    return () => (
        <Box
            mix={[
                style({ layout: { padding: { left: 1, right: 1 } } }),
                on("pointerclick", () => {
                    count++;
                    handle.update();
                }),
            ]}
        >
            <Text>Taps: {count}</Text>
        </Box>
    );
}

const terminal = await createRoot();
terminal.render(<App />);
await terminal.closed;
```

## What moved

The package was 1166 non-test lines across nine files in the Remix fork, and
it is the same nine files here.

| File                  | Lines | Owns                                                                                                                 |
| --------------------- | ----: | -------------------------------------------------------------------------------------------------------------------- |
| `lib/host.ts`         |   380 | the `RendererHost` implementation: `TerminalBox`, `TerminalTextElement`, prop and style validation, `getEventTarget` |
| `lib/root.ts`         |   375 | `createRoot`, the commit callback, input parsing, pointer dispatch, the animation timer                              |
| `lib/node.ts`         |   143 | the Node driver: raw mode, alternate screen, mouse tracking, SIGINT/SIGTERM, resize                                  |
| `lib/components.ts`   |    97 | `Box` and `Text`                                                                                                     |
| `lib/serialize.ts`    |    82 | tree walk to `@bomb.sh/tty` ops, plus the hit-test target map                                                        |
| `lib/style.ts`        |    40 | the `style` mixin                                                                                                    |
| `lib/error.ts`        |    25 | `TerminalRenderError`                                                                                                |
| `index.ts`, `node.ts` |    24 | the two entry points                                                                                                 |

Plus 451 lines of tests across three files, a 7.1 KB README, and a change file
describing it as "an experimental terminal renderer".

What that inventory hides is the important part. Layout, text measurement,
style application, hit-testing, and cell-diffed painting are not in any of
those files. They are in `@bomb.sh/tty`, a WASM engine the package calls
through `term.render(ops)`. `packages/tui` owns a host-tree data model, an op
serializer, and terminal I/O. The rendering belongs to someone else.

## Why it does not belong in Remix

Every `@remix-run/*` package with a third-party runtime dependency, from the
Remix tree as it stood before the move:

| Package                          | Third-party dependencies                                            | Kind                             |
| -------------------------------- | ------------------------------------------------------------------- | -------------------------------- |
| `assets`                         | `oxc-*`, `lightningcss`, `chokidar`, `magic-string`, `picomatch`, … | build tooling                    |
| `test`                           | `esbuild`, `istanbul-*`, `v8-to-istanbul`, …                        | test tooling                     |
| `cli`                            | `jsonc-parser`, `semver`                                            | tooling                          |
| `node-hmr`, `node-tsx`, `ui-hmr` | `oxc-parser`, `chokidar`, `source-map-js`                           | dev tooling                      |
| `data-schema`                    | `@standard-schema/spec`                                             | a spec shim                      |
| `ui`                             | `@types/dom-navigation`                                             | types only                       |
| `file-storage-s3`                | `aws4fetch`                                                         | request signing for one provider |
| `tui`                            | `@bomb.sh/tty`                                                      | the renderer                     |

Eight of the nine are tooling, a type package, or a protocol shim. The ninth,
`file-storage-s3`, is a provider adapter, and a provider adapter is precisely
the category Pitlane exists to hold. `tui` is the only entry where a third
party owns what the package is for, at runtime, in a user-facing package.

Two more things push the same direction.

The repository's own platform stance is to "prefer Web APIs and
standards-aligned primitives over Node-specific APIs whenever possible".
`lib/node.ts` is 143 lines of `process.stdin` raw mode, alternate-screen escape
sequences, and POSIX signal handling. It is the least Web-standard file in the
monorepo, and it has to be, because that is what a terminal is.

And the engine underneath is young. `@bomb.sh/tty` published 0.9.0 with four
versions total, its npm record starts 2026-06-18, and the GitHub repository has
37 stars and 36 open issues. That is a reasonable bet for a package that wants
to make it, and an unreasonable one to wire into Remix 3's release train, where
it would mean a framework at `3.0.0-rc.1` carrying a `0.x` WASM dependency it
does not control.

None of this is a criticism of the package. It is well built, it is the
existence proof the universal renderer needed, and the argument for moving it
is that it is the wrong shape for the repository, not that it is wrong.

## Why it belongs here

`VISION.md` describes the adapter pattern in terms this fits exactly:

> Remix owns the capability interface (e.g. `Database` from
> `remix/data-table`, the `FileStorage` interface from `remix/file-storage`). A
> Pitlane adapter package supplies the concrete implementation for a provider.

`RendererHost` from `@remix-run/ui/renderer` is a Remix-owned interface with
nine operations, and the DOM host was its only implementation. `@pitlane/tui`
supplies a second, the same way `@pitlane/data-table-d1` supplies a
`Database`. The substitution is exact: the interface stays upstream, the
binding to a specific substrate lives here.

Principle 4 is the other half, and it reads as though it were written for this:

> Treat dependencies as strategic liabilities, not as prohibited tools. Choose
> them wisely, wrap them completely behind Pitlane-owned APIs, and expect to
> replace most of them with Pitlane packages over time.

The package does most of the wrapping. Its exported surface is `Box`, `Text`,
`style`, `createRoot`, `TerminalPointerEvent`, and `TerminalRenderError`, and
no `@bomb.sh/tty` symbol is re-exported. The seams that remain are real and
documented: `style()` accepts tty's layout and text fields, an app that wants
`grow()`, `fixed()`, or `rgba()` installs `@bomb.sh/tty` itself, and engine
error types reach callers through `TerminalRenderError.type`. Owning that
dependency, budgeting for its replacement, and taking the maintenance is a
thing Pitlane has a stated policy for and Remix does not.

Principle 3 fits better here than most Pitlane packages manage. The zero-I/O
`createRoot` in `index.ts` needs no bundler, no build step, and no Node: it
takes a `write` sink and byte input, and the Node driver is a separate subpath
composed on top. "Runtime-oriented packages should work and run their core
tests without bundling as the first design pass" is already satisfied, and the
`.` versus `./node` split is the composition boundary the principle asks for,
drawn before anyone asked.

### The argument that makes it load-bearing

`VISION.md` reserves `create-pitlane` for "a future interactive scaffolder"
that "may automate those recipes". An interactive scaffolder is a terminal
program with a user interface, and the plan currently has no answer for how one
gets built.

`@pitlane/tui` is that answer, and it is a better one than the alternatives,
because the scaffolder would be written in the same component model as the
applications it scaffolds. That is not a new package added to the sequence for
its own sake. It is the missing dependency of a package already in it.

## Fit against the vision

The same question the `@pitlane/native` proposal raises, asked more cheaply.

`VISION.md` scopes Pitlane as a meta-framework for taking a Remix application
"from development to production across Cloudflare, Netlify, Vercel, Railway,
Deno Deploy, and plain Node, Bun, or Deno runtimes", and names the stable
contract as "the server entry's default-exported `.fetch(Request)` handler". A
terminal program has no fetch handler, no deployment boundary, and no provider.
Every row of the Deployment boundary table is a web host.

A render target was not in scope when this was written, so the amendment below
was a precondition of the move. The comparison that priced it:

|                               | `@pitlane/tui`             | `@pitlane/native`                                 |
| ----------------------------- | -------------------------- | ------------------------------------------------- |
| Code                          | exists, 1164 lines, tested | none                                              |
| Dependencies added            | one, MIT, 4 versions       | `react-native` plus four `@symbiote-native/*`     |
| Native code to maintain       | none                       | a SwiftUI vocabulary and a CocoaPods or SPM train |
| Build-time integration        | none                       | a Vite plugin replacing Metro                     |
| Already justified by the plan | yes, `create-pitlane`      | no                                                |
| Cost of being wrong           | delete a package           | months                                            |

The precedent that resolved the scope question was already in the document:
the Framework table assigns Styles and Design system to Remix,
and Pitlane ships `@pitlane/theme` anyway, because the Meta-Framework
capability table carries a "Type-safe styling" row marked Pitlane-native.
Remix owns the primitive; Pitlane owns a layer above it; the capability table
is where that gets recorded.

The amendment was one row and one sentence, and both are now in `VISION.md`:

- a Render targets row in the Meta-Framework capability table, reading
  "Pitlane-native (terminal, experimental)". The terminal is the only entry;
  nothing about a native target was decided here.
- one sentence in the Overview extending the portable boundary from where an
  application runs to what it paints, which is the existing claim ("the
  portable boundary is the application, not a synthesized hosting layer")
  taken one step rather than a new one.

The decision that landed covers the terminal render target and this move.
`@pitlane/native` remains a separate proposal with a separate answer.

## What is still blocked

Publishing. The port is done, tested here, and documented; nothing about it
waits on Remix. A release does, because the seam it implements is unpublished:

- `@remix-run/ui@0.8.0` publishes 28 export subpaths and `./renderer` is not
  among them.
- `remix@3.0.0-rc.1` vends neither `./ui/renderer` nor `./tui`.

`createRenderer` and `RendererHost` live on the `ui-universal-renderer` branch
of the `markmals/remix` fork, and `preview/ui-universal-renderer` is the built
branch pnpm installs from. `@pitlane/tui` takes `@remix-run/ui` as a peer
dependency at `^0.8.0` rather than the `remix` umbrella `@pitlane/theme` takes,
and `packages/tui/package.json` and `demos/tui/package.json` each declare a
Git dependency on that preview branch to satisfy it:
`markmals/remix#preview/ui-universal-renderer&path:packages/ui`.

Pinning the umbrella instead is what this replaced. A Git install of `remix`
drags 47 nested Git dependencies along with it, and pnpm rejects those under
`blockExoticSubdeps`, which defaults to true. Depending on `@remix-run/ui`
directly keeps the repository's supply-chain policy untouched, keeps the
arrangement inside the two packages that need it, and leaves every other
package on the published `remix` it already depends on. Nothing is pinned in
`pnpm-workspace.yaml`.

A Git dependency is still a development arrangement, not something a published
package can ask of its consumers, so the sequence is unchanged: the universal
renderer lands upstream and ships in a release, then `@pitlane/tui` gets a
version. That release is what removes the Git dependency, returns the peer
dependency to the `remix` umbrella the rest of Pitlane uses, and moves
consumers to `remix/ui/renderer`.

Until then the package is installable only from a checkout, and both guides
say so.

## The move, concretely

### What landed here

`packages/tui/`, matching the shape of `packages/theme/`:

```jsonc
{
    "name": "@pitlane/tui",
    "type": "module",
    "exports": {
        ".": { "types": "./dist/index.d.mts", "import": "./dist/index.mjs" },
        "./node": { "types": "./dist/node.d.mts", "import": "./dist/node.mjs" },
    },
    "dependencies": { "@bomb.sh/tty": "0.9.0" },
    "devDependencies": {
        "@remix-run/ui": "markmals/remix#preview/ui-universal-renderer&path:packages/ui",
    },
    "peerDependencies": { "@remix-run/ui": "^0.8.0" },
    "files": ["dist", "CHANGELOG.md"],
}
```

Plus a `vite.config.ts` with a `pack` entry per subpath and a `test` block, a
README, `demos/tui/`, the two guides under `docs/guides/`, and a
`.typedoc/tui.json` config with a line added to the `docs:api` task.

### What left the Remix fork

Six edits, none of them interesting:

- delete `packages/tui/` and `demos/tui/`
- delete `packages/remix/src/tui.ts` and `packages/remix/src/tui/node.ts`
- remove the two `remix/tui` lines from `packages/remix/manifest.json`
- remove the `./tui` and `./tui/node` entries from `packages/remix/package.json`,
  in both `exports` and `publishConfig`, plus the `@remix-run/tui` dependency
- drop the two `remix/tui` bullets from
  `packages/remix/.changes/minor.remix.update-exports.md`, keeping the
  `remix/ui/renderer` bullet, which is the part that has to land

The last one matters more than its size. What Remix should publish is the
renderer subpath. The terminal backend was always the demonstration, and a
demonstration does not need to be in the framework's export map.

### Porting cost

Mechanical, and larger than it looked in the diff.

- **Code style inverted.** Remix formats at two-space indentation, single
  quotes, no semicolons. Pitlane's `.oxfmtrc.jsonc` sets `tabWidth: 4`, double
  quotes, semicolons, `arrowParens: "avoid"`, and sorted imports. `oxfmt` did
  the work, and the result is that every line changed, so the move is one
  commit and the review should read the new files rather than the diff.
- **Test runner changed.** The tests used `@remix-run/test` and
  `@remix-run/assert`. Pitlane runs Vitest through `vp test`. All three test
  files had their harness swapped, which is where a real bug could hide.
- **Dependency shape changed.** `@remix-run/ui` as a workspace dependency
  became `@remix-run/ui` as a peer dependency at `^0.8.0`, satisfied in this
  checkout by a direct Git dependency on the fork's built
  `preview/ui-universal-renderer` branch. The imports did not move:
  `@remix-run/ui` and `@remix-run/ui/renderer` are still what the package and
  the demo write, and they become umbrella subpaths only when the renderer
  ships upstream and the peer dependency goes back to `remix`.
- **Build changed.** `tsconfig.build.json` and the dual `src`/`dist` exports
  map became a `vite.config.ts` `pack` entry emitting `.mjs` and `.d.mts`.

None of it was design work.

## Risks

1. `@bomb.sh/tty` is 0.x with four published versions, 37 stars, 36 open
   issues, and roughly 168 weekly downloads. Adopting it means Pitlane owns
   the consequences of it stalling. Principle 4 budgets for exactly this, but
   budgeting is not the same as being able to afford it: replacing a WASM
   layout and paint engine is not a weekend.
2. The engine's errors still leak. `TerminalRenderError` passes engine failures
   such as `DUPLICATE_ID` and `ELEMENTS_CAPACITY_EXCEEDED` through verbatim in
   its `type`, and its own TSDoc says so. The port did not fix that, so it is
   open work against the first release rather than a resolved item.
3. The package left Remix's CI with the move, so the universal renderer has no
   non-DOM consumer upstream. If `@remix-run/ui`'s host contract changes,
   nothing in that repository catches it. Worth raising with Remix, and worth
   offering the reverse: `@pitlane/tui` as a documented downstream test target.
4. Moving the package here did not make it stable. The README, both guides, and
   the capability row all say experimental, and the first release keeps the
   word.

## Open questions

- Whether `Box` and `Text` stay function components or become JSX intrinsics.
  They are thin wrappers calling `jsx(BOX, ...)`, and `demos/tui` uses
  `jsxImportSource: "@remix-run/ui"` with no TUI-specific intrinsic types at
  all. Intrinsics would read better. This move deliberately did not decide it:
  the ported package keeps the components and the public API it had.
- Whether the `style` mixin should be `css()` from `@pitlane/theme` instead.
  The theme package's authored format is a nested record of CSS values, and a
  terminal supports a small subset. Sharing the authoring surface across a
  terminal and a browser is either elegant or a category error, and the answer
  is not obvious from here. Also not decided by this move, and keeping the two
  packages unentangled is what makes it reversible.
- Whether Remix wants the package back later. If the universal renderer gains
  more backends, a terminal one in the framework repo becomes defensible again.

## Where it stands

1. The renderer subpath still needs to be published, as
   `@remix-run/ui/renderer` and through the umbrella as `remix/ui/renderer`.
   Everything about a `@pitlane/tui` release waits on it, and it is the one
   item this repository cannot do alone.
2. The vision amendment landed: one capability row, one Overview sentence.
3. The package is ported, reformatted, tested on Vitest, documented in two
   guides, and wired into `docs:api`.
4. The Remix fork's `packages/tui/`, `demos/tui/`, and `remix/tui` export
   entries are removed, and the `remix/ui/renderer` change note is what
   remains there.

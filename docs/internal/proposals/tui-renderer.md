# Moving the terminal renderer to `@pitlane/tui`

Status: draft, unscheduled. Nothing here is committed to a release. The package
exists, but it exists in the wrong repository.

`@remix-run/tui` renders a Remix component tree to a terminal. It was written
against `remix/ui`'s host-operation API, it works, and it is the only proof
that API survives contact with a non-DOM backend. It is also the only package
in the Remix 3 monorepo whose product behavior is owned by a third-party
dependency, which is a Pitlane shape rather than a Remix one. This proposes
moving it here as `@pitlane/tui`.

```tsx
import { on } from "remix/ui";
import { Box, Text, style } from "@pitlane/tui";
import { createRoot } from "@pitlane/tui/node";

function App(handle) {
    let count = 0;
    return () => (
        <Box
            mix={[
                style({ padding: 1 }),
                on("press", () => {
                    count++;
                    handle.update();
                }),
            ]}
        >
            <Text>Taps: {count}</Text>
        </Box>
    );
}

createRoot().render(<App />);
```

## What exists today

In the Remix fork, `packages/tui/src` is 1166 non-test lines across nine
files.

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
current tree:

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

`RendererHost` from `remix/ui/renderer` is a Remix-owned interface with nine
operations and no implementation outside the DOM. `@pitlane/tui` supplies one,
the same way `@pitlane/data-table-d1` supplies a `Database`. The substitution
is exact: the interface stays upstream, the binding to a specific substrate
lives here.

Principle 4 is the other half, and it reads as though it were written for this:

> Treat dependencies as strategic liabilities, not as prohibited tools. Choose
> them wisely, wrap them completely behind Pitlane-owned APIs, and expect to
> replace most of them with Pitlane packages over time.

The package already does the wrapping. Its public surface is `Box`, `Text`,
`style`, `createRoot`, `TerminalPointerEvent`, and `TerminalRenderError`.
Nothing from `@bomb.sh/tty` appears in it. Owning that dependency, budgeting
for its replacement, and taking the maintenance is a thing Pitlane has a stated
policy for and Remix does not.

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

So the honest reading is that a render target is not currently in scope, and
both proposals need the same amendment. What differs is the price of finding
out:

|                               | `@pitlane/tui`             | `@pitlane/native`                                 |
| ----------------------------- | -------------------------- | ------------------------------------------------- |
| Code                          | exists, 1164 lines, tested | none                                              |
| Dependencies added            | one, MIT, 4 versions       | `react-native` plus four `@symbiote-native/*`     |
| Native code to maintain       | none                       | a SwiftUI vocabulary and a CocoaPods or SPM train |
| Build-time integration        | none                       | a Vite plugin replacing Metro                     |
| Already justified by the plan | yes, `create-pitlane`      | no                                                |
| Cost of being wrong           | delete a package           | months                                            |

Decide the scope question here. The precedent that resolves it is already in
the document: the Framework table assigns Styles and Design system to Remix,
and Pitlane ships `@pitlane/theme` anyway, because the Meta-Framework
capability table carries a "Type-safe styling" row marked Pitlane-native.
Remix owns the primitive; Pitlane owns a layer above it; the capability table
is where that gets recorded.

The amendment is one row and one sentence:

- a Render targets row in the Meta-Framework capability table, listing the
  terminal first and native second
- one sentence extending the portable boundary from where an application runs
  to what it paints, which is the existing claim ("the portable boundary is the
  application, not a synthesized hosting layer") taken one step rather than a
  new one

If that amendment is refused, this proposal ends and `@pitlane/native` ends
with it. That is the correct outcome to reach in a week rather than a quarter.

## The blocking prerequisite

Neither this nor `@pitlane/native` can ship until Remix publishes the seam.
Verified against npm today:

- `@remix-run/ui@0.8.0` publishes 28 export subpaths and `./renderer` is not
  among them.
- `remix@3.0.0-rc.1` vends neither `./ui/renderer` nor `./tui`.

`createRenderer`, `RendererHost`, and the `remix/tui` entry all live on an
unmerged branch of a fork. `@pitlane/tui` would depend on `remix` as a peer,
the way `@pitlane/theme` does, so the sequence is fixed: the universal renderer
lands upstream and ships in a `remix` release, then this package can be
published against it.

Nothing stops the port from being written and tested against a workspace link
before then. Publishing is what waits.

## The move, concretely

### What lands here

`packages/tui/`, matching the shape of `packages/theme/`:

```jsonc
{
    "name": "@pitlane/tui",
    "type": "module",
    "exports": {
        ".": { "types": "./dist/index.d.mts", "import": "./dist/index.mjs" },
        "./node": { "types": "./dist/node.d.mts", "import": "./dist/node.mjs" },
    },
    "dependencies": { "@bomb.sh/tty": "^0.9.0" },
    "peerDependencies": { "remix": "^3.0.0-rc.1" },
    "files": ["dist", "CHANGELOG.md"],
}
```

Plus a `vite.config.ts` with a `pack` entry per subpath and a `test` block, a
README, and a `.typedoc/tui.json` config with a line added to the `docs:api`
task.

### What leaves the Remix fork

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

Mechanical, and larger than it looks in the diff.

- **Code style inverts.** Remix formats at two-space indentation, single
  quotes, no semicolons. Pitlane's `.oxfmtrc.jsonc` sets `tabWidth: 4`, double
  quotes, semicolons, `arrowParens: "avoid"`, and sorted imports. `oxfmt` does
  the work, and the result is that every line changes, so the move should be
  one commit and the review should read the new files rather than the diff.
- **Test runner changes.** The tests use `@remix-run/test` and
  `@remix-run/assert`. Pitlane runs Vitest through `vp test`. All three test
  files need their harness swapped, which is where a real bug could hide.
- **Dependency shape changes.** `@remix-run/ui` as a workspace dependency
  becomes `remix` as a peer dependency, and imports move from
  `@remix-run/ui/renderer` to `remix/ui/renderer`.
- **Build changes.** `tsconfig.build.json` and the dual `src`/`dist` exports
  map become a `vite.config.ts` `pack` entry emitting `.mjs` and `.d.mts`.

None of it is design work. All of it is a day.

## Risks

1. `@bomb.sh/tty` is 0.x with four published versions, 37 stars, 36 open
   issues, and roughly 168 weekly downloads. Adopting it means Pitlane owns
   the consequences of it stalling. Principle 4 budgets for exactly this, but
   budgeting is not the same as being able to afford it: replacing a WASM
   layout and paint engine is not a weekend.
2. The engine's errors leak. `TerminalRenderError` passes engine failures such
   as `DUPLICATE_ID` through verbatim, so the wrapping is not quite total. That
   is fixable and should be fixed as part of the port rather than after.
3. Moving a package out of the Remix monorepo removes it from Remix's CI, so
   the universal renderer loses its only non-DOM consumer upstream. If
   `remix/ui`'s host contract changes, nothing in that repository catches it.
   Worth raising with Remix, and worth offering the reverse: `@pitlane/tui` as
   a documented downstream test target.
4. The package is described in its own change file as "experimental". Moving it
   here does not make it stable, and the first `@pitlane/tui` release should
   keep that word.

## Open questions

- Whether `Box` and `Text` stay function components or become JSX intrinsics.
  They are currently thin wrappers calling `jsx(BOX, ...)`, and `demos/tui`
  uses `jsxImportSource: "remix/ui"` with no TUI-specific intrinsic types at
  all. Intrinsics would read better and would match what `@pitlane/native`
  wants.
- Whether the `style` mixin should be `css()` from `@pitlane/theme` instead.
  The theme package's authored format is a nested record of CSS values, and a
  terminal supports a small subset. Sharing the authoring surface across a
  terminal and a browser is either elegant or a category error, and the answer
  is not obvious from here.
- Whether the demo moves too. Pitlane has `demos/theme/`, so `demos/tui/` has a
  place, but the demo currently imports `remix/tui` and would need the same
  rewrite.
- Whether Remix wants the package back later. If the universal renderer gains
  more backends, a terminal one in the framework repo becomes defensible again.
  The move should be reversible, which mostly means not entangling it with
  `@pitlane/theme` in the first release.

## First step

1. Get `remix/ui/renderer` onto a path to being published. Everything else
   waits on it, and it is the one item this proposal cannot do alone.
2. Decide the vision amendment. One row, one sentence, and a no here is
   cheaper than a no after `@pitlane/native` starts.
3. Port the package against a workspace link: copy, reformat, swap the test
   harness, and get `vp test` green.
4. Open the removal PR on the Remix side only once step 1 has landed, so the
   framework is never in a state where `remix/tui` points at nothing.

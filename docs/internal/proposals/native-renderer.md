# A native renderer for `remix/ui`

Status: draft, unscheduled. Nothing here is committed to a release. No code
exists yet.

`remix/ui` grew a host-agnostic renderer. `createRenderer(host)` takes nine
operations and mounts a Remix tree onto any node graph, with no DOM anywhere in
the path. This proposes `@pitlane/native`: an implementation of those nine
operations against real iOS and Android views, so a Remix 3 component tree
paints `UIView` and `android.view.View` instead of `HTMLElement`.

```tsx
// app/App.tsx
import { on } from "remix/ui";
import { View, Text, Pressable } from "@pitlane/native";

function Counter(handle) {
    let count = 0;
    return () => (
        <View style={{ padding: 24 }}>
            <Text>Taps: {count}</Text>
            <Pressable
                mix={[
                    on("press", () => {
                        count++;
                        handle.update();
                    }),
                ]}
            >
                <Text>Tap me</Text>
            </Pressable>
        </View>
    );
}
```

That tree is real native views. The component is ordinary `remix/ui`: same
`handle`, same `mix`, same `on()`.

## The seam this depends on

`@remix-run/ui` publishes `./renderer` as a first-class subpath, separate from
`.` (DOM) and `./test`:

```ts
export { createRenderer } from "./runtime/universal/renderer.ts";
export type {
    Renderer,
    RendererHost,
    RendererRoot,
    RendererRootEventMap,
} from "./runtime/universal/host.ts";
```

`RendererHost<node, element>` is `createElement`, `createText`,
`createComment`, `setText`, `patchProp`, `insert`, `remove`, `parentNode`,
`nextSibling`, plus optional `commit(container)` and
`getEventTarget(element)`. That is the entire contract. The five files behind
it total 1798 lines and reference no DOM global: a grep across
`runtime/universal/` for `document`, `window`, `Node`, `HTMLElement`,
`customElements`, and `requestAnimationFrame` returns nothing but a doc
comment. Its own test suite drives it against a hand-rolled plain-object tree.

`@remix-run/tui` already implements the contract for a terminal, in 1164
non-test lines across eight files, of which `lib/host.ts` is 380. That is the
existence proof and the file to read first.

Two limits of the universal path, both load-bearing here:

- `<Frame>` is rejected outright (`FRAMES_UNSUPPORTED`,
  `universal/reconcile.ts:46`). There is no hydration and no SSR. A native
  target is client-rendered, full stop.
- A host without `getEventTarget` does not degrade. It throws
  `implement host.getEventTarget`, asserted at
  `renderer.mixins.test.tsx:523`. No `getEventTarget` means no `mix`, so no
  `on()`, no `ref()`, no styled components. It is required, not optional.

## Why React Native's renderer, and not Lynx

Two engines can host this. Lynx (ByteDance) exposes an Element PAPI documented
for framework authors, so a `RendererHost` maps onto it cleanly. React Native's
Fabric exposes `nativeFabricUIManager` as a JSI global, and React's renderer is
one client of it.

The decision does not turn on the renderer. It turns on what you get above it.

|                                       | Lynx                                                                                                                | React Native / Fabric                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Host contract fit                     | good: `__CreateElement`, `__InsertElementBefore`, `__FlushElementTree`                                              | equally good, plus a real anchor primitive                          |
| Positional anchor for `createComment` | no primitive. `__CreateNonElement` does not exist (0 hits in `lynx-stack`); `__CreateWrapperElement` is the closest | `createAnchor()`, built for exactly this                            |
| Prop routing                          | hand-written `on*` split, class/style/dataset routing                                                               | `routeProp()` decides prop-vs-event from the ViewConfig             |
| Recycling list                        | own milestone. Naive implementations hit `global reference table overflow (max=51200)` on Android                   | `FlatList` / `VirtualizedList` already exist framework-agnostically |
| Navigation containers                 | `LynxUI<T>` hands you a `UIView`. `UINavigationController` containment is yours to write                            | `react-native-screens`, wrapped framework-agnostically already      |
| Widget vocabulary                     | write `LynxUI` subclasses per control, plus a CocoaPods release train                                               | `UISwitch`, `UISlider`, maps, WebView are `npm install`             |
| Runtime globals                       | none. `EventTarget` / `Event` / `AbortController` need shims                                                        | `setUpDOM()` installs most of them                                  |

The two hardest items in a Lynx plan (list recycling, and view-controller
containment for navigation) are solved upstream on the RN side by packages with
years of production use. That is the whole argument.

### SymbioteNative

[SymbioteNative](https://github.com/OneEyed1366/symbiote-native) (MIT) extracts
Fabric's JS seam so a non-React renderer can drive it, and ships five adapters
(React, Vue, Angular, Svelte, Solid) over one engine. Its mutation API is what
`@pitlane/native` would target.

| `RendererHost`                    | `@symbiote-native/engine`                      |
| --------------------------------- | ---------------------------------------------- |
| `createElement(type, props)`      | `createElement(component, isText, tag)`        |
| `createText(text)`                | `createRawText(text)`                          |
| `createComment(label)`            | `createAnchor()`                               |
| `setText(node, text)`             | `setText(node, text)`                          |
| `patchProp(el, name, prev, next)` | `routeProp(node, name, value)`                 |
| `insert(node, parent, before)`    | `insertBefore` / `appendChild`                 |
| `remove(node)`                    | `removeChild(parent, node)`                    |
| `parentNode` / `nextSibling`      | `node.parent` / `node.children`                |
| `commit(container)`               | `surface.requestCommit()`, microtask-coalesced |

The tree is a retained mutable JS object graph, so `parentNode` and
`nextSibling` are property reads rather than calls across a thread boundary.
`toPublicInstance(node)` grafts `measure` / `setNativeProps` / `focus` onto the
node without changing its identity, which is what `ref()` should hand a caller.

Model the adapter on the Vue one, not the Solid one. Solid's
`adapters/solid/src/renderer.ts` is a Babel compiler target with a hard
eleven-name export contract ("drop one and the app fails to bundle"). Vue's is a
plain `createRenderer` plus nodeOps, called by the adapter per mount. `remix/ui`
uses a standard automatic JSX runtime and wants the second shape.

### What the engine already absorbs

Fabric is persistent: every change clones the node with new props and commits a
new child set. `remix/ui` mutates in place. That translation lives once, in the
engine, and is shared by all five existing adapters. `@pitlane/native` would be
the sixth client of code four other frameworks already exercise.

`@symbiote-native/components` holds framework-agnostic component logic behind a
`descriptorFor(tag)` lookup, consumed through a per-framework
`descriptor-to-<framework>.ts` bridge. Writing `descriptor-to-remix.ts` is what
buys `FlatList`, `Pressable`'s press machine, and `KeyboardAvoidingView`.

## The runtime globals mostly exist already

The universal renderer needs Web platform constructors that are not DOM:
`EventTarget` (`scheduler.ts:104`), `Event`, `ErrorEvent`
(`error-event.ts:15`), `AbortController` and `AbortSignal.abort()`
(`component.ts`, `on-mixin.ts:30`, `ref-mixin.ts:14`), `DOMException`
(`on-mixin.ts:33`), and `queueMicrotask` (`scheduler.ts:111`).

React Native's `src/private/setup/setUpDOM.js` installs, as real globals:

```
CharacterData  CustomEvent  DOMRect  DOMRectList  DOMRectReadOnly
Document  Element  Event  EventTarget  HTMLCollection  HTMLElement
Node  NodeList  Text
```

`queueMicrotask` is in Hermes. That leaves `ErrorEvent` and `DOMException`,
about fifty lines between them, against roughly four hundred for a from-scratch
shim on an engine that ships none of it.

One consequence to design around: RN also installs `Element` and `HTMLElement`.
`remix/ui`'s `EventMap<target>` conditional type (`event-types.ts:38`) resolves
`HTMLElement`-shaped targets to `lib.dom` event maps. Native element classes
must extend `TypedEventTarget<OwnMap>` and must not be structurally `Element`,
or `on()` infers the wrong event types. Cheap to get right, silent to get
wrong.

## Vite, not Metro

Pitlane's build tooling is Vite. Metro is not a requirement of the native side,
and for a non-React renderer it is actively worse than nothing.

### What the native host actually demands

Production, from `scripts/react-native-xcode.sh`, is one line that matters:

```sh
"$HERMES_CLI_PATH" -emit-binary -out "$DEST/$BUNDLE_NAME.jsbundle" "$BUNDLE_FILE"
```

`hermesc` compiles whatever JS file lands at `$BUNDLE_FILE`. It has no Metro
dependency. The release lookup in `RCTBundleURLProvider.mm` is
`[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"]`.
Rolldown emitting a single file, then `hermesc`, is the whole production path.
A monolithic bundle is not the startup cost it would be on the web: Hermes
bytecode is mmap'd and pages in lazily, which is why RAM bundles were retired.

Development is five endpoints:

| Endpoint                           | Contract                                     |
| ---------------------------------- | -------------------------------------------- |
| `GET /status`                      | the literal string `packager-status:running` |
| `GET /index.bundle?platform=&dev=` | the bundle, with `If-Modified-Since` honored |
| `GET /assets/*`                    | raw asset bytes                              |
| `POST /symbolicate`                | `{stack}` in, `{stack, codeFrame}` out       |
| `WS /hot`                          | Metro's HMR protocol                         |

Skip the last one.

### Metro's HMR does not work here anyway

From SymbioteNative's own Solid example config:

```js
// Metro's HMR runtime then hands the update to performReactRefresh, which walks
// React's Fiber tree for live instances to patch; this adapter never registers one
// (no react-reconciler in the path), so the update is silently swallowed.
unstable_forceFullRefreshPatterns: [/\.tsx$/],
```

Every non-React adapter on Metro takes a full reload on every edit. The `/hot`
protocol ships literal `__d(factory, id, deps)` source text keyed to a global
numeric module-id space, and routes it to React Refresh. There is no seam for a
renderer with no fibers.

`@pitlane/dev` already has component and server-data HMR. Metro is the thing
preventing its use. That reframes the largest apparent obstacle: reconciling
Rolldown's ESM chunks with Metro's `__d`/`__r` numeric-id wire format is
genuinely hard, and it is work nobody needs to do, because the protocol being
replaced is one that does not function for this renderer.

### The Flow problem, and how small it turns out to be

`react-native` ships raw, untranspiled Flow on npm. Verified against
`unpkg.com/react-native@0.87.1/Libraries/Image/Image.ios.js`: `@flow
strict-local` pragma, `import type`, live annotations, as published. Oxc (Vite
8's parser) reads JS, TS, JSX, and TSX. Not Flow. esbuild closed Flow support
as wontfix in 2020.

The mitigations are known. SWC has first-class `jsc.parser.syntax: "flow"`;
`hermes-parser` and `flow-remove-types` strip without a full Babel pass; Re.Pack
solves it with `hermes-parser` in its own loader. Any of them works as a Vite
`transform` hook scoped to `node_modules/react-native`, cached by the dep
optimizer.

What makes it tractable rather than dominant is how little RN JS a
SymbioteNative app pulls in. The engine's `package.json` declares no
dependencies at all, only a `peerDependencies` entry for the native side.
Across all of `core/` and `adapters/`, there are six non-test imports from
`react-native`, all in `bootstrap.ts` files behind a separate `./bootstrap`
subpath export, and every one is injectable:

```ts
setColorProcessor()  setDeviceEventSource()  setImageSourceResolver()
setNativeViewConfigSource()  setHostRegistrar()
```

Their own comment explains the arrangement: "react-native's own source is Flow
syntax Vitest's transform can't parse, so anything importing it directly must
stay unreachable from the tested main index.ts." The whole engine and all five
adapters run under Vitest without ever parsing Flow.

The app still needs `react-native/setup-env` at runtime, because that is what
installs the globals above and `AppRegistry.runApplication`, which native calls
into. So the Flow surface shrinks to a thin slice rather than disappearing.

### What `@pitlane/native-vite` has to build

| Piece                                          | Notes                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Flow pre-pass over `node_modules/react-native` | SWC or `hermes-parser`, cached                                                                  |
| Platform extension resolution                  | `.ios.ts` then `.native.ts` then `.ts`, plus the `react-native` export condition                |
| Asset plugin                                   | `require("./img.png")` to `AssetRegistry.registerAsset`, `@2x`/`@3x`, dev serving, release copy |
| Dev middleware                                 | the four endpoints above                                                                        |
| Production build                               | single file, then `hermesc` in a replacement Xcode build phase                                  |
| CSS                                            | replaces SymbioteNative's Metro transformer with a Vite plugin                                  |

`setup-env` ordering is easier here than in Metro, which guarantees it with a
`serializer.getModulesRunBeforeMainModule` hook. A static
`import "react-native/setup-env"` first, marked side-effectful, is enough.
Haste is dead in modern Metro and needs no port. Inline requires are a
cold-start trick specific to CJS; route-level `import()` is the ESM answer.

No maintained project bundles a native React Native app with Vite today. Re.Pack
(`@callstack/repack@5.3.0`, MIT) proves the shape is buildable, for webpack and
Rspack, and it is the reference to read. This would be the first for Vite.

## Apple platform reach

SymbioteNative is iOS and Android only: every platform-forked module in the
engine has exactly two branches, and `IPlatformOSType` names `macos` without
anything implementing it. The reach question is therefore about the out-of-tree
React Native distributions.

| Platform | Distribution                                 | State                                                                                                                                                                 |
| -------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tvOS     | `react-native-tvos@0.87.1-0` (2026-09-01)    | tracks upstream 0.87.1 (2026-08-26) within the week; consumed by npm alias, so the `>=0.86` peer floor is met; README states Fabric fully implemented, Hermes default |
| macOS    | `react-native-macos@0.81.9` (npm, July 2026) | roughly six minors behind, below the peer floor; additive out-of-tree platform, so it needs an import remap; Fabric present but never declared complete               |
| visionOS | `@callstack/react-native-visionos@0.79.x`    | stalled at RN 0.79 since mid-2025                                                                                                                                     |
| watchOS  | none                                         | see below                                                                                                                                                             |

tvOS is close to free. RN reports it as `Platform.OS === "ios"` with
`Platform.isTV === true`, and the engine already implements an `isTV` getter in
`platform/index.ios.ts:76` with a test behind it. The real work is the focus
engine: `TVFocusGuideView`, `TVEventHandler`, `focusable`,
`hasTVPreferredFocus`, and a focus style state.

macOS is worth parking behind a platform-table entry in the resolver plugin,
revisited when the fork crosses 0.86. RN 0.82 made the New Architecture
mandatory and neither macOS nor visionOS has reached it.

### watchOS is not buildable, by anyone

Two independent blockers, both at the engine level. Hermes's own Apple build
script (`utils/build-apple-framework.sh`) hardcodes its targets:

```
PLATFORMS=("macosx" "iphoneos" "iphonesimulator" "catalyst"
           "xros" "xrsimulator" "appletvos" "appletvsimulator")
```

No `watchos`. And Apple's own availability metadata for JavaScriptCore reads
iOS 16.0+, iPadOS 16.0+, macCatalyst 13.0+, macOS 10.5+, tvOS 9.0+, visionOS
1.0+. watchOS is absent there too. Apple ships no JS engine on watchOS, so this
is not a porting gap that effort closes.

There is a partial answer, covered next.

## Widgets, Live Activities, and SwiftUI

Expo SDK 57 ships `expo-widgets`, which authors WidgetKit widgets and Live
Activities in TSX. Reading its source changes what is worth building here.

The mechanism, from `ios/Widgets/WidgetsJSRuntime.swift`:

```swift
import JavaScriptCore
guard let context = JSContext() else { return nil }
context.evaluateScript(script)                                    // ExpoWidgets.bundle
context.setObject(layoutValue, forKeyedSubscript: "__expoWidgetLayout")
let function = context.objectForKeyedSubscript("__expoWidgetRender")
let result = function.call(withArguments: [props, environment])
```

JavaScript runs inside the widget extension, on JavaScriptCore rather than
Hermes. JSC is a system framework, so it costs no binary weight and needs no
port. A Babel plugin (`babel-preset-expo/src/plugins/widgets-plugin.ts`)
serializes the `'widget'`-directive function to source text; the app writes it
plus JSON props into an App Group container; the extension evaluates it and
gets back a plain `{type, key, props}` tree, which `DynamicView.swift` walks
into real SwiftUI.

It is not a reconciler, and it cannot be. WidgetKit runs a timeline of
precomputed snapshots in a memory-capped process with no persistent event loop,
so there is nothing for `insert` and `setProp` to mutate. A pure function of
props and environment is the only shape that fits, and it is the shape Expo
built.

The finding that matters: React is stubbed out. The widget bundle resolves
`react` to an 894-byte stub, `react/jsx-runtime` to a 1.6 KB stub that builds
`{type, key, props}` and flattens children, and `react-native` to
88 bytes. The contract a framework must meet is a JSX runtime emitting that
node shape, function components invoked eagerly, a SwiftUI element vocabulary,
and a top-level function serializable to source text. Nothing about it is
React-specific, and nothing about it touches Fabric.

That last point decouples this from every other decision in this document. The
widget extension contains no React Native. Whether the app renderer is
SymbioteNative or something else does not affect whether widgets can ship.

### The convergence worth planning around

`DynamicView.swift` delegates to `ExpoUI`'s SwiftUI view and props types, the
same ones `@expo/ui` exposes to an app as Fabric leaves via `requireNativeView`,
rooted in a `UIHostingController`. Expo built one SwiftUI vocabulary and used it
three ways.

Build that vocabulary once and the same three payoffs follow:

1. In-app SwiftUI components, each an opaque Fabric leaf whose props land on an
   observable record that SwiftUI re-renders from. This is the only viable
   bridge shape: SwiftUI views are value types with compiler-synthesized
   builder trees and no runtime insert primitive, so Fabric's mutations have to
   stop at the boundary of each primitive.
2. Home screen widgets, via a JSContext and a tree interpreter reusing the same
   views.
3. Live Activities, same runtime, different SwiftUI host.

JavaScriptCore is available on macOS, tvOS, and visionOS as well as iOS, so
this path reaches further than the Fabric renderer does, and reaches it without
depending on any out-of-tree RN fork. macOS widgets could ship before a macOS
renderer exists.

And `LiveActivityLayout` has a `bannerSmall` slot, documented as "the small
banner content displayed in CarPlay and WatchOS". The phone renders, the system
relays. A Live Activity authored in TSX appears on the watch without any JS
running there, which is probably most of what a watchOS story needs to deliver.

## Package layout

Deliberately split, so each piece can ship, stall, or be replaced alone.

```
packages/
├── native/          # @pitlane/native — RendererHost over the engine, ~500 lines
├── native-vite/     # @pitlane/native-vite — the Vite plugin and dev middleware
├── native-swiftui/  # @pitlane/native-swiftui — SwiftUI primitives as Fabric leaves
└── native-widgets/  # @pitlane/native-widgets — JSContext runtime, tree interpreter, App Group
```

Four packages rather than one with subpaths, because each has a different
release cadence and a different failure mode: `native-swiftui` and
`native-widgets` carry Swift that ships through CocoaPods or SPM, on a train
the npm packages do not share. The umbrella can vend them as `pitlane/native*`
subpaths later, the way the root README already describes.

The renderer is the smallest and least durable piece: nine operations against a
seam that could be re-pointed at `nativeFabricUIManager` directly, or at Lynx,
if SymbioteNative stalls. Keep it small and boring enough that switching
backends is one file.

The Vite plugin is the piece with independent value. It works for stock React
Native apps too, and it is the first Vite native pipeline that exists.

## Fit against the vision

`docs/internal/VISION.md` scopes Pitlane as a meta-framework that takes a Remix
application "from development to production across Cloudflare, Netlify, Vercel,
Railway, Deno Deploy, and plain Node, Bun, or Deno runtimes", and names the
stable contract precisely: "the server entry's default-exported
`.fetch(Request)` handler". An iOS app has no fetch handler. It has a bundle
identifier, a signing certificate, and a review queue. This is the widest
stretch the proposal makes, and it should be settled before any of the rest.

What fits without argument:

- The adapter pattern, as written. "Remix owns the capability interface (e.g.
  `Database` from `remix/data-table`). A Pitlane adapter package supplies the
  concrete implementation." `RendererHost` from `remix/ui/renderer` is a
  Remix-owned interface with no implementation for native views, which is the
  same shape `@pitlane/data-table-d1` has against `Database`.
- Principle 5, Demand Composition. Four single-purpose packages, each usable
  and documented on its own, none requiring the umbrella.
- Principle 3, Runtime When Possible. The renderer is runtime-only and its
  tests need no bundler. `@pitlane/native-vite` is the case the principle
  already carves out: "a package whose stated purpose intrinsically requires
  build-time integration, such as a Vite plugin, may use it directly".
- The explicit non-goals. None of the four are touched. There is no platform
  plugin, no universal CLI, no deploy action, no delegated build.

What strains:

- The Framework table assigns Components, Styles, Animations, and HMR to Remix,
  under "Remix 3 owns every framework-level concern. Pitlane never reimplements
  these." A renderer backend reimplements none of them, but the table has no row
  that describes it either.
- Principle 4, Avoid Dependencies. `react-native` plus four `@symbiote-native/*`
  packages is the largest foundational dependency Pitlane would have taken, and
  it is not one the principle expects to "replace with Pitlane packages over
  time". The clause that permits it, "necessary provider, runtime, and tooling
  dependencies are acceptable along the way", is doing more work here than
  anywhere else in the repo.
- The Deployment boundary table has six rows and all six are web hosts. An App
  Store submission is not composable hosting around a fetch handler, and no part
  of that section generalizes to it.
- The planned package sequence runs to fifteen numbered items with no render
  target among them. These four are a parallel track, not an insertion.

The precedent that resolves it is already in the document. The Framework table
gives Styles and Design system to Remix, and Pitlane ships `@pitlane/theme`
anyway, because the Meta-Framework capability table carries a "Type-safe
styling" row marked Pitlane-native. Remix owns the primitive; Pitlane owns a
typed layer above it; the capability table is where that ownership gets
recorded. A render target is the same move.

So the amendment this needs is small and specific: a Render targets row in the
Meta-Framework capability table, and one sentence extending the portable
boundary from where an application runs to what it paints. Pitlane's own
tagline already reads "the portable boundary is the application, not a
synthesized hosting layer", and the same components rendering to a different
host is that claim taken one step further rather than a different claim.

That amendment should not be argued here. `@pitlane/tui`, proposed separately,
asks the identical question with code that already exists, one dependency, and
no bet on an eleven-week-old project. It is the cheaper place to decide whether
Pitlane hosts render targets at all. If the answer there is no, this proposal
is moot regardless of how well Fabric maps onto nine operations.

## Risks

1. SymbioteNative is eleven weeks old (created 2026-06-20), has 60 stars, one
   fork, one watcher, and roughly 45 weekly npm downloads per package, which is
   the author and CI. Adopting it means being among its first external
   consumers.
2. `global.nativeFabricUIManager` is an RN internal with no stability contract.
   The "never fork" pitch reads better in reverse: consuming an unstable
   internal is a permanent per-release integration tax that one person pays.
3. "The API is settled" does not match the version history. `engine` reached
   0.4.0 across 11 versions in nine weeks; `navigation` reached 3.0.0 across 11
   versions in seven weeks. Two majors. Pin exactly.
4. Device coverage is uneven. The shared Detox `canary-journeys` spec runs for
   React, Vue, and Svelte. Angular has its own harness without it. Solid, the
   adapter closest in shape to what this proposes, has none.
5. Android trails iOS in that project by its maintainer's own description, and
   the canary is the definition of done rather than a parity percentage.
6. A third-party RN package's JS component is React-only by nature, since it
   calls hooks. Non-React adapters reach third-party native views through thin
   wrappers. Cheaper than Objective-C, not free.

Read the SymbioteNative source before trusting any of it. What was sampled is
good: `adapters/solid/src/renderer.ts` documents device-diagnosed failures with
dates, including an `RCTRawText` numeric-coercion SIGABRT and a lowering
divergence on `ellipsizeMode={null}`. The concern is continuity at that
velocity, not craft.

## Open questions

- Whether `css()` maps to a runtime `StyleManagerLike` over the engine's
  `style-registry` (`IClassNameValue`, `IStyleRule`, plus a `css-parser`
  package), or needs a build-time extractor. The registry suggests the first.
  Unverified.
- What `on()`'s capture boolean means on a platform with a responder system
  rather than DOM capture phases.
- Whether `link()`, which reaches for `globalThis.open` and the History API,
  gets a native sibling or a different name.
- Whether the Vite plugin should carry the Pitlane name at all. It works for a
  stock React Native app with no Pitlane renderer in it, and that is a larger
  audience than this proposal has.
- Whether `@pitlane/native-widgets` depends on `expo-widgets` and `@expo/ui`
  (fast, drags in Expo and Metro for one small bundle) or reimplements them
  (the Swift runtime is about 30 KB across thirteen files; the cost is the
  SwiftUI vocabulary, which item 1 of the convergence needs regardless).

## First step

One spike, before any package scaffolding, in this order:

1. Run `examples/vue-tsx` from the SymbioteNative repo on a simulator.
   Confirm the premise with your own eyes.
2. Write `createRemixHost(surface)`: nine operations over `createElement`,
   `createRawText`, `createAnchor`, `setText`, `routeProp`, `insertBefore`,
   `appendChild`, `removeChild`, with `commit` calling
   `surface.requestCommit()`, and element wrappers extending
   `TypedEventTarget`.
3. Wire `setEventListener` to re-dispatch a real `Event` on the wrapper, and
   return that wrapper from `getEventTarget`.
4. Render the `remix` repo's TUI counter demo, unchanged except for intrinsics,
   on a physical iPhone. Tap it.
5. Then the two questions that decide the rest: mount an
   `@symbiote-native/navigation` stack from `remix/ui`, and bridge one
   `@symbiote-native/components` descriptor (`FlatList`) through
   `descriptor-to-remix.ts`.

If step 5 works, everything above the renderer is grinding. If it does not, the
blocker cost a day.

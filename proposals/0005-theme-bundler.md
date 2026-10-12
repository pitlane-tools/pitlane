---
id: proposal.0005
title: Theme Bundler Optimization Through Airfoil and Mapper
authors: [Mark Malstrom]
status: draft
pull-request: https://github.com/pitlane-tools/pitlane/pull/49
issues: []
supersedes: []
---

# Theme Bundler Optimization Through Airfoil and Mapper

## Summary

Add optional bundler optimization to `@pitlane/theme`, using complete Tailwind-to-theme migrations of Airfoil and Mapper as the proving ground. Measure CSS and JavaScript before migration, after migration without optimization, and after optimization, while preserving appearance, interaction, server rendering, and consumer customization.

## Motivation

Airfoil needs a styling system that composes with Remix and Pitlane without requiring Tailwind in every consuming application. Mapper exercises the downstream cost of adopting that system, including server-rendered components, interactive browser components, and application-owned styling. Both repositories must end without a Tailwind dependency; leaving Mapper's own utility classes behind would not satisfy this change.

A runtime styling API can move bytes between CSS, JavaScript, and rendered HTML. A smaller stylesheet alone cannot establish a smaller application. We need reproducible measurements of the migration cost and the optimization benefit rather than a presumed bundle-size increase or an unsupported claim of zero runtime cost.

This is one migration-driven optimization effort: Airfoil and Mapper supply the real authoring patterns and distribution boundary against which the bundler contract is judged. Their migrations are deliverables, not optional demonstration snippets.

## Domain grounding

### Established context

- [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files) scans text rather than JavaScript reachability. Dependencies require explicit source registration. A scan of a library directory and a bundler's reachable module graph answer different questions.
- [Rollup tree-shaking semantics](https://rollupjs.org/configuration-options/#treeshake) distinguish unused exports from observable module effects and property reads. Declaring everything side-effect-free is not a safe substitute for understanding initialization. The actual Vite+/bundler versions used in these repositories must be tested; Rollup documentation is conceptual grounding, not evidence of their exact output.
- [CSS custom properties](https://www.w3.org/TR/css-variables-1/) participate in the cascade and can reference other custom properties. A used semantic token can require otherwise unreferenced primitive declarations. Modes and inheritance make deleting declarations different from deleting unused JavaScript exports.

### Relevant constraints and principles

`@pitlane/theme` remains runtime-first. Bundling is an optional optimization, not a prerequisite for authoring, rendering, or testing a theme. Existing validation, `raw`, derivation, nonce handling, and mode behavior remain meaningful contracts.

A token, a CSS declaration, a component style rule, a JavaScript module, and a delivered asset are different things. Reachability belongs to a build and its entries, not permanently to a theme. A library cannot decide which of its exported components a future application will use. A server-only component can require delivered styles without requiring browser component code.

Unknown usage is not unused usage. Dynamic token lookup, escaped theme objects, runtime variants, CSS custom-property references, and externally supplied overrides require conservative retention unless a sound bound is available. Reordering or extracting rules must preserve cascade and mixin precedence.

### Quality bar

The optimized application must behave like the migrated runtime application, including states not visible on initial render. A savings claim must identify its comparison, artifact boundary, and compression method. A zero-byte CSS file is not a success if the same styles moved into JavaScript or HTML.

### Remaining uncertainty

The exact static-authoring subset, opt-in API, and whether static component-style extraction belongs in this first bundler contract need human agreement. They are recommendations below, not approved architecture. No baseline builds or bundle measurements have been performed for this proposal; existing local build output is not measurement evidence.

## Existing baseline

### Pitlane

At the inspected baseline, `@pitlane/theme` is version 0.4.4. `packages/theme/package.json` exports the root, schema, default, and DTCG entry points, with no bundler entry point. `packages/theme/src/theme.ts` validates the token tree, constructs accessors and lookup maps, serializes all declarations and mode blocks, and returns runtime derivation methods. `<Theme />` renders inline CSS and carries `$theme` authoring information. `packages/theme/src/css.ts` normalizes style objects before forwarding them to Remix's CSS mixin.

This preserves a useful no-build contract. It also means ordinary module tree-shaking cannot be assumed to remove unused members of a compiled theme or all initialization machinery. The existing `select` API is explicit author selection, not application-level automatic elimination.

### Airfoil

`~/Developer/Libraries/airfoil/package.json` identifies source version 0.3.0. It exposes component subpaths, a `theme.css` entry, styling helpers, and registry content. Its publishing configuration maps source entries to compiled distribution files. It depends on `cva` and `tailwind-merge`, installs the Tailwind Vite plugin, and declares Tailwind as a peer dependency.

The migration must cover exported components, registry compositions, and Airfoil's own showcase—not just the subset Mapper happens to import. Existing class-based customization must be translated deliberately; deleting `tailwind-merge` without migrating caller overrides changes behavior.

### Mapper

`~/Developer/Projects/mapper/app/index.css` imports Tailwind and Airfoil's theme stylesheet and registers Airfoil's distribution with `@source`. It overrides the dark variant to follow the document's `.dark` class because the map uses a fixed dark basemap. Mapper also authors its own utility classes and passes utility overrides to Airfoil components. These are all migration inputs.

The inspected installed Airfoil dependency is 0.2.1, whereas the Airfoil source checkout is 0.3.0. Comparing those directly would mix a library-version change with the styling migration. The benchmark must establish a shared Airfoil source baseline first and record any changes needed to make Mapper consume it.

Mapper also uses MapLibre styling. That stylesheet is not Tailwind and remains in scope for total application byte accounting, but not as an optimization target. Existing generated output may be stale and must not be reused as the baseline.

## Proposed solution

Recommended direction: an optional Vite integration owned by `@pitlane/theme`, with build-time handling of statically understood theme declarations and component styles, conservative retention for dynamic behavior, and ordinary ESM tree-shaking for the resulting JavaScript. It composes with `@pitlane/dev` rather than becoming mandatory inside it.

Use complete, visually equivalent migrations of Airfoil and Mapper to identify the needed authoring support. Preserve a runnable migrated version without the plugin as the control. Then optimize that same source and measure the difference. Do not rewrite the benchmark application to make an unsupported optimizer look effective.

The recommendation is subject to the design choice in Open questions. No API name or syntax in this draft is a committed public interface.

## Detailed design

### Migration contract

Convert all first-party Airfoil component, composition, and showcase styling, and all Mapper application styling, to `@pitlane/theme` tokens and style composition. Preserve layout, typography, spacing, colors, responsive behavior, dark-mode selection, interactive states, animations, and accessibility behavior. Do not redesign either product as part of the migration.

Inventory Tailwind utilities, theme declarations, preflight-dependent defaults, arbitrary values, state selectors, container/media queries, animation definitions, and consumer overrides before conversion. Replace the needed reset/base behavior explicitly; removing Tailwind's reset without replacing relied-on defaults is a visual regression. Retain unrelated third-party stylesheets such as MapLibre's.

Airfoil must expose a usable theme contract to consumers and preserve component-level customization through Remix-compatible style composition. Migrate Mapper's `class` utility overrides to that contract. Ordinary class names may remain for semantic hooks and authored stylesheet interoperability, but no remaining class may rely on Tailwind generating its styling. Resolve the exact public customization interface before implementation approval.

Remove Tailwind dependencies and peer dependencies, its Vite plugins, `tailwind-merge`, obsolete utility-merging helpers, Tailwind imports/directives, and corresponding configuration from both repositories. Replace `cva` usage with theme variant composition where it serves this migrated styling; remove it when no callers remain. Update manifests, lockfiles, exported styling entry points, registry output, setup instructions, and every in-repository consumer. Do not retain a parallel Tailwind implementation or compatibility shim in the shipped result; immutable baseline revisions supply the comparison.

### Optimization contract

The integration must work for Airfoil's own application build and for Mapper consuming a built Airfoil artifact, not only through local source aliases. Library output must preserve information needed by the final consumer build without treating every exported component as used in that consumer. The Airfoil package's complete export surface remains usable.

For statically supported declarations, remove unused token declarations and their unused authoring/compilation JavaScript. Retain the transitive closure of referenced custom properties, including references inside composite values and mode overrides. Preserve scale references, selector and media conditions, `light-dark` behavior, source ordering where significant, and separate theme identities. A collision or invalid theme must not become silently valid because an optimizer ignored its offending portion.

Static component styling must not retain unreachable components' CSS or JavaScript merely because they share a package or theme. Dynamic variants that remain possible at runtime must remain functional. Server-rendered usage and lazy browser entries contribute their style requirements even when their component JavaScript is absent from the initial browser bundle. Never import server-only code into a browser build to discover styles.

Build-time evaluation must not execute arbitrary application modules with network, filesystem, database, or request side effects. The supported static forms and their failure/retention behavior must be documented. Unsupported dynamic forms retain correct runtime behavior with an actionable explanation of why they could not be optimized; they are not silently treated as dead.

Preserve runtime `raw`, `extend`, `select`, `$theme` re-derivation, and reflective usage where used. Their presence can require retaining data that a static-only caller does not need. Do not remove these APIs globally to meet a size target. Preserve no-plugin operation, development updates, server rendering, hydration, CSP nonce behavior, and stylesheet loading before dependent content paints.

The exact transform boundary and delivery mechanism remain an explicit design question. The approved revision must specify them sufficiently to derive fixtures for static and dynamic forms, rather than promising arbitrary JavaScript evaluation.

### Comparable benchmark matrix

Use three conditions for each measured surface:

| Condition | Styling                                          | Theme bundler optimization |
| --------- | ------------------------------------------------ | -------------------------- |
| T         | Existing Tailwind implementation                 | Not applicable             |
| R         | Complete `@pitlane/theme` migration, no Tailwind | Disabled                   |
| O         | Exactly the same migrated source as R            | Enabled                    |

Measure Airfoil's full showcase production build, its distributable package, and Mapper's production application consuming the corresponding built Airfoil package. Distinguish the complete library artifact from bytes delivered by an application; an export-complete package is not expected to shrink as if only Mapper's components existed. Add a fixed small consumer fixture for demonstrating unused-component elimination that a full showcase cannot expose. This fixture supplements, never replaces, measurements of the real applications.

Establish one Airfoil baseline revision that works in both the showcase and Mapper before recording T. If upgrading Mapper from its currently installed Airfoil version changes behavior or size, report that separately; do not attribute it to theme adoption. Pin repository commits, dependency resolutions, runtime and package-manager versions, build commands, production mode, target, minifier, sourcemap settings, and compression options. Install equivalent packed artifacts for T, R, and O rather than comparing a package install with a source alias.

Record raw/minified output bytes, gzip bytes, and Brotli bytes for CSS and JS separately. Compress each delivered file independently with fixed documented settings, then sum; do not report compression of one concatenated bundle as network cost. Report `R − T` as migration cost, `O − R` as optimization effect, and `O − T` as final adoption cost, with both absolute and percentage deltas. A zero baseline has no percentage; report it as not applicable. Negative deltas are savings, not an error.

For applications, report total unique browser CSS/JS across the build, initial-route transferred CSS/JS, and incremental lazy-route or interaction loads, deduplicating shared assets within each scenario. Report server JS separately; never mix server and browser totals. Keep unrelated dependencies in total application measurements, with attribution shown separately rather than subtracting them from the headline total.

Account separately for inline styles in response HTML, inline scripts, and runtime-inserted style rules at fixed interaction checkpoints. Styles embedded in JS remain counted in JS transfer bytes; their decoded CSS size is a diagnostic and must not be added again to transfer totals. Include HTML transfer size to expose moving CSS out of files and into documents. Exclude sourcemaps, caches, source files, icon/image/font assets, and report tooling from CSS/JS sums; document those exclusions and keep unchanged assets fixed.

Run fresh builds from isolated clean worktrees or equivalent disposable directories, never destructive cleanup of the user's working checkout. Record commands, revisions, artifact hashes, file-level measurements, and machine-readable results alongside the human-readable comparison in the implementation PRs. Repeat each condition to detect nondeterministic output; explain differences before interpreting a delta. Do not invent a numerical size budget before measuring the baseline.

### Behavioral proof and delivery sequence

First freeze and measure T. Next migrate Airfoil and Mapper completely and establish R with visual and interaction parity. Then implement the bundler contract and measure O from the same migrated source. Earlier stages may expose design conflicts; changes to this contract return to the proposal rather than being concealed by narrower benchmarks.

Exercise the Airfoil showcase and registry compositions across their supported states. Exercise Mapper's map chrome, server-rendered panels, chat, loading/error/empty states, menus and dialogs, keyboard focus, responsive layouts, and dark-mode behavior using fixed data. Compare optimized and unoptimized theme builds as well as the Tailwind reference. Verify a server-only component still has styles, a lazy component gets styles when loaded, and runtime variant changes do not lose rules.

Permanent behavior tests cover plausible elimination failures: retained-reference closure, mode-only references, dynamic access, exported library consumers, server/browser separation, and observable style precedence. Real-browser comparison and built-package installation are required in addition to tests. A size reduction caused by a missing component, state, reset, or stylesheet fails validation.

Before implementation readiness, publish the complete measurement matrix and explain retained runtime costs and cases that cannot be optimized. Demonstrate actual CSS and JS elimination with controlled unused inputs, not merely a smaller total caused by unrelated dependency changes. The human evaluates the measured adoption cost; this draft promises honest measurements, not that theme must beat Tailwind in every cell.

## Compatibility

The Pitlane integration is opt-in and preserves existing runtime authoring behavior. Airfoil's removal of a Tailwind peer and utility-based customization changes its consumer styling contract; its new theme setup and customization interface require migration guidance and an appropriate release note. Mapper migrates every affected caller in the same coordinated effort. No release, cross-repository merge, or publication is authorized by approval to draft this proposal.

## Implications on adoption

Theme users without a bundler continue using the runtime package. Optimizing applications add the chosen integration to their supported Vite configuration. Airfoil consumers install the migrated package and theme dependency, initialize its theme as documented, and use the new customization contract instead of Tailwind utilities. Mapper removes Tailwind entirely, not just Airfoil's source registration. Exact version floors follow the selected integration and must be recorded before approval.

## Scope

- Optional theme bundler optimization of unused CSS and JS, with runtime compatibility and built-library consumption.
- Complete Airfoil and Mapper styling migrations and Tailwind removal, including first-party registry/showcase surfaces and consumer customization.
- Reproducible CSS/JS benchmark matrix, behavioral verification, guides, migration instructions, and package changesets where appropriate.

### Out of scope

- Visual redesign, component feature additions, application data/transport rewrites, or MapLibre styling replacement.
- A generic optimizer for arbitrary third-party CSS or every JavaScript framework.
- Shipping and maintaining two Airfoil styling backends.
- Building a new preview service, publishing releases, or changing unrelated package versions.

## Preview

- Package artifact: the `pkg-preview.yml` build of `@pitlane/theme`, installed using `https://pkg.pr.new/pitlane-tools/pitlane/@pitlane/theme@<sha>`. Exercise it in both consumer builds and in the built-Airfoil fixture; green CI alone is insufficient.
- Guide artifact: the existing Workers preview from `preview.yml`, showing the integration and migration guidance when implemented.
- Airfoil and Mapper: use their actual migrated applications for local behavioral review and attach reproducible benchmark evidence to the linked implementation PRs. A public deployment of either private consumer repository is not assumed or required. Pitlane's package and docs preview URLs are publicly accessible; do not publish private consumer sources or data in them.
- This proposal-only change has no changed executable surface and needs no behavioral preview yet.

## Policies and decisions checked

- `VISION.md`, runtime/build-time distinction and theme section: keep runtime operation independent of the optional integration; preserve typed tokens and Remix composition.
- `policies/`: no numbered policies exist at drafting time.
- `decision.0001`, Static Documentation Delivery, currently proposed: applies to pitlane.tools, not consumer rendering architecture. Any changed guides continue using its existing static documentation delivery; this work does not change that decision.

## Future directions

Other bundlers could implement the same semantic contract once the Vite path is proven. They are not required to migrate these two repositories and are not promised here.

## Alternatives considered

1. **Recommended: static theme and component-style optimization with conservative runtime retention.** Addresses both authoring machinery and delivered styles while keeping runtime APIs. Requires an explicit supported subset and careful Remix rendering integration.
2. **Token precompilation and pruning only, leaving component styles entirely runtime-driven.** A smaller integration boundary that may remove theme compilation and unused tokens, but does not by itself establish the full component-style extraction benefit. Choose this only by explicitly agreeing that boundary, not by silently narrowing the work.
3. **Explicit generated stylesheets or a second build-only authoring API.** Can make output predictable but risks a parallel authoring model and duplicated application code. It is less aligned with the existing runtime-first contract; any use would need a clear reason it cannot be expressed as an optional optimization.

Keeping Tailwind in Mapper is not an alternative in this scope: complete removal from both repositories is part of the agreed request.

## Open questions

- [NEEDS CLARIFICATION: Which optimization boundary should this proposal settle on: the recommended static theme plus component-style optimization with conservative runtime retention, token-only precompilation/pruning, or an explicit build-only authoring boundary? After selection, specify its public API, supported static forms, CSS delivery, and exact toolchain compatibility before approval.]
- [NEEDS CLARIFICATION: Should Airfoil consumer overrides use standard Remix mix composition with theme css/tva, or does Airfoil need a distinct typed style/slot customization API? Recommend existing Remix composition, provided its precedence and component-root forwarding meet the current override use cases.]

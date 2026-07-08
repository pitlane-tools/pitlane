# @pitlane/theme — Design

**Date:** 2026-07-08
**Status:** Approved
**Package:** `@pitlane/theme` v0.1.0 — the first published Pitlane package

## Overview

`@pitlane/theme` is type-safe styling with design tokens for Remix 3. `createTheme` ingests a
[W3C DTCG design-token document](https://www.designtokens.org/tr/drafts/format/) and produces a
branded token accessor plus a `<Theme />` component that installs the tokens as CSS custom
properties. Module-level `css`, `tva`, `cx`, and `combine` helpers provide brand-enforced styling
on top of remix/ui's `css()` mixin and `mix` prop.

Prior art synthesized here:

- **Gist sketch** (vision doc §"Type-safe styling"): DTCG config in; token accessor, `Theme`,
  `tva`/`cx`/`combine` out.
- **remix-fork `remix/ui/theme`**: `<style>`-rendering theme component, `:root` var serialization.
- **maitre-d `create-theme.tsx`**: same-shape object traversal with `var()` leaves, kebab-cased
  var names.

Divergences from the gist, decided during design review:

1. No string token paths. The accessor is object traversal with **branded** leaves; `$.css()` is
   replaced by a module-level `css()` typed against the brands (it no longer needs the theme's
   config type).
2. `tva`, `cx`, `combine` are module-level exports, not `createTheme` returns — they carry no
   theme state.
3. `createTheme` gains a `modes` option (dark mode).
4. `raw` is a sibling return of `createTheme`, not `$.raw` — a `raw` key on the accessor would
   collide with a legitimate top-level DTCG group named `raw`.

## Goals

- One authoring format: branded token references used everywhere (standalone and in `css()`).
- Design-system enforcement: token-mapped CSS longhands reject off-palette literals at the type
  level.
- Spec-pure token documents: no vendor extensions required for any feature, including modes.
- Zero runtime dependencies; `remix` as the only (peer) dependency.
- Pure runtime architecture: no build step, no codegen, works in any Vite/Workers/Node context.

## Non-goals (v1)

- **Typography composite tokens** — requires one-var-per-subproperty and an object-returning
  accessor leaf; deferred.
- **`$extensions` semantics** — parsed and ignored (tolerated, never an error).
- **Attribute-scoped themes** (`[data-theme="dark"]`) and a `selector` option — modes are
  `prefers-color-scheme` only; scoped themes can be added later without breaking the API.
- **Bundled CSS reset** — remix/ui territory, not Pitlane's.
- **Static CSS extraction** — the API is fully static (config in → deterministic CSS out), so a
  future `pitlane/dev` transform can extract at build time with no API change. Not in this
  milestone.
- **The `pitlane` umbrella package** — ships later; all docs import from `@pitlane/theme`.
- **Theme functions** (maitre-d's `spacing(n)`) and value-leaf modifiers — not expressible in
  DTCG; userland concerns.

## Public API

```ts
import { combine, createTheme, css, cx, tva } from "@pitlane/theme";

let { token: $, raw, Theme } = createTheme(
    {
        color: {
            $type: "color", // group-level $type inherits downward
            white: { $value: "#fff" },
            gray: { 50: { $value: "#fafafa" }, 900: { $value: "#171717" } },
            bg: { $value: "{color.white}" }, // alias
        },
        space: {
            $type: "dimension",
            sm: { $value: "8px" }, // legacy string form
            md: { $value: { value: 16, unit: "px" } }, // structured form
        },
        shadow: {
            card: {
                $type: "shadow",
                $value: {
                    color: "{color.gray.900}",
                    offsetX: "0px",
                    offsetY: "1px",
                    blur: "3px",
                    spread: "0px",
                },
            },
        },
    },
    {
        modes: {
            dark: { color: { bg: { $value: "{color.gray.900}" } } },
        },
    },
);

$.color.white; // ColorToken — runtime value "var(--color-white)"
raw($.color.white); // "#fff" (serialized base-mode value)

let mixin = css({
    color: $.color.bg, // ✓ ColorToken
    // color: "#ff0000",          // ✗ type error — off-palette literal
    // color: $.space.md,         // ✗ type error — wrong brand
    backgroundColor: "transparent", // ✓ CSS keyword
    padding: [$.space.sm, $.space.md], // ✓ token tuple → "var(…) var(…)"
    margin: 0, // ✓ literal zero
    boxShadow: $.shadow.card,
    "&:hover": { color: $.color.gray[900] }, // nesting recurses
});

function Component() {
    return () => (
        <>
            <Theme />
            <div mix={mixin} />
        </>
    );
}
```

### `createTheme(config, options?)`

- `config` — a DTCG document, typed `<const T extends DTCGDocument>`. The `const` type parameter
  gives literal inference on inline objects with no `as const`. JSON imports work at runtime but
  TypeScript widens their literals, so full brand typing requires authoring tokens in `.ts`
  (documented limitation).
- `options.modes` — `{ light?: DeepPartialTokens<T>; dark?: DeepPartialTokens<T> }`. Each mode is
  a partial document of the same shape overriding `$value` only. Modes emit under
  `@media (prefers-color-scheme: …)` exclusively (no attribute selectors), hence exactly the
  `light`/`dark` keys.
- Runs eagerly at call time: parse → resolve → serialize → emit (see Pipeline). All validation
  errors throw here, never later.

Returns `{ token, raw, Theme }`:

- **`token`** (conventionally destructured as `$`) — plain eagerly-built object (no Proxy), same
  shape as the config minus `$`-keys. Every token leaf is a `var(--…)` string branded by its
  resolved DTCG type.
- **`raw(ref)`** — takes any branded ref minted by this theme, returns the serialized base-mode
  CSS value (`"#fff"`, `"16px"`). Implemented as a `Map<string, string>` from var-ref to value.
  Refs from a different theme instance throw.
- **`Theme`** — component rendering
  `<style data-pitlane-theme nonce?={props.nonce}>` via `createElement` (no JSX in package
  source). Content: one `:root { … }` block with every base var, then per mode one
  `@media (prefers-color-scheme: dark) { :root { … } }` block containing only overridden vars.
  Style text is escaped (`</style` → `<\/style`). Identical output in SSR streams and client
  renders; no style-manager coupling; documented to render once near the root.

### `css(styles)` — module-level

Brand-typed wrapper over remix/ui's `css()`. Input type is `ThemedCSSProps` (fixed, not
per-theme — see Type system). Runtime is thin: branded refs are already `var()` strings; token
tuples join with spaces; nested objects recurse; the result delegates directly to remix/ui
`css()` and returns its `CSSMixinDescriptor` for the `mix` prop.

Escape hatches, in order of preference: template interpolation
(`` border: `1px solid ${$.color.gray[900]}` `` — degrades to `string`, accepted by unmapped
properties), and remix/ui's own untyped `css()` for anything else. Our `css` intentionally
shadows remix/ui's at the import level; same runtime behavior, stricter types.

### `tva(config)` — module-level

"Theme Variance Authority," modeled on cva:

```ts
let button = tva({
    base: ThemedCSSProps,
    variants: { intent: { primary: ThemedCSSProps, danger: ThemedCSSProps } },
    compoundVariants: [{ intent: "primary", size: "sm", css: ThemedCSSProps }],
    defaultVariants: { intent: "primary" },
});

<button mix={button({ intent: "danger" })} />;
```

- Returns `(props?) => CSSMixinDescriptor`. Deep-merges `base` → matching variants (variant-key
  declaration order) → matching `compoundVariants` (array order), last write wins per property,
  into **one** remix/ui `css()` call (one generated class).
- Boolean and string variant values supported, as in cva.
- `TVAProps<typeof button>` extracts the variant props type (cva's `VariantProps` analog).

### `combine(...tvaFns)` — module-level

cva-`compose` analog: returns a tva-like function whose props are the union of the inputs' props;
resolution deep-merges each component's resolved styles in argument order into one `css()` call.

### `cx(...values)` — module-level

clsx-compatible className joiner (strings, numbers, arrays, record form; ~15 lines, no
dependency). Interop escape hatch for the `className` prop; unrelated to the mixin path.

## DTCG support matrix

| Feature                                                                       | v1                                                    |
| ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| Groups, nested arbitrarily                                                     | ✓                                                      |
| Group-level `$type` inheritance                                                | ✓                                                      |
| Aliases `{path.to.token}` as full `$value`                                     | ✓ (emitted as `var()` indirection)                     |
| Aliases in composite sub-values                                                | ✓ (inline `var()`)                                     |
| `$description`, `$extensions`, `$deprecated`                                   | Parsed, ignored                                        |
| color                                                                          | ✓ string + structured object                           |
| dimension, duration                                                            | ✓ string + `{value, unit}`                             |
| fontFamily, fontWeight, number, cubicBezier                                    | ✓                                                      |
| shadow, border, transition, gradient, strokeStyle                              | ✓ (single-CSS-value serialization)                     |
| typography                                                                     | ✗ rejected at type level and runtime                   |
| Modes                                                                          | Package option (`modes`), not in-document — spec-pure  |

## Token processing pipeline

Four phases inside `createTheme`, fail-fast:

### 1. Parse

A node owning `$value` is a token; every other non-`$`-prefixed key is a group. `$type` resolves
as: own `$type` → nearest ancestor group `$type` → (aliases) referenced token's resolved type.
Unknown `$type` values and tokens with no resolvable type throw.

### 2. Resolve

- **Var naming**: each path segment is kebab-cased — camelCase splits (`backgroundHover` →
  `background-hover`), characters outside `[a-z0-9-]` collapse to `-`, lowercased — segments join
  with `-`, prefixed `--`: `color.gray.900` → `--color-gray-900`. If two token paths produce the
  same var name, throw (collision report names both paths).
- **Aliases**: full-value alias emits `--alias-name: var(--target-name)` — the indirection is
  preserved in CSS so a mode override of the target cascades through every alias for free.
  Unknown target and reference cycles throw (cycle report includes the chain).

### 3. Serialize (per `$type`)

| Type        | Accepted `$value`                                  | CSS output                                                                                                                                                                     |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| color       | CSS color string; `{colorSpace, components, alpha?, hex?}` | string passes through; object → `hex` when present, else per-space function: `srgb`→`rgb()`, `hsl`→`hsl()`, `hwb`→`hwb()`, `lab/lch/oklab/oklch`→ own functions, other spaces (`display-p3`, `srgb-linear`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d65`, `xyz-d50`)→`color(<space> …)`; `"none"` components pass through; alpha via `/ a` |
| dimension   | `"16px"`; `{value: number, unit: "px" \| "rem"}`   | concatenation                                                                                                                                                                    |
| duration    | `"200ms"`; `{value: number, unit: "ms" \| "s"}`    | concatenation                                                                                                                                                                    |
| fontFamily  | string; string[]                                   | names needing quotes get them; array comma-joins                                                                                                                                 |
| fontWeight  | number 1–1000; DTCG keyword                        | keywords map to numbers per the spec table                                                                                                                                       |
| number      | number                                             | `String(n)`                                                                                                                                                                      |
| cubicBezier | `[x1, y1, x2, y2]`                                 | `cubic-bezier(x1, y1, x2, y2)`                                                                                                                                                   |
| shadow      | object or array of objects                          | `[inset] x y blur spread color`, comma-joined; missing `blur`/`spread` default `0` (Style Dictionary-compatible leniency)                                                        |
| border      | `{color, width, style}`                            | `width style color`                                                                                                                                                              |
| transition  | `{duration, timingFunction, delay?}`               | `duration timing-function delay`; missing delay → `0s`                                                                                                                           |
| gradient    | array of `{color, position}` stops                 | stop list only (`#fff 0%, #000 100%`) — the spec defines no gradient kind; documented for interpolation inside `linear-gradient(…)` etc.                                         |
| strokeStyle | keyword string; `{dashArray, lineCap}`             | keyword passes through; object form → `"dashed"` (the spec's stated CSS fallback)                                                                                                |

Composite sub-values accept aliases anywhere a value is accepted; invalid structured values
(unknown `colorSpace`, unknown unit, malformed arrays) throw with the offending path.

### 4. Emit

`:root` block with all base vars in document order, then one media block per configured mode
containing only that mode's overridden vars. Mode validation before emit: every override path
must exist in the base document, carry the same resolved `$type`, and set nothing but `$value` —
violations throw.

### Error catalog (items 1–6 thrown by `createTheme`, item 7 at call time; all naming the token path)

1. Token without resolvable `$type`; unknown `$type`.
2. Alias to nonexistent path; alias cycle (chain reported).
3. Var-name collision after kebab-casing (both paths reported).
4. Invalid value for declared type (bad `colorSpace`, bad unit, malformed composite).
5. Mode override path absent from base; mode override changing `$type`; mode override containing
   non-`$value` keys.
6. `typography` tokens (unsupported in v1).
7. `raw(ref)` with a ref not minted by this theme.

## Type system

### Brands

Twelve exported brand types over module-private `unique symbol`s, all subtypes of `string`:
`ColorToken`, `DimensionToken`, `FontFamilyToken`, `FontWeightToken`, `DurationToken`,
`CubicBezierToken`, `NumberToken`, `ShadowToken`, `BorderToken`, `TransitionToken`,
`GradientToken`, `StrokeStyleToken`. Brands are theme-independent: tokens minted by different
`createTheme` instances interoperate in one `css()` call.

### Accessor typing

`TokenTree<T>` is a recursive mapped type: group nodes map to nested objects; token nodes map to
the brand for their resolved type — own `$type`, else the inherited group `$type` (threaded as a
type parameter), else the alias target's resolved type via template-literal parsing of
`"{a.b.c}"` and indexed access into `T` (bounded recursion). No template-literal path unions are
generated anywhere — tsserver cost stays proportional to config size. `DeepPartialTokens<T>`
(the `modes` value type) maps `T` recursively with every group optional and token nodes reduced
to `{ $value }`.

### `ThemedCSSProps`

Extends remix/ui's `CSSProps` contract: token-mapped longhands get strict brand typing; every
other property keeps remix/ui's loose typing (`string | number | nested`); nested
selector/media/`@keyframes` values recurse as `ThemedCSSProps`.

Canonical property map (`Wide` = `inherit | initial | unset | revert | revert-layer`):

| Property family                                                                                                                                    | Accepted values                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `color`, `backgroundColor`, `borderColor`, `borderTopColor`, `borderRightColor`, `borderBottomColor`, `borderLeftColor`, `outlineColor`, `textDecorationColor`, `columnRuleColor`, `caretColor`, `accentColor`, `fill`, `stroke` | `ColorToken \| "transparent" \| "currentColor" \| Wide`                 |
| `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `flexBasis`                                                                     | `DimensionToken \| 0 \| "auto" \| "min-content" \| "max-content" \| "fit-content" \| Wide` |
| `top`, `right`, `bottom`, `left`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft`                                                           | `DimensionToken \| 0 \| "auto" \| Wide`                                 |
| `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `fontSize`, `textIndent`, `outlineOffset`, `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius`, `rowGap`, `columnGap` | `DimensionToken \| 0 \| Wide`                                           |
| `letterSpacing`, `wordSpacing`                                                                                                                       | `DimensionToken \| 0 \| "normal" \| Wide`                               |
| `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`, `outlineWidth`                                                         | `DimensionToken \| 0 \| "thin" \| "medium" \| "thick" \| Wide`          |
| `padding`, `margin`, `inset`, `borderRadius` (box shorthands)                                                                                        | single value as the longhand, **or** tuple of 1–4 such values → space-joined |
| `gap`                                                                                                                                                | `DimensionToken \| 0 \| Wide` or 2-tuple                                |
| `fontFamily`                                                                                                                                         | `FontFamilyToken \| Wide`                                               |
| `fontWeight`                                                                                                                                         | `FontWeightToken \| "normal" \| "bold" \| "lighter" \| "bolder" \| Wide` |
| `lineHeight`                                                                                                                                         | `NumberToken \| DimensionToken \| "normal" \| Wide`                     |
| `opacity`, `zIndex`, `flexGrow`, `flexShrink`, `order`                                                                                               | `NumberToken \| number \| Wide` (plain numbers stay legal — enforcing tokens for `zIndex: 10` is noise) |
| `transitionDuration`, `transitionDelay`, `animationDuration`, `animationDelay`                                                                       | `DurationToken \| Wide`                                                 |
| `transitionTimingFunction`, `animationTimingFunction`                                                                                                | `CubicBezierToken \| "ease" \| "linear" \| "ease-in" \| "ease-out" \| "ease-in-out" \| "step-start" \| "step-end" \| Wide` |
| `boxShadow`, `textShadow`                                                                                                                            | `ShadowToken \| "none" \| Wide`                                         |

`BorderToken`, `TransitionToken`, `GradientToken`, and `StrokeStyleToken` have no strictly-mapped
longhand: they are `string` subtypes usable inside loose properties and shorthands
(`border: $.border.card`, `` backgroundImage: `linear-gradient(45deg, ${$.gradient.hero})` ``).
Multi-part shorthands (`border`, `background`, `font`, `transition`, `animation`) deliberately
stay loose — template interpolation degrades brands to `string`, so fake-strict typing there
would only breed casts.

## Repo & package structure

### Workspace conversion

- Add `pnpm-workspace.yaml`: `packages: [packages/*]`.
- Root `package.json` stays the private docs package (name, scripts unchanged).
- Root `vite.config.ts`: fmt/lint `ignorePatterns` gain `packages/*/dist/**`.
- Root `tsconfig.json` continues to serve the VitePress site; the package's tsconfig is
  standalone (below), not extending it.

### `packages/theme/`

```
packages/theme/
    package.json
    tsconfig.json        # standalone; content-layer's library compilerOptions
    vite.config.ts       # pack + run tasks + test (typecheck via tsgo)
    src/
        index.ts             # public exports
        brands.ts            # brand symbols + Token types + ThemedCSSProps
        tokens.ts            # DTCG parse/resolve (walk, $type inheritance, aliases, naming)
        serialize.ts         # per-type value serializers + :root/media emission
        css.ts               # css() wrapper (tuple joins, delegation)
        tva.ts               # tva, combine, cx
        theme.ts             # createTheme + Theme component (createElement, no JSX)
        *.test.ts, *.test-d.ts
```

`package.json` essentials: `@pitlane/theme@0.1.0`, MIT, `type: "module"`, `files: ["dist"]`,
exports `"."` → `{ types: "./dist/index.d.mts", import: "./dist/index.mjs" }`,
`peerDependencies: { remix: "*" }`, `devDependencies: { remix: "3.0.0-beta.5" }`, zero runtime
dependencies, `scripts.prepublishOnly: "vp run build"`, repository pointing at the
`pitlane-tools` org repo with `directory: packages/theme`.

`vite.config.ts` mirrors content-layer: `pack: [{ entry: { index: "src/index.ts" }, dts: { tsgo: true } }]`,
`run.tasks` `dev`/`build`, `test` with `include: ["**/*.test.ts"]` and
`typecheck: { enabled: true, checker: "tsgo", tsconfig: "tsconfig.json" }`.

## Publishing

`.github/workflows/publish.yml`, adapted from content-layer's:

- Trigger: `release: { types: [published] }`, job gated by
  `if: startsWith(github.event.release.tag_name, '@pitlane/theme@')` — future packages add their
  own filtered jobs to the same file.
- `permissions: { contents: read, id-token: write }`; `working-directory: packages/theme`.
- Steps: checkout → `voidzero-dev/setup-vp@v1` (node 24, cache) → `vp install --frozen-lockfile`
  → `vp test` → `vp run build` → `npm publish --provenance --access public --tag latest`.
- Release process: publish a GitHub release tagged `@pitlane/theme@0.1.0`.

## Testing strategy

Runtime tests (`vp test`, Vitest):

- **Serializers**: every type × legacy/structured input, structured-color space matrix, fontWeight
  keyword mapping, shadow arrays/inset/defaults, gradient stop lists, strokeStyle fallback.
- **Parse/resolve**: `$type` inheritance depth, alias chains, sub-value aliases, alias cycles,
  unknown targets, kebab-case naming, collision detection.
- **Modes**: subset validation errors ($type change, unknown path, extra keys), media-block
  emission with only overridden vars, alias cascade through mode override.
- **`raw`**: base-mode values; foreign-ref rejection.
- **`css`**: tuple joining, nested selectors/media passthrough, delegation to remix/ui `css()`
  (assert returned descriptor shape/args).
- **`tva`/`combine`/`cx`**: merge order (base → variants → compound), boolean variants, defaults,
  compound matching, compose prop-union, clsx-parity cases for `cx`.
- **`Theme` component**: rendered output contains the style tag, `data-pitlane-theme`, nonce
  passthrough, escaped `</style`, `:root` + media blocks — rendered with `renderToString` from
  `remix/ui/server`.

Type tests (`*.test-d.ts`, Vitest typecheck via tsgo):

- Brand assignability matrix: right brand accepted; wrong brand, off-palette string, bare number
  (where excluded) rejected; keywords, `0`, tuples accepted per property family.
- Alias leaves inherit the target's brand; group `$type` inheritance brands correctly.
- `modes` shape: partial accepted, unknown paths/`$type` mutations rejected.
- `TVAProps` extraction; `combine` prop union.
- `typography` tokens rejected.

## Documentation deliverables

Both pages ship with the package (sidebar links `/package/theme` and `/guides/styling` already
exist in `docs/.vitepress/config.ts` — no config change):

- **`docs/package/theme.md`** — reference: install (`@pitlane/theme` + `remix` peer),
  `createTheme` signature and options, the DTCG support matrix (including exclusions), aliases,
  modes, `token`/`raw`, `css` enforcement rules and escape hatches, the property map, `tva`/`cx`/
  `combine`, `Theme` (SSR behavior, nonce, render-once), error catalog, JSON-import typing
  limitation.
- **`docs/guides/styling.md`** — narrative: remix/ui `css()`/`mix` baseline → why tokens →
  `createTheme` walkthrough → dark mode via `modes` → variants with `tva` → a full component
  recipe. Imports show `@pitlane/theme`; the `pitlane/theme` umbrella subpath is noted as future.

## Design decisions log

| Decision                                   | Choice                                                                | Alternatives considered                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Architecture                               | Pure runtime `createTheme`                                             | Build-time codegen plugin; runtime + extraction now                          |
| Modes                                      | Partial DTCG documents per mode; `prefers-color-scheme` only            | `$extensions` per-token modes (Terrazzo-style); attribute selectors; none    |
| DTCG type scope                            | Primitives + aliases + single-value composites                          | Primitives only; full spec incl. typography                                  |
| Value formats                              | Legacy strings + structured objects, normalized                         | Strings only; structured only                                                |
| Accessor                                   | Branded object traversal; no string paths                               | `$("path")` template-literal unions; Proxy hybrid                            |
| Enforcement                                | Brand + CSS keywords + `0`; tuples for box shorthands                    | Brand-only; `Brand \| (string & {})` advisory                                |
| Styling helpers' home                      | Module-level `css`/`tva`/`cx`/`combine`                                  | Hanging off `$` (rejected: brands make theme-binding unnecessary)            |
| `tva` output                               | `(props) => CSSMixinDescriptor`, one class per invocation                | CSSProps object; className strings                                           |
| `raw` placement                            | Sibling return                                                          | `$.raw` with reserved top-level key                                          |
| `cssText`                                  | Cut from public API                                                     | Kept for static emission (re-addable in one line if a concrete need appears) |
| Reset CSS                                  | None                                                                    | Fork-style bundled reset                                                     |
| Docs                                       | Reference page + styling guide                                          | Reference only                                                               |
| Publish trigger                            | Release tag prefix `@pitlane/theme@`                                    | Unfiltered release trigger (content-layer style)                             |

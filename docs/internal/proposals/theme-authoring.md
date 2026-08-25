# Theme authoring

Status: proposal, unscheduled. Replaces the two earlier drafts on this branch
(`theme-authoring.md`'s five-part DTCG-document plan and
`authoring-and-interchange.md`'s twelve per-type factories). What survives from
each is recorded at the end.

`@pitlane/theme` 0.2.0 uses one format for two jobs: a W3C DTCG document is both
what you author and what the compiler consumes. This splits them. Authoring
becomes a plain nested record of CSS values plus a map naming each namespace's
token type. DTCG becomes an interchange format read at one edge and written at
the other.

The package has never been published (`npm view @pitlane/theme` 404s, and
`CHANGELOG.md` records 0.1.0 and a peer-dep-only 0.2.0 as unreleased), and its
only consumer is `demos/theme`. There is no migration to write. That window
closes on first publish.

## The shape to copy already exists

`@remix-run/ui@0.7.0` carries its own design tokens at
`dist/shared/style-values.js`. Forty-nine leaves, no envelope, no wrapper
objects:

```js
export const componentStyleValues = {
    space: { none: "0px", xs: "4px", sm: "8px", md: "12px", lg: "16px" },
    radius: { md: "8px", lg: "12px", xl: "16px", full: "9999px" },
    lineHeight: { normal: "1.45", relaxed: "1.65" },
    control: { height: { sm: "28px", md: "32px", lg: "36px" } },
    surface: { lvl0: "light-dark(#ffffff, #1a1a1a)" /* lvl1-lvl4 */ },
    shadow: { xs: "0 1px 1px rgb(0 0 0 / 0.05)" /* sm, md */ },
    colors: {
        border: { subtle: "light-dark(#e7e7e7, #333333)", default: "light-dark(#d1d1d1, #444444)" },
        action: { primary: { background: "light-dark(#1A72FF, #6eaaff)" /* … */ } },
    },
};
```

Three properties of that object decide this proposal.

Every value is the CSS it becomes. A dark-mode color is
`light-dark(#ffffff, #1a1a1a)`, one string, resolved by the native CSS function
against `color-scheme`. A shadow is `0 1px 2px rgb(0 0 0 / 0.07)`, not five
sub-values. DTCG 2025.10 can express neither.

Nothing declares a type. The object is data, and the four component modules that
consume it (`accordion`, `breadcrumbs`, `combobox`, `menu`, plus
`listbox-popover-styles`) import it as `styles` and read `styles.control.height.sm`
directly. No brands, no checking.

It is private. `@remix-run/ui`'s `exports` map has nineteen subpaths and none of
them is this module, so an application cannot reach it. Generalizing it into a
public, extensible, brand-checked package is the job `@pitlane/theme` exists to
do, and matching its authored shape is the closest this package can get to a
Remix 3 API that Remix 3 has not shipped.

## Why DTCG cannot be the authoring format

The format module reached
[Final Community Group Report](https://www.designtokens.org/tr/2025.10/format/)
on 28 October 2025. Its value grammar is narrower than CSS on every axis this
package cares about:

| Type         | DTCG 2025.10 requires                                                                                             | Rules out                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `dimension`  | `{ value: number, unit: "px" \| "rem" }`                                                                          | `em`, `ch`, `%`, `vh`, `clamp()`, `calc()`, `min()` |
| `duration`   | `{ value: number, unit: "ms" \| "s" }`                                                                            | `calc()`, custom-property arithmetic                |
| `color`      | `{ colorSpace, components, alpha?, hex? }` per the [Color module](https://www.designtokens.org/tr/2025.10/color/) | `light-dark()`, `color-mix()`, `currentColor`       |
| `shadow`     | `color`, `offsetX`, `offsetY`, `blur`, `spread`                                                                   | `inset`                                             |
| `fontWeight` | number 1-1000 or one of 19 keywords                                                                               | variable-font axis syntax                           |

Those rules exist so a value survives translation into Figma, Style Dictionary,
iOS, and Android at once. That portability is exactly what makes DTCG wrong as
the surface a web developer types into. Writing
`{ "colorSpace": "srgb", "components": [0, 0.4, 0.8], "hex": "#0066cc" }` to say
`#0066cc` is the price of the interchange guarantee, and there is no reason to
pay it at the keyboard.

The current package already refuses to pay it. `serializeColor` returns any
string unchanged (`serialize.ts:106`) and `serializeMeasure` does the same
(`serialize.ts:136`), so `demos/theme/app/theme.ts` writes
`"oklch(98.5% 0.002 247.839)"` and `"0.25rem"`, neither of which is a conformant
`$value`. The document `createTheme` accepts is a CSS dialect wearing DTCG's `$`
sigils. Meanwhile the parts of DTCG that a real Figma export would use are
missing: `$root`, `$extends`, `$ref`, `typography`, and composite sub-values
written as nested token objects all fail against `parseTokens`.

So the real question is where to spend the conformance budget. Spent on the
import path it is checkable against real Figma output. Spent on the authoring
path it taxes every line a developer writes and leaves the import path broken
anyway.

Measured on the demo: the DTCG document plus its `modes` option is 124 lines and
4,576 bytes. The same theme in the format below is **76 lines and 2,526 bytes**,
and compiles to byte-identical CSS.

## The authoring format

```ts
import { createTheme } from "@pitlane/theme";

export let Theme = createTheme({
    types: {
        color: "color",
        space: "dimension",
        radius: "dimension",
        font: "fontFamily",
        weight: "fontWeight",
        shadow: "shadow",
    },
    tokens: {
        color: {
            white: "#fff",
            gray: { 50: "oklch(98.5% 0.002 247.839)", 900: "oklch(21% 0.034 264.665)" },
            surface: "{color.white}",
        },
        space: { sm: "0.5rem", md: "1rem", gutter: "clamp(1rem, 4vw, 2.5rem)" },
        radius: { md: "8px", full: "999px" },
        font: { sans: ["Inter var", "ui-sans-serif", "system-ui"] },
        weight: { regular: 400, medium: "medium" },
        shadow: { card: "0 1px 2px rgb(0 0 0 / 0.07)" },
    },
});

export let { token: t, raw } = Theme;
```

### Values are the CSS they become

A leaf is a string, a number, or an array of either. A group is a plain object.
Nothing else. That makes an object always a group, so composite types
(`shadow`, `border`, `transition`, `gradient`) and `cubicBezier` take CSS text
where DTCG takes sub-value objects. No wrapper key and no constructor call is
needed to tell a leaf from a group, and `inset`, `em`, `%`, `clamp()`, and
`light-dark()` all follow for free, because they are characters in a string that
reaches the custom property unchanged.

Package cost: string passthrough at the top of `serializeShadow`,
`serializeBorder`, `serializeTransition`, `serializeGradient`, and
`serializeCubicBezier`. Five lines. The object forms stay, reached only by the
DTCG import path.

`number` and `fontWeight` keep requiring real numbers, so Remix UI's `'400'` and
`'1.45'` become `400` and `1.45` on transcription. That is the entire mechanical
diff between `componentStyleValues` and a valid `tokens` tree.

### Types are declared by namespace

`types` maps a dotted path prefix to one of the twelve token types. The nearest
enclosing declaration wins, which is DTCG's `$type` inheritance with the
declaration lifted out of the tree:

```ts
types: {
    control: "dimension",
    "control.color": "color",
    "control.opacity": "number",
},
tokens: {
    control: {
        height: { sm: "28px", md: "32px" },   // DimensionToken
        radius: "6px",                        // DimensionToken
        color: { border: "#d4d4d8" },         // ColorToken
        opacity: { disabled: 0.5 },           // NumberToken
    },
},
```

Lifting it out is the point. The token tree keeps zero reserved keys, so it is
plain JSON, diffable by a designer, and droppable in from
`componentStyleValues` verbatim. A real theme's map runs about one line per
namespace, roughly what `$type` cost when it was sprinkled through the tree, and
it reads as the theme's schema.

Four alternatives were considered and rejected.

Twelve per-type factories, `color({ … })` and `dimension({ … })`, as the earlier
draft proposed. Twelve exports whose names (`color`, `number`, `border`,
`shadow`, `transition`, `gradient`) collide with ordinary local variables, a
function call at every group, and a token tree that stops being data. Remix does
ship this style elsewhere, in `data-table`'s `column` namespace and across
`data-schema`, so dropping it here is a deliberate divergence. The tiebreaker is
that Remix's own token module has no constructors in it.

Inline `$type`, which is what 0.2.0 does. Keeps the sigil that signals "this is
DTCG" when it no longer is, and reserves a key inside the value tree.

Inline `type: "color"` without the sigil. Reserves the token name `type` with no
escape hatch.

Inference from the value's shape. `400` is a `number` and a `fontWeight`;
`calc()` is a `dimension`, a `duration`, and a `number`; a typo in a color
matches nothing and brands as `never`. Type-level CSS parsing would buy terse
authoring at the cost of the worst error messages in the package.

The cost of the map is two edit sites when a layer introduces a namespace, and a
forgotten entry. A leaf with no resolvable type brands as `unknown`, not `never`,
so it is unusable rather than universally assignable, and `parseTokens` already
throws a `ThemeError` naming the path at module load. Both behaviors were spiked.

### References

A leaf that is exactly `"{a.b.c}"` is a reference, unchanged from today: it
resolves to `var(--a-b-c)` in the emitted CSS, so overriding the target flips
every reference through the cascade.

Across layers, a reference is a property access on the previous layer's
accessor, which autocompletes, jumps to definition, and fails to compile when
the target is renamed:

```ts
export let Theme = createTheme({ types, tokens }).extend(base => ({
    types: { surface: "color" },
    tokens: {
        surface: { page: base.color.white, sunken: base.color.gray[50] },
    },
}));
```

`base.color.white` is the string `var(--color-white)`, so it reaches the custom
property as an ordinary value. Reversing it back to `{color.white}` for DTCG
export needs the `varName` map that `parseTokens` already builds.

Interpolation is also how a reference gets inside a composite. DTCG spells that
with a sub-value alias, which CSS text has no room for:

```ts
.extend(base => ({
    types: { "motion.press": "transition" },
    tokens: { motion: { press: `${base.motion.fast} cubic-bezier(0.25, 0.1, 0.25, 1) 0s` } },
}))
```

Template interpolation is strictly more general than a sub-value alias. It
works at any position in any value, and the `var()` indirection survives, so a
mode override of `motion.fast` still reaches the transition. It gives up the
brand (a template string is a `string`), which is why the `types` entry is
required, and it is the same pattern `docs/guides/styling.md` already documents
for `` border: `1px solid ${t.color.line}` ``.

### Modes

For colors, `light-dark()` is the answer, and it needs no package feature at
all:

```ts
tokens: {
    surface: { page: "light-dark(#ffffff, #1a1a1a)" },
},
```

It resolves against the `color-scheme` property, so a subtree that sets
`color-scheme: light` flips whatever the media query says, which is what a theme
toggle needs and what `options.modes` cannot do today. It is also what Remix UI
does for all 26 of its own dark values.

`modes` stays for what `light-dark()` cannot carry: dimensions, shadows, font
stacks, durations. Each mode declares its own condition, which closes the one
gap the earlier draft left open:

```ts
modes: {
    dark: {
        selector: ":root[data-color-scheme=dark]",
        tokens: { shadow: { card: "0 1px 2px rgb(0 0 0 / 0.4)" } },
    },
},
```

`media` defaults to `(prefers-color-scheme: <name>)` for the names `light` and
`dark` and is required for any other name. Supplying both `media` and `selector`
emits both blocks, so first paint is correct for a user who never touches the
toggle and an attribute write overrides it afterwards. A mode may override a
token's value and nothing else, as now.

## The Theme value

```ts
export interface Theme<T> {
    (handle: Handle<ThemeProps>): () => RemixElement;
    readonly token: TokenTree<T>;
    raw(ref: AnyToken): string;
    extend<const E extends ThemePatch>(
        patch: E | ((token: TokenTree<T>) => E),
    ): Theme<Extended<T, E>>;
    pick<const P extends readonly string[]>(...paths: P): Theme<Picked<T, P[number]>>;
}

export function createTheme<const T extends ThemeOptions>(options: T): Theme<T>;
```

An app that starts from a shipped palette writes one expression:

```ts
import { createTheme } from "@pitlane/theme";
import { DefaultTheme } from "@pitlane/theme/default";

export let Theme = createTheme(DefaultTheme)
    .pick("color.gray", "color.blue", "space", "radius", "font")
    .extend(base => ({
        types: { surface: "color", ink: "color" },
        tokens: {
            surface: { page: base.color.gray[50], panel: "light-dark(#fff, #171717)" },
            ink: { body: base.color.gray[900], link: base.color.blue[600] },
        },
    }));

export let { token: t, raw } = Theme;
```

`Theme` is callable, so `<Theme />` survives unchanged and `Theme.extend()` is
the derivation surface. The precedent is `remix/ui/input`, whose `InputFunction`
is both `(options?) => InputMixin` and a namespace carrying `.root()` and
`.field()`. `createTheme` stays the entry point, matching how Remix pairs
`createCookie` with `Cookie` and `createRouter` with `Router`.

The single objection to a callable theme is that definition-time derivation and
render-time rendering live on one value. The alternative is a plain `theme`
object whose component is `theme.Style`, which costs the `<Theme />` name in the
guide, the README, `VISION.md`, and `demos/theme/app/Document.tsx`. Recorded as
an open question below.

### extend

`extend` deep-merges a patch and returns a new `Theme`. A leaf replaces
wholesale; every other node recurses. `types` shallow-merges, and is optional
because a patch that adds tokens to an existing namespace needs no new entry.

Remix has no `.extend()` anywhere (an exhaustive grep across every package's
`dist/**/*.d.ts` returns nothing), so the shape comes from the two nearest
things it does have. `Query.with(relations)` is immutable, merges onto existing
state, clones via a private `#clone`, and widens a type parameter so the return
type reflects what was added (`query.js:101-108`). `Schema.pipe`, `.refine`, and
`.transform` are each documented as returning a new schema. `extend` takes all
three properties: immutable, chainable, type-widening.

Layering is forced by the type system. A single self-referential literal,
`createTheme(t => ({ … t.color.white … }))`, does not type: TypeScript resolves
the circularity by inferring `t` as `{}` and every reference through it errors
with TS2339. Layering is the only shape that works, and it is the shape a design
system already has.

### pick

`pick` narrows a theme to the listed paths, in both the runtime object and the
accessor type. Its reason to exist is a shipped default theme: a 260-token
primitive palette (22 hues by 11 steps, plus spacing and radius) compiles to
10,622 bytes of custom properties, and `pick("color.hue0", "color.hue1",
"space", "radius")` cuts that to 1,280 bytes. Nothing else prunes;
`<Theme />` emits every token it is given.

A selection has to keep what it depends on. `pick("color.surface")` where
`color.surface` is `{color.white}` throws today, because the target is gone.
The rule: **picked paths are what appears in the accessor; the emitted CSS also
carries the transitive closure of their references.** So `--color-white` is
declared but `t.color.white` does not exist, which is exactly the honest
reading of "I asked for the semantic token, not the primitive."

The closure is computable at runtime and has no expression in the accessor type,
which is why the split falls where it does.

Remix has no subsetting operator to imitate. Its one "choose a subset" verb is
SQL's, in `Query.select(...)`, whose `ReturningInput` is
`'*' | (keyof row & string)[]`. `pick` is new vocabulary, chosen because it is
the vocabulary TypeScript itself uses for the same operation.

## DTCG at the edges

`@pitlane/theme/dtcg`, runtime-only and dependency-free:

- `fromDTCG(document)` accepts a conformant 2025.10 document and produces the
  same internal tree the authoring format produces. This is where the
  conformance work belongs, and it is real work (see below). A runtime-loaded
  JSON document cannot produce a branded accessor, so it returns a theme with an
  untyped one and points at the codegen for the typed path.
- `toDTCG(theme)` returns the base document plus one document per mode. DTCG has
  no mode concept; the
  [Resolver module](https://www.designtokens.org/tr/drafts/resolver/) models this
  as sets plus modifiers in a `.resolver.json` manifest, so that is the target
  for a multi-mode theme.

Export is lossy and the docs must say so. `clamp()`, `em`, `%`,
`light-dark()`, inset shadows, and every composite written as CSS text have no
conformant representation. Recommendation: emit them under
`$extensions["tools.pitlane"]` and report the count, so a Style Dictionary
consumer gets a valid document and the author learns what did not travel.

Two thin wrappers sit on top. `@pitlane/theme/vite` watches an imported DTCG
document and regenerates a typed module, which fixes a problem the package
already documents but cannot solve: `theme.ts:110-113` warns that a JSON import
widens its literals and the brands degrade. Codegen writes the literals back out
as `as const`. A `pitlane-theme` bin owns the export direction and CI, because
producing an interchange artifact is a one-shot job and not a web-build job.

Placement is a subpath rather than a package because the codegen and the IR
change together in both directions, which is the exception `VISION.md`
principle 5 carves out.

### Conformance debt on the import path

Independent of this proposal, measured against 2025.10:

| Gap                                               | Where                                                        |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `$root` (a group carrying its own token)          | `walk` treats any node without `$value` as a group           |
| `$extends` (group inheritance)                    | not implemented                                              |
| `$ref` (JSON Pointer, including into sub-values)  | not implemented; only `{dotted.path}` is recognized          |
| `typography` composite                            | thrown by `validateType` (`tokens.ts:159`)                   |
| Composite sub-value as a nested token object      | `field()` hands it to the type serializer, which rejects it  |
| `hex` treated as the value rather than a fallback | `serialize.ts:114` returns `hex` before reading `colorSpace` |

The last one is a bug today. A `display-p3` or `oklch` token authored in the
structured form silently degrades to sRGB. The spike hit a smaller version of it
in the demo: `{ colorSpace: "oklch", components: [0, 0, 0] }` emits
`oklch(0 0 0)` while every hand-written color in the same file carries a percent
on lightness. Worth fixing on its own.

## What this costs

| Surface                                                                           | Change                                                                                                                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/theme/src/authoring.ts` (new)                                           | `lower()`, the `types` resolution, the `extend`/`pick` merges                                                                                                 |
| `packages/theme/src/types.ts`                                                     | `Tokens`, `TokenTypes`, `ToDTCG<T>`, `DeepMerge`, `PickTree`; the brand walk retargets from `$value` leaves to CSS-value leaves                               |
| `packages/theme/src/theme.ts`                                                     | `createTheme` takes `ThemeOptions`; `Theme` becomes callable and gains `extend`/`pick`; modes gain `media`/`selector`                                         |
| `packages/theme/src/serialize.ts`                                                 | String passthrough in five serializers                                                                                                                        |
| `packages/theme/src/tokens.ts`                                                    | Unchanged. It keeps consuming a DTCG document, now produced by `lower()`                                                                                      |
| `packages/theme/src/dtcg.ts` (new)                                                | `fromDTCG`, `toDTCG`                                                                                                                                          |
| `packages/theme/src/css.ts`, `props.ts`, `tva.ts`                                 | Unchanged. They read only the twelve brands, never the document shape                                                                                         |
| `theme.test.ts`, `types.test-d.ts`, `tokens.test.ts`                              | Fixtures rewritten. The invariants they defend (type inheritance precedence, cycle and collision detection, kebab-case var names, nominal brands) all survive |
| `serialize.test.ts`                                                               | Gains the string-passthrough cases; the rest becomes the import path's coverage                                                                               |
| `tva.test.ts`, `tva.test-d.ts`, `css.test.ts`, `css.test-d.ts`, `props.test-d.ts` | Unchanged apart from fixture construction                                                                                                                     |
| `demos/theme/app/theme.ts`                                                        | Rewritten, 124 lines to 76                                                                                                                                    |
| `docs/guides/styling.md`                                                          | "Define a theme", "Dark mode", and "A complete component"; the other seven sections stand                                                                     |
| `packages/theme/README.md`                                                        | Quick start                                                                                                                                                   |
| `docs/internal/VISION.md`                                                         | The `createTheme` example at L773-830 and the paragraph at L767                                                                                               |

## What was verified

Spikes run against the real `packages/theme/src` under `tsc` 7.0.2 with
`--strict`, then deleted.

Type inference, 50 assertions: 38 that a leaf carries the brand its namespace
declares, and 12 that a wrong one is rejected. Group-declared brands on string,
numeric, and array leaves; nested `types` prefixes overriding an ancestor;
`{alias}` resolution through the tree; nominal brands refusing cross-type
assignment; `DeepMerge` through both the callback and literal forms of `extend`;
`PickTree` removing unselected siblings; `pick` then `extend`; the real `css()`
accepting every branded leaf and rejecting an off-palette literal. Four
assertions were deliberately mis-stated and all four failed, with the error
naming the two brands involved.

Two failure modes were found this way rather than assumed. A leaf with no
resolvable type brands as `never` under the obvious `BrandOf`, and `never` is
assignable to every brand, so a forgotten `types` entry would have passed every
`css()` check silently. `BrandOf` returns `unknown` instead. And a dangling
reference brands as `unknown` too, because the alias branch is checked before
the inherited group type, so a typo'd path is a type error as well as the
runtime `ThemeError` it already was.

Lowering, at runtime. The demo theme transcribed into this format lowers to a
document deep-equal to the hand-written one and `compileThemeCss` returns
byte-identical text for both, 1,909 bytes. `componentStyleValues` transcribed
verbatim compiles to 49 tokens and 2,481 bytes, with `--surface-lvl0` carrying
its `light-dark()` intact, `--shadow-sm` its CSS string, and
`--colors-action-primary-background-hover` its kebab-cased path.

`extend`, four cases. Merging into an existing group, accessor references from
the previous layer, overriding a leaf without disturbing its siblings, and
chaining two layers.

`pick`, three cases. Unselected tokens absent from the emitted CSS, a selection
whose reference target is missing throwing, and the transitive closure of two
semantic aliases resolving to exactly `color.gray.900` and `color.white`.
Closure retention itself is designed, not implemented.

Cost. A single compile of a 260-token theme takes 0.42 ms; three `extend` layers
plus the compile take 1.74 ms. Layer count multiplies the work because each
layer recompiles, and at these numbers that is not worth deferring. Compilation
stays eager so a malformed value still throws at module load.

Not verified: `fromDTCG`, `toDTCG`, the resolver manifest, the `selector` half
of modes, and the metadata argument.

## What the earlier drafts contributed

| Earlier                                              | Now                                                                                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `theme-authoring.md` P1, composition via `.extend()` | Kept, and load-bearing. Layering is the only form that types.                                                                                                                                          |
| P2, `DefaultTheme` plus `pick`                       | Kept. `pick` now has a measured reason (10,622 bytes to 1,280) and a stated rule for reference targets.                                                                                                |
| P3, `scale()` multipliers                            | Dropped as an export. Dimension values are CSS strings, so `` `calc(${base.space.base} * 4)` `` is an ordinary template interpolation, and an app that wants `space(4)` writes three lines of its own. |
| P4, `lightDark()`                                    | Dropped as an export. Write `light-dark(a, b)`, which is what Remix UI does. The mode-selector half of P4 is kept and is now how every mode declares its condition.                                    |
| P5, modifier leaves                                  | Dropped. Free-form nesting plus a nested `types` prefix already gives `t.text.size.sm` beside `t.text.leading.sm` with no `$modifiers` and no accessor-shape question.                                 |
| `authoring-and-interchange.md`, TypeScript authoring | Kept, and is the whole proposal.                                                                                                                                                                       |
| Twelve dual-purpose factories                        | Dropped, for the `types` map.                                                                                                                                                                          |
| Modes attached to the token via `modes()`            | Dropped. `light-dark()` covers colors with no mechanism; the rest stays in `modes`, which now declares conditions.                                                                                     |
| `fromDTCG` / `toDTCG` behind a build step            | Kept unchanged, including the conformance-debt table.                                                                                                                                                  |

## Open questions

1. Callable `Theme`, or a plain object whose component is `theme.Style`? The
   callable form keeps `<Theme />` and reads as `Theme.extend()`, and has a
   Remix precedent in `remix/ui/input`. It also puts definition-time derivation
   and render-time rendering on one value. The alternative renames the component
   in four places.
2. Is `types` required on `createTheme`? Required makes the schema unskippable
   and makes `extend`'s optional `types` an asymmetry. Optional makes one shape
   to learn and leans on the `unknown` brand plus the load-time `ThemeError` to
   teach.
3. What does `DefaultTheme` contain? Primitives only, following Tailwind v4's
   `@theme` defaults, or primitives plus a semantic layer. Remix UI's own module
   is 49 leaves of both, which argues that the semantic half is what an app
   actually wants to start from and edit.
4. Does `types` support a wildcard prefix? `"text.*.leading": "number"` would
   let a type scale pair a size and a line height at the leaf. It also adds a
   second matching rule to a lookup that is currently one exact-key test.

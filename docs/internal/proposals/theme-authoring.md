# Theme authoring proposals

Status: draft, unscheduled, and partly superseded by
[`authoring-and-interchange.md`](./authoring-and-interchange.md), which argues
that the DTCG document should stop being the authoring surface. P1 survives as
the mechanism that proposal depends on, P2 and P3 survive unchanged, P4 is
mostly subsumed, and P5 is unaffected. The per-proposal reconciliation is in
that document. Everything below is written against the 0.1.0 DTCG-document
API and should be read with that in mind.

`@pitlane/theme` 0.1.0 compiles one DTCG document into one accessor. What is
missing sits above it: composition, a starting palette, and two value helpers.
This document proposes five changes, in the order they unblock each other.

The reference for several of these is an ad-hoc theme runtime in
`~/Developer/Projects/maitre-d/app/utils/create-theme.tsx`, which reaches similar
goals with a much smaller type system and no DTCG conformance.

## Evidence

Numbers below come from the current tree, not from memory.

- The eight starter templates each carry a **268-line, 115-token** hand-written
  document. Seven of them are byte-identical to the eighth; the two Deno copies
  differ only in how their formatter wraps one destructuring statement.
- That document is itself a transcription. `remix/ui`'s combobox styles read
  `styles.control.height.sm`, `styles.colors.border.default`, `styles.radius.md`,
  `styles.surface.lvl0` — the same paths, because whoever wrote the template
  copied them out of `@remix-run/ui`.
- Converting those templates off `remix/ui`'s prebuilt mixins needed four spacing
  values the t-shirt ladder did not have (32px, 48px, 64px, and a 36px type step).
  Rather than name `xxxl`, `xxxxl`, and `xxxxxl`, the conversion invented a
  parallel `layout` group. That is a workaround for a missing multiplier.
- Compiled, the template document emits **4,639 bytes** of custom properties into
  every response.
- `raw()` already round-trips `light-dark(#ef4444, #f87171)` as a color and
  `calc(var(--space-base) * 3)` as a dimension. Neither needed a compiler change.

## P1 — Token composition

### Problem

There is no way to start from someone else's document. `createTheme` takes one
object literal, so an app that wants ninety percent of a base palette must paste
all of it. The eight templates are that paste, eight times.

Aliases (`"{color.gray.900}"`) solve reference within a document. They do not
solve composition across documents.

### Proposal

`.extend()` on the compiled theme, taking either a document fragment or a
callback that receives the branded accessor:

```ts
import { createTheme } from "@pitlane/theme";
import { DefaultTheme } from "@pitlane/theme/default";

export let { token: t, Theme } = createTheme(DefaultTheme).extend(base => ({
    colors: {
        $type: "color",
        text: {
            primary: { $value: base.color.gray[900] },
            warning: { $value: base.color.red[500] },
        },
    },
}));
```

`DefaultTheme` stays a plain DTCG document. `createTheme` compiles it, `.extend`
deep-merges the fragment and recompiles, and the result is another `ThemeResult`,
so extends chain. A node carrying `$value` is a leaf and replaces wholesale;
every other node recurses.

`base.color.gray[900]` is `"var(--color-gray-900)"`, which is character-for-character
what the alias `"{color.gray.900}"` compiles to. The two forms are interchangeable
in the callback; the accessor is the one that autocompletes.

### The objections that killed this in the first draft, and why they were wrong

The first draft of this document recommended a standalone
`createTheme(mergeTokens(DefaultTheme, {…}))` on two grounds. Both were asserted,
not checked. Checked, both fail.

**"Compiling the base and discarding its CSS is wasteful."** Measured on a
284-token synthetic default theme (22 hues × 11 steps plus the usual scales):
`createTheme` costs **0.55 ms**, and base-then-extend costs **0.82 ms**. The waste
is **0.27 ms**, once, at module load. That is not an argument.

**"A callback returning `var()` strings loses the token type."** It does not, for
two reasons the first draft missed.

Accessor leaves are _branded_, and a brand is recoverable:

```ts
type TypeOfBrand<V> = [V] extends [ColorToken]
    ? "color"
    : [V] extends [DimensionToken]
      ? "dimension"
      : /* … the other ten … */ never;
```

Each brand carries its own `unique symbol`, so the arms are mutually exclusive.
`TokenTypeOf` gains one branch for the branded case beside its existing
`$type` / alias / inherited chain.

And the `const` type-parameter modifier propagates into a callback's _return_
inference, which the first draft assumed it would not:

```ts
declare function probe<const U extends DTCGDocument>(fn: (t: unknown) => U): U;
```

With `const`, `$type: "color"` and `$value: "#111827"` both stay literal inside the
callback with no `as const` at the callsite. Dropping `const` widens `$value` to
`string`, which would break alias resolution — so the modifier is load-bearing, and
it works.

A type spike covering brand recovery, `const` propagation, and `DeepMerge`
confirmed all three against the real `types.ts` and `brands.ts`. The merged tree
brands correctly in every case that matters: a token added into an existing group
inherits that group's `$type`, an overridden leaf keeps its type, a wholly new
group resolves on its own, and untouched groups still refuse cross-brand
assignment. **The existing `TokenTree` needs no change for the fragment form.**

### What is actually required

| Form                                             | New machinery                                                                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.extend(fragment)` with `"{alias}"` values      | `DeepMerge<A, B>` and the method. Nothing else.                                                                                                                |
| `.extend(base => fragment)` with accessor values | The above, plus a `TypeOfBrand` branch in `TokenTypeOf`, plus `raw()` and alias validation learning to chase a `var(--x)` value the same way they chase `{x}`. |

The second form is the one worth having, and its extra cost is one conditional
type and one lookup table the compiler already builds (`varName` → key).

The one real merit of the first draft survives: `DefaultTheme` must stay **data**,
not a pre-compiled `ThemeResult`. A DTCG document is inspectable, diffable,
publishable as JSON, and consumable by Style Dictionary or a Figma sync.
`createTheme(DefaultTheme).extend(…)` keeps that property, since the document is
the input rather than the exported artifact.

### Open: where modes go

`options.modes` is typed `DeepPartialTokens<T>` against the document, and
`.extend` changes the document. Three candidates, none obviously right:

1. `.extend(fragment, { modes })` — modes merge as you go. Reads heavy at the
   callsite.
2. `.modes(base => ({ dark: … }))` as its own chained step, typed against the
   accumulated document. Symmetric with `.extend`, but leaves two ways to declare
   modes once `createTheme(doc, { modes })` also exists.
3. Modes stay on `createTheme` only, and an extended theme cannot add them. Simple,
   and probably too restrictive for a `DefaultTheme` that ships dark values.

Resolve this before implementing. It is the only part of P1 still undesigned.

## P2 — `DefaultTheme`

### Problem

Every app starts from nothing. Tailwind's answer is a default theme you override;
Pitlane's is a blank file, which is why all eight templates transcribed
`remix/ui`'s private token set.

### Proposal

Ship a DTCG document of **primitives only** from a subpath:

```ts
import { DefaultTheme } from "@pitlane/theme/default";
```

Scope, following Tailwind v4's `@theme` defaults: the full color ramp, the
spacing base, radius, shadow families (including inset), the type scale, font
stacks, easing curves, and blur. No semantic names — no `color.text`, no
`surface.lvl1`. Those belong to the app, layered on with `.extend`, exactly as
the templates do now.

### Cost, and why it needs solving first

The template document emits 4,639 bytes for 115 tokens. maitre-d's default theme
declares roughly 379 leaves, which extrapolates to about **15 KB of custom
properties in every document**, most of them referencing colors the app never
uses. `<Theme />` emits every token it is given; nothing prunes.

Three ways out, in order of preference:

1. **Group selection at author time.** `pick(DefaultTheme, "color.gray",
"color.red", "space", "radius")` returns a narrowed document, typed by the
   selected paths. Explicit, no build step, no magic. An app that wants the whole
   ramp still pays for it, having asked.
2. **Split subpaths.** `@pitlane/theme/default/color`, `/space`, `/type`. Coarser
   than `pick`, but it makes the cost visible in the import list.
3. **Build-time pruning.** A Vite plugin that walks `t.*` accesses and drops
   unreferenced declarations. This is the only option that gets the whole palette
   for free, and it is also the only one that violates the runtime-first rule in
   `VISION.md`: the package must work without a bundler. Optimization only.

**Recommendation:** ship `DefaultTheme` together with `pick`. Shipping the
document without a selection mechanism trades one problem (nothing to start
from) for a worse one (12 KB of dead CSS on every page).

## P3 — Scale multipliers

### Problem

Named steps run out. Converting the templates needed 32px, 48px, and 64px past a
ladder that stopped at `xxl: 24px`. Naming them `xxxl`, `xxxxl`, `xxxxxl` is
absurd; the conversion instead invented a second group (`layout.section`,
`layout.block`, `layout.page`) whose only job was to hold three numbers.

maitre-d solves this with a function token: `spacing(4)` returns
`calc(var(--spacing) * 4)`.

### Proposal

A helper, not a document feature:

```ts
import { createTheme, scale } from "@pitlane/theme";

export let { token: t } = createTheme({
    space: { $type: "dimension", base: { $value: "4px" }, md: { $value: "8px" } },
});

export let space = scale(t.space.base); // (steps: number) => DimensionToken

css({ padding: space(16), gap: t.space.md }); // calc(var(--space-base) * 16)
```

`scale(ref)` returns `(n: number) => DimensionToken`. The returned string is
`calc(${ref} * ${n})`, which `css()` accepts because the brand says dimension.
Named steps keep working for the values that deserve names.

This needs no compiler change: `raw()` already round-trips `calc(var(--space-base)

- 3)` as a dimension today. It is roughly ten lines plus a brand cast.

DTCG has no function tokens and should not grow one here. Keeping `scale` outside
the document keeps the document portable.

## P4 — `light-dark()` colors, and the mode gap behind them

### Problem

`options.modes.dark` emits `@media (prefers-color-scheme: dark)`. That is correct
for OS-driven theming and wrong for a theme toggle: a media query cannot be
overridden by a `[data-theme]` attribute, so an app that wants a user-selectable
mode currently cannot have one.

maitre-d sidesteps this with `auto({ light, dark })` producing `light-dark(l, d)`,
which resolves against the `color-scheme` property. A subtree with
`color-scheme: light` flips, media query or not.

### Proposal, in two parts

**The helper is trivial and already works.** `serializeColor` passes any string
through, so this compiles today with no package change:

```ts
colors: {
    text: {
        warning: {
            $value: "light-dark(#ef4444, #f87171)";
        }
    }
}
```

Wrap it for symmetry and to keep the pair readable:

```ts
import { lightDark } from "@pitlane/theme";

colors: {
    text: {
        warning: {
            $value: lightDark("#ef4444", "#f87171");
        }
    }
}
```

Note the limits honestly in the docs: `light-dark()` is color-only. It cannot
carry a shadow, a dimension, or a font stack, so it is not a replacement for
`modes` — which is exactly why maitre-d only uses it for colors.

**The real fix is the mode selector.** Have each mode emit both blocks:

```css
@media (prefers-color-scheme: dark) {
    :root {
        --colors-text-primary: #f3f4f6;
    }
}
:root[data-color-scheme="dark"] {
    --colors-text-primary: #f3f4f6;
}
```

Then a toggle is one attribute write, aliases still cascade, every token type is
covered, and first paint stays correct for users who never touch the toggle. Cost
is duplicated declarations in the stylesheet, so put it behind
`modes: { dark: { … } }, modeSelector: "[data-color-scheme]"` rather than making
every app pay.

**Recommendation:** ship `lightDark` as documentation of an existing capability.
Treat the mode selector as the substantive change, and design it with the theme
toggle as its acceptance test.

## P5 — Modifier leaves

### Problem

A type scale wants its line height attached. DTCG's answer is the `typography`
composite type, which `createTheme` deliberately rejects because it would need one
variable per subproperty and the accessor shape for that was never settled.

So the templates carry `fontSize.sm` and `lineHeight.normal` as unrelated groups,
and every callsite re-pairs them by hand.

### Proposal

Adopt maitre-d's modifier leaf, which is precisely the missing accessor shape:

```ts
fontSize: {
    $type: "dimension",
    sm: { $value: "14px", $modifiers: { lineHeight: "1.5" } },
}
```

emits

```css
--font-size-sm: 14px;
--font-size-sm--line-height: 1.5;
```

and the accessor gains `t.fontSize.sm.lineHeight` alongside `t.fontSize.sm`.

The open question is the leaf's own type. `t.fontSize.sm` must stay a
`DimensionToken` for `css({ fontSize: … })` to accept it, so the modifiers cannot
sit on the branded string as properties — brands are strings at runtime. Either
the accessor leaf becomes an object with a `.value` (maitre-d's choice, but it
breaks every existing `t.x.y` callsite) or modifiers hang off a sibling path
(`t.fontSize.$.sm.lineHeight`), which is uglier but non-breaking.

**Recommendation:** lowest priority of the five. Revisit once P1 lands and there
is a real base type scale to attach line heights to.

## Sequencing

P1 first: without composition, `DefaultTheme` has no delivery mechanism. P2 and
its `pick` come next, since they are what removes 268 lines from each starter. P3
and P4's `lightDark` are small and independent and can land alongside either. The
mode question inside P1, the mode selector in P4, and all of P5 want their own
design pass.

## Open questions

- Where do mode overrides live on an extended theme? See "Open: where modes go"
  under P1; a published `DefaultTheme` carrying opinionated dark values makes the
  question urgent rather than theoretical.
- Should `pick` narrow the _type_ as well as the runtime object? It must, or the
  accessor keeps offering tokens the document no longer declares.
- Is a semantic layer (`color.text`, `surface.lvl1`) worth shipping as a second
  optional document, or does it belong in the templates where an app can read and
  edit it?

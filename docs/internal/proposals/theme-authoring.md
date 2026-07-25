# Theme authoring proposals

Status: draft, unscheduled. Nothing here is committed to a release.

`@pitlane/theme` 0.1.0 compiles one DTCG document into one accessor. That is the
right primitive and it should not change. What is missing sits above it:
composition, a starting palette, and two value helpers. This document proposes
five changes, in the order they unblock each other.

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

A standalone merge, not a method on the result:

```ts
import { createTheme, mergeTokens } from "@pitlane/theme";
import { DefaultTheme } from "@pitlane/theme/default";

export let { token: t, Theme } = createTheme(
    mergeTokens(DefaultTheme, {
        colors: {
            $type: "color",
            text: {
                primary: { $value: "{color.gray.900}" },
                warning: { $value: "{color.red.500}" },
            },
        },
    }),
    { modes: { dark: { colors: { text: { primary: { $value: "{color.gray.100}" } } } } } },
);
```

`mergeTokens(a, b)` deep-merges two documents and returns one. A node with a
`$value` is a leaf and replaces wholesale; groups recurse. Its type is
`DeepMerge<A, B>`, so `TokenTree` resolves aliases against the merged document
and `t.colors.text.warning` is a `ColorToken` because `{color.red.500}` is.

### Why this shape rather than `.extend(t => …)`

maitre-d puts `extend` on the compiled theme and passes the accessor to a
callback, which buys autocomplete on `t.color.gray[50]` and lets an extension
compute (`calc(${t.spacing} * 4)`).

For Pitlane that shape has two costs. `DefaultTheme` would have to be a compiled
`ThemeResult`, so its CSS gets built and discarded on every extend. And a
callback returning raw `var()` strings loses the token type: a value of
`"var(--color-gray-50)"` is an opaque string, where `"{color.gray.50}"` carries
its `$type` through `TypeAtPath` into the brand.

Keeping `DefaultTheme` as **data** rather than behavior means it is inspectable,
diffable, publishable as JSON, and mergeable more than once. Composition happens
before compilation, so `createTheme` stays the only compiler and validation still
runs once over the finished document.

`.extend()` remains available later as sugar over `mergeTokens` if the nesting
gets tiresome. It is not needed first.

### P1b — Typed alias strings

The one thing the callback form clearly wins is autocomplete. Recover it by
typing the alias syntax instead of the accessor:

```ts
type Alias<T> = `{${TokenPath<T>}}`;
```

`TokenPath<T>` walks the document to a union of dotted paths. `$value:
"{color.gry.500}"` then fails at the keystroke rather than throwing from
`createTheme`. Cost: a template-literal union over a large document is real
compiler work, and `DefaultTheme` would be the largest document anyone loads.
Measure before shipping; gate behind the merged document being reasonably sized.

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
`surface.lvl1`. Those belong to the app, layered on with `mergeTokens` and
aliases, exactly as the templates do now.

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
mode selector in P4 and all of P5 want their own design pass.

## Open questions

- Does `mergeTokens` need to merge mode overrides too, or does the app always own
  `options.modes`? A published `DefaultTheme` with opinionated dark values would
  argue for the former.
- How large can `TokenPath<T>` (P1b) get before it degrades editor
  responsiveness? Measure against a full default palette before committing.
- Should `pick` narrow the _type_ as well as the runtime object? It must, or the
  accessor keeps offering tokens the document no longer declares.
- Is a semantic layer (`color.text`, `surface.lvl1`) worth shipping as a second
  optional document, or does it belong in the templates where an app can read and
  edit it?

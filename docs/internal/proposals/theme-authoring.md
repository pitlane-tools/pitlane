# Theme authoring

Status: proposal, unscheduled. Replaces the two earlier drafts on this branch,
`theme-authoring.md`'s five-part DTCG-document plan and
`authoring-and-interchange.md`'s twelve dual-purpose per-type factories. What
survives from each is recorded at the end.

`@pitlane/theme` 0.2.0 uses one format for two jobs: a W3C DTCG document is both
what you author and what the compiler consumes. This splits them. Authoring
becomes a plain nested record of CSS values plus a schema tree built on
`remix/data-schema`. DTCG becomes an interchange format read at one edge and
written at the other.

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

Note `colors.border.default` in that object. A token named `default` is normal in
a design system, which is why the schema below reserves no token names at all.

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
4,576 bytes. The same theme in the format below, schema block included, is
**77 lines and 2,628 bytes**, and compiles to byte-identical CSS.

## The authoring format

```ts
import { createTheme, lightDark, scale } from "@pitlane/theme";
import * as s from "@pitlane/theme/schema";

export let {
    token: t,
    raw,
    Theme,
} = createTheme({
    schema: {
        color: s.color(),
        spacing: s.scale(),
        radius: s.dimension(),
        font: s.font.family(),
        weight: s.font.weight(),
        shadow: s.shadow(),
        animate: s.any(),
        control: s.group(s.dimension(), {
            color: s.color(),
            opacity: s.number(),
        }),
    },
    tokens: {
        color: {
            white: "#fff",
            gray: { 50: "oklch(98.5% 0.002 247.839)", 900: "oklch(21% 0.034 264.665)" },
            surface: "{color.white}",
            page: lightDark("#ffffff", "#1a1a1a"),
        },
        spacing: "0.25rem",
        radius: { md: "8px", full: "999px" },
        font: { sans: ["Inter var", "ui-sans-serif", "system-ui"] },
        weight: { regular: 400, medium: "medium" },
        shadow: { card: "0 1px 2px rgb(0 0 0 / 0.07)" },
        animate: { spin: "spin 1s linear infinite" },
        control: {
            height: { sm: "28px", md: "32px" }, // DimensionToken
            radius: "6px", // DimensionToken
            color: { border: "#d4d4d8" }, // ColorToken
            opacity: { disabled: 0.5 }, // NumberToken
        },
    },
});

t.spacing(4); // calc(var(--spacing) * 4)
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

### The schema is a tree of `remix/data-schema` schemas

`@pitlane/theme/schema` exports one factory per token type plus three that are
not types, designed for `import * as s`, which is how `remix/data-schema` ships
its own `string()`, `number()`, and `object()`:

| Export                    | Token type            | Accepts                                                     |
| ------------------------- | --------------------- | ----------------------------------------------------------- |
| `s.color()`               | `color`               | any CSS color, including `light-dark()` and `color-mix()`   |
| `s.dimension()`           | `dimension`           | any CSS length, including `clamp()` and `%`                 |
| `s.duration()`            | `duration`            | `ms`, `s`, `calc()`                                         |
| `s.number()`              | `number`              | a finite number                                             |
| `s.easing()`              | `cubicBezier`         | a 4-tuple or `cubic-bezier(…)`                              |
| `s.shadow()`              | `shadow`              | CSS shadow text, `inset` included                           |
| `s.border()`              | `border`              | CSS border shorthand text                                   |
| `s.transition()`          | `transition`          | CSS transition shorthand text                               |
| `s.gradient()`            | `gradient`            | CSS gradient function text                                  |
| `s.stroke()`              | `strokeStyle`         | a line-style keyword                                        |
| `s.font.family()`         | `fontFamily`          | a string or an array of names                               |
| `s.font.weight()`         | `fontWeight`          | 1-1000 or a DTCG keyword                                    |
| `s.scale()`               | `dimension`           | a base length whose accessor leaf multiplies                |
| `s.any()`                 | none                  | any string or number, emitted verbatim, branded as `string` |
| `s.group(self, children)` | inherited from `self` | a typed node with per-child overrides                       |

`s.easing()` and `s.stroke()` are named for CSS rather than for the DTCG
`$type` they map to (`cubicBezier`, `strokeStyle`). `props.ts` already calls its
own union `Easing`, and `toDTCG` is where the DTCG spelling has to be exact.

Each factory returns a `remix/data-schema` `Schema<unknown, string>` carrying one
extra symbol property naming its token type. The type is what the accessor brand
reads; the `Schema` is what validates and serializes. `s.color()` is
`createSchema(validator)` around the existing `serializeColor`, so the twelve
serializers in `serialize.ts` keep their behavior and gain a wrapper.

Building on `remix/data-schema` costs nothing and buys four things. `remix` is
already a peer dependency and `data-schema` is one of its subpaths, so the only
new transitive dependency is the type-only `@standard-schema/spec`. The token
tree composes into a single `object()` schema, so one `parse()` with
`abortEarly: false` validates every token and returns a `ValidationError` whose
`issues` name every bad value with its own path, where the current compiler
throws on the first one. `s.color().refine(…)` works, so an app can narrow a
namespace to hex-only or to a brand palette without the package growing an option
for it. And the schemas are Standard Schema v1, so anything in that ecosystem can
read a theme's shape.

One caveat found by spiking it: `ValidationError.message` is always the literal
`"Validation failed"`, because the constructor's second `message` argument is
optional and the detail lives on `issues`. So `ValidationError` is right for
value failures, where there may be many and each wants a path, and wrong for
structural failures, where there is one and it wants a sentence. The split:
`parse()` raises `ValidationError` for bad values, and `ThemeError` survives for
unknown references, reference cycles, variable collisions, a mode overriding a
token that does not exist, and a typed token referencing an untyped one.

### `s.group` types a node and its children

`s.group(self, children)` marks a node that is itself typed and also carries
per-child overrides. The `self` schema applies to that node and to every
descendant without its own entry:

```ts
schema: {
    control: s.group(s.dimension(), { color: s.color(), opacity: s.number() }),
    text: s.group(s.dimension(), { leading: s.number() }),
},
tokens: {
    control: { height: { sm: "28px" }, radius: "6px", color: { border: "#d4d4d8" } },
    text: { sm: "0.875rem", lg: "1.125rem", leading: { sm: 1.5, lg: 1.35 } },
},
```

This is DTCG's `$type` inheritance with the declaration lifted into a parallel
tree, and it is also the answer to the type-scale problem the earlier draft
deferred to a `$modifiers` design: `t.text.sm` and `t.text.leading.sm` are a
dimension and a number, from one schema group, with no new machinery.

An earlier draft of this document spelled the self type as a reserved `default`
key inside the group. `s.group` replaces it because `default` is a name a design
system wants, and Remix UI's own `colors.border.default` proves the point. With
`s.group` the self type rides on a symbol key, so no token name is reserved
anywhere and a token named `default` can carry its own type:

```ts
schema: {
    line: s.group(s.color(), {
        width: s.group(s.dimension(), { default: s.dimension() }),
    }),
},
tokens: { line: { subtle: "#e7e7e7", width: { default: "1px", thick: "2px" } } },
```

`t.line.subtle` is a color, `t.line.width.default` is a dimension. Verified at
both the type level and in the emitted CSS.

A plain object is still a children-only group with no self type, which is what
`motion: { fast: s.duration(), ease: s.easing() }` is. So the schema has three
node kinds: a leaf schema, a plain object, and `s.group`.

Two alternatives were rejected on the way here.

Twelve dual-purpose factories, `color({ … })` used as both leaf constructor and
group tag, as the interchange draft proposed. Twelve exports whose names
(`color`, `number`, `border`, `shadow`, `transition`, `gradient`) collide with
ordinary local variables, a function call wrapped around every group, and a token
tree that stops being data. The schema tree keeps the factories and moves them
out of the values, where `import * as s` also solves the collision.

A flat map of dotted path prefixes, `{ "control.color": "color" }`. Stringly
typed, so a renamed group leaves a dangling key that nothing checks, and no
place to hang a `refine()`.

### `s.scale` and `scale`

Tailwind v4's `--spacing` is one token that the whole spacing scale multiplies:
`p-4` is four steps of it, and there is no `--spacing-4` anywhere. `s.scale()` is
that shape. It declares a dimension token whose accessor leaf is a multiplier
rather than a value:

```ts
schema: { spacing: s.scale() },
tokens: { spacing: "0.25rem" },
```

```ts
t.spacing(4); // calc(var(--spacing) * 4), a DimensionToken
t.spacing(0.5); // calc(var(--spacing) * 0.5)
t.spacing.token; // var(--spacing), the base itself
css({ padding: t.spacing }); // type error: pick a step
```

The token still emits its own custom property (`--spacing: 0.25rem`), so nothing
about the CSS output is special. What changes is the accessor leaf, which is a
callable carrying a `.token` property. `.token` is load-bearing rather than
decorative: it is what `select` re-roots, since a projection holding a bare
function has nothing for the `varName` map to resolve, and it is what `raw`
reads. Both verified.

`scale(base)` is the same operation applied to an ordinary token you did not
declare as a scale, and it preserves the brand rather than flattening to
dimension:

```ts
declare function scale<base extends DimensionToken | DurationToken | NumberToken>(
    base: base,
): (steps: number) => base;
```

So `scale(t.motion.fast)(2)` is a `DurationToken`, `scale(t.tracking.tight)(2)` is
a `DimensionToken`, and `scale(t.shadow.card)` does not compile. Neither does
`scale(t.spacing)`, because a scale leaf is already a multiplier; the spelling
there is `scale(t.spacing.token)`, which is redundant but harmless.

Neither needs a compiler change. `serializeMeasure` already passes any string
through, so a `calc()` result also works as an authored token value:
`tokens: { gap: { lg: t.spacing(8) } }` in an `extend` layer emits
`--gap-lg: calc(var(--spacing) * 8)`. Verified.

`scale` is a module-level export, beside `css`, `tva`, `combine`, and `cx`, which
`VISION.md:771` already describes as "module-level exports rather than values
returned by `createTheme`". The cost of that placement is that `scale` cannot
check its base belongs to the theme actually rendered, so dropping the base in a
later `select` leaves `calc(var(--spacing) * 4)` pointing at nothing. `s.scale()`
does not have that problem, because its multiplier comes from the accessor and
disappears with it, which is the argument for declaring a scale when you own the
theme and reaching for `scale()` when you do not.

### References

A leaf that is exactly `"{a.b.c}"` is a reference, unchanged from today: it
resolves to `var(--a-b-c)` in the emitted CSS, so overriding the target flips
every reference through the cascade.

Across layers, a reference is a property access on the previous layer's
accessor, which autocompletes, jumps to definition, and fails to compile when
the target is renamed:

```ts
createTheme({ schema, tokens }).extend(base => ({
    schema: { surface: s.color() },
    tokens: { surface: { page: base.color.white, sunken: base.color.gray[50] } },
}));
```

`base.color.white` is the string `var(--color-white)`, so it reaches the custom
property as an ordinary value. Reversing it back to `{color.white}` for DTCG
export needs the `varName` map the collector already builds.

Interpolation is also how a reference gets inside a composite. DTCG spells that
with a sub-value alias, which CSS text has no room for:

```ts
.extend(base => ({
    schema: { motion: { press: s.transition() } },
    tokens: { motion: { press: `${base.motion.fast} cubic-bezier(0.25, 0.1, 0.25, 1) 0s` } },
}))
```

Template interpolation is strictly more general than a sub-value alias. It works
at any position in any value, and the `var()` indirection survives, so a mode
override of `motion.fast` still reaches the transition. It gives up the brand (a
template string is a `string`), which is what the schema entry is for.

`lightDark(light, dark)` is the same idea with a name, because a two-argument
call reads better than the punctuation and because it composes with accessor
refs: `lightDark(base.color.white, base.color.gray[900])` produces
`light-dark(var(--color-white), var(--color-gray-900))`, and a mode override of
either primitive still lands.

A typed token may not reference an `s.any()` token. The reference machinery
checks that the target's type matches what the referrer expects, and an untyped
token has nothing to match, so it raises `ThemeError`. Verified.

### Modes

For colors, `light-dark()` is the answer, and it needs no package feature at all:

```ts
tokens: {
    surface: { page: lightDark("#ffffff", "#1a1a1a") },
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
        selector: ':root[data-color-scheme="dark"]',
        tokens: { shadow: { card: "0 1px 2px rgb(0 0 0 / 0.4)" } },
    },
},
```

`media` defaults to `(prefers-color-scheme: <name>)` for the names `light` and
`dark` and is required for any other name. Supplying both emits both blocks.

#### The selector block wins, and not because of source order

The earlier draft framed this as a source-order question and was wrong.
Specificity decides it first: `:root[data-color-scheme="dark"]` is (0,2,0) and
`:root` inside a media query is (0,1,0), because a media query contributes no
specificity. Measured in Chromium, with a media query rigged to always match:

| Source order                                   | Winner   |
| ---------------------------------------------- | -------- |
| media block first, selector block second       | selector |
| selector block first, media block second       | selector |
| selector first, media second with `:root:root` | media    |

So the attribute wins in either order, and making the media query win would take
deliberately inflating its specificity.

That outcome is also the only one where a toggle works. Emulating
`prefers-color-scheme` across all six combinations of OS preference and attribute:

| OS preference | attribute | resolved |
| ------------- | --------- | -------- |
| dark          | none      | dark     |
| dark          | dark      | dark     |
| dark          | light     | light    |
| light         | none      | light    |
| light         | dark      | dark     |
| light         | light     | light    |

No attribute means the OS preference decides, so first paint is correct for a
user who never touches the toggle. An attribute overrides it in both directions.
Under "media beats selector" the third row would resolve dark, which is a user on
a dark laptop being told they cannot have light mode.

This reverses the preference recorded when the question was asked, on the
strength of that table. It is one `:root:root` away from being reversed back if
the OS preference should be authoritative for some reason this table does not
capture.

A mode may override a token's value and nothing else, as now.

## The theme value

```ts
export interface ThemeResult<T> {
    readonly token: TokenTree<T>;
    raw(ref: AnyToken): string;
    readonly Theme: ThemeComponent<T>;
    extend<const E extends ThemePatch>(
        patch: E | ((base: TokenTree<T>) => E),
    ): ThemeResult<Merged<T, E>>;
    select<const P extends ThemeInit>(projection: (base: TokenTree<T>) => P): ThemeResult<P>;
}

export interface ThemeComponent<T> {
    (handle: Handle<ThemeProps>): () => RemixElement;
    readonly $theme: T;
}

export function createTheme<const T extends ThemeInit>(init: T): ThemeResult<T>;
export function createTheme<T>(theme: ThemeComponent<T>): ThemeResult<T>;
```

`createTheme` stays the entry point and keeps returning `{ token, raw, Theme }`,
so `export let { token: t, raw, Theme } = createTheme(…)` and `<Theme />` are
both unchanged. `extend` and `select` live on the returned object, which is where
a chain belongs, and neither one is a component.

### `Theme` carries the init it was built from

`Theme` is an ordinary component with one extra property, `$theme`, holding the
`{ schema, tokens, modes }` it was compiled from. The second `createTheme`
overload reads it, so a published theme is one import and one call:

```ts
import { createTheme } from "@pitlane/theme";
import { DefaultTheme } from "@pitlane/theme/default";

export let { token: t, raw, Theme } = createTheme(DefaultTheme).select(/* … */);
```

`$theme` stays public because it is the only way in, but the callsite never has
to reach for it. Verified that `createTheme(base.Theme)` reproduces the CSS byte
for byte and that a chain from it extends normally.

The spelling follows Remix. `remix/ui`'s `clientEntry` tags a component with
`$entry` and `$entryId` and ships an `isEntry()` guard; `RemixElement` carries
`$rmx: true`; `data-table` hangs `columnMetadataKey` and `tableMetadataKey` off
its builders as non-enumerable symbols. A `$`-prefixed metadata property on a
component is an existing Remix idiom, so `$theme` plus an `isTheme()` guard is
the on-brand version of the hidden property.

### extend

`extend` deep-merges a patch into the base and returns a new `ThemeResult`. A
leaf replaces wholesale, every other node recurses, and the schema tree merges
the same way, so adding `motion.press` to a schema group keeps `motion.fast`
beside it. `schema` is optional on a patch, because a patch that only adds tokens
to an existing namespace needs no new entry.

Remix has no `.extend()` anywhere (an exhaustive grep across every package's
`dist/**/*.d.ts` returns nothing), so the shape comes from the two nearest things
it does have. `Query.with(relations)` is immutable, merges onto existing state,
clones via a private `#clone`, and widens a type parameter so the return type
reflects what was added (`query.js:101-108`). `Schema.pipe`, `.refine`, and
`.transform` are each documented as returning a new schema. `extend` takes all
three properties: immutable, chainable, type-widening.

Layering is forced by the type system. A single self-referential literal,
`createTheme(t => ({ … t.color.white … }))`, does not type: TypeScript resolves
the circularity by inferring `t` as `{}` and every reference through it errors
with TS2339. Layering is the only shape that works, and it is the shape a design
system already has.

### select

`select` takes a callback and replaces the base with what the callback returns,
where `extend` merges into it. That one bit of difference is the whole
distinction; both take the same `{ schema, tokens }` shape and both run the same
brand walk over the result.

```ts
createTheme(DefaultTheme).select(base => ({
    schema: {
        color: s.color(),
        spacing: s.scale(),
        radius: s.dimension(),
        font: s.font.family(),
    },
    tokens: {
        color: { blue: base.color.blue, gray: base.color.gray },
        spacing: base.spacing.token,
        radius: base.radius,
        font: base.font,
    },
}));
```

The values in a projection are accessor references, whole subtrees included, so
`select` re-roots them: every `var(--color-blue-500)` resolves back through the
`varName` map to the value that token holds, and the new path decides the new
custom property name. The narrowed theme emits `--color-blue-500: oklch(…)`, not
a self-reference. Verified: selecting two primitive groups produces CSS with no
`var(` in it at all.

Because the path decides the name, `select` also reshapes and renames.
`tokens: { brand: { light: base.color.gray[50] } }` emits `--brand-light`. The
name is SQL's for exactly that reason: `SELECT a AS b` is a projection that
renames, and Remix already has `Query.select` with a
`ReturningInput = '*' | (keyof row & string)[]`. `pick` was the runner-up, on the
symmetry with `extend` that TypeScript's `Pick` and `extends` establish, and it
lost because it promises a filter and delivers a projection.

`select` declares a `schema` even though it does not strictly need one: the
brands are recoverable from the accessor, and a `TypeOfBrand` conditional that
maps `ColorToken` back to `"color"` was spiked and resolves exactly, so a
projection made entirely of references could infer its own schema. Requiring it
anyway buys three things a derived schema cannot. A projection may re-type a
token it reshapes. A projection may mix fresh values in beside references, and a
fresh value has no brand to recover. And `createTheme`, `extend`, and `select`
then take one shape instead of three, with `schema` optional only on an `extend`
patch that adds nothing new. The cost is duplication in the common case where
nothing is renamed, plus a contradiction to detect: declaring
`brand: s.dimension()` over a projection of colors has to throw rather than
silently mis-brand.

Its reason to exist is a shipped default theme. A 258-token primitive palette
(22 hues by 11 steps, plus spacing and radius) compiles to 10,572 bytes of custom
properties, and selecting two hues plus spacing and radius cuts that to 1,280
bytes. Nothing else prunes at runtime; `<Theme />` emits every token it is given.

A projection has to keep what it depends on. Selecting `base.color.surface`,
which is `{color.white}`, throws today because the target is gone. The rule:
selected paths are what appears in the accessor, and the emitted CSS also carries
the transitive closure of their references, under their original names. So
`--color-white` is declared while `t.color.white` does not exist, which is the
honest reading of "I asked for the semantic token, not the primitive." The
closure is computable at runtime and has no expression in the accessor type,
which is why the split falls where it does.

## The IR

The collector walks the token tree and the schema tree together, in document
order, into one list of entries discriminated by `kind`:

```ts
type Entry =
    | { kind: "typed"; key; path; varName; type: TokenType; value; aliasOf? }
    | { kind: "scale"; key; path; varName; value }
    | { kind: "untyped"; key; path; varName; value: string };
```

The discriminant is what makes `s.any()` affordable. `serializeValue` switches
over all twelve `TokenType` values with no default, and TypeScript checks that
switch for exhaustiveness; an optional `type` field would force an `undefined`
branch into `serializeValue`, `varRefFor`, `resolveRaw`, `walkMode`, and
`toDTCG`, and the exhaustiveness check would stop meaning anything. Tagging the
entry instead keeps every twelve-type code path total and reached only for
`kind: "typed"`.

Two separate maps, one typed and one untyped, would achieve the same
exhaustiveness. One tagged list is better on the two axes where the split costs
something: every walk that needs all tokens (accessor construction, declaration
emission, variable-collision detection, `raw`) consults one collection instead of
remembering to consult both, and document order survives, so the emitted CSS
still reads in the order the theme was written. Collision detection across kinds
is verified, since `--a-b` from an untyped `a.b` and from a typed `a-b` must
still collide.

This replaces `parseTokens` rather than feeding it. An earlier draft lowered
`{ schema, tokens }` into a DTCG document so that `tokens.ts` could stay
untouched, which worked for the twelve types and had nowhere to put an untyped or
scale token. The schema-driven collector is verified to reproduce the current
DTCG compiler's output byte for byte, including alias `var()` indirection, the
`{ value: 2.5, unit: "rem" }` to `2.5rem` equivalence, the `fontWeight` keyword
map, and the dark-mode media block. DTCG becomes purely an edge format: only
`fromDTCG` reads a document, and it produces `{ schema, tokens }` like everything
else.

## `@pitlane/theme/default`

A `Theme` component built from Tailwind v4's default theme, primitives only, no
semantic layer. Tailwind's
[theme variable namespaces](https://tailwindcss.com/docs/theme) are the scope,
and they map onto the schema like this:

| Tailwind namespace                                                                                         | Schema            |
| ---------------------------------------------------------------------------------------------------------- | ----------------- |
| `--color-*`                                                                                                | `s.color()`       |
| `--font-*`                                                                                                 | `s.font.family()` |
| `--text-*`, `--tracking-*`, `--radius-*`, `--blur-*`, `--perspective-*`, `--breakpoint-*`, `--container-*` | `s.dimension()`   |
| `--spacing`                                                                                                | `s.scale()`       |
| `--font-weight-*`                                                                                          | `s.font.weight()` |
| `--leading-*`, `--tab-size-*`, `--zoom-*`                                                                  | `s.number()`      |
| `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*`                                                        | `s.shadow()`      |
| `--ease-*`                                                                                                 | `s.easing()`      |
| `--aspect-*`, `--animate-*`                                                                                | `s.any()`         |

Two rows are why `s.scale()` and `s.any()` are in the export list. `--spacing` is
a single base that multiplies, so `t.spacing(4)` is the whole point of shipping
it. And `16 / 9` and `spin 1s linear infinite` are valid CSS values with no DTCG
type, so refusing them would mean shipping a default theme that is not the one
Tailwind ships.

`s.scale()` also answers what would otherwise be a small wart. An app gets
`t.spacing(4)` from the default theme with no import beyond `DefaultTheme` and no
`scale(t.spacing)` line of its own, and the multiplier travels with the accessor,
so it cannot outlive a `select` that dropped its base.

No semantic layer, deliberately. `color.text`, `surface.lvl1`, and
`control.height` are decisions about a product.

## The semantic layer lives downstream

The semantic layer belongs to a component package, not to the theme package. The
planned one is a shadcn-style component set for Remix 3, and its relationship to
this proposal is a chain of two derivations:

```
@pitlane/theme/default   primitives only, Tailwind v4's namespaces
        │  createTheme(DefaultTheme).select(…).extend(…)
        ▼
the component package    the primitives it needs, plus its semantic tokens
        │  createTheme(ComponentsTheme).extend(…)
        ▼
the application          its own tokens on top
```

That answers what would otherwise be a hard question about contracts. The
component package's tokens exist because the component package declares them, so
its components can reference `t.surface.raised` without documenting a set of
paths every consuming theme must provide. The app extends the component
package's theme rather than `DefaultTheme` directly, which is what makes the
components' tokens non-optional, and `select` at the top of the chain is what
keeps the app from paying for 258 primitives it never uses.

It also settles the direction of the split. `@pitlane/theme/default` is a
starting point and never an interface: nothing in it is a contract, so a
component package is free to select two hues out of it and rename them.

## DTCG at the edges

`@pitlane/theme/dtcg`, runtime-only:

- `fromDTCG(document)` accepts a conformant 2025.10 document and produces the
  `{ schema, tokens }` pair the authoring format produces, deriving each schema
  node from the token's resolved `$type`. This is where the conformance work
  belongs, and it is real work (see below). A runtime-loaded JSON document cannot
  produce a branded accessor, so it returns a theme with an untyped one and points
  at the codegen for the typed path.
- `toDTCG(theme)` returns the base document plus one document per mode, with each
  token's `$type` read off its entry. DTCG has no mode concept; the
  [Resolver module](https://www.designtokens.org/tr/drafts/resolver/) models this
  as sets plus modifiers in a `.resolver.json` manifest, so that is the target
  for a multi-mode theme.

Export is lossy and the docs must say so. `clamp()`, `em`, `%`, `light-dark()`,
inset shadows, every composite written as CSS text, every `scale()` result, and
every `s.any()` token have no conformant representation. Recommendation: emit
them under `$extensions["tools.pitlane"]` and report the count, so a Style
Dictionary consumer gets a valid document and the author learns what did not
travel.

DTCG's `$description` and `$deprecated` have nowhere to live in the authoring
format yet, so `toDTCG` drops them and `fromDTCG` discards them. That is a
deliberate deferral rather than an oversight: the shape when it arrives is a
trailing options bag on each factory, following `data-schema`'s own
`object(shape, options?)`.

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

## Build-time optimization

Everything here is optional by construction. `VISION.md` principle 3 is explicit
that a bundler plugin may optimize the runtime API and never become a
prerequisite for it, so each item below has a runtime behavior it improves rather
than enables. Nothing in this section is implemented or measured; it is the shape
of the work, in rough order of payoff per unit of risk.

`@pitlane/dev` already depends on `oxc-parser` and `magic-string` for the
`clientEntry` transform, so the analysis and rewriting machinery is in place.

### Dead-token elimination

Walk every module for member expressions rooted at a theme accessor, collect the
token paths actually referenced, and drop the rest from the emitted CSS. The
transitive reference closure has to be retained, exactly as `select` retains it at
runtime.

The precedent is Tailwind v4, which does this by default: "By default only used
CSS variables will be generated in the final CSS output," with `@theme static` as
the opt-out. A theme that ships 258 primitives and uses forty is the normal case,
and 10,572 bytes on every response is what it costs today.

Soundness is the whole problem, and the bail-out has to be conservative. `t` used
as a value, spread, passed to a function, or indexed dynamically
(`t.color[hue]`) means the referenced set is unknown, so the containing namespace
survives whole. Scales are a worked example of the hazard, in two flavors:
`scale(t.tracking.tight)` references a base in a module that may never mention
`letterSpacing`, and `t.spacing(4)` is a call expression rather than the member
access the analysis is looking for. Both have to count as uses, which means the
analysis has to know about `scale` and about scale-typed accessor leaves.

This is where the plugin earns its keep or loses trust, and it wants a
`static: true`-style escape hatch of its own before anyone relies on it.

`select` and this transform overlap on purpose. `select` is explicit, runtime, and
typed, and it also narrows the accessor so an unselected token stops
autocompleting. The transform is automatic, needs no source change, and cannot
narrow a type. An app that wants both gets both.

### Compile at build time

`createTheme` runs the schema parse, the collector, and serialization on every
cold start: 0.8 ms for a 242-token theme, 2.5 ms across three `extend` layers.
A transform that evaluates a statically analyzable `createTheme` chain at build
time can replace it with the frozen accessor object and the finished CSS string,
taking the runtime cost to zero and moving every `ValidationError` from module
load to build. Values that are not statically analyzable bail out to the runtime
path. Scale leaves complicate this one too, since a frozen accessor has to
serialize a callable.

### The Vite CSS pipeline

Today `<Theme />` renders a `<style data-pitlane-theme>` element with the
compiled text inline, which costs 1,909 bytes in every SSR response for the demo
theme and is invisible to the app's own `.css` files. Emitting the same text as a
virtual module that Vite's CSS pipeline owns changes four things:

- Vite's configured CSS minifier normalizes and shrinks the declarations.
- A plain `.css` file in the app can `@import` the theme and use `var(--color-…)`
  without `<Theme />` having rendered.
- The output becomes a content-hashed asset, cacheable across navigations
  instead of re-sent per response. `remix/ui`'s `link` mixin attaches it.
- Cascade-layer placement becomes declarable. `remix/ui` inserts component styles
  into an `rmx` layer and its reset into `rmx-reset`
  (`REMIX_UI_STYLE_LAYER`, `REMIX_UI_RESET_LAYER`), and Tailwind orders
  `@layer theme, base, components, utilities`. The theme's custom properties want
  a layer below `rmx` so app CSS can override them; today they are unlayered on
  `:root`, which outranks every layered rule.

Layering interacts with mode precedence and the interaction is worth checking
before shipping either: a layer assignment beats specificity, so putting the
selector block and the media block in different layers would override the
measured behavior above.

The extraction trade-off points the other way for small themes. An inline
`<style>` in `<head>` costs no extra round trip and cannot cause a flash of
unstyled content, which for a 2 KB block of `:root` custom properties is probably
the right default. Extraction should be an option with a size threshold, not a
replacement.

### `@property` registration

The schema knows each token's CSS type, which is exactly what
[`@property`](https://developer.mozilla.org/en-US/docs/Web/CSS/@property) wants:

```css
@property --color-accent {
    syntax: "<color>";
    inherits: true;
    initial-value: oklch(54.6% 0.245 262.881);
}
```

Registered custom properties are type-checked by the browser, animatable, and
fail per-declaration instead of at computed-value time. This is the one item on
the list that a runtime could also do, and it is the clearest payoff of having a
schema at all: nothing else in the package knows that `--color-accent` is a
`<color>`. `s.any()` tokens have no `syntax` to declare and fall back to `*`.
Worth prototyping before the harder transforms, and worth measuring, since it
adds bytes rather than removing them.

### Typed module codegen

Already needed for the DTCG import path. `theme.ts:110-113` warns that a JSON
import widens its literals and the brands degrade, and codegen is the fix: watch
an imported DTCG document, emit `export const tokens = { … } as const` plus the
schema derived from each token's `$type`, and the accessor is fully branded
again. This is the only item that enables something rather than optimizing it,
which is why it belongs in `@pitlane/theme/vite` rather than here.

### Deliberately out of scope

Static extraction of `css()` and `tva()` output. That is `remix/ui`'s style
engine, not this package's, and a theme-side transform that tried to own it would
be reimplementing `processStyleClass` and the `rmx` layer.

## What this costs

| Surface                                                                           | Change                                                                                                                                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/theme/src/schema.ts` (new)                                              | The twelve type factories plus `s.scale`, `s.any`, and `s.group`, over `remix/data-schema`; the type tag; `composeSchema`                                                                  |
| `packages/theme/src/tokens.ts`                                                    | `parseTokens` becomes a schema-driven collector emitting tagged entries; `ThemeError` keeps the structural failures                                                                        |
| `packages/theme/src/types.ts`                                                     | `Tokens`, `SchemaNode`, `NodeType`, `Merged`, `ScaleFn`, and the brand walk retargeting from `$value` leaves to CSS-value leaves                                                           |
| `packages/theme/src/theme.ts`                                                     | `createTheme` takes `ThemeInit` or a `ThemeComponent`; the result gains `extend`/`select`; `Theme` gains `$theme`; modes gain `media`/`selector`; the accessor gains callable scale leaves |
| `packages/theme/src/serialize.ts`                                                 | String passthrough in five serializers, plus a verbatim branch for untyped entries                                                                                                         |
| `packages/theme/src/scale.ts` (new)                                               | `scale`, ten lines and a brand-preserving signature                                                                                                                                        |
| `packages/theme/src/dtcg.ts` (new)                                                | `fromDTCG`, `toDTCG`                                                                                                                                                                       |
| `packages/theme/src/default.ts` (new)                                             | Tailwind v4's primitives as a `Theme`                                                                                                                                                      |
| `packages/theme/src/css.ts`, `props.ts`, `tva.ts`                                 | Unchanged. They read only the twelve brands, never the token tree                                                                                                                          |
| `packages/theme/package.json`                                                     | Four new `exports` subpaths (`./schema`, `./default`, `./dtcg`, `./vite`)                                                                                                                  |
| `theme.test.ts`, `types.test-d.ts`, `tokens.test.ts`                              | Fixtures rewritten. The invariants they defend (type inheritance precedence, cycle and collision detection, kebab-case var names, nominal brands) all survive                              |
| `serialize.test.ts`                                                               | Gains the string-passthrough cases; the rest becomes the import path's coverage                                                                                                            |
| `tva.test.ts`, `tva.test-d.ts`, `css.test.ts`, `css.test-d.ts`, `props.test-d.ts` | Unchanged apart from fixture construction                                                                                                                                                  |
| `demos/theme/app/theme.ts`                                                        | Rewritten, 124 lines to 77                                                                                                                                                                 |
| `docs/guides/styling.md`                                                          | "Define a theme", "Dark mode", and "A complete component"; the other seven sections stand                                                                                                  |
| `packages/theme/README.md`                                                        | Quick start                                                                                                                                                                                |
| `docs/internal/VISION.md`                                                         | The `createTheme` example at L773-830 and the paragraph at L767                                                                                                                            |

## What was verified

Spikes run against the real `packages/theme/src` and the real
`remix/data-schema`, then deleted. Types under `tsc` 7.0.2 with `--strict`,
runtime under `vp test`, mode precedence in Chromium.

Types, 59 assertions: 42 that a leaf carries the brand its schema declares, and
17 that a wrong one is rejected. Covered: every factory in the table;
`s.group(self, children)` typing a node and its unlabelled descendants with
children overriding; a token literally named `default` carrying its own type
under `s.group`; `s.scale()` producing a callable leaf whose result is a
dimension, whose `.token` is the base, and which `css()` rejects uncalled;
`{alias}` resolution through the tree; `lightDark()` over literals and over
accessor refs; `scale` preserving a dimension, duration, and number brand while
refusing a shadow and refusing an already-scale leaf; `s.any()` accepted by
`animation` and `aspectRatio` and rejected by `color`; nominal brands refusing
cross-type assignment; the `extend` merge through both the callback and literal
forms, including a schema group gaining a sibling and a layer introducing a scale
node; `select` narrowing, reshaping, and renaming, and carrying a scale through
`.token`; `select` then `extend`; `createTheme(Theme)` via the component
overload; and the real `css()` accepting every branded leaf while rejecting an
off-palette literal. Ten assertions were deliberately mis-stated and all ten
failed, each error naming the two types involved.

One failure mode came from the spike rather than reasoning. A leaf with no
resolvable type brands as `never` under the obvious `BrandOf`, and `never` is
assignable to every brand, so a forgotten schema entry would have passed every
`css()` check silently. `BrandOf` returns `unknown` instead, which is unusable,
and validation already throws at module load naming the path.

Runtime, 20 assertions across six groups.

The IR: entries come out tagged `typed`, `scale`, and `untyped` in document
order, and only typed entries carry a `type`; every kind emits in document order
into one `:root` block; a typed token referencing an untyped one raises
`ThemeError`; a variable collision between an untyped `a.b` and a typed `a-b` is
detected; and `raw()` resolves a value, an alias chain, an untyped token, and a
scale base.

`s.scale`: the base emits its own custom property, `spacing(4)` and
`spacing(0.5)` produce `calc(var(--spacing) * 4)` and `calc(var(--spacing) * 0.5)`,
`.token` is `var(--spacing)`, a `select` through `.token` keeps the base and
rebuilds the multiplier, an `extend` layer can author `t.spacing(8)` as a token
value emitting `--gap-lg: calc(var(--spacing) * 8)`, and the module-level `scale`
still handles an ordinary token.

`s.group`: the six custom properties emitted correctly, and `line.subtle` a color
beside `line.width.default` a dimension.

`select` and `extend`: re-rooting references back to their own values with no
`var(` left in the output; reshaping and renaming to `--brand-light`; a selected
reference whose target was dropped throwing and naming `color.white`; and
`extend` keeping siblings of both trees.

Mode precedence: both blocks emitted for a mode declaring both conditions, and
the selector block placed first without relying on order. The specificity and
toggle tables above were measured in Chromium against a real stylesheet with
`Emulation.setEmulatedMedia`, all six OS-preference and attribute combinations.

Parity: the schema-driven collector reproduces the current DTCG compiler's output
byte for byte on a theme exercising aliases, the `{ value, unit }` form, a
`fontWeight` keyword, a `fontFamily` array, a `cubicBezier` tuple, and a dark
mode.

Cost: `createTheme` 0.8 ms for 242 tokens, three `extend` layers 2.5 ms. Layer
count multiplies the work because each layer recompiles, and at these numbers
deferring it is not worth the complexity. Compilation stays eager so a malformed
value throws at module load.

Not verified: `fromDTCG`, `toDTCG`, the resolver manifest, and everything under
"Build-time optimization".

## What the earlier drafts contributed

| Earlier                                              | Now                                                                                                                                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme-authoring.md` P1, composition via `.extend()` | Kept, and load-bearing. Layering is the only form that types.                                                                                                                                                                               |
| P2, `DefaultTheme` plus `pick`                       | Kept as `select`, a projection with a callback, with a measured reason (10,572 bytes to 1,280).                                                                                                                                             |
| P3, `scale()` multipliers                            | Kept twice. `scale(ref)` is a module-level export that preserves whichever of the dimension, duration, and number brands it was given; `s.scale()` declares a token whose accessor leaf is the multiplier, which is what `--spacing` needs. |
| P4, `lightDark()`                                    | Kept as an export, because it composes with accessor refs and reads better than the punctuation. The mode-selector half of P4 is also kept, and is now how every mode declares its condition.                                               |
| P5, modifier leaves                                  | Dropped. `s.group(s.dimension(), { leading: s.number() })` gives `t.text.sm` beside `t.text.leading.sm` with no `$modifiers` and no accessor-shape question.                                                                                |
| `authoring-and-interchange.md`, TypeScript authoring | Kept, and is the whole proposal.                                                                                                                                                                                                            |
| Twelve dual-purpose factories                        | Kept as factories, moved out of the token tree into the schema tree, and built on `remix/data-schema` rather than hand-rolled.                                                                                                              |
| Modes attached to the token via `modes()`            | Dropped. `light-dark()` covers colors with no mechanism; the rest stays in `modes`, which now declares conditions.                                                                                                                          |
| The lowering step to a DTCG document                 | Dropped. The collector is schema-driven and DTCG only appears at `fromDTCG` and `toDTCG`.                                                                                                                                                   |
| `fromDTCG` / `toDTCG` behind a build step            | Kept, including the conformance-debt table, and now derives the schema from `$type` in both directions.                                                                                                                                     |

## Open questions

1. Can a scale leaf survive build-time compilation? Freezing an accessor into a
   literal is straightforward for branded strings and needs a codegen story for a
   callable. That decides whether "compile at build time" covers a theme using
   `s.scale()` or bails out on one.
2. Does `s.scale()` generalize past dimension? `scale(t.motion.fast)` already
   multiplies a duration, so a `s.scale(s.duration())` form is expressible. No
   use has come up, and the one-argument form keeps `--spacing` honest.
3. Should `toDTCG` emit a scale token as its base or as its steps? The base is
   the only conformant answer, and it loses the multiplier, so a consumer sees
   `--spacing: 0.25rem` with no indication that the design system uses multiples
   of it.
4. What does `fromDTCG` do about `s.group`? A DTCG group with its own `$type`
   plus children that override it is exactly `s.group`, so the mapping is direct;
   the question is whether the generated schema is readable enough to check in as
   codegen output.

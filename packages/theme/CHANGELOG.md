# @pitlane/theme

## 0.3.0

Authoring moves off W3C DTCG. `createTheme` now takes a schema tree and the
token tree it describes, and token values are the CSS they become. DTCG stays
as an interchange format behind `@pitlane/theme/dtcg`.

**Breaking.** Every theme written against 0.1.0 or 0.2.0 has to be rewritten.
There is no compatibility shim, and `createTheme` does not accept a DTCG
document any more. `fromDTCG` reads one, so an existing document can be moved
across without being retyped by hand:

```ts
import { createTheme } from "@pitlane/theme";
import { fromDTCG } from "@pitlane/theme/dtcg";

export let { token: t, raw, Theme } = createTheme(fromDTCG(existingDocument));
```

What changes in a hand-written theme:

| 0.2.0                                              | 0.3.0                                    |
| -------------------------------------------------- | ---------------------------------------- |
| `createTheme(document, { modes })`                 | `createTheme({ schema, tokens, modes })` |
| `{ $type: "color" }` on a group                    | `color: s.color()` in the schema tree    |
| `{ $value: "#fff" }`                               | `"#fff"`                                 |
| `$value: { value: 2.5, unit: "rem" }`              | `"2.5rem"`                               |
| `$value: { colorSpace: "oklch", components: […] }` | the `oklch(…)` text                      |
| A shadow, border, transition, or gradient object   | the CSS shorthand text                   |
| `modes: { dark: { … { $value } } }`                | `modes: { dark: { tokens: { … } } }`     |

`{color.white}` references, the accessor shape, `raw`, `<Theme />`, `css`,
`tva`, `combine`, and `cx` are all unchanged. A DTCG sub-value alias, such as a
shadow whose `color` field was `{color.line}`, becomes a reference inside the
shorthand text: `"0 1px 2px {color.line}"`. That resolves to a `var()` like any
other reference, so a mode override of the target still reaches it.

- `createTheme({ schema, tokens, modes })` replaces
  `createTheme(document, options)`. A leaf is a string, a number, or an array;
  a plain object is a group. No `$value` wrappers, and no reserved token names.
- `@pitlane/theme/schema` — one factory per token type, built on
  `remix/data-schema` and designed for `import * as s`. `s.color()`,
  `s.dimension()`, `s.duration()`, `s.number()`, `s.easing()`, `s.shadow()`,
  `s.border()`, `s.transition()`, `s.gradient()`, `s.stroke()`,
  `s.font.family()`, and `s.font.weight()` name a token type;
  `s.group(self, children)` types a node and lets its children override it;
  `s.scale()` declares a base whose accessor leaf multiplies; `s.any()`
  declines to type a token at all.
- Composite types (`shadow`, `border`, `transition`, `gradient`) and
  `cubicBezier` take CSS text. `inset`, `em`, `%`, `clamp()`, `light-dark()`,
  and `color-mix()` all work, none of which DTCG can express. The structured
  object forms remain on the DTCG import path.
- `theme.extend(patch)` deep-merges a patch and returns a new theme.
  `theme.select(projection)` replaces the theme with a projection of it, which
  may also reshape and rename. Both take a callback that receives the accessor,
  so a layer can reference what it builds on.
- `<Theme />` carries the init it was compiled from as `$theme`, and
  `createTheme(SomeTheme)` reads it, so a published theme is one import.
- `@pitlane/theme/default` — `DefaultTheme`, Tailwind v4's primitives with no
  semantic layer. Pair it with `select` to avoid shipping every one of them.
- `@pitlane/theme/dtcg` — `fromDTCG` reads a conformant 2025.10 document and
  derives its schema from each token's resolved `$type`; `toDTCG` writes one
  out and counts the values the format cannot express.
- `scale(base)` multiplies any dimension, duration, or number token, keeping
  its brand. `lightDark(light, dark)` writes a `light-dark()` color, and
  composes with token references.
- A mode declares its own condition. `media` defaults to
  `(prefers-color-scheme: <name>)`; `selector` emits a second block for a
  user-selectable toggle, which outranks the media block on specificity so an
  explicit choice beats the OS preference.
- A `{path.to.token}` reference works anywhere in a value, not only as the whole
  value, which is what carries a DTCG sub-value alias across. One that names
  nothing raises `ThemeError` rather than reaching the stylesheet as literal
  braces.
- Bad token values raise `ValidationError` from `remix/data-schema`, one issue
  per bad token with its own path, all reported in one pass. Read `issues`
  rather than `message`. `ThemeError` covers the structural failures: an
  unknown or wrongly-typed reference, a reference to an untyped token, a
  reference cycle, a variable collision, a reserved character in a name, and a
  mode overriding a token that does not exist.
- `css()`, `tva()`, `combine()`, and `cx()` are unchanged.

## 0.2.0

- Raised the `remix` peer dependency to `^3.0.0-beta.10` (from
  `^3.0.0-beta.5`). No API changes — `createTheme`, `<Theme />`, and the
  `css`/`tva`/`combine`/`cx` helpers are unchanged.

## 0.1.0

Initial release.

- `createTheme(document, options?)` — takes a W3C DTCG token document and
  returns a typed `token` accessor, a `raw` base-value lookup, and a
  `<Theme />` component. Token paths kebab-case into CSS custom properties, and
  each accessor leaf is a `var()` string carrying a compile-time brand naming
  its token type.
- `options.modes` — per-mode `$value` overrides. `<Theme />` emits `:root`
  plus one `@media (prefers-color-scheme: <mode>)` block per mode, using
  `var()` indirection so aliases cascade with no JavaScript.
- `css()`, `tva()`, `combine()`, and `cx()` — `remix/ui`'s `css()` mixin with
  brand enforcement, a cva-style variant resolver, variant composition, and a
  clsx-compatible class joiner. Token-mapped properties accept only the
  matching brand, CSS-wide keywords, a small set of property keywords, and
  literal `0`; every other property carries csstype's value union.
- Full type surface exported alongside `ThemeError`: the per-type token brands,
  `ThemedCSSProps`, `TVAProps`, and the document and configuration types.
- `remix@^3.0.0-beta.5` is a peer dependency.

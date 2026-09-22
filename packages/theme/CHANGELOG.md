# @pitlane/theme

## 0.4.2

Published 2026-09-21. [npm](https://www.npmjs.com/package/@pitlane/theme/v/0.4.2) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/theme%400.4.2) · [Source](https://github.com/pitlane-tools/pitlane/commit/b725843491ad0c36c61c83d44466134f76dbd615).

Documentation only. `createTheme`, `extend`, `select`, `<Theme />`, and the `css`/`tva`/`combine`/`cx` helpers are unchanged.

- The README's guide link pointed at `/guides/styling`, which stopped existing when that guide was renamed. It points at the [theme guide](https://pitlane.tools/guides/theme) now, under a Documentation heading rather than Links.
- The npm description is now "Design tokens and type-safe styling for Remix.", and both it and the README opening say Remix rather than Remix 3. The version this package supports is in its peer range, which still reads `^3.0.0-rc.1`.

## 0.4.1

Published 2026-09-10. [npm](https://www.npmjs.com/package/@pitlane/theme/v/0.4.1) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/theme%400.4.1) · [Source](https://github.com/pitlane-tools/pitlane/commit/dc4844ff683fb1eb6b61f6ab9fe960b8a6c93b44).

Target Remix `3.0.0-rc.2`.

- No API changes. `createTheme`, `extend`, `select`, `<Theme />`, and the `css`/`tva`/`combine`/`cx` helpers behave as they did in 0.4.0.
- The `remix` peer stays at `^3.0.0-rc.1`, which already admits rc.2.
- Tested against `remix@3.0.0-rc.2`, type tests included.

## 0.4.0

Published 2026-09-01. [npm](https://www.npmjs.com/package/@pitlane/theme/v/0.4.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/theme%400.4.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/2617cd3d0e4c074878f34a96c6175116f926cf05).

Target Remix `3.0.0-rc.1`.

- Raised the `remix` peer dependency to `^3.0.0-rc.1` (from `^3.0.0-beta.10`). No API changes — `createTheme`, `extend`, `select`, `<Theme />`, and the `css`/`tva`/`combine`/`cx` helpers are unchanged, and the published `dist/` is byte for byte the one 0.3.1 shipped. What this package calls into Remix at runtime is `createElement` and `css` from `remix/ui`, plus `parse`, `createSchema`, `fail`, and `object` from `remix/data-schema`.
- One rc.1 change is worth knowing about when reading generated markup: the marker on server-rendered style elements is now `data-rmx-style`, where beta.10 emitted a bare `data-rmx`. A stylesheet or test that selected `[data-rmx]` needs the new attribute. The class hashes this package emits (`rmxc-…`) and the `@layer rmx` / `@layer rmx-reset` cascade layers are unaffected.
- The npm description dropped "W3C". It now reads "Type-safe styling with design tokens for Remix 3: a schema tree plus the CSS values it describes compile to a typed token accessor and a `<Theme />` component.", which is what 0.3.0 made true; the old wording still described the 0.1.0 authoring surface. The README's exports list picked up `@pitlane/theme/dtcg` in the same pass, so `fromDTCG` and `toDTCG` stopped being undocumented.
- Tested against `remix@3.0.0-rc.1`.

## 0.3.1

Published 2026-08-26. [npm](https://www.npmjs.com/package/@pitlane/theme/v/0.3.1) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/theme%400.3.1) · [Source](https://github.com/pitlane-tools/pitlane/commit/6edc5ab6294246c1f1ee13f16e9f8d55cfa090ff).

- `createTheme`, `extend`, `select`, and a mode all take their token tree under a `tokens` key, and leaving that wrapper off now raises `ThemeError` naming the key. A bare tree used to reach the compiler and fail as `Object.entries(undefined)`, and a mode missing the key reported `override at ""`, which named neither the key nor the mistake.

## 0.3.0

Published 2026-08-26. [npm](https://www.npmjs.com/package/@pitlane/theme/v/0.3.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/theme%400.3.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/c97d28a6fe8eabe565ca5ff1f30b002ef4743d82).

Authoring moves off W3C DTCG. `createTheme` now takes a schema tree and the token tree it describes, and token values are the CSS they become. DTCG stays as an interchange format behind `@pitlane/theme/dtcg`.

**Breaking.** Every theme written against 0.1.0 or 0.2.0 has to be rewritten. There is no compatibility shim, and `createTheme` does not accept a DTCG document any more. `fromDTCG` reads one, so an existing document can be moved across without being retyped by hand:

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
| `$value: [0.25, 0.1, 0.25, 1]` on `cubicBezier`    | the same tuple, under `s.easing()`       |
| A shadow's `color: "{color.line}"` sub-value       | the reference inside the shorthand text  |
| `modes: { dark: { … { $value } } }`                | `modes: { dark: { tokens: { … } } }`     |
| `"{color.white}"`                                  | `base.color.white` in an `extend` layer  |

The accessor shape, `raw`, `<Theme />`, `css`, `tva`, `combine`, and `cx` are all unchanged.

References need the most attention. The `"{color.white}"` string syntax is gone, and a reference is a property access on the layer below:

```ts
createTheme({ schema: { color: s.color() }, tokens: { color: { white: "#fff" } } }).extend(
    base => ({
        schema: { surface: s.color() },
        tokens: { surface: { page: base.color.white } },
    }),
);
```

The emitted CSS is the same, `--surface-page: var(--color-white)`, so overrides still cascade. What changes is that the reference is now checked: its type has to match its position, and renaming the target breaks the reference at build time instead of emitting a variable nothing declares.

Three consequences worth planning for. A semantic tier becomes a separate `extend` from the primitives it names. A mode override that references another token goes in an `extend` layer too, since that is where an accessor is in scope. And a DTCG sub-value alias, such as a shadow whose `color` field was `{color.line}`, becomes an interpolation: ``tokens: { shadow: { card: `0 1px 2px ${base.color.line}` } }``.

`fromDTCG` converts a document's aliases for you, including the ones inside a composite's sub-values, so an existing document needs no hand-editing.

One side effect worth knowing: a layer's declarations follow the ones it references, so moving a semantic tier into an `extend` moves its declarations later in the `:root` block. Custom properties in one rule resolve independently of order, so nothing about the cascade changes. Declaring the namespace as an empty group in the base tree reserves its position if the order matters for diffing.

- `createTheme({ schema, tokens, modes })` replaces `createTheme(document, options)`. A leaf is a string, a number, or an array; a plain object is a group. No `$value` wrappers, and no reserved token names.
- `@pitlane/theme/schema` — one factory per token type, built on `remix/data-schema` and designed for `import * as s`. `s.color()`, `s.dimension()`, `s.duration()`, `s.number()`, `s.easing()`, `s.shadow()`, `s.border()`, `s.transition()`, `s.gradient()`, `s.stroke()`, `s.font.family()`, and `s.font.weight()` name a token type; `s.group(self, children)` types a node and lets its children override it; `s.scale()` declares a base whose accessor leaf multiplies; `s.any()` declines to type a token at all.
- Composite types (`shadow`, `border`, `transition`, `gradient`) and `cubicBezier` take CSS text. `inset`, `em`, `%`, `clamp()`, `light-dark()`, and `color-mix()` all work, none of which DTCG can express. The structured object forms remain on the DTCG import path.
- `theme.extend(patch)` deep-merges a patch and returns a new theme. `theme.select(projection)` replaces the theme with a projection of it, which may also reshape and rename. Both take a callback that receives the accessor, so a layer can reference what it builds on.
- `<Theme />` carries the init it was compiled from as `$theme`, and `createTheme(SomeTheme)` reads it, so a published theme is one import.
- `@pitlane/theme/default` — `DefaultTheme`, Tailwind v4's primitives with no semantic layer. Pair it with `select` to avoid shipping every one of them.
- `@pitlane/theme/dtcg` — `fromDTCG` reads a conformant 2025.10 document and derives its schema from each token's resolved `$type`; `toDTCG` writes one out and counts the values the format cannot express.
- `scale(base)` multiplies any dimension, duration, or number token, keeping its brand. `lightDark(light, dark)` writes a `light-dark()` color, and composes with token references.
- A mode declares its own condition. `media` defaults to `(prefers-color-scheme: <name>)`; `selector` emits a second block for a user-selectable toggle, which outranks the media block on specificity so an explicit choice beats the OS preference.
- `<Theme />` declares `color-scheme: light dark` at the top of the `:root` block when any token value uses `light-dark()`. An undeclared `color-scheme` resolves `light-dark()` to its light half, so a theme built on the function would have kept its light values on a dark system.
- A `"{a.b.c}"` string left over from the old format raises `ThemeError` naming the `extend` that replaces it. Braces are never valid in a CSS value, so passing one through would put `{color.white}` in the stylesheet where a color belongs.
- A reference is a property access, so it is type-checked wherever it appears, including interpolated into a composite's CSS text. `select` refuses a projection that drops a token something it kept refers to, and a reference whose type does not match its position raises `ThemeError`.
- Bad token values raise `ValidationError` from `remix/data-schema`, one issue per bad token with its own path, all reported in one pass. Read `issues` rather than `message`. `ThemeError` covers the structural failures: an unknown or wrongly-typed reference, a reference to an untyped token, a reference cycle, a variable collision, a reserved character in a name, and a mode overriding a token that does not exist.
- Two type exports left the package entry. `ThemeOptions` is gone, replaced by `ThemeInit` and `ThemeMode`, and `DTCGDocument` moved to `@pitlane/theme/dtcg`, where it is `Record<string, unknown>` rather than the structural document type 0.2.0 exported. `ThemeComponent` takes a type parameter now, so a bare `ThemeComponent` annotation no longer compiles; `typeof theme.Theme` gives it to you. The new type exports are `Merged`, `ScalableToken`, `ScaleFn`, `ThemeInit`, `ThemeMode`, `ThemePatch`, `TokenValue`, `Tokens`, and `UntypedToken`, and `raw` accepts an `UntypedToken` alongside the branded ones.
- `css()`, `tva()`, `combine()`, and `cx()` are unchanged.

## 0.2.0

Published 2026-08-18. [npm](https://www.npmjs.com/package/@pitlane/theme/v/0.2.0) · [GitHub release](https://github.com/pitlane-tools/pitlane/releases/tag/%40pitlane/theme%400.2.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/f6be34e6116aaac178a017eb0fd86083f90b23dc).

- Raised the `remix` peer dependency to `^3.0.0-beta.10` (from `^3.0.0-beta.5`). No API changes — `createTheme`, `<Theme />`, and the `css`/`tva`/`combine`/`cx` helpers are unchanged.

## 0.1.0

Published 2026-08-13. [npm](https://www.npmjs.com/package/@pitlane/theme/v/0.1.0) · [Source](https://github.com/pitlane-tools/pitlane/commit/fadd7b4656d2868bcbd899d360297512783eb48c).

There is no recorded tag or GitHub release for this version. The source above is the `gitHead` npm recorded when the tarball went up, and it holds: that commit is the last on `main` before the 0.2.0 work, and its `package.json`, `README.md`, `CHANGELOG.md`, and `LICENSE` are byte-identical to the ones inside the tarball. It was authored on 25 July, nineteen days before the publish.

Initial release.

- `createTheme(document, options?)` — takes a W3C DTCG token document and returns a typed `token` accessor, a `raw` base-value lookup, and a `<Theme />` component. Token paths kebab-case into CSS custom properties, and each accessor leaf is a `var()` string carrying a compile-time brand naming its token type.
- `options.modes` — per-mode `$value` overrides. `<Theme />` emits `:root` plus one `@media (prefers-color-scheme: <mode>)` block per mode, using `var()` indirection so aliases cascade with no JavaScript.
- `css()`, `tva()`, `combine()`, and `cx()` — `remix/ui`'s `css()` mixin with brand enforcement, a cva-style variant resolver, variant composition, and a clsx-compatible class joiner. Token-mapped properties accept only the matching brand, CSS-wide keywords, a small set of property keywords, and literal `0`; every other property carries csstype's value union.
- Full type surface exported alongside `ThemeError`: the per-type token brands, `ThemedCSSProps`, `TVAProps`, and the document and configuration types.
- `remix@^3.0.0-beta.5` is a peer dependency.
- ESM only, with `csstype` as its one runtime dependency, a single `.` entry point, and `node@^20.19.0 || >=22.12.0`.

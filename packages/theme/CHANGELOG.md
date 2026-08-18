# @pitlane/theme

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

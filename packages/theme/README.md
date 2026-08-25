# @pitlane/theme

Type-safe styling with design tokens for [Remix 3](https://remix.run). `createTheme` compiles a schema tree and a tree of CSS values into a typed token accessor plus a `<Theme />` component that installs CSS custom properties. The `css`, `tva`, `combine`, and `cx` helpers wrap `remix/ui`'s `css()` mixin and enforce the theme palette at the type level.

## Install

```sh
npm install @pitlane/theme
# or
vp add @pitlane/theme
```

Requires `remix@^3.0.0-beta.10` as a peer.

## Quick start

Define the schema beside the tokens it describes. Token values are the CSS they become:

```ts
// app/theme.ts
import { createTheme, lightDark } from "@pitlane/theme";
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
        shadow: s.shadow(),
        animate: s.any(),
    },
    tokens: {
        color: {
            white: "#fff",
            gray: { 50: "#fafafa", 900: "#171717" },
            page: lightDark("#fff", "#171717"),
        },
        spacing: "0.25rem",
        radius: { full: "999px", responsive: "clamp(0.25rem, 2vw, 1rem)" },
        shadow: { card: "0 1px 2px rgb(0 0 0 / 0.07)" },
        animate: { spin: "spin 1s linear infinite" },
    },
});
```

Render `<Theme />` once near the root. It emits one `<style data-pitlane-theme>` element with the custom properties:

```tsx
import { Theme } from "./theme.ts";

function App() {
    return () => (
        <html lang="en">
            <head>
                <Theme />
            </head>
            <body>…</body>
        </html>
    );
}
```

Set `color-scheme` on the root when `lightDark()` should follow the operating-system preference:

```css
:root {
    color-scheme: light dark;
}
```

Pass tokens to `css()` inline at each element through the `mix` prop. Token-mapped properties accept only the matching brand:

```tsx
import { css } from "@pitlane/theme";
import { t } from "./theme.ts";

<article
    mix={css({
        color: t.color.page,
        padding: [t.spacing(2), t.spacing(4)],
        margin: 0,
        // color: "#ff0000", // type error: outside the palette
        "&:hover": { color: t.color.gray[900] },
    })}
/>;
```

`t.spacing(4)` produces `calc(var(--spacing) * 4)`, and `t.spacing.token` is the unmultiplied `var(--spacing)`. Use module-level `scale(token)` to multiply an ordinary dimension, duration, or number token.

## Exports

- `createTheme({ schema, tokens, modes? })` compiles a theme and returns `{ token, raw, Theme, extend, select }`. `token`, conventionally `t`, mirrors the tree with branded `var()` strings. `raw(ref)` resolves a base value. `<Theme />` installs the custom properties.
- `createTheme(DefaultTheme)` accepts a published theme component and returns a derivable theme. `@pitlane/theme/default` exports `DefaultTheme`, Tailwind v4 primitives without a semantic layer.
- `css(props)` is `remix/ui`'s `css()` with token-brand enforcement. Call it inline at each `mix` callsite.
- `tva(config)` creates a cva-style variant resolver. `combine(...fns)` composes tva components. `cx(...)` joins clsx-compatible class values.
- `lightDark(light, dark)` returns CSS `light-dark()` text. `scale(token)` returns a multiplier for an ordinary dimension, duration, or number token.
- `ThemeError` reports structural failures, such as unknown references or variable collisions. Invalid values raise `ValidationError` from `remix/data-schema`, whose `issues` array contains the detail.
- `@pitlane/theme/schema` exports `s.color()`, `s.dimension()`, `s.duration()`, `s.number()`, `s.easing()`, `s.shadow()`, `s.border()`, `s.transition()`, `s.gradient()`, `s.stroke()`, `s.font.family()`, `s.font.weight()`, `s.scale()`, `s.any()`, and `s.group()`.
- Types include `ThemeInit`, `ThemeMode`, `ThemeResult`, `ThemeComponent`, `ThemeProps`, `TokenTree`, `ScaleFn`, `Tokens`, `TokenValue`, `ThemedCSSProps`, `ThemedCSSMixin`, TVA types, and per-type token brands.

## Links

- [Styling guide](https://pitlane.tools/guides/styling)
- [API reference](https://pitlane.tools/package/theme/)

## License

MIT

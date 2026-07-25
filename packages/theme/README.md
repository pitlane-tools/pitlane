# @pitlane/theme

Type-safe styling with W3C design tokens for [Remix 3](https://remix.run). `createTheme` takes a [DTCG token document](https://www.designtokens.org/tr/drafts/format/) and returns a typed token accessor plus a `<Theme />` component that installs the tokens as CSS custom properties. The `css`, `tva`, `combine`, and `cx` helpers wrap `remix/ui`'s `css()` mixin and enforce your palette at the type level.

## Install

```sh
npm install @pitlane/theme
# or
vp add @pitlane/theme
```

Requires `remix@^3.0.0-beta.5` as a peer.

## Quick start

```ts
// app/theme.ts
import { createTheme } from "@pitlane/theme";

export let {
    token: t,
    raw,
    Theme,
} = createTheme(
    {
        color: {
            $type: "color",
            white: { $value: "#fff" },
            gray: { 50: { $value: "#fafafa" }, 900: { $value: "#171717" } },
            bg: { $value: "{color.white}" },
        },
        space: { $type: "dimension", sm: { $value: "8px" }, md: { $value: "16px" } },
    },
    {
        modes: {
            dark: { color: { bg: { $value: "{color.gray.900}" } } },
        },
    },
);
```

Render `<Theme />` once near the root. It emits a single `<style data-pitlane-theme>` element containing `:root` plus one `@media (prefers-color-scheme: dark)` block for the override:

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

Pass tokens to `css()` inline at each element, through the `mix` prop. Token-mapped properties accept only the matching brand, so off-palette literals fail to compile:

```tsx
import { css } from "@pitlane/theme";
import { t } from "./theme.ts";

<article
    mix={css({
        color: t.color.bg, // ✓ ColorToken
        padding: [t.space.sm, t.space.md], // ✓ 1–4 token tuple
        margin: 0, // ✓ literal zero
        // color: "#ff0000", // ✗ not in the palette
        "&:hover": { color: t.color.gray[900] },
    })}
/>;
```

## Exports

- `createTheme(document, options?)` — returns `{ token, raw, Theme }`. `token` (conventionally `t`) mirrors the document; each leaf is a branded `var()` string. `raw(ref)` resolves the base-mode value behind a ref. `<Theme />` installs the CSS custom properties and accepts an optional `nonce`.
- `css(props)` — `remix/ui`'s `css()` with brand enforcement; call it inline at each `mix` callsite.
- `tva(config)` — a cva-style variant resolver returning a `mix`-ready descriptor.
- `combine(...fns)` — composes `tva` components into one.
- `cx(...)` — a clsx-compatible `className` joiner.
- `ThemeError` — thrown for invalid documents, references, or overrides.
- Types: `ThemeOptions`, `ThemeProps`, `ThemeResult`, `ThemeComponent`, `ThemedCSSProps`, `ThemedCSSMixin`, `TVAConfig`, `TVAProps`, `TVAFn`, `CombinedTVAFn`, `ClassValue`, `DTCGDocument`, `TokenTree`, `DeepPartialTokens`, and the per-type token brands (`ColorToken`, `DimensionToken`, `DurationToken`, and the rest).

## Links

- [Styling guide](https://pitlane.tools/guides/styling)
- [API reference](https://pitlane.tools/package/theme/)

## License

MIT

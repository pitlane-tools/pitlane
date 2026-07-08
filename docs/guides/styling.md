---
title: Styling
description: Style Remix apps with remix/ui css mixins and @pitlane/theme design tokens.
---

# Styling

Remix UI styles elements with the `css()` mixin through the `mix` prop — no class-name management, SSR-streamed style tags, automatic deduplication:

```tsx
import { css } from "remix/ui";

function Card() {
    return () => <article mix={css({ padding: "16px", color: "#111" })}>…</article>;
}
```

That works, but every value is a loose string. `@pitlane/theme` layers design tokens and type safety on top.

## Define a theme

Design tokens live in a [W3C DTCG](https://www.designtokens.org/tr/drafts/format/) document passed to `createTheme`. Define the theme once in `app/theme.ts` and export the pieces:

```ts
import { createTheme } from "@pitlane/theme";

export let {
    token: $,
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

`$.color.white` is a `ColorToken` — a typed `var(--color-white)` reference. `raw($.color.white)` returns `"#fff"`.

## Install the tokens

Render `<Theme />` once near the root; it emits a `<style>` tag with your CSS custom properties, streaming-safe on the server:

```tsx
import { Theme } from "./theme.ts";

function App() {
    return () => (
        <html>
            <head>
                <Theme />
            </head>
            <body>…</body>
        </html>
    );
}
```

## Use tokens in styles

`css` from `@pitlane/theme` is remix/ui's `css()` with brand enforcement — token-mapped properties only accept tokens from your theme:

```tsx
import { css } from "@pitlane/theme";
import { $ } from "./theme.ts";

// css() binds to the element type of the `mix` position it appears in —
// write it inline at each element, like remix/ui's own css.
<article
    mix={css({
        color: $.color.bg,
        padding: [$.space.sm, $.space.md], // 1–4 value tuples join with spaces
        margin: 0,
        // color: "#ff0000", // ✗ type error — not in the palette
        "&:hover": { color: $.color.gray[900] },
    })}
/>;
```

Unmapped properties stay loose, and template interpolation is the escape hatch for shorthands: `` border: `1px solid ${$.color.gray[900]}` ``.

## Dark mode

Modes are partial token documents overriding `$value` only, emitted under `@media (prefers-color-scheme: …)`:

```css
:root {
    --color-bg: var(--color-white);
}

@media (prefers-color-scheme: dark) {
    :root {
        --color-bg: var(--color-gray-900);
    }
}
```

Aliases keep their `var()` indirection in the emitted CSS, so overriding one referenced token in `modes.dark` flips every alias that points at it — no duplicate declarations, no JavaScript.

## Variants with tva

`tva` is a cva-style variant resolver that returns a `mix`-ready descriptor:

```ts
import { tva } from "@pitlane/theme";
import type { TVAProps } from "@pitlane/theme";
import { $ } from "./theme.ts";

export let button = tva({
    base: { padding: [$.space.sm, $.space.md] },
    variants: {
        intent: {
            primary: { backgroundColor: $.color.gray[900], color: $.color.white },
            neutral: { backgroundColor: $.color.white, color: $.color.gray[900] },
        },
    },
    defaultVariants: { intent: "primary" },
});

export type ButtonProps = TVAProps<typeof button>;
```

## A complete component

```tsx
import { Theme } from "./theme.ts";
import { button } from "./button.ts";
import type { ButtonProps } from "./button.ts";
import type { Handle } from "remix/ui";

function SaveButton(handle: Handle<ButtonProps>) {
    return () => <button mix={button(handle.props)}>Save</button>;
}

function App() {
    return () => (
        <html>
            <head>
                <Theme />
            </head>
            <body>
                <SaveButton intent="neutral" />
            </body>
        </html>
    );
}
```

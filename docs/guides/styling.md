---
title: Styling
description: Style Remix apps with remix/ui css mixins and @pitlane/theme design tokens.
---

# Styling

Remix UI styles elements with the `css()` mixin through the `mix` prop. You manage no class names. Styles stream with server rendering, and structurally equal style objects share one generated class:

```tsx
import { css } from "remix/ui";

function Card() {
    return () => <article mix={css({ padding: "16px", color: "#111" })}>…</article>;
}
```

That works, but every value is a loose string. Nothing stops `#111` here and `#121212` two files over. `@pitlane/theme` layers design tokens and type safety on top, and this guide walks the whole surface. If you prefer reading code, the [demo app](https://github.com/pitlane-tools/pitlane/tree/main/demos/theme) covers the same ground as a running Remix app.

First, install the package. `remix` 3.0.0-beta.5 or later is a peer dependency:

```bash
vp add @pitlane/theme
```

## Define a theme

Design tokens live in a [W3C DTCG](https://www.designtokens.org/tr/drafts/format/) document passed to `createTheme`. Define the theme once, in something like `app/theme.ts`, and export the pieces:

```ts
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

Three things happened here. The `color` group sets `$type` once and its tokens inherit it. `color.bg` is an _alias_ of `color.white`, written with the DTCG reference syntax. And the `modes.dark` override redefines only `color.bg` for dark mode.

What you get back:

- `token`, destructured as `t` by convention. A typed mirror of the document whose leaves are `var()` reference strings. `t.color.white` is `"var(--color-white)"`.
- `raw`, a lookup from ref to concrete base value. `raw(t.color.bg)` follows the alias and returns `"#fff"`.
- `Theme`, a component that installs the CSS variables.

Each leaf also carries a compile-time _brand_ naming its token type. `t.color.white` is a `ColorToken` and `t.space.md` is a `DimensionToken`. Brands power the type errors you'll see below, and they vanish at runtime.

## Install the tokens

Render `<Theme />` once near the root. It emits a `<style>` tag with your custom properties, and it streams correctly during server rendering:

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

`css` from `@pitlane/theme` is remix/ui's `css()` with brand enforcement. Token-mapped properties only accept tokens from your theme:

```tsx
import { css } from "@pitlane/theme";
import { t } from "./theme.ts";

// css() binds to the element type of the `mix` position it appears in,
// so write it inline at each element, like remix/ui's own css.
<article
    mix={css({
        color: t.color.bg,
        padding: [t.space.sm, t.space.md], // tuples join with spaces
        margin: 0,
        // color: "#ff0000", // ✗ type error, not in the palette
        "&:hover": { color: t.color.gray[900] },
    })}
/>;
```

Off-palette literals fail to compile. Keywords like `"transparent"` and literal `0` stay legal, unmapped properties like `display` stay loose, and template interpolation is the escape hatch for shorthands: `` border: `1px solid ${t.color.gray[900]}` ``.

## Dark mode

The `modes.dark` override from earlier emits a media query, and nothing else:

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

Aliases keep their `var()` indirection in the emitted CSS, so overriding one referenced token flips every alias that points at it. The cascade does all the work, and the theme is correct on first paint. Switch your OS appearance with the demo app open and watch every surface follow.

## Variants with tva

`tva` is a cva-style variant resolver. It takes brand-enforced style objects instead of class strings and returns a `mix`-ready descriptor:

```ts
import { tva } from "@pitlane/theme";
import { t } from "./theme.ts";

export let button = tva({
    base: { padding: [t.space.sm, t.space.md] },
    variants: {
        intent: {
            primary: { backgroundColor: t.color.gray[900], color: t.color.white },
            neutral: { backgroundColor: t.color.white, color: t.color.gray[900] },
        },
    },
    defaultVariants: { intent: "primary" },
});
```

```tsx
<button mix={button({ intent: "neutral" })} type="button">
    Save
</button>
```

Resolution merges `base` first, then each matching variant. The merged object feeds a single `css()` call, so one invocation produces one class.

### Boolean variants

Name a variant's options `true` and `false` and callers pass a boolean prop:

```ts
export let button = tva({
    variants: {
        block: {
            true: { display: "flex", width: "auto" },
        },
    },
});
```

```tsx
<button mix={button({ block: true })} type="button" />
```

### Compound variants

A compound variant applies extra styles when several conditions hold at once:

```ts
export let button = tva({
    variants: {
        intent: { primary: {}, link: {} },
        size: { sm: {}, md: {} },
    },
    compoundVariants: [{ intent: "link", size: "md", css: { fontSize: t.text.lg } }],
});
```

### Default variants

`defaultVariants` fill in anything the caller omits. An explicit `undefined` falls back to the default too, which keeps spread-through component props predictable:

```ts
button(); // intent "primary"
button({ intent: undefined }); // still "primary"
```

## Compose components with combine

`combine` merges tva components into one, like cva's `compose`. The composed component accepts the union of both prop sets and keeps each input's defaults:

```ts
import { combine, tva } from "@pitlane/theme";

let rounded = tva({
    variants: {
        pill: { true: { borderRadius: t.radius.full } },
    },
});

export let pillButton = combine(button, rounded);
```

```tsx
<button mix={pillButton({ intent: "primary", pill: true })} type="button" />
```

## Mix with plain stylesheets

`mix` and `className` compose on the same element, so tokens and existing CSS coexist. `cx` joins class values, compatible with clsx:

```tsx
import { css, cx } from "@pitlane/theme";

<span className={cx("mono", isAlias && "alias-tag")} mix={css({ fontSize: t.text.sm })}>
    color.bg
</span>;
```

## TypeScript

`TVAProps` extracts a component's variant props, like cva's `VariantProps`:

```ts
import type { TVAProps } from "@pitlane/theme";

export type ButtonProps = TVAProps<typeof button>;
// { intent?: "primary" | "neutral"; block?: boolean }
```

Wire it into a component's own props to pass variants through:

```tsx
import type { Handle } from "remix/ui";

function SaveButton(handle: Handle<{ intent?: ButtonProps["intent"] }>) {
    return () => (
        <button mix={button({ intent: handle.props.intent })} type="button">
            Save
        </button>
    );
}
```

The [reference](/package/theme) documents the full exported type surface, the property-by-property enforcement table, and the error catalog.

## A complete component

Everything above, in three files:

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
        radius: { $type: "dimension", full: { $value: "999px" } },
    },
    {
        modes: {
            dark: { color: { bg: { $value: "{color.gray.900}" } } },
        },
    },
);
```

```ts
// app/components/button.ts
import { tva } from "@pitlane/theme";
import type { TVAProps } from "@pitlane/theme";

import { t } from "../theme.ts";

export let button = tva({
    base: { padding: [t.space.sm, t.space.md], borderRadius: t.radius.full },
    variants: {
        intent: {
            primary: { backgroundColor: t.color.gray[900], color: t.color.white },
            neutral: { backgroundColor: t.color.white, color: t.color.gray[900] },
        },
    },
    defaultVariants: { intent: "primary" },
});

export type ButtonProps = TVAProps<typeof button>;
```

```tsx
// app/app.tsx
import type { Handle } from "remix/ui";

import { button } from "./components/button.ts";
import type { ButtonProps } from "./components/button.ts";
import { Theme } from "./theme.ts";

function SaveButton(handle: Handle<{ intent?: ButtonProps["intent"] }>) {
    return () => (
        <button mix={button({ intent: handle.props.intent })} type="button">
            Save
        </button>
    );
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

## Explore the demo

The [theme demo](https://github.com/pitlane-tools/pitlane/tree/main/demos/theme) in this repository is a runnable version of this guide. It covers the full token document with semantic aliases and dark mode, plus a composed tva button, `raw()` swatch labels, and `cx()` interop. Clone the repo, build the package, and run it:

```sh
vp install
vp -C packages/theme run build
cd demos/theme
vp dev
```

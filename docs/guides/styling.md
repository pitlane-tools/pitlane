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

That works, but every value is a loose string. Nothing stops `#111` here and `#121212` two files over. `@pitlane/theme` layers design tokens and type safety on top. The [demo app](https://github.com/pitlane-tools/pitlane/tree/main/demos/theme) contains an application-level example.

First, install the package. `remix` 3.0.0-beta.10 or later is a peer dependency:

```bash
vp add @pitlane/theme
```

## Define a theme

A theme has a schema tree, a token tree, and optional modes. Define it once, such as in `app/theme.ts`, then export the typed accessor, raw-value resolver, and component:

```ts
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
        text: s.group(s.dimension(), { leading: s.number() }),
        shadow: s.shadow(),
        animate: s.any(),
        control: s.group(s.dimension(), { color: s.color() }),
    },
    tokens: {
        color: {
            white: "#fff",
            gray: { 50: "#fafafa", 900: "#171717" },
            bg: "{color.white}",
            page: lightDark("#fff", "#171717"),
        },
        spacing: "0.25rem",
        radius: { full: "999px", responsive: "clamp(0.25rem, 2vw, 1rem)" },
        text: { sm: "0.875rem", lg: "1.125rem", leading: { sm: 1.5, lg: 1.35 } },
        shadow: { card: "0 1px 2px rgb(0 0 0 / 0.07)" },
        animate: { spin: "spin 1s linear infinite" },
        control: {
            height: { sm: "28px", md: "32px" },
            color: { default: "#d4d4d8" },
        },
    },
});
```

Token values are the CSS they become. Each schema decides its leaf shape. It can be a string or number, and some schemas use arrays. Plain objects form groups. CSS strings pass through, so `clamp()`, `em`, `%`, `light-dark()`, and CSS color functions remain valid values. Composite schemas use CSS text, as `shadow.card` does above, rather than sub-value objects.

`token`, conventionally destructured as `t`, mirrors the token tree with branded `var()` strings. `t.color.white` is `"var(--color-white)"`. `raw(t.color.bg)` follows the reference and returns `"#fff"`. `<Theme />` installs every custom property. The brands exist at compile time and let `css()` reject a color where a dimension is required.

### Choose schemas

The schema names the type for each token or group. Import the factories as `s` to keep those declarations separate from the token values.

| Factory                   | Token type            | Accepted authored value                                                                                                                                                                                                                            |
| ------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `s.color()`               | `color`               | CSS color text, including `light-dark()`, `color-mix()`, and `currentColor`                                                                                                                                                                        |
| `s.dimension()`           | `dimension`           | CSS length text, including `clamp()`, `calc()`, `em`, and `%`                                                                                                                                                                                      |
| `s.duration()`            | `duration`            | CSS time text, including `ms`, `s`, and `calc()`                                                                                                                                                                                                   |
| `s.number()`              | `number`              | A finite number                                                                                                                                                                                                                                    |
| `s.easing()`              | `cubicBezier`         | `cubic-bezier(...)` text or a four-number tuple                                                                                                                                                                                                    |
| `s.shadow()`              | `shadow`              | CSS shadow text, including `inset`                                                                                                                                                                                                                 |
| `s.border()`              | `border`              | CSS border shorthand text                                                                                                                                                                                                                          |
| `s.transition()`          | `transition`          | CSS transition shorthand text                                                                                                                                                                                                                      |
| `s.gradient()`            | `gradient`            | CSS gradient function text                                                                                                                                                                                                                         |
| `s.stroke()`              | `strokeStyle`         | `solid`, `dashed`, `dotted`, `double`, `groove`, `ridge`, `outset`, or `inset`                                                                                                                                                                     |
| `s.font.family()`         | `fontFamily`          | A font name or an array of font names                                                                                                                                                                                                              |
| `s.font.weight()`         | `fontWeight`          | A number from 1 through 1000, or `thin`, `hairline`, `extra-light`, `ultra-light`, `light`, `normal`, `regular`, `book`, `medium`, `semi-bold`, `demi-bold`, `bold`, `extra-bold`, `ultra-bold`, `black`, `heavy`, `extra-black`, or `ultra-black` |
| `s.scale()`               | `dimension`           | One base length whose accessor multiplies it                                                                                                                                                                                                       |
| `s.any()`                 | None                  | A string or number emitted verbatim                                                                                                                                                                                                                |
| `s.group(self, children)` | Inherited from `self` | A typed node with schema overrides for children                                                                                                                                                                                                    |

`s.group(self, children)` gives a group a type and lets specific children use another type. In the example, `control.height.sm` inherits `s.dimension()`, while `control.color.default` uses `s.color()`. `default` is an ordinary token name. The schema stores its own type separately, so no token name is reserved.

Use `s.scale()` for a single base value that callers multiply. The accessor is callable, and its `.token` property holds the unmultiplied base:

```ts
t.spacing(4); // calc(var(--spacing) * 4)
t.spacing(0.5); // calc(var(--spacing) * 0.5)
t.spacing.token; // var(--spacing)
```

The module-level `scale()` applies the same operation to an ordinary dimension, duration, or number token:

```ts
import { scale } from "@pitlane/theme";

scale(t.text.sm)(2); // calc(var(--text-sm) * 2)
```

Declare `s.any()` for CSS values without a token type, such as `animation` values and aspect ratios. Its accessor has its own brand. Open-grammar properties, including `animation` and `aspectRatio`, accept it. Token-mapped properties, including `color`, reject it.

### Reference and derive tokens

A reference to another token is a property access on the layer below. There is no string syntax for one, so every reference is checked by the compiler and renaming a token breaks its references at build time rather than in the stylesheet.

`extend` deep-merges a patch with its base. Its callback receives the accessor of the preceding layer:

```ts
let baseTheme = createTheme({
    schema: { color: s.color() },
    tokens: { color: { white: "#fff" } },
});

let applicationTheme = baseTheme.extend(base => ({
    schema: { surface: s.color() },
    tokens: { surface: { page: base.color.white } },
}));
```

`applicationTheme` emits `--surface-page: var(--color-white)`, so the declaration keeps its indirection and a later override of `color.white` reaches it.

References work across layers, so a semantic tier is a separate `extend` from the primitives it names. That is the shape a design system already has.

A composite is authored as CSS text, so a reference goes inside the shorthand by interpolating the accessor leaf:

```ts
let shadows = baseTheme.extend(base => ({
    schema: { shadow: s.shadow() },
    tokens: { shadow: { card: `0 1px 2px ${base.color.white}` } },
}));
```

That emits `--shadow-card: 0 1px 2px var(--color-white);`, so a mode override of `color.white` reaches the shadow.

`select` replaces a theme with a projection. It retains selected tokens, and its output paths decide the resulting custom-property names, so a projection can reshape and rename a tree:

```ts
let publicTheme = baseTheme.select(base => ({
    schema: { brand: { primary: s.color() } },
    tokens: { brand: { primary: base.color.white } },
}));

publicTheme.token.brand.primary; // var(--brand-primary)
```

`@pitlane/theme/default` exports `DefaultTheme`, a `<Theme />` component built from Tailwind v4 primitives. It has colors, spacing, radii, fonts, and other primitives. Semantic names belong in the theme that extends it. Select the primitives an application uses before rendering the theme:

```ts
import { createTheme } from "@pitlane/theme";
import { DefaultTheme } from "@pitlane/theme/default";
import * as s from "@pitlane/theme/schema";

export let {
    token: t,
    raw,
    Theme,
} = createTheme(DefaultTheme).select(base => ({
    schema: {
        color: s.color(),
        spacing: s.scale(),
        radius: s.dimension(),
    },
    tokens: {
        color: { blue: base.color.blue, gray: base.color.gray },
        spacing: base.spacing.token,
        radius: base.radius,
    },
}));
```

Validation runs when `createTheme` compiles the theme. Invalid values raise `ValidationError` from `remix/data-schema`. Its `issues` array contains every invalid value with its path and diagnostic. `ValidationError.message` is generic. Structural failures raise `ThemeError`, including a reference whose type does not match its position, a reference to an untyped token, a projection that drops a token something it kept refers to, a CSS variable collision, an undeclared token, and a mode that overrides an unknown token.

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

// css() binds to the element type of the mix position it appears in,
// so write it inline at each element, like remix/ui's own css.
<article
    mix={css({
        color: t.color.bg,
        padding: [t.spacing(2), t.spacing(4)], // tuples join with spaces
        margin: 0,
        // color: "#ff0000", // type error: outside the palette
        "&:hover": { color: t.color.gray[900] },
    })}
/>;
```

Off-palette literals fail to compile. Keywords such as `transparent` and literal `0` stay legal. Properties outside the token-mapped set carry [csstype](https://github.com/frenic/csstype)'s value union, so `resize: "vertical"` autocompletes and `resize: "diagonal"` is a type error, while open-grammar properties such as `background` and `gridTemplateColumns` take any string. Template interpolation covers shorthands: `` border: `1px solid ${t.color.gray[900]}` ``.

## Dark mode

Use `lightDark(light, dark)` for a color whose value follows the active CSS color scheme. The `color.page` token in the theme above becomes `light-dark(#fff, #171717)`, and responds to the operating-system preference without a theme mode. `lightDark()` accepts accessor references too, so its colors can still be overridden in a later layer.

`light-dark()` resolves against the `color-scheme` property, and an undeclared `color-scheme` behaves as light, so the function would otherwise keep its light value on a dark system. `<Theme />` declares `color-scheme: light dark` on `:root` whenever a token uses the function. Declare a narrower value yourself to override it.

Use `modes` for values that CSS `light-dark()` cannot carry, including shadows, dimensions, durations, and font stacks. A mode may set `media`, `selector`, or both. `selector` adds a selector block alongside the mode's media block. `light` and `dark` default to their matching `prefers-color-scheme` query. Supply `media` for an explicit condition or for another mode name.

```ts
modes: {
    light: {
        media: "(prefers-color-scheme: light)",
        selector: ':root[data-color-scheme="light"]',
        tokens: { shadow: { card: "0 1px 2px rgb(0 0 0 / 0.07)" } },
    },
    dark: {
        media: "(prefers-color-scheme: dark)",
        selector: ':root[data-color-scheme="dark"]',
        tokens: { shadow: { card: "0 1px 2px rgb(0 0 0 / 0.4)" } },
    },
},
```

`:root[data-color-scheme="dark"]` and `:root[data-color-scheme="light"]` have greater specificity than `:root` in a media block. An explicit choice wins over the operating-system preference. Set both the attribute and `color-scheme` when a toggle controls values from `modes` and `lightDark()`:

```ts
type ColorScheme = "light" | "dark";

function setColorScheme(scheme: ColorScheme | undefined) {
    let root = document.documentElement;

    if (scheme === undefined) {
        root.removeAttribute("data-color-scheme");
        root.style.removeProperty("color-scheme");
        return;
    }

    root.setAttribute("data-color-scheme", scheme);
    root.style.colorScheme = scheme;
}
```

Call `setColorScheme(undefined)` to return control to the operating-system preference.

## Variants with tva

`tva` is a cva-style variant resolver. It takes brand-enforced style objects instead of class strings and returns a `mix`-ready descriptor:

```ts
import { tva } from "@pitlane/theme";
import { t } from "./theme.ts";

export let button = tva({
    base: { padding: [t.spacing(2), t.spacing(4)] },
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

Every variant prop is optional. To require one, wrap the component and re-declare that prop as required:

```ts
import type { TVAProps } from "@pitlane/theme";

type ButtonVariants = TVAProps<typeof button>;

interface IntentButtonProps
    extends Omit<ButtonVariants, "intent">, Required<Pick<ButtonVariants, "intent">> {}

export let intentButton = (props: IntentButtonProps) => button(props);
```

The [reference](/package/theme/) documents every export, the property-by-property enforcement table, and the error catalog.

## A complete component

These three files define a theme, a typed button variant, and a component that installs the theme near the document root:

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
        text: s.group(s.dimension(), { leading: s.number() }),
    },
    tokens: {
        color: {
            white: "#fff",
            gray: { 50: "#fafafa", 900: "#171717" },
            page: lightDark("#fff", "#171717"),
        },
        spacing: "0.25rem",
        radius: { full: "999px" },
        text: { sm: "0.875rem", lg: "1.125rem", leading: { sm: 1.5 } },
    },
});
```

```ts
// app/components/button.ts
import { tva } from "@pitlane/theme";
import type { TVAProps } from "@pitlane/theme";

import { t } from "../theme.ts";

export let button = tva({
    base: { padding: [t.spacing(2), t.spacing(4)], borderRadius: t.radius.full },
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

The [theme demo](https://github.com/pitlane-tools/pitlane/tree/main/demos/theme) is a Remix application for inspecting rendered token styles and component variants. Build the package, then start the demo from its directory:

```sh
vp install
vp -C packages/theme run build
cd demos/theme
vp dev
```

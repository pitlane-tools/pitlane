---
title: "@pitlane/theme"
description: Type-safe styling with W3C design tokens for Remix 3.
---

# @pitlane/theme

Type-safe styling with design tokens. `createTheme` takes a [W3C DTCG design-token document](https://www.designtokens.org/tr/drafts/format/) and returns a branded token accessor plus a `<Theme />` component that installs the tokens as CSS custom properties. Module-level `css`, `tva`, `cx`, and `combine` helpers enforce your palette at the type level on top of `remix/ui`'s `css()` mixin.

## Install

```bash
vp add @pitlane/theme
```

`remix` (>= 3.0.0-beta.5) is a peer dependency.

## createTheme

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
        space: {
            $type: "dimension",
            sm: { $value: "8px" },
            md: { $value: { value: 16, unit: "px" } },
        },
    },
    {
        modes: {
            dark: { color: { bg: { $value: "{color.gray.900}" } } },
        },
    },
);
```

- `token` — a same-shape accessor. Every leaf is a `var(--…)` string branded by its token type: `t.color.white` is a `ColorToken` whose value is `"var(--color-white)"`.
- `raw(ref)` — the serialized base-mode value behind a ref: `raw(t.color.white)` → `"#fff"`. Aliases are chased to their concrete value. Refs from another theme throw.
- `Theme` — a component that renders a `<style data-pitlane-theme>` tag containing the token CSS. Render it once near your root. Accepts an optional `nonce` prop for CSP.

CSS variable names are the kebab-cased token path: `color.gray.900` → `--color-gray-900`.

Author token documents in TypeScript. JSON imports work at runtime, but TypeScript widens JSON literals, so brands degrade to `never` — a `.ts` file with an inline object (no `as const` needed) gives full typing.

### Modes

`modes.light` / `modes.dark` are partial documents of the same shape that override `$value` only. They emit under `@media (prefers-color-scheme: …)` — no attribute selectors. Aliased overrides keep their `var()` indirection, so a mode override of a referenced token cascades through every alias.

## DTCG support

| Feature | Support |
| --- | --- |
| Groups + group-level `$type` inheritance | ✓ |
| Aliases `{path.to.token}` (full values and composite sub-values) | ✓ — emitted as `var()` references |
| color, dimension, duration | ✓ — legacy strings and structured objects |
| fontFamily, fontWeight, number, cubicBezier | ✓ |
| shadow, border, transition, gradient, strokeStyle | ✓ — single CSS value each |
| typography | ✗ — throws (planned) |
| `$description`, `$extensions`, `$deprecated` | Parsed and ignored |

Gradient tokens serialize to a color-stop list (`#fff 0%, #000 100%`) for use inside `linear-gradient(…)` and friends. Gradient stop positions must be literal numbers; stop colors may be aliases. Object-form `strokeStyle` serializes to `dashed` (the spec's CSS fallback).

## css

```tsx
import { css } from "@pitlane/theme";
import { t } from "./theme.ts";

<div
    mix={css({
        color: t.color.bg, // ✓ ColorToken
        backgroundColor: "transparent", // ✓ CSS keyword
        padding: [t.space.sm, t.space.md], // ✓ 1–4 token tuple
        margin: 0, // ✓ literal zero
        "&:hover": { color: t.color.gray[900] },
    })}
/>;
```

Token-mapped longhands only accept the matching brand, CSS-wide keywords, property keywords, and `0` — `color: "#ff0000"` is a type error. Unmapped properties (`display`, `border`, `background`, …) stay loosely typed; interpolating a token into a template string (`` border: `1px solid ${t.color.bg}` ``) is the intended escape hatch, and `remix/ui`'s own `css()` remains fully untyped if you need out.

`css()` is node-generic, exactly like remix/ui's own `css`: the descriptor it returns binds to the element type of the `mix` position it appears in, so write `css({ … })` inline at each element. For styles genuinely reused across elements, share a `ThemedCSSProps` object and pass it through `css()` per callsite — a stored descriptor is bound to one element type.

Canonical property map (`Wide` = `inherit | initial | unset | revert | revert-layer`):

| Property family | Accepted values |
| --- | --- |
| `color`, `backgroundColor`, `borderColor`, `borderTopColor`, `borderRightColor`, `borderBottomColor`, `borderLeftColor`, `outlineColor`, `textDecorationColor`, `columnRuleColor`, `caretColor`, `accentColor`, `fill`, `stroke` | `ColorToken \| "transparent" \| "currentColor" \| Wide` |
| `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `flexBasis` | `DimensionToken \| 0 \| "auto" \| "min-content" \| "max-content" \| "fit-content" \| Wide` |
| `top`, `right`, `bottom`, `left`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft` | `DimensionToken \| 0 \| "auto" \| Wide` |
| `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `fontSize`, `textIndent`, `outlineOffset`, `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius`, `rowGap`, `columnGap` | `DimensionToken \| 0 \| Wide` |
| `letterSpacing`, `wordSpacing` | `DimensionToken \| 0 \| "normal" \| Wide` |
| `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`, `outlineWidth` | `DimensionToken \| 0 \| "thin" \| "medium" \| "thick" \| Wide` |
| `padding`, `margin`, `inset`, `borderRadius` (box shorthands) | single value as the longhand, **or** tuple of 1–4 such values → space-joined |
| `gap` | `DimensionToken \| 0 \| Wide` or 2-tuple |
| `fontFamily` | `FontFamilyToken \| Wide` |
| `fontWeight` | `FontWeightToken \| "normal" \| "bold" \| "lighter" \| "bolder" \| Wide` |
| `lineHeight` | `NumberToken \| DimensionToken \| "normal" \| Wide` |
| `opacity`, `zIndex`, `flexGrow`, `flexShrink`, `order` | `NumberToken \| number \| Wide` (plain numbers stay legal — enforcing tokens for `zIndex: 10` is noise) |
| `transitionDuration`, `transitionDelay`, `animationDuration`, `animationDelay` | `DurationToken \| Wide` |
| `transitionTimingFunction`, `animationTimingFunction` | `CubicBezierToken \| "ease" \| "linear" \| "ease-in" \| "ease-out" \| "ease-in-out" \| "step-start" \| "step-end" \| Wide` |
| `boxShadow`, `textShadow` | `ShadowToken \| "none" \| Wide` |

## tva

```ts
import { tva } from "@pitlane/theme";
import type { TVAProps } from "@pitlane/theme";

let button = tva({
    base: { padding: [t.space.sm, t.space.md] },
    variants: {
        intent: {
            primary: { backgroundColor: t.color.gray[900], color: t.color.white },
            neutral: { backgroundColor: t.color.white, color: t.color.gray[900] },
        },
        block: { true: { width: "auto" } },
    },
    compoundVariants: [{ intent: "neutral", block: true, css: { margin: 0 } }],
    defaultVariants: { intent: "primary" },
});

type ButtonProps = TVAProps<typeof button>;

<button mix={button({ intent: "neutral" })} />;
```

Styles deep-merge `base` → matching variants → matching compound variants into one `css()` call. `combine(a, b)` composes tva components (cva's `compose`); `cx(…)` is a clsx-style `className` joiner for interop.

## Errors

`createTheme` throws `ThemeError` (never renders broken CSS) for: missing or unknown `$type`; typography tokens; aliases to unknown tokens; alias cycles; CSS variable-name collisions; invalid values for a declared type; and mode overrides that target unknown tokens or set anything but `$value`. `raw()` throws for refs the theme didn't mint.

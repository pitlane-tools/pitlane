---
title: "@pitlane/theme"
description: Type-safe styling with W3C design tokens for Remix 3.
---

# @pitlane/theme

Type-safe styling with design tokens. `createTheme` takes a [W3C DTCG design-token document](https://www.designtokens.org/tr/drafts/format/) and returns a typed token accessor plus a `<Theme />` component that installs the tokens as CSS custom properties. The package also exports `css`, `tva`, `cx`, and `combine`, which enforce your palette at the type level on top of `remix/ui`'s `css()` mixin.

Every feature on this page appears in a working app: the [theme demo](https://github.com/pitlane-tools/pitlane/tree/main/demos/theme) in this repository renders tokens, variants, composition, and dark mode in about 200 lines.

## Install

```bash
vp add @pitlane/theme
```

`remix` (3.0.0-beta.5 or later) is a peer dependency.

## The token document

`createTheme` accepts one argument shaped by the DTCG format. A node with a `$value` is a token. Every other key is a group, and groups nest to any depth.

```ts
import { createTheme } from "@pitlane/theme";

export let {
    token: t,
    raw,
    Theme,
} = createTheme({
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
    shadow: {
        card: {
            $type: "shadow",
            $value: {
                color: "{color.gray.900}",
                offsetX: "0px",
                offsetY: "1px",
                blur: "3px",
                spread: "0px",
            },
        },
    },
});
```

Each token becomes a CSS custom property named after its kebab-cased path. `color.gray.900` becomes `--color-gray-900`. Two paths that collide after kebab-casing throw at `createTheme` time, and so do names containing `.`, `{`, or `}`, which the reference syntax reserves.

Author token documents in TypeScript. JSON imports work at runtime, but TypeScript widens JSON literals, so the brands described below degrade. An inline object needs no `as const`: `createTheme` uses a `const` type parameter.

### Types and inheritance

A token's type comes from its own `$type`, from the token it references, or from the nearest ancestor group's `$type`, in that order. This matches the DTCG Format Module's resolution rules. A token whose type cannot be resolved throws.

| `$type`       | Accepted `$value`                                               | Serializes to                                                                                              |
| ------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `color`       | CSS color string, or `{ colorSpace, components, alpha?, hex? }` | the string as written, `hex` when present, or the color-space function (`oklch(…)`, `color(display-p3 …)`) |
| `dimension`   | `"16px"` or `{ value, unit }` with `px` or `rem`                | concatenation                                                                                              |
| `duration`    | `"200ms"` or `{ value, unit }` with `ms` or `s`                 | concatenation                                                                                              |
| `fontFamily`  | string or non-empty array of strings                            | quoted where needed, comma-joined                                                                          |
| `fontWeight`  | number 1 to 1000, or a DTCG keyword like `"semi-bold"`          | the number (keywords map to numbers)                                                                       |
| `number`      | number                                                          | the number                                                                                                 |
| `cubicBezier` | `[x1, y1, x2, y2]`                                              | `cubic-bezier(…)`                                                                                          |
| `shadow`      | object or array of objects                                      | a CSS shadow list                                                                                          |
| `border`      | `{ color, width, style }`                                       | `width style color`                                                                                        |
| `transition`  | `{ duration, timingFunction, delay? }`                          | `duration timing-function delay`                                                                           |
| `gradient`    | array of `{ color, position }` stops                            | a color-stop list for use inside `linear-gradient(…)`                                                      |
| `strokeStyle` | keyword or `{ dashArray, lineCap }`                             | the keyword, or `dashed` for the object form                                                               |

Two details worth knowing. Gradient stop positions must be literal numbers, though stop colors may be aliases. `typography` tokens throw: they need one variable per subproperty, which is planned but not built.

### Aliases

A `$value` of `"{path.to.token}"` references another token. Aliases resolve to `var()` indirection in the emitted CSS, not to copies of the value:

```css
:root {
    --color-white: #fff;
    --color-bg: var(--color-white);
}
```

That indirection is what makes mode overrides cascade. Change what `color.white` resolves to and every alias of it follows, with no duplicate declarations. Aliases work as full token values and inside composite sub-values, so a shadow's `color` field can reference `{color.gray.900}`. Unknown targets and reference cycles throw. References are also type-checked: a shadow's `color` field only accepts a color-typed token, and a token with an explicit `$type` only aliases a token of that same type. A mismatch throws naming both types.

## Dark mode

Pass `modes` as the second argument. Each mode is a partial document of the same shape that overrides `$value` only:

```ts
export let {
    token: t,
    raw,
    Theme,
} = createTheme(tokens, {
    modes: {
        dark: {
            color: {
                bg: { $value: "{color.gray.900}" },
            },
        },
    },
});
```

`<Theme />` emits the base `:root` block plus one `@media (prefers-color-scheme: dark)` block containing only the overridden variables:

```css
@media (prefers-color-scheme: dark) {
    :root {
        --color-bg: var(--color-gray-900);
    }
}
```

There are no attribute selectors and no JavaScript. The OS appearance setting flips the variables, and every alias follows. Overrides that target unknown tokens, change a token's type (directly or by aliasing a token of a different type), or set anything besides `$value` throw at `createTheme` time.

## The token accessor

`createTheme` returns `token`, conventionally destructured as `t`. It mirrors the document's shape, and every leaf is a `var()` reference string:

```ts
t.color.white; // "var(--color-white)" at runtime
t.color.gray[900]; // numeric keys index with brackets
```

### Brands

Each leaf carries a _brand_: a compile-time tag naming its token type. `t.color.white` is a `ColorToken`, `t.space.md` is a `DimensionToken`, and so on through all twelve DTCG types. Brands are what let `css()` reject a dimension where a color belongs. They exist only in the type system. At runtime a ref is a plain string, so brands cost nothing.

Brands are also theme-independent: tokens minted by two different `createTheme` calls mix freely in one `css()` call.

## raw

`raw(ref)` returns the serialized base-mode value behind a ref, chasing references to the end. Full-value aliases and composite sub-values both resolve to concrete values, never to `var()` strings:

```ts
raw(t.color.white); // "#fff"
raw(t.color.bg); // "#fff" (follows the alias)
raw(t.space.md); // "16px"
raw(t.shadow.card); // "0px 1px 3px 0px #171717" — the sub-value alias is resolved too
```

`raw` answers with the base mode's value even when a dark override exists, since mode resolution happens in CSS, not in JavaScript. A ref naming a variable the theme never minted throws. Because refs are plain strings, two themes that define the same token path mint identical refs. `raw` can't tell them apart and answers for its own theme.

## css

`css()` wraps `remix/ui`'s mixin of the same name with brand enforcement. Write it inline at the element, and pass the result to the `mix` prop:

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

Token-mapped longhands accept the matching brand, CSS-wide keywords, property keywords, and `0`. Anything else is a type error, including `color: "#ff0000"`. Unmapped properties (`display`, `border`, `background`, and the rest) stay loosely typed. Nested selectors and media queries recurse. On loose properties an array value joins with spaces (the tuple behavior box shorthands use), so comma lists like `transitionProperty` need a template string instead.

`css()` is node-generic, exactly like remix/ui's own `css`. The descriptor it returns binds to the element type of the `mix` position it appears in, so write `css({ … })` inline at each element. For styles reused across elements, share a `ThemedCSSProps` object and pass it through `css()` per callsite. A stored descriptor is bound to one element type.

### Escape hatches

Two exits exist when strictness gets in the way. Interpolating a token into a template string produces a plain string, which unmapped shorthands accept:

```ts
border: `1px solid ${t.color.gray[900]}`,
```

And `remix/ui`'s own `css()` remains fully untyped when you need out entirely.

### What each property accepts

`Wide` below stands for the CSS-wide keywords `inherit | initial | unset | revert | revert-layer`.

| Property family                                                                                                                                                                                                                    | Accepted values                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `color`, `backgroundColor`, `borderColor`, `borderTopColor`, `borderRightColor`, `borderBottomColor`, `borderLeftColor`, `outlineColor`, `textDecorationColor`, `columnRuleColor`, `caretColor`, `accentColor`, `fill`, `stroke`   | `ColorToken \| "transparent" \| "currentColor" \| Wide`                                                                    |
| `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `flexBasis`                                                                                                                                                   | `DimensionToken \| 0 \| "auto" \| "min-content" \| "max-content" \| "fit-content" \| Wide`                                 |
| `top`, `right`, `bottom`, `left`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft`                                                                                                                                         | `DimensionToken \| 0 \| "auto" \| Wide`                                                                                    |
| `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `fontSize`, `textIndent`, `outlineOffset`, `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius`, `rowGap`, `columnGap` | `DimensionToken \| 0 \| Wide`                                                                                              |
| `letterSpacing`, `wordSpacing`                                                                                                                                                                                                     | `DimensionToken \| 0 \| "normal" \| Wide`                                                                                  |
| `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`, `outlineWidth`                                                                                                                                       | `DimensionToken \| 0 \| "thin" \| "medium" \| "thick" \| Wide`                                                             |
| `padding`, `margin`, `inset`, `borderRadius` (box shorthands)                                                                                                                                                                      | a single value as the longhand, or a tuple of 1 to 4 such values, space-joined                                             |
| `gap`                                                                                                                                                                                                                              | `DimensionToken \| 0 \| Wide` or 2-tuple                                                                                   |
| `fontFamily`                                                                                                                                                                                                                       | `FontFamilyToken \| Wide`                                                                                                  |
| `fontWeight`                                                                                                                                                                                                                       | `FontWeightToken \| "normal" \| "bold" \| "lighter" \| "bolder" \| Wide`                                                   |
| `lineHeight`                                                                                                                                                                                                                       | `NumberToken \| DimensionToken \| "normal" \| Wide`                                                                        |
| `opacity`, `zIndex`, `flexGrow`, `flexShrink`, `order`                                                                                                                                                                             | `NumberToken \| number \| Wide` (plain numbers stay legal, since enforcing tokens for `zIndex: 10` is noise)               |
| `transitionDuration`, `transitionDelay`, `animationDuration`, `animationDelay`                                                                                                                                                     | `DurationToken \| Wide`                                                                                                    |
| `transitionTimingFunction`, `animationTimingFunction`                                                                                                                                                                              | `CubicBezierToken \| "ease" \| "linear" \| "ease-in" \| "ease-out" \| "ease-in-out" \| "step-start" \| "step-end" \| Wide` |
| `boxShadow`, `textShadow`                                                                                                                                                                                                          | `ShadowToken \| "none" \| Wide`                                                                                            |

## tva

`tva` is a variant resolver modeled on [cva](https://cva.style). Where cva composes class strings, `tva` composes brand-enforced style objects and returns a `mix`-ready descriptor.

### Creating variants

```ts
import { tva } from "@pitlane/theme";
import { t } from "./theme.ts";

export let button = tva({
    base: {
        borderRadius: t.radius.md,
        fontWeight: t.weight.medium,
    },
    variants: {
        intent: {
            primary: { backgroundColor: t.color.accent, color: t.color.white },
            secondary: { backgroundColor: "transparent", color: t.color.text },
        },
        size: {
            sm: { padding: [t.space.xs, t.space.sm], fontSize: t.text.sm },
            md: { padding: [t.space.sm, t.space.md], fontSize: t.text.md },
        },
    },
    defaultVariants: { intent: "primary", size: "md" },
});
```

```tsx
<button mix={button({ intent: "secondary", size: "sm" })} type="button" />
```

Resolution deep-merges `base`, then each matching variant in declaration order, then matching compound variants in array order. The merged object feeds one `css()` call, so each invocation produces one generated class. Every style slot is `ThemedCSSProps`, with the same brand enforcement as `css()`.

### Boolean variants

Name a variant's options `true` and `false` and callers pass booleans:

```ts
let button = tva({
    variants: {
        block: {
            true: { display: "flex", width: "auto" },
        },
    },
});

button({ block: true });
```

### Compound variants

Compound variants apply their `css` when every listed condition matches, after the individual variants merge:

```ts
let button = tva({
    variants: {
        intent: { primary: {}, link: {} },
        size: { sm: {}, md: {} },
    },
    compoundVariants: [{ intent: "link", size: "md", css: { fontSize: t.text.lg } }],
});
```

### Default variants

`defaultVariants` fill in unspecified props. Passing `undefined` explicitly falls back to the default rather than clearing it:

```ts
button(); // intent "primary", size "md"
button({ intent: undefined }); // same
```

### resolve

Every tva component exposes `resolve(props)`, which returns the merged `ThemedCSSProps` object without creating a descriptor. `combine` is built on it, and tests find it handy for asserting merge output.

## combine

`combine` composes tva components, like cva's `compose`. The result accepts the union of the inputs' props and honors each component's own defaults:

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

Each input resolves independently, the results deep-merge in argument order, and one `css()` call produces one class.

## cx

`cx` joins `className` values, compatible with clsx. It exists for interop with plain stylesheets, since `mix` and `className` compose on the same element:

```tsx
import { cx } from "@pitlane/theme";

<span className={cx("mono", isAlias && "alias-tag")} mix={css({ fontSize: t.text.sm })} />;
```

Strings and numbers join with spaces. Falsy values drop. Arrays flatten. Object keys with truthy values join.

## The Theme component

`Theme` renders a `<style data-pitlane-theme>` element containing the token CSS. Render it once, near the document root:

```tsx
import { Theme } from "./theme.ts";

<head>
    <Theme />
</head>;
```

The output contains the base `:root` block plus one media block per configured mode. It renders identically during server streaming and on the client, and it accepts a `nonce` prop for Content Security Policy setups. Style text is escaped, so token values cannot break out of the tag.

## TypeScript

### TVAProps

`TVAProps` extracts a tva component's props type, like cva's `VariantProps`:

```ts
import type { TVAProps } from "@pitlane/theme";

export type ButtonProps = TVAProps<typeof button>;
// { intent?: "primary" | "secondary"; size?: "sm" | "md" }
```

### Required variants

All variant props are optional. To require one, follow the cva recipe and wrap the component:

```ts
import type { TVAProps } from "@pitlane/theme";

type BannerVariantProps = TVAProps<typeof bannerVariants>;

interface BannerProps
    extends Omit<BannerVariantProps, "tone">, Required<Pick<BannerVariantProps, "tone">> {}

export let banner = (props: BannerProps) => bannerVariants(props);
```

### Exported types

| Type                                                                                                                                                                                                           | Purpose                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `ColorToken`, `DimensionToken`, `DurationToken`, `FontFamilyToken`, `FontWeightToken`, `NumberToken`, `CubicBezierToken`, `ShadowToken`, `BorderToken`, `TransitionToken`, `GradientToken`, `StrokeStyleToken` | the twelve brands                                                      |
| `AnyToken`, `TokenType`                                                                                                                                                                                        | the brand union and the `$type` union                                  |
| `ThemedCSSProps`                                                                                                                                                                                               | the style-object type accepted by `css()` and every tva slot           |
| `ThemedCSSMixin<node>`                                                                                                                                                                                         | the descriptor `css()` returns                                         |
| `TokenTree<T>`, `DeepPartialTokens<T>`, `DTCGDocument`                                                                                                                                                         | the accessor shape, the `modes` override shape, and the input document |
| `ThemeOptions`, `ThemeResult`, `ThemeComponent`, `ThemeProps`                                                                                                                                                  | `createTheme`'s option and return types                                |
| `TVAConfig`, `TVAFn`, `TVAProps`, `CombinedTVAFn`, `ClassValue`                                                                                                                                                | the tva and cx surface                                                 |

## Errors

`createTheme` validates everything up front and throws `ThemeError` rather than emit broken CSS. Every message names the offending token path.

| Condition                         | Example message shape                                                        |
| --------------------------------- | ---------------------------------------------------------------------------- |
| Missing or unknown `$type`        | `"color.brand" has unknown $type "sparkles"`                                 |
| Typography token                  | `"heading": typography tokens are not supported in v1`                       |
| Reserved characters in a name     | `name contains characters reserved by DTCG references (".", "{", "}")`       |
| Alias to a missing token          | `"color.bg" references unknown token "color.white"`                          |
| Alias to a wrong-typed token      | `references "space.sm" of type "dimension" where "color" is required`        |
| Alias cycle                       | `Alias cycle: a → b → a`                                                     |
| Variable-name collision           | names both colliding paths                                                   |
| Invalid value for a declared type | names the path and the value; an empty `fontFamily` array counts             |
| Bad mode override                 | unknown path, changed type (directly or via alias), or keys besides `$value` |

`raw()` throws for refs naming a variable the theme never minted.

## Learn more

The [styling guide](/guides/styling) walks these features end to end in tutorial form. The [demo app](https://github.com/pitlane-tools/pitlane/tree/main/demos/theme) is the same material as a running Remix app you can clone and edit.

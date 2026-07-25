import type * as CSS from "csstype";

import type {
    ColorToken,
    CubicBezierToken,
    DimensionToken,
    DurationToken,
    FontFamilyToken,
    FontWeightToken,
    NumberToken,
    ShadowToken,
} from "./brands.ts";

type Wide = "inherit" | "initial" | "unset" | "revert" | "revert-layer";

type ColorLike = ColorToken | "transparent" | "currentColor" | Wide;
type Size = DimensionToken | 0 | Wide;
type SizeAuto = DimensionToken | 0 | "auto" | Wide;
type SizeIntrinsic =
    | DimensionToken
    | 0
    | "auto"
    | "min-content"
    | "max-content"
    | "fit-content"
    | Wide;
type SpacingText = DimensionToken | 0 | "normal" | Wide;
type LineWidth = DimensionToken | 0 | "thin" | "medium" | "thick" | Wide;
type Easing =
    | CubicBezierToken
    | "ease"
    | "linear"
    | "ease-in"
    | "ease-out"
    | "ease-in-out"
    | "step-start"
    | "step-end"
    | Wide;
type ShadowLike = ShadowToken | "none" | Wide;
type Numeric = NumberToken | number | Wide;

type Repeat1to4<V> = readonly [V] | readonly [V, V] | readonly [V, V, V] | readonly [V, V, V, V];

type PadItem = DimensionToken | 0;
type MarginItem = DimensionToken | 0 | "auto";

/**
 * Longhands whose values must come from the token document. Each one
 * narrows the matching CSS property to a token brand plus the small
 * keyword set the property genuinely needs.
 *
 * @see {@link ThemedCSSProps}
 */
interface TokenMappedProps {
    // Colors
    color?: ColorLike;
    backgroundColor?: ColorLike;
    borderColor?: ColorLike;
    borderTopColor?: ColorLike;
    borderRightColor?: ColorLike;
    borderBottomColor?: ColorLike;
    borderLeftColor?: ColorLike;
    borderBlockColor?: ColorLike;
    borderInlineColor?: ColorLike;
    outlineColor?: ColorLike;
    textDecorationColor?: ColorLike;
    columnRuleColor?: ColorLike;
    caretColor?: ColorLike;
    accentColor?: ColorLike;
    fill?: ColorLike;
    stroke?: ColorLike;
    // Sizing
    width?: SizeIntrinsic;
    height?: SizeIntrinsic;
    minWidth?: SizeIntrinsic;
    minHeight?: SizeIntrinsic;
    maxWidth?: SizeIntrinsic;
    maxHeight?: SizeIntrinsic;
    blockSize?: SizeIntrinsic;
    inlineSize?: SizeIntrinsic;
    minBlockSize?: SizeIntrinsic;
    minInlineSize?: SizeIntrinsic;
    maxBlockSize?: SizeIntrinsic;
    maxInlineSize?: SizeIntrinsic;
    flexBasis?: SizeIntrinsic;
    // Position offsets & margins
    top?: SizeAuto;
    right?: SizeAuto;
    bottom?: SizeAuto;
    left?: SizeAuto;
    insetBlockStart?: SizeAuto;
    insetBlockEnd?: SizeAuto;
    insetInlineStart?: SizeAuto;
    insetInlineEnd?: SizeAuto;
    marginTop?: SizeAuto;
    marginRight?: SizeAuto;
    marginBottom?: SizeAuto;
    marginLeft?: SizeAuto;
    marginBlockStart?: SizeAuto;
    marginBlockEnd?: SizeAuto;
    marginInlineStart?: SizeAuto;
    marginInlineEnd?: SizeAuto;
    // Paddings & other plain sizes
    paddingTop?: Size;
    paddingRight?: Size;
    paddingBottom?: Size;
    paddingLeft?: Size;
    paddingBlockStart?: Size;
    paddingBlockEnd?: Size;
    paddingInlineStart?: Size;
    paddingInlineEnd?: Size;
    fontSize?: Size;
    textIndent?: Size;
    outlineOffset?: Size;
    borderTopLeftRadius?: Size;
    borderTopRightRadius?: Size;
    borderBottomRightRadius?: Size;
    borderBottomLeftRadius?: Size;
    rowGap?: Size;
    columnGap?: Size;
    // Text spacing
    letterSpacing?: SpacingText;
    wordSpacing?: SpacingText;
    // Border widths
    borderTopWidth?: LineWidth;
    borderRightWidth?: LineWidth;
    borderBottomWidth?: LineWidth;
    borderLeftWidth?: LineWidth;
    outlineWidth?: LineWidth;
    // Box shorthands (single value or 1–4 tuple)
    padding?: Size | Repeat1to4<PadItem>;
    paddingBlock?: Size | readonly [PadItem, PadItem];
    paddingInline?: Size | readonly [PadItem, PadItem];
    margin?: SizeAuto | Repeat1to4<MarginItem>;
    marginBlock?: SizeAuto | readonly [MarginItem, MarginItem];
    marginInline?: SizeAuto | readonly [MarginItem, MarginItem];
    inset?: SizeAuto | Repeat1to4<MarginItem>;
    insetBlock?: SizeAuto | readonly [MarginItem, MarginItem];
    insetInline?: SizeAuto | readonly [MarginItem, MarginItem];
    borderRadius?: Size | Repeat1to4<PadItem>;
    gap?: Size | readonly [PadItem, PadItem];
    // Typography
    fontFamily?: FontFamilyToken | Wide;
    fontWeight?: FontWeightToken | "normal" | "bold" | "lighter" | "bolder" | Wide;
    lineHeight?: NumberToken | DimensionToken | "normal" | Wide;
    // Numbers
    opacity?: Numeric;
    zIndex?: Numeric;
    flexGrow?: Numeric;
    flexShrink?: Numeric;
    order?: Numeric;
    // Motion
    transitionDuration?: DurationToken | Wide;
    transitionDelay?: DurationToken | Wide;
    animationDuration?: DurationToken | Wide;
    animationDelay?: DurationToken | Wide;
    transitionTimingFunction?: Easing;
    animationTimingFunction?: Easing;
    // Shadows
    boxShadow?: ShadowLike;
    textShadow?: ShadowLike;
}

/**
 * Every CSS property [csstype](https://github.com/frenic/csstype) knows
 * that {@link TokenMappedProps} does not claim, with lengths narrowed to
 * `dimension` tokens and times to `duration` tokens.
 *
 * Properties whose grammar is a closed keyword set (`display`, `resize`,
 * `position`, …) resolve to that keyword union. Properties that accept
 * open-ended values (`background`, `transform`, `gridTemplateColumns`, …)
 * keep csstype's `string` escape, because CSS genuinely allows any
 * `calc()`, function, or list there.
 *
 * @see {@link ThemedCSSProps}
 */
type KeywordProps = Omit<CSS.Properties<DimensionToken | 0, DurationToken>, keyof TokenMappedProps>;

/**
 * The style-object type accepted by {@link css} and every {@link tva}
 * slot.
 *
 * Two layers stack. Token-mapped longhands enforce the matching token
 * brand plus a small set of CSS keywords and the literal `0`. Every
 * other property carries csstype's value union, so closed-grammar
 * properties such as `display`, `position`, `resize`, and `overflow`
 * only accept their real keywords. Unknown keys — nested selectors,
 * at-rules, and CSS custom properties — recurse or stay loose.
 *
 * `Wide` below is the CSS-wide keyword union
 * `"inherit" | "initial" | "unset" | "revert" | "revert-layer"`.
 *
 * | Property family | Accepted values |
 * | --- | --- |
 * | `color`, `backgroundColor`, `borderColor`, the four per-side and two logical border colors, `outlineColor`, `textDecorationColor`, `columnRuleColor`, `caretColor`, `accentColor`, `fill`, `stroke` | `ColorToken \| "transparent" \| "currentColor" \| Wide` |
 * | `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, their `blockSize`/`inlineSize` logical forms, `flexBasis` | `DimensionToken \| 0 \| "auto" \| "min-content" \| "max-content" \| "fit-content" \| Wide` |
 * | `top`, `right`, `bottom`, `left`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft`, and their `inset*`/`margin*` logical start/end forms | `DimensionToken \| 0 \| "auto" \| Wide` |
 * | `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, the logical padding start/end forms, `fontSize`, `textIndent`, `outlineOffset`, the four corner radii, `rowGap`, `columnGap` | `DimensionToken \| 0 \| Wide` |
 * | `letterSpacing`, `wordSpacing` | `DimensionToken \| 0 \| "normal" \| Wide` |
 * | `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`, `outlineWidth` | `DimensionToken \| 0 \| "thin" \| "medium" \| "thick" \| Wide` |
 * | `padding`, `margin`, `inset`, `borderRadius` (box shorthands) | a single value as the longhand, or a tuple of 1–4 such values, space-joined |
 * | `gap`, `paddingBlock`, `paddingInline`, `marginBlock`, `marginInline`, `insetBlock`, `insetInline` | the longhand value, or a 2-tuple |
 * | `fontFamily` | `FontFamilyToken \| Wide` |
 * | `fontWeight` | `FontWeightToken \| "normal" \| "bold" \| "lighter" \| "bolder" \| Wide` |
 * | `lineHeight` | `NumberToken \| DimensionToken \| "normal" \| Wide` |
 * | `opacity`, `zIndex`, `flexGrow`, `flexShrink`, `order` | `NumberToken \| number \| Wide` (plain numbers stay legal) |
 * | `transitionDuration`, `transitionDelay`, `animationDuration`, `animationDelay` | `DurationToken \| Wide` |
 * | `transitionTimingFunction`, `animationTimingFunction` | `CubicBezierToken \| "ease" \| "linear" \| "ease-in" \| "ease-out" \| "ease-in-out" \| "step-start" \| "step-end" \| Wide` |
 * | `boxShadow`, `textShadow` | `ShadowToken \| "none" \| Wide` |
 * | every other CSS property | csstype's union for that property, with `dimension` tokens for lengths and `duration` tokens for times |
 *
 * @see {@link css}
 */
export interface ThemedCSSProps extends KeywordProps, TokenMappedProps {
    // Nested selectors, at-rules, and custom properties.
    [key: string]:
        | ThemedCSSProps
        | string
        | number
        | null
        | undefined
        | readonly (string | number)[];
}

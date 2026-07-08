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

type Repeat1to4<V> =
    | readonly [V]
    | readonly [V, V]
    | readonly [V, V, V]
    | readonly [V, V, V, V];

type PadItem = DimensionToken | 0;
type MarginItem = DimensionToken | 0 | "auto";

export interface ThemedCSSProps {
    // Colors
    color?: ColorLike;
    backgroundColor?: ColorLike;
    borderColor?: ColorLike;
    borderTopColor?: ColorLike;
    borderRightColor?: ColorLike;
    borderBottomColor?: ColorLike;
    borderLeftColor?: ColorLike;
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
    flexBasis?: SizeIntrinsic;
    // Position offsets & margins
    top?: SizeAuto;
    right?: SizeAuto;
    bottom?: SizeAuto;
    left?: SizeAuto;
    marginTop?: SizeAuto;
    marginRight?: SizeAuto;
    marginBottom?: SizeAuto;
    marginLeft?: SizeAuto;
    // Paddings & other plain sizes
    paddingTop?: Size;
    paddingRight?: Size;
    paddingBottom?: Size;
    paddingLeft?: Size;
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
    margin?: SizeAuto | Repeat1to4<MarginItem>;
    inset?: SizeAuto | Repeat1to4<MarginItem>;
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
    // Everything else stays loose; nested selectors/media recurse.
    [key: string]:
        | ThemedCSSProps
        | string
        | number
        | null
        | undefined
        | readonly (string | number)[];
}

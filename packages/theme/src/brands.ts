/**
 * The twelve DTCG token types, in canonical order.
 *
 * @internal
 */
export const TOKEN_TYPES = [
    "color",
    "dimension",
    "duration",
    "fontFamily",
    "fontWeight",
    "number",
    "cubicBezier",
    "shadow",
    "border",
    "transition",
    "gradient",
    "strokeStyle",
] as const;

/** The twelve DTCG token `$type` values. @see {@link AnyToken} */
export type TokenType = (typeof TOKEN_TYPES)[number];

// The symbols are declared, never created — they exist only in the type system,
// which keeps every brand a plain string at runtime.
declare const COLOR: unique symbol;
declare const DIMENSION: unique symbol;
declare const DURATION: unique symbol;
declare const FONT_FAMILY: unique symbol;
declare const FONT_WEIGHT: unique symbol;
declare const NUMBER: unique symbol;
declare const CUBIC_BEZIER: unique symbol;
declare const SHADOW: unique symbol;
declare const BORDER: unique symbol;
declare const TRANSITION: unique symbol;
declare const GRADIENT: unique symbol;
declare const STROKE_STYLE: unique symbol;

/** Compile-time brand for a `color` token. */
export type ColorToken = string & { readonly [COLOR]: true };
/** Compile-time brand for a `dimension` token. */
export type DimensionToken = string & { readonly [DIMENSION]: true };
/** Compile-time brand for a `duration` token. */
export type DurationToken = string & { readonly [DURATION]: true };
/** Compile-time brand for a `fontFamily` token. */
export type FontFamilyToken = string & { readonly [FONT_FAMILY]: true };
/** Compile-time brand for a `fontWeight` token. */
export type FontWeightToken = string & { readonly [FONT_WEIGHT]: true };
/** Compile-time brand for a `number` token. */
export type NumberToken = string & { readonly [NUMBER]: true };
/** Compile-time brand for a `cubicBezier` token. */
export type CubicBezierToken = string & { readonly [CUBIC_BEZIER]: true };
/** Compile-time brand for a `shadow` token. */
export type ShadowToken = string & { readonly [SHADOW]: true };
/** Compile-time brand for a `border` token. */
export type BorderToken = string & { readonly [BORDER]: true };
/** Compile-time brand for a `transition` token. */
export type TransitionToken = string & { readonly [TRANSITION]: true };
/** Compile-time brand for a `gradient` token. */
export type GradientToken = string & { readonly [GRADIENT]: true };
/** Compile-time brand for a `strokeStyle` token. */
export type StrokeStyleToken = string & { readonly [STROKE_STYLE]: true };

/**
 * Maps each {@link TokenType} to its token brand.
 *
 * @internal
 */
export interface BrandByType {
    color: ColorToken;
    dimension: DimensionToken;
    duration: DurationToken;
    fontFamily: FontFamilyToken;
    fontWeight: FontWeightToken;
    number: NumberToken;
    cubicBezier: CubicBezierToken;
    shadow: ShadowToken;
    border: BorderToken;
    transition: TransitionToken;
    gradient: GradientToken;
    strokeStyle: StrokeStyleToken;
}

declare const UNTYPED: unique symbol;

/**
 * Compile-time brand for a token declared with `s.any()`. It carries
 * no CSS type, so the open-grammar properties (`animation`,
 * `aspectRatio`, `background`) accept it and the token-mapped
 * longhands reject it.
 */
export type UntypedToken = string & { readonly [UNTYPED]: true };

/**
 * The union of all twelve token brands. Brands are compile-time tags
 * naming each token's type; they let {@link css} reject a dimension
 * where a color belongs. They exist only in the type system — every
 * ref is a plain string at runtime, so brands cost nothing — and they
 * are theme-independent, so tokens minted by two different
 * {@link createTheme} calls mix freely in one {@link css} call.
 */
export type AnyToken = BrandByType[TokenType];

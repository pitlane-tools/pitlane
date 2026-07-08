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

export type ColorToken = string & { readonly [COLOR]: true };
export type DimensionToken = string & { readonly [DIMENSION]: true };
export type DurationToken = string & { readonly [DURATION]: true };
export type FontFamilyToken = string & { readonly [FONT_FAMILY]: true };
export type FontWeightToken = string & { readonly [FONT_WEIGHT]: true };
export type NumberToken = string & { readonly [NUMBER]: true };
export type CubicBezierToken = string & { readonly [CUBIC_BEZIER]: true };
export type ShadowToken = string & { readonly [SHADOW]: true };
export type BorderToken = string & { readonly [BORDER]: true };
export type TransitionToken = string & { readonly [TRANSITION]: true };
export type GradientToken = string & { readonly [GRADIENT]: true };
export type StrokeStyleToken = string & { readonly [STROKE_STYLE]: true };

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

export type AnyToken = BrandByType[TokenType];

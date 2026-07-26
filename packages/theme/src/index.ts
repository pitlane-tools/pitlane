/**
 * Type-safe styling with W3C DTCG design tokens for Remix 3.
 * `createTheme` turns a design-token document into a typed token
 * accessor plus a `<Theme />` component that installs the tokens as
 * CSS custom properties. The `css`, `tva`, `combine`, and `cx`
 * helpers enforce the token palette at the type level on top of
 * `remix/ui`'s `css()` mixin.
 *
 * @module @pitlane/theme
 */

export { createTheme } from "./theme.ts";
export type { ThemeComponent, ThemeOptions, ThemeProps, ThemeResult } from "./theme.ts";
export { css } from "./css.ts";
export type { ThemedCSSMixin } from "./css.ts";
export { combine, cx, tva } from "./tva.ts";
export type { ClassValue, CombinedTVAFn, TVAConfig, TVAFn, TVAProps } from "./tva.ts";
export { ThemeError } from "./tokens.ts";
export type { ThemedCSSProps } from "./props.ts";
export type {
    AnyToken,
    BorderToken,
    ColorToken,
    CubicBezierToken,
    DimensionToken,
    DurationToken,
    FontFamilyToken,
    FontWeightToken,
    GradientToken,
    NumberToken,
    ShadowToken,
    StrokeStyleToken,
    TokenType,
    TransitionToken,
} from "./brands.ts";
export type { DeepPartialTokens, DTCGDocument, TokenTree } from "./types.ts";

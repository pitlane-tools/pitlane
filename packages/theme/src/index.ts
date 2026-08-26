/**
 * Type-safe styling with design tokens for Remix 3.
 *
 * `createTheme` takes a schema tree and the token tree it describes,
 * and returns a typed token accessor plus a `<Theme />` component that
 * installs the tokens as CSS custom properties. Token values are the
 * CSS they become; the schema, built from `@pitlane/theme/schema`,
 * names each token's type. The `css`, `tva`, `combine`, and `cx`
 * helpers enforce the token palette at the type level on top of
 * `remix/ui`'s `css()` mixin.
 *
 * @module @pitlane/theme
 */

export { css } from "./css.ts";
export type { ThemedCSSMixin } from "./css.ts";
export type { ThemedCSSProps } from "./props.ts";
export { lightDark, scale } from "./scale.ts";
export { createTheme } from "./theme.ts";
export type { ThemeComponent, ThemeProps, ThemeResult } from "./theme.ts";
export { ThemeError } from "./tokens.ts";
export { combine, cx, tva } from "./tva.ts";
export type { ClassValue, CombinedTVAFn, TVAConfig, TVAFn, TVAProps } from "./tva.ts";
export type {
    DeepPartialTokens,
    Merged,
    ScalableToken,
    ScaleFn,
    ThemeInit,
    ThemeMode,
    ThemePatch,
    TokenTree,
    Tokens,
    TokenValue,
} from "./types.ts";
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
    UntypedToken,
} from "./brands.ts";

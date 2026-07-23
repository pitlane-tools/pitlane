import { ElementProps, Handle, MixinDescriptor, RemixElement, css as css$1 } from "remix/ui";

//#region src/brands.d.ts
declare const TOKEN_TYPES: readonly ["color", "dimension", "duration", "fontFamily", "fontWeight", "number", "cubicBezier", "shadow", "border", "transition", "gradient", "strokeStyle"];
type TokenType = (typeof TOKEN_TYPES)[number];
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
type ColorToken = string & {
  readonly [COLOR]: true;
};
type DimensionToken = string & {
  readonly [DIMENSION]: true;
};
type DurationToken = string & {
  readonly [DURATION]: true;
};
type FontFamilyToken = string & {
  readonly [FONT_FAMILY]: true;
};
type FontWeightToken = string & {
  readonly [FONT_WEIGHT]: true;
};
type NumberToken = string & {
  readonly [NUMBER]: true;
};
type CubicBezierToken = string & {
  readonly [CUBIC_BEZIER]: true;
};
type ShadowToken = string & {
  readonly [SHADOW]: true;
};
type BorderToken = string & {
  readonly [BORDER]: true;
};
type TransitionToken = string & {
  readonly [TRANSITION]: true;
};
type GradientToken = string & {
  readonly [GRADIENT]: true;
};
type StrokeStyleToken = string & {
  readonly [STROKE_STYLE]: true;
};
interface BrandByType {
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
type AnyToken = BrandByType[TokenType];
//#endregion
//#region src/types.d.ts
interface TokenGroup {
  $type?: TokenType;
  $description?: string;
  $extensions?: Record<string, unknown>;
  [key: string]: unknown;
}
type DTCGDocument = TokenGroup;
type GroupType<N, Inherited> = N extends {
  $type: infer Ty extends TokenType;
} ? Ty : Inherited;
type BrandOf<Ty> = Ty extends TokenType ? BrandByType[Ty] : never;
type TokenTypeOf<N, Root, Inherited> = N extends {
  $type: infer Ty extends TokenType;
} ? Ty : N extends {
  $value: `{${infer P}}`;
} ? TypeAtPath<Root, P, Root, GroupType<Root, undefined>> : Inherited extends TokenType ? Inherited : never;
type MatchKey<N, S extends string> = keyof N extends infer K ? K extends string | number ? `${K}` extends S ? K : never : never : never;
type TypeAtPath<N, P extends string, Root, Inherited> = P extends `${infer Head}.${infer Rest}` ? MatchKey<N, Head> extends infer K ? [K] extends [never] ? never : TypeAtPath<N[K & keyof N], Rest, Root, GroupType<N[K & keyof N], Inherited>> : never : MatchKey<N, P> extends infer K ? [K] extends [never] ? never : TokenTypeOf<N[K & keyof N], Root, Inherited> : never;
type TreeOf<N, Root, Inherited> = { [K in Exclude<keyof N, `$${string}`>]: N[K] extends {
  $value: unknown;
} ? BrandOf<TokenTypeOf<N[K], Root, Inherited>> : TreeOf<N[K], Root, GroupType<N[K], Inherited>> };
/**
 * Same-shape accessor type: token leaves become branded `var()` strings.
 * An `any` document (e.g. `JSON.parse`) short-circuits to `unknown` — mapping
 * over `any` would otherwise recurse without bound.
 */
type TokenTree<T> = 0 extends 1 & T ? unknown : TreeOf<T, T, GroupType<T, undefined>>;
/** Mode override shape: every group optional, token nodes reduced to `{ $value }`. */
type DeepPartialTokens<T> = 0 extends 1 & T ? unknown : { [K in Exclude<keyof T, `$${string}`>]?: T[K] extends {
  $value: unknown;
} ? {
  $value: unknown;
} : DeepPartialTokens<T[K]> };
//#endregion
//#region src/theme.d.ts
interface ThemeOptions<T> {
  modes?: {
    light?: DeepPartialTokens<T>;
    dark?: DeepPartialTokens<T>;
  };
}
type ThemeProps = {
  nonce?: string;
};
type ThemeComponent = (handle: Handle<ThemeProps>) => () => RemixElement;
interface ThemeResult<T> {
  token: TokenTree<T>;
  raw(ref: AnyToken): string;
  Theme: ThemeComponent;
}
declare function createTheme<const T extends DTCGDocument>(config: T, options?: ThemeOptions<T>): ThemeResult<T>;
//#endregion
//#region src/props.d.ts
type Wide = "inherit" | "initial" | "unset" | "revert" | "revert-layer";
type ColorLike = ColorToken | "transparent" | "currentColor" | Wide;
type Size = DimensionToken | 0 | Wide;
type SizeAuto = DimensionToken | 0 | "auto" | Wide;
type SizeIntrinsic = DimensionToken | 0 | "auto" | "min-content" | "max-content" | "fit-content" | Wide;
type SpacingText = DimensionToken | 0 | "normal" | Wide;
type LineWidth = DimensionToken | 0 | "thin" | "medium" | "thick" | Wide;
type Easing = CubicBezierToken | "ease" | "linear" | "ease-in" | "ease-out" | "ease-in-out" | "step-start" | "step-end" | Wide;
type ShadowLike = ShadowToken | "none" | Wide;
type Numeric = NumberToken | number | Wide;
type Repeat1to4<V> = readonly [V] | readonly [V, V] | readonly [V, V, V] | readonly [V, V, V, V];
type PadItem = DimensionToken | 0;
type MarginItem = DimensionToken | 0 | "auto";
interface ThemedCSSProps {
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
  width?: SizeIntrinsic;
  height?: SizeIntrinsic;
  minWidth?: SizeIntrinsic;
  minHeight?: SizeIntrinsic;
  maxWidth?: SizeIntrinsic;
  maxHeight?: SizeIntrinsic;
  flexBasis?: SizeIntrinsic;
  top?: SizeAuto;
  right?: SizeAuto;
  bottom?: SizeAuto;
  left?: SizeAuto;
  marginTop?: SizeAuto;
  marginRight?: SizeAuto;
  marginBottom?: SizeAuto;
  marginLeft?: SizeAuto;
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
  letterSpacing?: SpacingText;
  wordSpacing?: SpacingText;
  borderTopWidth?: LineWidth;
  borderRightWidth?: LineWidth;
  borderBottomWidth?: LineWidth;
  borderLeftWidth?: LineWidth;
  outlineWidth?: LineWidth;
  padding?: Size | Repeat1to4<PadItem>;
  margin?: SizeAuto | Repeat1to4<MarginItem>;
  inset?: SizeAuto | Repeat1to4<MarginItem>;
  borderRadius?: Size | Repeat1to4<PadItem>;
  gap?: Size | readonly [PadItem, PadItem];
  fontFamily?: FontFamilyToken | Wide;
  fontWeight?: FontWeightToken | "normal" | "bold" | "lighter" | "bolder" | Wide;
  lineHeight?: NumberToken | DimensionToken | "normal" | Wide;
  opacity?: Numeric;
  zIndex?: Numeric;
  flexGrow?: Numeric;
  flexShrink?: Numeric;
  order?: Numeric;
  transitionDuration?: DurationToken | Wide;
  transitionDelay?: DurationToken | Wide;
  animationDuration?: DurationToken | Wide;
  animationDelay?: DurationToken | Wide;
  transitionTimingFunction?: Easing;
  animationTimingFunction?: Easing;
  boxShadow?: ShadowLike;
  textShadow?: ShadowLike;
  [key: string]: ThemedCSSProps | string | number | null | undefined | readonly (string | number)[];
}
//#endregion
//#region src/css.d.ts
type RemixCSSProps = Parameters<typeof css$1>[0];
/**
 * The descriptor css() produces. `MixinDescriptor` is invariant in its node
 * type, so — exactly like remix/ui's own css factory — the node binds per
 * callsite through the generic parameter.
 */
type ThemedCSSMixin<node extends Element = Element> = MixinDescriptor<node, [styles: RemixCSSProps], ElementProps>;
/**
 * Brand-typed wrapper over remix/ui's css() mixin. Branded token refs are
 * already `var()` strings; tuples join with spaces; everything else passes
 * straight through.
 *
 * The node type parameter is inferred from the `mix` position it is used in
 * (`<div mix={css({ … })} />`), mirroring remix/ui's css. Apply css() at the
 * element; share ThemedCSSProps objects, not descriptors.
 */
declare function css<node extends Element = Element>(styles: ThemedCSSProps): ThemedCSSMixin<node>;
//#endregion
//#region src/tva.d.ts
type VariantShape = Record<string, Record<string, ThemedCSSProps>>;
type VariantValue<K> = K extends "true" | "false" ? boolean : K;
/**
 * Controller-approved one-token deviation from the brief: `-readonly` strips
 * the readonly modifier that a homomorphic mapped type would otherwise
 * inherit from V's const-inferred (deeply readonly) property modifiers.
 * TVAProps<F> must yield ordinary mutable optional props for consumers;
 * readonly inheritance here is an artifact of `const V`, not intent.
 */
type Selection<V extends VariantShape> = { -readonly [K in keyof V]?: VariantValue<keyof V[K] & string> };
interface TVAConfig<V extends VariantShape> {
  base?: ThemedCSSProps;
  variants?: V;
  compoundVariants?: readonly (Selection<V> & {
    css: ThemedCSSProps;
  })[];
  defaultVariants?: Selection<V>;
}
interface TVAFn<V extends VariantShape> {
  <node extends Element = Element>(props?: Selection<V>): ThemedCSSMixin<node>;
  resolve(props?: Selection<V>): ThemedCSSProps;
}
type TVAProps<F> = F extends TVAFn<infer V> ? Selection<V> : never;
declare function tva<const V extends VariantShape>(config: TVAConfig<V>): TVAFn<V>;
type UnionToIntersection<U> = (U extends unknown ? (arg: U) => void : never) extends ((arg: infer I) => void) ? I : never;
type CombinedProps<Fns extends readonly TVAFn<VariantShape>[]> = UnionToIntersection<Exclude<Parameters<Fns[number]>[0], undefined>> extends infer P ? { [K in keyof P]: P[K] } : never;
interface CombinedTVAFn<Fns extends readonly TVAFn<VariantShape>[]> {
  <node extends Element = Element>(props?: CombinedProps<Fns>): ThemedCSSMixin<node>;
  resolve(props?: CombinedProps<Fns>): ThemedCSSProps;
}
/** cva-`compose` analog: one css() call over every input's resolved styles. */
declare function combine<Fns extends readonly TVAFn<VariantShape>[]>(...fns: Fns): CombinedTVAFn<Fns>;
type ClassValue = string | number | null | undefined | false | readonly ClassValue[] | Record<string, boolean | null | undefined>;
/** clsx-compatible className joiner for the className interop escape hatch. */
declare function cx(...inputs: ClassValue[]): string;
//#endregion
//#region src/tokens.d.ts
declare class ThemeError extends Error {
  name: string;
}
//#endregion
export { type AnyToken, type BorderToken, type ClassValue, type ColorToken, type CombinedTVAFn, type CubicBezierToken, type DTCGDocument, type DeepPartialTokens, type DimensionToken, type DurationToken, type FontFamilyToken, type FontWeightToken, type GradientToken, type NumberToken, type ShadowToken, type StrokeStyleToken, type TVAConfig, type TVAFn, type TVAProps, type ThemeComponent, ThemeError, type ThemeOptions, type ThemeProps, type ThemeResult, type ThemedCSSMixin, type ThemedCSSProps, type TokenTree, type TokenType, type TransitionToken, combine, createTheme, css, cx, tva };
import type { BrandByType, TokenType } from "./brands.ts";

/**
 * A DTCG token node: a `$value` plus optional metadata.
 *
 * @internal
 */
export interface TokenNode {
    $value: unknown;
    $type?: TokenType;
    $description?: string;
    $extensions?: Record<string, unknown>;
    $deprecated?: boolean | string;
}

/**
 * A DTCG group node: an optional `$type` shared by descendants, plus
 * nested groups and tokens.
 *
 * @internal
 */
export interface TokenGroup {
    $type?: TokenType;
    $description?: string;
    $extensions?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * The input document {@link createTheme} accepts, shaped by the
 * [W3C DTCG format](https://www.designtokens.org/tr/drafts/format/). A
 * node with a `$value` is a token; every other key is a group, and
 * groups nest to any depth. A token's type comes from its own
 * `$type`, from the token it aliases, or from the nearest ancestor
 * group's `$type`, in that order.
 *
 * Each `$type` fixes the accepted `$value` forms and how the value
 * serializes into CSS:
 *
 * | `$type` | Accepted `$value` | Serializes to |
 * | --- | --- | --- |
 * | `color` | CSS color string, or `{ colorSpace, components, alpha?, hex? }` | the string as written, `hex` when present, or the color-space function (`oklch(…)`, `color(display-p3 …)`) |
 * | `dimension` | `"16px"`, or `{ value, unit }` with `px` or `rem` | the string verbatim, or concatenation |
 * | `duration` | `"200ms"`, or `{ value, unit }` with `ms` or `s` | the string verbatim, or concatenation |
 * | `fontFamily` | string or non-empty array of strings | quoted where needed, comma-joined |
 * | `fontWeight` | number 1–1000, or a DTCG keyword like `"semi-bold"` | the number (keywords map to numbers) |
 * | `number` | number | the number |
 * | `cubicBezier` | `[x1, y1, x2, y2]` | `cubic-bezier(…)` |
 * | `shadow` | `{ color, offsetX, offsetY, blur?, spread?, inset? }`, or an array of them | a CSS shadow list, `inset` first when `inset` is `true` |
 * | `border` | `{ color, width, style }` | `width style color` |
 * | `transition` | `{ duration, timingFunction, delay? }` | `duration timing-function delay` |
 * | `gradient` | array of `{ color, position }` stops | a color-stop list for use inside `linear-gradient(…)` |
 * | `strokeStyle` | keyword or object | the keyword, or `dashed` for the object form |
 *
 * Gradient stop positions must be literal numbers, though stop colors
 * may be aliases. `typography` tokens throw — they need one variable
 * per subproperty, which is not built.
 *
 * Only the object form of a `dimension` or `duration` is unit-checked.
 * The string form is emitted verbatim, which is the way in for units
 * the DTCG format does not cover (`em`, `ch`, `%`) and for computed
 * values such as `clamp(…)`.
 *
 * A `$value` of `"{path.to.token}"` is an alias: it resolves to
 * `var()` indirection in the emitted CSS, not a copied value, which is
 * what makes mode overrides cascade. Aliases work as full token values
 * and inside composite sub-values (e.g. a shadow's `color`), and they
 * are type-checked — a token with an explicit `$type` only aliases a
 * token of that same type. Unknown targets and reference cycles throw.
 *
 * @see {@link createTheme}
 * @see {@link TokenTree} for the resulting accessor shape.
 * @see {@link DeepPartialTokens} for the mode-override shape.
 */
export type DTCGDocument = TokenGroup;

type GroupType<N, Inherited> = N extends { $type: infer Ty extends TokenType } ? Ty : Inherited;

type BrandOf<Ty> = Ty extends TokenType ? BrandByType[Ty] : never;

type TokenTypeOf<N, Root, Inherited> = N extends { $type: infer Ty extends TokenType }
    ? Ty
    : N extends { $value: `{${infer P}}` }
      ? TypeAtPath<Root, P, Root, GroupType<Root, undefined>>
      : Inherited extends TokenType
        ? Inherited
        : never;

type MatchKey<N, S extends string> = keyof N extends infer K
    ? K extends string | number
        ? `${K}` extends S
            ? K
            : never
        : never
    : never;

type TypeAtPath<N, P extends string, Root, Inherited> = P extends `${infer Head}.${infer Rest}`
    ? MatchKey<N, Head> extends infer K
        ? [K] extends [never]
            ? never
            : TypeAtPath<N[K & keyof N], Rest, Root, GroupType<N[K & keyof N], Inherited>>
        : never
    : MatchKey<N, P> extends infer K
      ? [K] extends [never]
          ? never
          : TokenTypeOf<N[K & keyof N], Root, Inherited>
      : never;

type TreeOf<N, Root, Inherited> = {
    [K in Exclude<keyof N, `$${string}`>]: N[K] extends { $value: unknown }
        ? BrandOf<TokenTypeOf<N[K], Root, Inherited>>
        : TreeOf<N[K], Root, GroupType<N[K], Inherited>>;
};

/**
 * The accessor shape for a document `T`: the same nesting as the
 * document, with every token leaf replaced by its branded `var(--…)`
 * reference string. Numeric keys index with brackets
 * (`t.color.gray[900]`).
 *
 * An `any` document (e.g. from `JSON.parse`) short-circuits to
 * `unknown` — mapping over `any` would otherwise recurse without
 * bound.
 *
 * @see {@link ThemeResult}
 */
export type TokenTree<T> = 0 extends 1 & T ? unknown : TreeOf<T, T, GroupType<T, undefined>>;

/**
 * The mode-override shape for a document `T`: every group is optional
 * and each token node is reduced to `{ $value }`. A mode overrides a
 * token's value only, never its `$type` or structure.
 *
 * An `any` document short-circuits to `unknown`, as in
 * {@link TokenTree}.
 *
 * @see {@link ThemeOptions}
 */
export type DeepPartialTokens<T> = 0 extends 1 & T
    ? unknown
    : {
          [K in Exclude<keyof T, `$${string}`>]?: T[K] extends { $value: unknown }
              ? { $value: unknown }
              : DeepPartialTokens<T[K]>;
      };

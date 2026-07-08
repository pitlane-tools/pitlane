import type { BrandByType, TokenType } from "./brands.ts";

export interface TokenNode {
    $value: unknown;
    $type?: TokenType;
    $description?: string;
    $extensions?: Record<string, unknown>;
    $deprecated?: boolean | string;
}

export interface TokenGroup {
    $type?: TokenType;
    $description?: string;
    $extensions?: Record<string, unknown>;
    [key: string]: unknown;
}

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

/** Same-shape accessor type: token leaves become branded `var()` strings. */
export type TokenTree<T> = TreeOf<T, T, GroupType<T, undefined>>;

/** Mode override shape: every group optional, token nodes reduced to `{ $value }`. */
export type DeepPartialTokens<T> = {
    [K in Exclude<keyof T, `$${string}`>]?: T[K] extends { $value: unknown }
        ? { $value: unknown }
        : DeepPartialTokens<T[K]>;
};

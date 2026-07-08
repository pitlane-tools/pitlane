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
      ? TypeAtPath<Root, P, Root, undefined>
      : Inherited extends TokenType
        ? Inherited
        : never;

type TypeAtPath<N, P extends string, Root, Inherited> = P extends `${infer Head}.${infer Rest}`
    ? Head extends keyof N
        ? TypeAtPath<N[Head], Rest, Root, GroupType<N[Head], Inherited>>
        : never
    : P extends keyof N
      ? TokenTypeOf<N[P], Root, Inherited>
      : never;

type TreeOf<N, Root, Inherited> = {
    [K in Exclude<keyof N, `$${string}`>]: N[K] extends { $value: unknown }
        ? BrandOf<TokenTypeOf<N[K], Root, Inherited>>
        : TreeOf<N[K], Root, GroupType<N[K], Inherited>>;
};

/** Same-shape accessor type: token leaves become branded `var()` strings. */
export type TokenTree<T> = TreeOf<T, T, undefined>;

/** Mode override shape: every group optional, token nodes reduced to `{ $value }`. */
export type DeepPartialTokens<T> = {
    [K in Exclude<keyof T, `$${string}`>]?: T[K] extends { $value: unknown }
        ? { $value: unknown }
        : DeepPartialTokens<T[K]>;
};

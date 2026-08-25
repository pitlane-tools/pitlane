import type {
    BrandByType,
    DimensionToken,
    DurationToken,
    NumberToken,
    TokenType,
    UntypedToken,
} from "./brands.ts";
import type { SchemaNode, SchemaTag, SELF, TAG } from "./schema.ts";

/**
 * A token value: the CSS it becomes. A string, a number, or an array
 * of either. Anything else is a group.
 *
 * @see {@link Tokens}
 */
export type TokenValue = number | readonly (number | string)[] | string;

/**
 * The token tree {@link createTheme} accepts: nested records whose
 * leaves are {@link TokenValue}s. No reserved keys, so it is plain
 * JSON and a designer can diff it.
 */
export interface Tokens {
    [key: string]: Tokens | TokenValue;
}

/**
 * The accessor leaf for a token declared with `s.scale()`: callable
 * for steps, with the base itself as `.token`.
 *
 * `.token` is what a projection re-roots and what `raw` resolves, so
 * it is load-bearing rather than decorative.
 *
 * @see {@link TokenTree}
 */
export interface ScaleFn {
    (steps: number): DimensionToken;
    readonly token: DimensionToken;
}

/** A theme's mode: a condition plus the values it overrides. */
export interface ThemeMode<T> {
    /**
     * The media query this mode applies under. Defaults to
     * `(prefers-color-scheme: <name>)` for the names `light` and
     * `dark`, and is required for any other name.
     */
    media?: string;
    /**
     * A selector this mode also applies under, for a user-selectable
     * toggle. An attribute selector outranks the media block on
     * specificity, so an explicit choice beats the OS preference.
     */
    selector?: string;
    /** The values this mode overrides. Structure only, never types. */
    tokens: DeepPartialTokens<T>;
}

/**
 * The argument {@link createTheme} accepts: a schema tree, the token
 * tree it describes, and any modes.
 *
 * The members are typed as bare objects on purpose. A `const` type
 * parameter constrained to an index-signature type widens the literal
 * it was inferred from, which would erase every brand; the shapes are
 * enforced by the schema factories being typed values, by an
 * undeclared leaf resolving to `unknown`, and by validation at module
 * load.
 */
export interface ThemeInit {
    schema: object;
    tokens: object;
    modes?: object;
}

/** The internal, fully-typed form of a {@link ThemeInit}. @internal */
export interface ResolvedInit {
    schema: Record<string, SchemaNode>;
    tokens: Tokens;
    modes?: Record<string, ThemeMode<Tokens>>;
}

/**
 * The argument `extend` accepts. `schema` is optional, because a patch
 * that only adds tokens to an existing namespace needs no new entry.
 */
export interface ThemePatch {
    schema?: object;
    tokens: object;
    modes?: object;
}

/**
 * The mode-override shape for a token tree: every group optional, every
 * leaf a value. A mode overrides values, never structure or types.
 */
export type DeepPartialTokens<T> = 0 extends 1 & T
    ? unknown
    : {
          [K in keyof T]?: T[K] extends Leaf ? TokenValue : DeepPartialTokens<T[K]>;
      };

type Leaf = number | readonly (number | string)[] | string;

// `never` is assignable to every brand, so an undeclared leaf resolves to
// `unknown` instead: unusable rather than universally accepted.
type BrandOf<tag> = [tag] extends [never]
    ? unknown
    : [tag] extends ["any"]
      ? UntypedToken
      : [tag] extends ["scale"]
        ? ScaleFn
        : tag extends TokenType
          ? BrandByType[tag]
          : unknown;

/** The tag a schema node declares for itself and its unlabelled children. */
type NodeTag<S, Inherited> = S extends { readonly [TAG]: infer tag extends SchemaTag }
    ? tag
    : S extends { readonly [SELF]: { readonly [TAG]: infer tag extends SchemaTag } }
      ? tag
      : Inherited;

type Child<S, K> = K extends keyof S ? S[K] : undefined;

type MatchKey<N, S extends string> = keyof N extends infer K
    ? K extends number | string
        ? `${K}` extends S
            ? K
            : never
        : never
    : never;

/** Follows a `{a.b.c}` reference, tracking the schema beside the tree. */
type TagAtPath<Tok, P extends string, Sch, Inherited> = P extends `${infer Head}.${infer Rest}`
    ? MatchKey<Tok, Head> extends infer K
        ? [K] extends [never]
            ? never
            : TagAtPath<Tok[K & keyof Tok], Rest, Child<Sch, K>, NodeTag<Child<Sch, K>, Inherited>>
        : never
    : MatchKey<Tok, P> extends infer K
      ? [K] extends [never]
          ? never
          : LeafTag<Tok[K & keyof Tok], Child<Sch, K>, Inherited, Tok, Sch>
      : never;

// The schema is authoritative, so an inherited tag settles a leaf before its
// value is looked at. Following the reference is only needed for a leaf that
// inherits nothing, and skipping it keeps a reference cycle from making the
// type infinite.
type LeafTag<V, S, Inherited, Root, RootSchema> = S extends {
    readonly [TAG]: infer tag extends SchemaTag;
}
    ? tag
    : [Inherited] extends [never]
      ? V extends `{${infer P}}`
          ? TagAtPath<Root, P, RootSchema, never>
          : Inherited
      : Inherited;

type TreeOf<Tok, Sch, Inherited, Root, RootSchema> = {
    [K in keyof Tok]: Tok[K] extends Leaf
        ? BrandOf<LeafTag<Tok[K], Child<Sch, K>, Inherited, Root, RootSchema>>
        : TreeOf<Tok[K], Child<Sch, K>, NodeTag<Child<Sch, K>, Inherited>, Root, RootSchema>;
};

/**
 * The accessor shape for an init `T`: the same nesting as its token
 * tree, with every leaf replaced by the branded `var(--…)` reference
 * its schema declares. Numeric keys index with brackets
 * (`t.color.gray[900]`).
 *
 * A leaf whose schema entry is missing resolves to `unknown`, which is
 * unusable in `css()`. The compiler also throws for it at module load.
 *
 * @see {@link ThemeResult}
 */
export type TokenTree<T> = 0 extends 1 & T
    ? unknown
    : T extends { schema: infer Sch; tokens: infer Tok }
      ? TreeOf<Tok, Sch, never, Tok, Sch>
      : unknown;

/**
 * Deep-merges an `extend` patch onto the tree it extends. A leaf
 * replaces wholesale; every other node recurses.
 *
 * @internal
 */
export type DeepMerge<A, B> = {
    [K in keyof A | keyof B]: K extends keyof B
        ? K extends keyof A
            ? B[K] extends Leaf
                ? B[K]
                : A[K] extends Leaf
                  ? B[K]
                  : DeepMerge<A[K], B[K]>
            : B[K]
        : K extends keyof A
          ? A[K]
          : never;
};

/**
 * The init an `extend` produces: both trees merged.
 *
 * @internal
 */
export interface Merged<T, E> {
    schema: DeepMerge<
        T extends { schema: infer S } ? S : {},
        E extends { schema: infer S } ? S : {}
    >;
    tokens: DeepMerge<
        T extends { tokens: infer S } ? S : {},
        E extends { tokens: infer S } ? S : {}
    >;
}

/** The bases {@link scale} accepts. @internal */
export type ScalableToken = DimensionToken | DurationToken | NumberToken;

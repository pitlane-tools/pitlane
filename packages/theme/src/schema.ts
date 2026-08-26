/**
 * Token schemas: one factory per token type, plus `scale`, `any`, and
 * `group`. Each factory returns a `remix/data-schema` schema tagged
 * with the token type it declares, so the same value both validates a
 * token and names the brand its accessor leaf carries.
 *
 * Designed for a namespace import, the way `remix/data-schema` ships
 * its own `string()` and `object()`:
 *
 * ```ts
 * import * as s from "@pitlane/theme/schema";
 *
 * let schema = { color: s.color(), spacing: s.scale() };
 * ```
 *
 * @module @pitlane/theme/schema
 */

import type { Issue, Schema } from "remix/data-schema";

import { createSchema, fail } from "remix/data-schema";

import type { TokenType } from "./brands.ts";

import { serializeValue } from "./serialize.ts";

/**
 * The tag a schema carries. The twelve {@link TokenType} values name a
 * DTCG type; `scale` is a dimension whose accessor leaf multiplies;
 * `any` declines to type the token at all.
 *
 * @internal
 */
export type SchemaTag = "any" | "scale" | TokenType;

/** @internal */
export const TAG: unique symbol = Symbol.for("pitlane.theme.tag");

/** @internal */
export const SELF: unique symbol = Symbol.for("pitlane.theme.self");

/**
 * A `remix/data-schema` schema that also names the token type it
 * declares. Every factory in this module returns one.
 *
 * @see {@link color}
 */
export interface TokenSchema<tag extends SchemaTag = SchemaTag> extends Schema<unknown, string> {
    readonly [TAG]: tag;
}

/**
 * A schema group: per-child schemas, optionally under a schema for the
 * node itself. {@link group} builds one; a plain object literal is the
 * children-only form.
 *
 * @see {@link group}
 */
export interface SchemaGroup {
    readonly [SELF]?: TokenSchema;
    readonly [key: string]: SchemaNode | undefined;
}

/** A node in a schema tree. @see {@link SchemaGroup} */
export type SchemaNode = SchemaGroup | TokenSchema;

// Aliases inside a token value are resolved by the collector, which knows every
// token's var name. Validation only has to accept the reference and leave it
// alone, so the context handed to `serializeValue` here never resolves anything.
const NO_REFS = {
    varRefFor(key: string) {
        return `var(--${key.replaceAll(".", "-")})`;
    },
};

/**
 * Standard Schema path segments may be objects, so stringify each one
 * rather than relying on `Array#join`.
 *
 * @internal
 */
export function pathKey(path: NonNullable<Issue["path"]>): string {
    return path
        .map(segment =>
            typeof segment === "object" && segment !== null && "key" in segment
                ? String(segment.key)
                : String(segment),
        )
        .join(".");
}

function tokenSchema<tag extends SchemaTag>(tag: tag): TokenSchema<tag> {
    let schema = createSchema<unknown, string>((value, context) => {
        let key = pathKey(context.path);
        if (tag === "any") {
            if (typeof value === "string" || typeof value === "number") {
                return { value: String(value) };
            }
            return fail(`"${key}" must be a string or a number`, context.path);
        }
        try {
            let type = (tag === "scale" ? "dimension" : tag) as TokenType;
            return { value: serializeValue(type, value, NO_REFS, key) };
        } catch (error) {
            return fail((error as Error).message, context.path);
        }
    });
    return Object.assign(schema, { [TAG]: tag }) as TokenSchema<tag>;
}

/**
 * A `color` token. Accepts any CSS color, including `light-dark()`,
 * `color-mix()`, and `currentColor`, plus DTCG's structured form.
 *
 * @returns A schema declaring the `color` token type
 *
 * @example
 * ```ts
 * let schema = { color: s.color() };
 * let tokens = { color: { white: "#fff", page: lightDark("#fff", "#111") } };
 * ```
 */
export function color(): TokenSchema<"color"> {
    return tokenSchema("color");
}

/**
 * A `dimension` token. Accepts any CSS length, including `clamp()`,
 * `calc()`, `%`, and `em`.
 *
 * @returns A schema declaring the `dimension` token type
 */
export function dimension(): TokenSchema<"dimension"> {
    return tokenSchema("dimension");
}

/**
 * A `duration` token. Accepts `ms`, `s`, and `calc()`.
 *
 * @returns A schema declaring the `duration` token type
 */
export function duration(): TokenSchema<"duration"> {
    return tokenSchema("duration");
}

/**
 * A `number` token. Accepts a finite number, which is what unitless
 * CSS values such as `line-height` and `opacity` take.
 *
 * @returns A schema declaring the `number` token type
 */
export function number(): TokenSchema<"number"> {
    return tokenSchema("number");
}

/**
 * A `cubicBezier` token, named for the CSS property it feeds. Accepts
 * a four-number tuple or `cubic-bezier(…)` text.
 *
 * @returns A schema declaring the `cubicBezier` token type
 */
export function easing(): TokenSchema<"cubicBezier"> {
    return tokenSchema("cubicBezier");
}

/**
 * A `shadow` token. Accepts CSS shadow text, `inset` included.
 *
 * @returns A schema declaring the `shadow` token type
 */
export function shadow(): TokenSchema<"shadow"> {
    return tokenSchema("shadow");
}

/**
 * A `border` token. Accepts CSS border shorthand text.
 *
 * @returns A schema declaring the `border` token type
 */
export function border(): TokenSchema<"border"> {
    return tokenSchema("border");
}

/**
 * A `transition` token. Accepts CSS transition shorthand text.
 *
 * @returns A schema declaring the `transition` token type
 */
export function transition(): TokenSchema<"transition"> {
    return tokenSchema("transition");
}

/**
 * A `gradient` token. Accepts CSS gradient function text.
 *
 * @returns A schema declaring the `gradient` token type
 */
export function gradient(): TokenSchema<"gradient"> {
    return tokenSchema("gradient");
}

/**
 * A `strokeStyle` token, named for the CSS value it holds. Accepts a
 * line-style keyword.
 *
 * @returns A schema declaring the `strokeStyle` token type
 */
export function stroke(): TokenSchema<"strokeStyle"> {
    return tokenSchema("strokeStyle");
}

/**
 * The two font token types, grouped because they share a prefix.
 *
 * `font.family()` accepts a font stack, as a string or an array of
 * names; an array joins with commas and quotes what needs quoting.
 * `font.weight()` accepts 1 to 1000 or one of DTCG's nineteen
 * keywords, and emits the number.
 *
 * @example
 * ```ts
 * let schema = { font: s.font.family(), weight: s.font.weight() };
 * let tokens = { font: { sans: ["Inter var", "system-ui"] }, weight: { bold: 700 } };
 * ```
 */
export let font: {
    family(): TokenSchema<"fontFamily">;
    weight(): TokenSchema<"fontWeight">;
} = {
    family: () => tokenSchema("fontFamily"),
    weight: () => tokenSchema("fontWeight"),
};

/**
 * A dimension token whose accessor leaf is a multiplier rather than a
 * value. The token emits its own custom property; the accessor leaf is
 * callable, and carries the base itself as `.token`.
 *
 * This is Tailwind's `--spacing`: one base that the whole scale
 * multiplies, with no named steps.
 *
 * @returns A schema declaring a scale token
 *
 * @example
 * ```ts
 * let theme = createTheme({
 *     schema: { spacing: s.scale() },
 *     tokens: { spacing: "0.25rem" },
 * });
 *
 * theme.token.spacing(4); // "calc(var(--spacing) * 4)"
 * theme.token.spacing.token; // "var(--spacing)"
 * ```
 */
export function scale(): TokenSchema<"scale"> {
    return tokenSchema("scale");
}

/**
 * A token with no type. Its value is emitted verbatim and its accessor
 * leaf brands as a plain `string`, which the open-grammar CSS
 * properties accept and the token-mapped longhands still reject.
 *
 * This exists for CSS values with no DTCG type, such as
 * `spin 1s linear infinite` and `16 / 9`. An untyped token may not be
 * the target of a typed token's reference, because there is no type to
 * check against.
 *
 * @returns A schema declaring an untyped token
 */
export function any(): TokenSchema<"any"> {
    return tokenSchema("any");
}

/**
 * A node that is itself typed and also carries per-child overrides.
 * `self` applies to that node and to every descendant without its own
 * entry; each key in `children` overrides it from there down.
 *
 * The self schema rides on a symbol key, so no token name is reserved:
 * a token named `default` can carry its own type.
 *
 * @param self - The schema for this node and its unlabelled descendants
 * @param children - Per-child schema overrides
 * @returns A schema group
 *
 * @example
 * ```ts
 * let schema = {
 *     control: s.group(s.dimension(), { color: s.color(), opacity: s.number() }),
 * };
 * // control.height.sm is a dimension; control.color.border is a color.
 * ```
 */
export function group<
    const self extends TokenSchema,
    const children extends Record<string, SchemaNode>,
>(self: self, children: children): children & { readonly [SELF]: self } {
    return { ...children, [SELF]: self };
}

/**
 * True when a node declares a token type rather than grouping others.
 *
 * @internal
 */
export function isTokenSchema(node: unknown): node is TokenSchema {
    return typeof node === "object" && node !== null && TAG in node;
}

/**
 * The schema a node declares for itself and its unlabelled children,
 * or `undefined` when it only groups.
 *
 * @internal
 */
export function selfSchema(node: unknown): TokenSchema | undefined {
    if (isTokenSchema(node)) return node;
    if (typeof node === "object" && node !== null && SELF in node) {
        return (node as SchemaGroup)[SELF];
    }
    return undefined;
}

/**
 * The schema node for one child key, or `undefined` when the parent
 * declares nothing for it.
 *
 * @internal
 */
export function childSchema(node: unknown, key: string): unknown {
    if (typeof node !== "object" || node === null || isTokenSchema(node)) return undefined;
    // Own properties only: a token named `constructor` or `toString` must not
    // pick up `Object.prototype`'s member as its schema.
    if (!Object.hasOwn(node, key)) return undefined;
    return (node as Record<string, unknown>)[key];
}

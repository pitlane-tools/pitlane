import type { ThemedCSSMixin } from "./css.ts";
import type { ThemedCSSProps } from "./props.ts";

import { css } from "./css.ts";

type VariantShape = Record<string, Record<string, ThemedCSSProps>>;

type VariantValue<K> = K extends "true" | "false" ? boolean : K;

/**
 * Controller-approved one-token deviation from the brief: `-readonly` strips
 * the readonly modifier that a homomorphic mapped type would otherwise
 * inherit from V's const-inferred (deeply readonly) property modifiers.
 * TVAProps<F> must yield ordinary mutable optional props for consumers;
 * readonly inheritance here is an artifact of `const V`, not intent.
 */
type Selection<V extends VariantShape> = {
    -readonly [K in keyof V]?: VariantValue<keyof V[K] & string>;
};

/**
 * Configuration for {@link tva}. Every style slot is
 * {@link ThemedCSSProps}, carrying the same brand enforcement as
 * {@link css}.
 */
export interface TVAConfig<V extends VariantShape> {
    /** Styles applied to every invocation, before any variant. */
    base?: ThemedCSSProps;
    /**
     * The variant axes. Each axis maps option names to styles; name
     * an axis's options `true` and `false` to accept a boolean.
     */
    variants?: V;
    /**
     * Extra styles applied when every listed variant condition
     * matches, merged after the individual variants in array order.
     */
    compoundVariants?: readonly (Selection<V> & { css: ThemedCSSProps })[];
    /**
     * Options used for axes the caller leaves unset. Passing an axis
     * `undefined` explicitly still falls back to its default.
     */
    defaultVariants?: Selection<V>;
}

/**
 * A variant component built by {@link tva}. Call it with a variant
 * selection to get a `mix`-ready descriptor; call `resolve` for the
 * merged {@link ThemedCSSProps} without building a descriptor.
 */
export interface TVAFn<V extends VariantShape> {
    /**
     * Resolves the selection and returns a `mix`-ready descriptor.
     * Node-generic like {@link css}: `MixinDescriptor` is invariant in
     * its node, so the element type binds per `mix` callsite.
     */
    <node extends Element = Element>(props?: Selection<V>): ThemedCSSMixin<node>;
    /**
     * Returns the merged style object for a selection without
     * producing a descriptor. {@link combine} is built on it.
     */
    resolve(props?: Selection<V>): ThemedCSSProps;
}

/**
 * Extracts a {@link tva} component's variant props, like cva's
 * `VariantProps`. All props are optional; wrap the component to
 * require one.
 *
 * @example
 * ```ts
 * export type ButtonProps = TVAProps<typeof button>;
 * // { intent?: "primary" | "secondary"; size?: "sm" | "md" }
 * ```
 */
export type TVAProps<F> = F extends TVAFn<infer V> ? Selection<V> : never;

/**
 * Builds a variant resolver modeled on [cva](https://cva.style). Where
 * cva composes class strings, `tva` composes brand-enforced style
 * objects into a `mix`-ready descriptor.
 *
 * Each invocation resolves the selection by deep-merging `base`, then
 * every matching variant in declaration order, then every matching
 * compound variant in array order, and feeds the result to a single
 * {@link css} call. `defaultVariants` fills in unset axes, and boolean
 * axes come from options named `true` and `false`.
 *
 * @see {@link TVAConfig} for the configuration shape.
 * @see {@link TVAProps} to extract the props type.
 *
 * @example
 * ```ts
 * export let button = tva({
 *     base: { borderRadius: t.radius.md },
 *     variants: {
 *         intent: {
 *             primary: { backgroundColor: t.color.accent },
 *             secondary: { backgroundColor: "transparent" },
 *         },
 *         size: { sm: { fontSize: t.text.sm }, md: { fontSize: t.text.md } },
 *         block: { true: { display: "flex" } },
 *     },
 *     compoundVariants: [
 *         { intent: "secondary", size: "md", css: { fontSize: t.text.lg } },
 *     ],
 *     defaultVariants: { intent: "primary", size: "md" },
 * });
 *
 * <button mix={button({ intent: "secondary", block: true })} />;
 * ```
 */
export function tva<const V extends VariantShape>(config: TVAConfig<V>): TVAFn<V> {
    function resolve(props?: Selection<V>): ThemedCSSProps {
        let selected: Record<string, unknown> = { ...config.defaultVariants };
        for (let [key, value] of Object.entries(props ?? {})) {
            if (value !== undefined) selected[key] = value;
        }

        let merged: Record<string, unknown> = { ...config.base };
        for (let [name, values] of Object.entries(config.variants ?? {})) {
            let choice = selected[name];
            if (choice === undefined || choice === null) continue;
            let styles = (values as Record<string, ThemedCSSProps>)[
                String(choice as string | boolean)
            ];
            if (styles) merged = deepMerge(merged, styles) as Record<string, unknown>;
        }
        for (let compound of config.compoundVariants ?? []) {
            let { css: compoundCss, ...match } = compound;
            let matches = Object.entries(match).every(([key, value]) => selected[key] === value);
            if (matches) merged = deepMerge(merged, compoundCss) as Record<string, unknown>;
        }
        return merged as ThemedCSSProps;
    }

    let fn = <node extends Element = Element>(props?: Selection<V>): ThemedCSSMixin<node> =>
        css<node>(resolve(props));
    return Object.assign(fn, { resolve });
}

/**
 * Plain objects merge recursively; arrays and primitives replace.
 *
 * @internal
 */
export function deepMerge(a: unknown, b: unknown): unknown {
    if (!isPlainObject(a) || !isPlainObject(b)) return b;
    let out: Record<string, unknown> = { ...a };
    for (let [key, value] of Object.entries(b)) {
        out[key] = key in out ? deepMerge(out[key], value) : value;
    }
    return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

type UnionToIntersection<U> = (U extends unknown ? (arg: U) => void : never) extends (
    arg: infer I,
) => void
    ? I
    : never;

// Controller-approved deviation from the brief: `Parameters<T>[0]` distributes
// over the `Fns[number]` union and keeps each branch's optional `| undefined`,
// which would otherwise poison `UnionToIntersection` (intersecting with
// `undefined` yields an uninhabited type) — `Exclude` strips it first.
type CombinedProps<Fns extends readonly TVAFn<VariantShape>[]> =
    UnionToIntersection<Exclude<Parameters<Fns[number]>[0], undefined>> extends infer P
        ? { [K in keyof P]: P[K] }
        : never;

/**
 * A component built by {@link combine}. Accepts the union of the input
 * components' props and honors each input's own defaults.
 */
export interface CombinedTVAFn<Fns extends readonly TVAFn<VariantShape>[]> {
    /** Resolves every input and returns a `mix`-ready descriptor. */
    <node extends Element = Element>(props?: CombinedProps<Fns>): ThemedCSSMixin<node>;
    /** Returns the merged style object without building a descriptor. */
    resolve(props?: CombinedProps<Fns>): ThemedCSSProps;
}

/**
 * Composes {@link tva} components, like cva's `compose`. Each input
 * resolves independently against the shared props, the results
 * deep-merge in argument order, and one {@link css} call produces the
 * descriptor. The result accepts the union of the inputs' props and
 * honors each input's own defaults.
 *
 * @see {@link CombinedTVAFn}
 *
 * @example
 * ```tsx
 * export let pillButton = combine(button, rounded);
 * <button mix={pillButton({ intent: "primary", pill: true })} />;
 * ```
 */
export function combine<Fns extends readonly TVAFn<VariantShape>[]>(
    ...fns: Fns
): CombinedTVAFn<Fns> {
    function resolve(props?: CombinedProps<Fns>): ThemedCSSProps {
        let merged: unknown = {};
        for (let fn of fns) {
            merged = deepMerge(merged, fn.resolve(props as never));
        }
        return merged as ThemedCSSProps;
    }
    let fn = <node extends Element = Element>(props?: CombinedProps<Fns>): ThemedCSSMixin<node> =>
        css<node>(resolve(props));
    return Object.assign(fn, { resolve });
}

/**
 * A value {@link cx} accepts: a string, a number, a nested array of
 * the same, or a record whose truthy keys are emitted. `null`,
 * `undefined`, and `false` are dropped. Compatible with clsx.
 */
export type ClassValue =
    | string
    | number
    | null
    | undefined
    | false
    | readonly ClassValue[]
    | Record<string, boolean | null | undefined>;

/**
 * clsx-compatible `className` joiner for interop with plain
 * stylesheets, since `mix` and `className` compose on the same
 * element. Strings and numbers join with spaces, falsy values drop,
 * arrays flatten, and truthy object keys join.
 *
 * @see {@link ClassValue}
 *
 * @example
 * ```tsx
 * <span className={cx("mono", isAlias && "alias-tag")} />;
 * ```
 */
export function cx(...inputs: ClassValue[]): string {
    let out: string[] = [];
    for (let input of inputs) {
        if (!input) continue;
        if (typeof input === "string" || typeof input === "number") {
            out.push(String(input));
        } else if (Array.isArray(input)) {
            let inner = cx(...input);
            if (inner) out.push(inner);
        } else if (typeof input === "object") {
            for (let [key, on] of Object.entries(input)) {
                if (on) out.push(key);
            }
        }
    }
    return out.join(" ");
}

import { css } from "./css.ts";
import type { CSSMixinDescriptor } from "remix/ui";
import type { ThemedCSSProps } from "./props.ts";

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

export interface TVAConfig<V extends VariantShape> {
    base?: ThemedCSSProps;
    variants?: V;
    compoundVariants?: readonly (Selection<V> & { css: ThemedCSSProps })[];
    defaultVariants?: Selection<V>;
}

export interface TVAFn<V extends VariantShape> {
    (props?: Selection<V>): CSSMixinDescriptor;
    resolve(props?: Selection<V>): ThemedCSSProps;
}

export type TVAProps<F> = F extends TVAFn<infer V> ? Selection<V> : never;

export function tva<const V extends VariantShape>(config: TVAConfig<V>): TVAFn<V> {
    function resolve(props?: Selection<V>): ThemedCSSProps {
        let selected: Record<string, unknown> = { ...config.defaultVariants };
        for (let [key, value] of Object.entries(props ?? {})) {
            if (value !== undefined) selected[key] = value;
        }

        let merged: Record<string, unknown> = { ...(config.base ?? {}) };
        for (let [name, values] of Object.entries(config.variants ?? {})) {
            let choice = selected[name];
            if (choice === undefined || choice === null) continue;
            let styles = (values as Record<string, ThemedCSSProps>)[String(choice)];
            if (styles) merged = deepMerge(merged, styles) as Record<string, unknown>;
        }
        for (let compound of config.compoundVariants ?? []) {
            let { css: compoundCss, ...match } = compound;
            let matches = Object.entries(match).every(([key, value]) => selected[key] === value);
            if (matches) merged = deepMerge(merged, compoundCss) as Record<string, unknown>;
        }
        return merged as ThemedCSSProps;
    }

    let fn = (props?: Selection<V>) => css(resolve(props));
    return Object.assign(fn, { resolve });
}

/** Plain objects merge recursively; arrays and primitives replace. */
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

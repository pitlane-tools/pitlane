/// <reference lib="dom" preserve="true" />

import type { ElementProps, MixinDescriptor } from "remix/ui";

import { css as remixCss } from "remix/ui";

import type { ThemedCSSProps } from "./props.ts";

type RemixCSSProps = Parameters<typeof remixCss>[0];

/**
 * The descriptor css() produces. `MixinDescriptor` is invariant in its node
 * type, so — exactly like remix/ui's own css factory — the node binds per
 * callsite through the generic parameter.
 */
export type ThemedCSSMixin<node extends Element = Element> = MixinDescriptor<
    node,
    [styles: RemixCSSProps],
    ElementProps
>;

/**
 * Brand-typed wrapper over remix/ui's css() mixin. Branded token refs are
 * already `var()` strings; tuples join with spaces; everything else passes
 * straight through.
 *
 * The node type parameter is inferred from the `mix` position it is used in
 * (`<div mix={css({ … })} />`), mirroring remix/ui's css. Apply css() at the
 * element; share ThemedCSSProps objects, not descriptors.
 */
export function css<node extends Element = Element>(styles: ThemedCSSProps): ThemedCSSMixin<node> {
    return remixCss<node>(normalizeStyles(styles) as RemixCSSProps);
}

function normalizeStyles(styles: ThemedCSSProps): Record<string, unknown> {
    let out: Record<string, unknown> = {};
    for (let [key, value] of Object.entries(styles)) {
        if (Array.isArray(value)) {
            out[key] = value.join(" ");
        } else if (typeof value === "object" && value !== null) {
            out[key] = normalizeStyles(value as ThemedCSSProps);
        } else {
            out[key] = value;
        }
    }
    return out;
}

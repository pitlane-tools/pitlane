/// <reference lib="dom" preserve="true" />

import type { ElementProps, MixinDescriptor } from "remix/ui";

import { css as remixCss } from "remix/ui";

import type { ThemedCSSProps } from "./props.ts";

type RemixCSSProps = Parameters<typeof remixCss>[0];

/**
 * The descriptor {@link css} produces. `MixinDescriptor` is invariant
 * in its node type, so — exactly like `remix/ui`'s own `css` factory —
 * the node binds per callsite through the generic parameter.
 *
 * @see {@link css}
 */
export type ThemedCSSMixin<node extends Element = Element> = MixinDescriptor<
    node,
    [styles: RemixCSSProps],
    ElementProps
>;

/**
 * Brand-enforced wrapper over `remix/ui`'s `css()` mixin. Token-mapped
 * longhands accept the matching token brand, CSS-wide keywords,
 * property keywords, and `0`; anything else — including a raw
 * `color: "#ff0000"` — is a type error. Every other CSS property
 * carries csstype's value union, so `display`, `position`, `resize`,
 * and the rest of the closed-grammar properties accept only their real
 * keywords. Nested selectors, at-rules, and custom properties recurse.
 *
 * Branded token refs are already `var()` strings and pass through; an
 * array value joins with spaces, which is how the box shorthands take
 * a 1–4 tuple. A comma list needs a template string.
 *
 * `css()` is node-generic, exactly like `remix/ui`'s own `css`: the
 * descriptor binds to the element type of the `mix` position it
 * appears in, so write `css({ … })` inline at each element and share
 * {@link ThemedCSSProps} objects, never stored descriptors.
 *
 * Interpolating a token into a template string
 * (`` `1px solid ${t.color.line}` ``) yields a plain string, which the
 * open-grammar shorthands accept.
 *
 * @see {@link ThemedCSSProps} for the accepted per-property values.
 * @see {@link ThemedCSSMixin} for the returned descriptor.
 *
 * @example
 * ```tsx
 * <div
 *     mix={css({
 *         color: t.color.bg,
 *         padding: [t.space.sm, t.space.md],
 *         margin: 0,
 *         "&:hover": { color: t.color.gray[900] },
 *     })}
 * />
 * ```
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

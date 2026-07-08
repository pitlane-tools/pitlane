import { css as remixCss } from "remix/ui";
import type { CSSMixinDescriptor } from "remix/ui";

import type { ThemedCSSProps } from "./props.ts";

type RemixCSSProps = Parameters<typeof remixCss>[0];

/**
 * Brand-typed wrapper over remix/ui's css() mixin. Branded token refs are
 * already `var()` strings; tuples join with spaces; everything else passes
 * straight through.
 */
export function css(styles: ThemedCSSProps): CSSMixinDescriptor {
    return remixCss(normalizeStyles(styles) as RemixCSSProps);
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

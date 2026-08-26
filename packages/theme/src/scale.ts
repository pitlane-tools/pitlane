import type { ScalableToken } from "./types.ts";

/**
 * Turns one token into a multiplier, so a scale does not have to name
 * every step. The returned function produces
 * `calc(<base> * <steps>)`, keeping whichever brand the base carried.
 *
 * Use this for a token you did not declare as a scale. A token
 * declared with `s.scale()` is already a multiplier, and its base is
 * `t.spacing.token` when you need it.
 *
 * The result is a CSS string like any other, so it also works as an
 * authored token value.
 *
 * @param base - The token to multiply
 * @returns A function from steps to a token of the same type
 *
 * @example
 * ```ts
 * import { scale } from "@pitlane/theme";
 *
 * let step = scale(t.tracking.tight);
 * css({ letterSpacing: step(2) }); // calc(var(--tracking-tight) * 2)
 * ```
 */
export function scale<base extends ScalableToken>(base: base): (steps: number) => base {
    return steps => `calc(${base} * ${steps})` as base;
}

/**
 * A `light-dark()` color, resolved by the browser against the
 * `color-scheme` property. A subtree that sets `color-scheme` flips
 * whatever the media query says, which is what a theme toggle needs.
 *
 * Both arguments may be token references, so a mode override of either
 * primitive still reaches the result.
 *
 * `light-dark()` is color-only. Use `modes` for anything else.
 *
 * @param light - The color for a light `color-scheme`
 * @param dark - The color for a dark `color-scheme`
 * @returns The `light-dark()` function text
 *
 * @example
 * ```ts
 * tokens: { surface: { page: lightDark("#ffffff", "#1a1a1a") } }
 * ```
 */
export function lightDark(light: string, dark: string): string {
    return `light-dark(${light}, ${dark})`;
}

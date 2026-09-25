/**
 * The site's responsive conditions, written as `css()` at-rule keys. Custom
 * properties cannot appear in a media query, so these live here rather than
 * in the theme.
 *
 * - `narrow`: the sidebar and outline fold into the section bar.
 * - `compact`: the primary navigation folds into a menu too.
 * - `outlineColumn`: the page outline gets a column of its own; below it the
 *   outline is a disclosure in the section bar.
 */
export const compact = "@media (width < 40rem)";
export const narrow = "@media (width < 56.25rem)";
export const wide = "@media (width >= 56.25rem)";
export const belowOutlineColumn = "@media (width < 80rem)";
export const outlineColumn = "@media (width >= 80rem)";
/** Wide enough for the sidebar column, not yet for the outline's. */
export const medium = "@media (56.25rem <= width < 80rem)";

/** Controls that only a script can operate stay out of a page read without one. */
export const noScript = "@media (scripting: none)";
export const canHover = "@media (hover: hover)";

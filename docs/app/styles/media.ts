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
/** Stand-ins for those controls, needed only when they are missing. */
export const scripted = "@media (scripting: enabled)";

/**
 * While the reader has collapsed the sidebar: a page condition rather than a
 * media query, set as `data-nav-collapsed` on the root by the sidebar toggle.
 * Pair it with `wide`, the only layout with a sidebar column to collapse.
 */
export const navCollapsed = ":root[data-nav-collapsed] &";

/**
 * While the article panel slides after the sidebar toggles. The panel is
 * transformed then, which makes it the containing block of its fixed corner.
 */
export const navSliding = ":root[data-nav-sliding] &";

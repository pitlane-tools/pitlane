import * as jsxRuntime from "remix/ui/jsx-runtime";
import type { Handle } from "remix/ui";

/**
 * Imported by `mdx-with-expressions.mdx` as `./footnote.tsx`, a sibling of the
 * document. A relative specifier resolves from the MDX file's own directory on
 * both hosts: under the bundler the manifest resolves it from the entry's path,
 * because a compiled body has no directory of its own.
 */
export function Footnote(handle: Handle<{ text: string }>) {
    return () => jsxRuntime.jsx("aside", { class: "footnote", children: handle.props.text });
}

import type { Handle, RemixNode } from "remix/ui";

/** What an `.mdx` module's default export is: a props function, not a Remix component. */
export type MdxDocument = (props: Record<string, never>) => RemixNode;

/** Renders a shared partial inside a page. */
export function Include(handle: Handle<{ document: MdxDocument }>) {
    return () => handle.props.document({});
}

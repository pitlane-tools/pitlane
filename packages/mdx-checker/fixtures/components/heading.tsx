import type { Handle } from "remix/ui";

/** A default export, so a document can `import Heading from "./heading.tsx"`. */
export default function Heading(handle: Handle<{ label: string; level?: 2 | 3 }>) {
    return () =>
        handle.props.level === 3 ? (
            <h3 class="heading">{handle.props.label}</h3>
        ) : (
            <h2 class="heading">{handle.props.label}</h2>
        );
}

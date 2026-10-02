import * as jsxRuntime from "remix/component/jsx-runtime";
import type { Handle } from "remix/component";

/** A default export, so a document can `import Heading from "./heading.tsx"`. */
export default function Heading(handle: Handle<{ label: string }>) {
    return () => jsxRuntime.jsx("h2", { class: "heading", children: handle.props.label });
}

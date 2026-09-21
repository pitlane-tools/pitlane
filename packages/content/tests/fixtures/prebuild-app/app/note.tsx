import * as jsxRuntime from "remix/ui/jsx-runtime";
import type { Handle } from "remix/ui";

/** Imported by the MDX fixture, so both paths must resolve it identically. */
export function Note(handle: Handle<{ label: string }>) {
    return () => jsxRuntime.jsx("em", { class: "note", children: handle.props.label });
}

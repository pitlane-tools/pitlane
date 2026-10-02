import * as jsxRuntime from "remix/component/jsx-runtime";
import type { Handle } from "remix/component";

/** Imported by the MDX fixture, so both paths must resolve it identically. */
export function Note(handle: Handle<{ label: string }>) {
    return () => jsxRuntime.jsx("em", { class: "note", children: handle.props.label });
}

import * as jsxRuntime from "remix/component/jsx-runtime";
import type { Handle } from "remix/component";

/** A server-only component: rendered once, never shipped to the browser. */
export function Badge(handle: Handle<{ label: string }>) {
    return () => jsxRuntime.jsx("strong", { class: "badge", children: handle.props.label });
}

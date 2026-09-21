import * as jsxRuntime from "remix/ui/jsx-runtime";
import type { Handle } from "remix/ui";

/**
 * Exports the name `Badge` on purpose: two modules exporting one name is the
 * case a single bindings object cannot represent.
 */
export function Badge(handle: Handle<{ label: string }>) {
    return () => jsxRuntime.jsx("em", { class: "chip", children: handle.props.label });
}

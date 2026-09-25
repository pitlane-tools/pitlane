import type { Handle } from "remix/ui";

export interface BadgeProps {
    label: string;
}

/** A server-only component with a required prop. */
export function Badge(handle: Handle<BadgeProps>) {
    return () => <strong class="badge">{handle.props.label}</strong>;
}

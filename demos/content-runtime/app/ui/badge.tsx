import type { Handle } from "remix/ui";

export interface BadgeProps {
    label: string;
}

/**
 * A server-only component. It renders during the response and is never sent to
 * the browser, so it costs nothing on the client.
 */
export function Badge(handle: Handle<BadgeProps>) {
    return () => <strong class="badge">{handle.props.label}</strong>;
}

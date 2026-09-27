/**
 * Loaders for widgets.
 *
 * @see {@link https://example.com/guides/loaders | Loaders guide}
 *
 * @module
 */
import { Widget } from "./widget.ts";

export { Widget, Widget as Gadget };

/** Loads a widget from the entry or fallback name. */
export function load(
    name: string,
    options?: {
        entry?: string;
        rules?: Array<{ nested: string }>;
        label?: (widget: Widget) => string;
    },
): Widget {
    return new Widget(options?.entry ?? name);
}

function makeWidget(name: string): Widget {
    return new Widget(name);
}

/** Makes a widget, through an implementation the reference must not name. */
export const make: (name: string) => Widget = makeWidget;

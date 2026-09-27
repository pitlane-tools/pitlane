import { Widget } from "./widget.ts";

export { Widget, Widget as Gadget };

/** Loads a widget from the entry or fallback name. */
export function load(
    name: string,
    options?: { entry?: string; rules?: Array<{ nested: string }> },
): Widget {
    return new Widget(options?.entry ?? name);
}

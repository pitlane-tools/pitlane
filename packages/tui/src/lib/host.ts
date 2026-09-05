import type { OpenElement, Text } from "@bomb.sh/tty";
import type { RendererHost } from "@remix-run/ui/renderer";

import { TypedEventTarget } from "@remix-run/ui";

import { TerminalRenderError } from "./error.ts";

/**
 * Host element name emitted by the `Box` component.
 */
export const BOX = "tui-box";

/**
 * Host element name emitted by the `Text` component.
 */
export const TEXT = "tui-text";

/**
 * Layout, color, border, and transition fields of a box, forwarded verbatim
 * to the tty element op.
 */
export type TerminalBoxStyle = Omit<OpenElement, "directive" | "id">;

/**
 * Color, wrapping, font, and attribute fields of a text run, forwarded
 * verbatim to the tty text op.
 */
export type TerminalTextStyle = Omit<Text, "directive" | "content">;

/**
 * Style fields accepted by the `style` mixin. A box takes
 * {@link TerminalBoxStyle} fields and a text run takes
 * {@link TerminalTextStyle} fields; applying one kind to the other is
 * rejected instead of silently dropped, since tty ignores fields its op does
 * not carry.
 */
export type TerminalStyle = TerminalBoxStyle | TerminalTextStyle;

// tty packs only the fields its op declares, so an unrecognized field would
// disappear without a trace. Listing them lets the host name the mistake.
const BOX_STYLE_FIELDS: Record<string, true> = {
    layout: true,
    bg: true,
    cornerRadius: true,
    border: true,
    clip: true,
    floating: true,
    transition: true,
};

const TEXT_STYLE_FIELDS: Record<string, true> = {
    color: true,
    bg: true,
    fontSize: true,
    fontId: true,
    wrap: true,
    attrs: true,
    caret: true,
};

/**
 * Pointer event names tty reports for a box.
 */
export type TerminalPointerEventType = "pointerenter" | "pointerleave" | "pointerclick";

/**
 * Event dispatched on a {@link TerminalBox} when tty hit tests the pointer
 * against it. Listen for it with the `on` mixin from `@remix-run/ui`.
 */
export class TerminalPointerEvent extends Event {
    declare readonly type: TerminalPointerEventType;

    /**
     * Id tty reported the event with: the box's `id` prop when it has one, and
     * its generated id otherwise.
     */
    readonly id: string;

    /**
     * @param type Pointer event name reported by tty.
     * @param id Id of the box tty hit tested.
     */
    constructor(type: TerminalPointerEventType, id: string) {
        super(type);
        this.id = id;
    }
}

/**
 * Events dispatched on a {@link TerminalBox}. tty reports a pointer as being
 * over every box that contains it, so an event on a box also fires for each
 * of its ancestors.
 */
export interface TerminalBoxEventMap {
    pointerenter: TerminalPointerEvent;
    pointerleave: TerminalPointerEvent;
    pointerclick: TerminalPointerEvent;
}

/**
 * Events dispatched on a {@link TerminalTextElement}. A text run is not hit
 * tested by tty, so it has none and `on()` rejects every event name for a
 * `<Text>`.
 */
export type TerminalTextEventMap = Record<never, Event>;

interface TerminalNodeBase {
    /**
     * Owning element, or `null` while the node is detached.
     */
    parent: TerminalElement | null;
}

/**
 * A box element. Boxes lay out their children and are the only nodes tty can
 * hit test, so they are also the only nodes that receive pointer events.
 *
 * The element is itself the event target mixins bind to, so a handler added
 * with `on` from `@remix-run/ui` sees {@link TerminalPointerEvent} instances
 * dispatched on this object.
 */
export class TerminalBox extends TypedEventTarget<TerminalBoxEventMap> implements TerminalNodeBase {
    readonly type = BOX;

    /**
     * Id sent to tty. Defaults to {@link TerminalBox.generatedId} and is
     * replaced while an `id` prop is present.
     */
    id: string;

    /**
     * Id generated when the element was created. Stable for the lifetime of the
     * element so tty keeps pointer and transition state across frames.
     */
    readonly generatedId: string;

    /**
     * Style fields for the tty element op, written by the `style` mixin.
     */
    style: TerminalBoxStyle | undefined = undefined;

    readonly children: TerminalNode[] = [];

    parent: TerminalElement | null = null;

    /**
     * @param id Id sent to tty for this element.
     */
    constructor(id: string) {
        super();
        this.id = id;
        this.generatedId = id;
    }
}

/**
 * A text element. Serializes to a single styled tty text run built from its
 * text children.
 */
export class TerminalTextElement
    extends TypedEventTarget<TerminalTextEventMap>
    implements TerminalNodeBase
{
    readonly type = TEXT;

    /**
     * Style fields for the tty text op, written by the `style` mixin.
     */
    style: TerminalTextStyle | undefined = undefined;

    readonly children: TerminalNode[] = [];

    parent: TerminalElement | null = null;
}

/**
 * A text node created for a rendered string, number, or bigint child.
 */
export interface TerminalString extends TerminalNodeBase {
    type: "string";
    value: string;
}

/**
 * An invisible positional anchor the renderer uses to mark a range in the
 * tree. Anchors are skipped during serialization and never reach tty, so they
 * cannot influence layout.
 */
export interface TerminalAnchor extends TerminalNodeBase {
    type: "anchor";
}

/**
 * Any element in the terminal host tree.
 */
export type TerminalElement = TerminalBox | TerminalTextElement;

/**
 * Any node in the terminal host tree.
 */
export type TerminalNode = TerminalElement | TerminalString | TerminalAnchor;

/**
 * Creates the renderer host that maintains a terminal node tree.
 *
 * @param commit Called once per synchronous render batch, after all tree
 *   mutations, with the container that was rendered into.
 * @returns A host for `createRenderer` from `@remix-run/ui/renderer`.
 */
export function createTerminalHost(
    commit: (container: TerminalElement) => void,
): RendererHost<TerminalNode, TerminalElement> {
    let generated = 0;

    return {
        createElement(type, props) {
            let element: TerminalElement;
            if (type === BOX) {
                element = new TerminalBox(`~${++generated}`);
            } else if (type === TEXT) {
                element = new TerminalTextElement();
            } else {
                throw new TerminalRenderError(
                    "UNSUPPORTED_ELEMENT",
                    `<${type}> is not a terminal element. Render Box and Text from @pitlane/tui instead.`,
                );
            }
            for (let name in props) {
                setProp(element, name, props[name]);
            }
            return element;
        },

        createText(text) {
            return { type: "string", value: text, parent: null };
        },

        createComment() {
            return { type: "anchor", parent: null };
        },

        setText(node, text) {
            if (node.type !== "string") {
                throw new TerminalRenderError(
                    "UNSUPPORTED_NODE",
                    `Cannot set text on a ${describe(node)} node.`,
                );
            }
            node.value = text;
        },

        patchProps(element, previous, next) {
            for (let name in previous) {
                if (!(name in next)) setProp(element, name, undefined);
            }
            for (let name in next) {
                if (previous[name] !== next[name]) setProp(element, name, next[name]);
            }
        },

        insert(node, parent, before) {
            detach(node);
            node.parent = parent;
            if (before === null) {
                parent.children.push(node);
                return;
            }
            let index = parent.children.indexOf(before);
            if (index < 0) {
                throw new TerminalRenderError(
                    "INVALID_INSERT",
                    "Cannot insert before a node that is not a child of the target element.",
                );
            }
            parent.children.splice(index, 0, node);
        },

        remove(node) {
            detach(node);
        },

        parentNode(node) {
            return node.parent;
        },

        nextSibling(node) {
            let parent = node.parent;
            if (parent === null) return null;
            let index = parent.children.indexOf(node);
            return index < 0 ? null : (parent.children[index + 1] ?? null);
        },

        // Elements are their own event targets: a box receives tty pointer events
        // on itself, and a text run, while never hit tested, still needs a node
        // for mixins to bind their lifecycle to.
        getEventTarget(element) {
            return element;
        },

        commit,
    };
}

function detach(node: TerminalNode): void {
    let parent = node.parent;
    if (parent === null) return;
    let index = parent.children.indexOf(node);
    if (index >= 0) parent.children.splice(index, 1);
    node.parent = null;
}

function setProp(element: TerminalElement, name: string, value: unknown): void {
    if (name === "children" || name === "mix" || name === "key") return;

    if (name === "style") {
        if (element.type === BOX) {
            element.style = asStyle<TerminalBoxStyle>(element, value, BOX_STYLE_FIELDS);
        } else {
            element.style = asStyle<TerminalTextStyle>(element, value, TEXT_STYLE_FIELDS);
        }
        return;
    }

    if (element.type === BOX && name === "id") {
        if (value === undefined) {
            element.id = element.generatedId;
            return;
        }
        if (typeof value !== "string" || value === "") {
            throw new TerminalRenderError(
                "UNSUPPORTED_PROP",
                `${describe(element)} id must be a non-empty string.`,
            );
        }
        element.id = value;
        return;
    }

    throw new TerminalRenderError(
        "UNSUPPORTED_PROP",
        `${describe(element)} does not support the "${name}" prop. ${
            element.type === BOX
                ? "A Box accepts id, children, and mix. Style it with style() and handle pointer events with on()."
                : "A Text accepts children and mix. Style it with style()."
        }`,
    );
}

function asStyle<style extends TerminalStyle>(
    element: TerminalElement,
    value: unknown,
    fields: Record<string, true>,
): style | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "object" || value === null) {
        throw new TerminalRenderError(
            "UNSUPPORTED_STYLE",
            `${describe(element)} style must be an object.`,
        );
    }
    for (let field in value) {
        if (fields[field] === true) continue;
        throw new TerminalRenderError(
            "UNSUPPORTED_STYLE",
            `${describe(element)} has no "${field}" style field. ${
                element.type === BOX
                    ? "A Box is styled with layout, bg, cornerRadius, border, clip, floating, and transition."
                    : "A Text is styled with color, bg, fontSize, fontId, wrap, attrs, and caret."
            }`,
        );
    }
    return value as style;
}

function describe(node: TerminalNode): string {
    switch (node.type) {
        case BOX:
            return "<Box>";
        case TEXT:
            return "<Text>";
        case "string":
            return "text";
        case "anchor":
            return "anchor";
    }
}

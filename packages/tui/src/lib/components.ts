import type { Handle, MixInput, RemixNode } from "@remix-run/ui";

import { jsx } from "@remix-run/ui/jsx-runtime";

import type { TerminalBox, TerminalTextElement } from "./host.ts";

import { BOX, TEXT } from "./host.ts";

/**
 * Props for {@link Box}.
 */
export interface BoxProps {
    /**
     * Id reported by tty for this box in pointer events and element bounds.
     * Must be unique in the frame; a generated id is used when omitted.
     */
    id?: string;

    /**
     * Mixins applied to the box: `style` from `@pitlane/tui` for layout and
     * paint, and `on` from `@remix-run/ui` for `pointerenter`, `pointerleave`,
     * and `pointerclick`.
     */
    mix?: MixInput<TerminalBox>;

    /**
     * Boxes, texts, and strings to lay out inside the box.
     */
    children?: RemixNode;
}

/**
 * Props for {@link Text}.
 */
export interface TextProps {
    /**
     * Mixins applied to the text run. `style` from `@pitlane/tui` sets color,
     * wrapping, font, and attributes. tty hit tests boxes only, so a text run
     * has no events to listen for.
     */
    mix?: MixInput<TerminalTextElement>;

    /**
     * Strings, numbers, components, and fragments that make up the text run.
     * Nested {@link Box} and {@link Text} elements are rejected because a
     * terminal text run is a single styled string.
     */
    children?: RemixNode;
}

/**
 * Lays out children in the terminal, and receives pointer events.
 *
 * @param handle Component handle supplying {@link BoxProps}.
 * @returns A render function emitting a terminal box element.
 *
 * @example
 * ```tsx
 * import { fixed, grow, rgba } from "@bomb.sh/tty";
 * import { Box, style, Text } from "@pitlane/tui";
 * import { on } from "@remix-run/ui";
 *
 * <Box mix={style({ layout: { width: grow(), direction: "ttb" }, bg: rgba(20, 20, 30) })}>
 *     <Box
 *         mix={[
 *             style({ layout: { height: fixed(1) } }),
 *             hovered && style({ bg: rgba(40, 40, 60) }),
 *             on("pointerclick", increment),
 *         ]}
 *     >
 *         <Text mix={style({ color: rgba(255, 255, 255) })}>Clicked {count} times</Text>
 *     </Box>
 * </Box>
 * ```
 */
export function Box(handle: Handle<BoxProps>): () => RemixNode {
    // Props are copied because the handle's props object keeps its identity
    // across updates, and the renderer diffs host props by value. The copy is
    // also what makes style composition stateless: every render starts from the
    // props the caller passed, so the mixins rebuild the style from scratch.
    return () => jsx(BOX, { ...handle.props });
}

/**
 * Renders a styled run of text in the terminal.
 *
 * @param handle Component handle supplying {@link TextProps}.
 * @returns A render function emitting a terminal text element.
 *
 * @example
 * ```tsx
 * import { rgba } from "@bomb.sh/tty";
 * import { style, Text } from "@pitlane/tui";
 *
 * <Text mix={style({ color: rgba(120, 200, 255) })}>Hello, terminal</Text>
 * ```
 */
export function Text(handle: Handle<TextProps>): () => RemixNode {
    return () => jsx(TEXT, { ...handle.props });
}

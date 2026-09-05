/**
 * Terminal rendering for Remix 3 components. `Box` and `Text` lay out through
 * `@bomb.sh/tty`, `style()` carries tty layout and paint fields on the normal
 * `mix` prop, and `createRoot()` returns a root that does no I/O: it hands
 * changed frames to `write` and consumes the bytes given to `writeInput`.
 *
 * @module @pitlane/tui
 */

export type { BoxProps, TextProps } from "./lib/components.ts";
export { Box, Text } from "./lib/components.ts";
export { TerminalRenderError } from "./lib/error.ts";
export type {
    TerminalBox,
    TerminalBoxEventMap,
    TerminalBoxStyle,
    TerminalPointerEventType,
    TerminalStyle,
    TerminalTextElement,
    TerminalTextEventMap,
    TerminalTextStyle,
} from "./lib/host.ts";
export { TerminalPointerEvent } from "./lib/host.ts";
export type {
    TerminalInputEvent,
    TerminalRoot,
    TerminalRootEventMap,
    TerminalRootOptions,
} from "./lib/root.ts";
export { createRoot } from "./lib/root.ts";
export { style } from "./lib/style.ts";

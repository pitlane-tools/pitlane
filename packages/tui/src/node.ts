/**
 * The interactive Node runner. `createRoot()` connects a terminal renderer to
 * `process.stdin` and `process.stdout`, enters the alternate screen, and
 * restores terminal state on `unmount()`, Ctrl+C, SIGINT, SIGTERM, or EOF.
 *
 * @module @pitlane/tui/node
 */

export type { NodeTerminalOptions, NodeTerminalRoot } from "./lib/node.ts";
export { createRoot } from "./lib/node.ts";

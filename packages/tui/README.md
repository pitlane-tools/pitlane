# @pitlane/tui

Render [Remix 3](https://remix.run) components in a terminal. `@bomb.sh/tty` does layout, input parsing, and cell-diffed output; Remix's universal renderer (`@remix-run/ui/renderer`) does reconciliation, so component setup, context, batched updates, mixins, and abort-signal cleanup work exactly as they do in the DOM.

This is an experimental package. It is not on npm, and the renderer host API it builds on is not in any published `@remix-run/ui` — see [Install](#install).

## Features

- Remix component setup, stable props, context, update batching, and abort-signal cleanup
- `Box` layout and `Text` content, with keyed component identity across reordering
- Composable style and event mixins, parsed keyboard input, resizing, and tty transitions
- A zero-I/O renderer for embedding, plus a Node runner that manages terminal modes

## Install

`@remix-run/ui/renderer` is not part of `@remix-run/ui@0.8.0` on npm. Until the universal renderer lands upstream, this package and its demo take `@remix-run/ui` as a pnpm Git dependency on the `preview/ui-universal-renderer` branch of [markmals/remix](https://github.com/markmals/remix), which carries the built package:

```json
{
    "dependencies": {
        "@remix-run/ui": "markmals/remix#preview/ui-universal-renderer&path:packages/ui"
    }
}
```

When the renderer ships in a published Remix, that dependency becomes a `remix` peer and the imports below move from `@remix-run/ui` to `remix/ui`.

Consume the package from this workspace:

```sh
pnpm install
vp -C packages/tui run build
```

Then depend on it from another workspace package:

```json
{
    "dependencies": {
        "@pitlane/tui": "workspace:*",
        "@remix-run/ui": "markmals/remix#preview/ui-universal-renderer&path:packages/ui"
    }
}
```

Import tty helpers such as `grow`, `fixed`, and `rgba` from `@bomb.sh/tty` directly; add `"@bomb.sh/tty": "0.9.0"` to the consuming package when you do.

## Quick start

The Node runner requires interactive stdin and stdout. It enters the alternate screen, enables raw input and mouse reporting, and restores terminal state on `unmount()`, Ctrl+C, SIGINT, SIGTERM, or input EOF.

```tsx
import type { TerminalRoot } from "@pitlane/tui";
import type { Handle } from "@remix-run/ui";

import { Box, style, Text } from "@pitlane/tui";
import { createRoot } from "@pitlane/tui/node";
import { on } from "@remix-run/ui";

function Counter(handle: Handle<{ terminal: TerminalRoot }>) {
    let count = 0;

    function increment() {
        count++;
        handle.update();
    }

    handle.props.terminal.addEventListener(
        "input",
        event => {
            if (event.detail.type === "keydown" && event.detail.code === "Enter") increment();
        },
        { signal: handle.signal },
    );

    return () => (
        <Box mix={[style({ layout: { direction: "ttb" } }), on("pointerclick", increment)]}>
            <Text>Count: {count}</Text>
            <Text>Enter or click to increment. Ctrl+C to quit.</Text>
        </Box>
    );
}

let terminal = await createRoot();
try {
    terminal.render(<Counter terminal={terminal} />);
    await terminal.closed;
} finally {
    terminal.unmount();
}
```

Use the normal `@remix-run/ui` JSX runtime (`jsx: "react-jsx"`, `jsxImportSource: "@remix-run/ui"`). Run TSX on Node with `node --import @remix-run/node-tsx app.tsx`.

The [interactive demo](../../demos/tui) exercises context, local component state, keyed reordering, removal, input cleanup, pointer clicks, and resizing:

```sh
vp -C packages/tui run build
pnpm -C demos/tui start
```

## Layout and text

Use `style()` in the `mix` prop for terminal layout and appearance, just as you use `css()` for DOM elements. Import sizing and color helpers from their owning package:

```tsx
import { grow, rgba } from "@bomb.sh/tty";
import { Box, style, Text } from "@pitlane/tui";

<Box
    mix={style({
        bg: rgba(20, 25, 32),
        layout: { width: grow(), height: grow(), direction: "ttb" },
    })}
>
    <Text mix={style({ color: rgba(232, 237, 242) })}>Ready</Text>
</Box>;
```

`style()` is a Remix mixin built with `createMixin`, not a separate styling system. Compose it with other mixins in an array. Later styles override earlier styles at the top level; a later `layout` replaces the earlier `layout` object. Reusable descriptors and conditional entries follow the normal `mix` conventions:

```tsx
let row = style({ layout: { width: grow(), direction: "ltr" } });
let selected = true;

<Box mix={[row, selected && style({ bg: rgba(37, 65, 88) })]}>
    <Text>Selected task</Text>
</Box>;
```

Wrap a full-screen app in a growing `Box`. The renderer does not add a layout box around your tree. `Text` combines primitive children, fragments, and component output into one styled text run. Nesting a `Box` or another `Text` inside `Text` is unsupported and reports an error; put separately styled runs in a surrounding `Box`.

Use `on("pointerenter", handler)`, `on("pointerleave", handler)`, and `on("pointerclick", handler)` from `@remix-run/ui` on a `Box`. Handlers receive a typed event with the box's `id` and an `AbortSignal` that is aborted on repeated dispatch or removal. A click requires a press and release over the box. tty also reports containing ancestor boxes, so their listeners may run too; these are separate events, not DOM bubbling. Box ids are generated per host instance; an explicit `id` must be unique in the frame. `Text` is a text run, not an independent pointer target.

## Embedding without Node I/O

`@pitlane/tui` never reads stdin, writes stdout, or changes terminal modes. Supply dimensions and consume its output bytes, then feed it input and resize notifications from your environment:

```tsx
import { createRoot, Text } from "@pitlane/tui";

let frames: Uint8Array[] = [];
let root = await createRoot({
    width: 80,
    height: 24,
    write(bytes) {
        frames.push(bytes.slice());
    },
});
root.addEventListener("input", event => {
    if (event.detail.type === "keydown") {
        root.render(<Text>Last key: {event.detail.key}</Text>);
    }
});
root.render(<Text>Press a key</Text>);
root.writeInput(new TextEncoder().encode("a"));
root.resize(100, 30);
root.unmount();
```

The output is an ephemeral WASM memory view. Consume or copy it before `write` returns; retaining it for an asynchronous write without copying corrupts output. The Node runner handles this copy. Identical frames emit no output.

`handle.update()` schedules a microtask-batched component update. `root.flush()` drains queued work synchronously. `root.unmount()` aborts component signals and stops input and animation timers; the zero-I/O root leaves the last screen intact. The Node root additionally restores terminal modes and settles `closed`.

## Errors and experimental boundaries

Reconciliation errors from `render()` throw synchronously. Scheduled component errors, queued-task errors, and paint or commit errors emit a cancelable `error` event. On the zero-I/O root, call `event.preventDefault()` when handling `event.error`; otherwise it is rethrown asynchronously. The Node runner treats these errors as fatal: it restores the terminal and rejects `closed`, even if an application listener also calls `preventDefault()`. tty errors use `TerminalRenderError`, whose `type` identifies the failure.

Error events use the portable `RendererErrorEvent` shape from `@remix-run/ui/renderer`: a standard `Event` carrying the original thrown value in `event.error`. No browser `ErrorEvent` global is required.

Reconciliation does not roll back host mutations after a failure. For clean recovery on a zero-I/O root, unmount it and create a replacement root.

This package does not implement DOM elements, CSS, DOM-dependent mixins, `innerHTML`, hydration, frames, or navigation. `Box` and `Text` are terminal-specific; `style()` and `on()` use the shared Remix mixin lifecycle. tty 0.9.0 exposes no scroll-update API: wheel events are forwarded as input, but this package implements neither scrolling nor a focus and widget system. Hover depends on the terminal sending mouse-motion reports.

## Exports

- `@pitlane/tui` — `Box` and `Text` components, the `style()` mixin factory, `createRoot(options)` for a zero-I/O root, `TerminalPointerEvent`, and `TerminalRenderError`. Types include `BoxProps`, `TextProps`, `TerminalRoot`, `TerminalRootOptions`, `TerminalRootEventMap`, `TerminalInputEvent`, `TerminalBox`, `TerminalBoxEventMap`, `TerminalBoxStyle`, `TerminalTextElement`, `TerminalTextEventMap`, `TerminalTextStyle`, `TerminalStyle`, and `TerminalPointerEventType`.
- `@pitlane/tui/node` — `createRoot(options?)` for an interactive Node session, plus `NodeTerminalOptions` and `NodeTerminalRoot`. It owns raw mode, the alternate screen, mouse tracking, resize, Ctrl+C, SIGINT, SIGTERM, and EOF, and settles a `closed` promise.

## Links

- [Terminal applications guide](https://pitlane.tools/guides/terminal-applications)
- [Embedding terminal renderers](https://pitlane.tools/guides/embedding-terminal-renderers)
- [@bomb.sh/tty](https://github.com/bombshell-dev/tty) — terminal layout, input parser, and WASM rendering engine

## License

MIT

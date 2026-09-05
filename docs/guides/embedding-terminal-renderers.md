---
title: Embedding terminal renderers
description: Record a terminal session with @pitlane/tui and manage input bytes, output buffers, dimensions, errors, and shutdown without the Node runner.
---

# Embedding terminal renderers

The album browser in [Terminal applications](/guides/terminal-applications) leaves stdin, stdout, and terminal modes to `@pitlane/tui/node`. Use `createRoot()` from [`@pitlane/tui`](/package/tui/) instead when your program already owns that I/O, or when there is no interactive terminal at all.

We'll reuse the finished `app.tsx` and `albums.ts` from that guide, feed the app a short sequence of keys, and save its output to `albums.ansi`. No raw mode, alternate screen, or interactive stdin is needed to record the session. The project setup, including the direct Git dependency on the fork's `@remix-run/ui` that supplies `@remix-run/ui/renderer`, is the [same one](/guides/terminal-applications#set-up-a-terminal-project) that guide starts from.

## Record the album browser

Add `capture.tsx` beside the app in `demos/albums-tui`:

```tsx
// demos/albums-tui/capture.tsx
import { writeFile } from "node:fs/promises";
import { createRoot } from "@pitlane/tui";

import { AlbumBrowser } from "./app.tsx";

const encoder = new TextEncoder();
const frames: Uint8Array[] = [];
const keys: string[] = [];
const errors: unknown[] = [];

const terminal = await createRoot({
    width: 60,
    height: 12,
    write(output) {
        frames.push(output.slice());
    },
});

terminal.addEventListener("input", event => {
    if (event.detail.type === "keydown") keys.push(event.detail.code);
});
terminal.addEventListener("error", event => {
    event.preventDefault();
    errors.push(event.error);
    terminal.unmount();
});

try {
    terminal.render(<AlbumBrowser terminal={terminal} />);

    terminal.writeInput(encoder.encode("\x1b[B"));
    terminal.flush();
    terminal.writeInput(encoder.encode("\r"));
    terminal.flush();
    terminal.writeInput(encoder.encode("s"));
    terminal.flush();

    terminal.resize(80, 16);
} finally {
    terminal.unmount();
}

if (errors.length > 0) throw errors[0];

await writeFile("albums.ansi", Buffer.concat(frames));
console.log(`Captured input: ${keys.join(", ")}`);
console.log("Wrote albums.ansi");
```

Run it from the app directory:

```sh
cd demos/albums-tui
node --import @remix-run/node-tsx capture.tsx
```

The script prints:

```txt
Captured input: ArrowDown, Enter, s
Wrote albums.ansi
```

The session selects Rumours and queues it, sorts the albums by year, then redraws at 80 columns by 16 rows. `albums.ansi` contains the terminal escape sequences for those frames, in order. It is an ANSI recording, not plain text or an image. A terminal emulator can apply the frames to reconstruct the final screen, but the file does not preserve timing between frames.

`AlbumBrowser` has not changed. It still receives a `TerminalRoot`, listens for parsed `input` events, and calls `handle.update()`. Only the code around the root changed.

## Keep output bytes alive

The copy in `frames.push(output.slice())` is required. Each `write` callback receives a view into tty's WebAssembly memory. The next frame can overwrite that memory, so retaining the original view would corrupt our recording before `writeFile` gets to it.

There are two valid choices:

- Consume the bytes completely before `write` returns, without retaining the view.
- Copy them before returning, then send or store the copy later.

For a Node stream that may retain a buffer until it drains, use `Buffer.from(output)`:

```ts
// Inside the write callback for a root whose transport owns `stream`:
stream.write(Buffer.from(output));
```

`write` is synchronous. Returning a promise does not make the renderer wait for it. A long-running socket transport needs an ordered, bounded output queue and a policy for slow readers. The renderer does not supply backpressure. The recording above buffers only a fixed, short session, not an unbounded interactive session.

## Treat frames as changes, not snapshots

Each callback contains the changes from the previous frame, so an unchanged tree can produce no output at all while a selection change updates only a few cells. Preserve frame order, and do not drop arbitrary frames when a transport falls behind: a later diff assumes the client applied the earlier ones.

A resize to different dimensions redraws the viewport. If you are keeping a virtual screen, resize that screen too before applying the renderer's next output.

Zero-I/O does not mean inline output. The bytes contain cursor-positioning commands and draw in the root's viewport. They can overwrite other content in the same terminal. There is no root-origin or pane-offset option. If several panels share one physical screen, their host must own composition or coordinate translation rather than writing their frame streams over one another.

## Feed raw input to the root

`writeInput()` takes the bytes produced by a terminal, not a key name:

| Input       | Bytes      |
| ----------- | ---------- |
| Enter       | `"\r"`     |
| Down arrow  | `"\x1b[B"` |
| Lowercase s | `"s"`      |
| Escape      | `"\x1b"`   |

The parser dispatches an `input` event for each parsed event. Components inspect `event.detail.type` and then the fields of that event, just as they did with the Node runner.

Our script calls `flush()` after each key because component updates are microtask-batched. Without it, several keys delivered in one synchronous call stack could be reflected in a single later frame. In an ordinary interactive session, the event loop lets those updates flush between input chunks. When component code itself needs to wait for an update, it can await `handle.update()`.

A lone Escape byte is ambiguous because it also starts longer escape sequences. tty waits briefly for more bytes before emitting an Escape key, and the root owns the timer that asks the parser to scan again. `flush()` drains component work, not that parser timer, so a scripted Escape needs a real delay or an application-owned completion signal. The recording avoids that timing dependency by unmounting directly.

Mouse reports also arrive as bytes. The Node runner enables mouse reporting for you, but an embedded session must arrange it itself. For SGR reports, a press at column 3, row 4 is `"\x1b[<0;3;4M"`, followed by `"\x1b[<0;3;4m"` for release. Coordinates in the report are 1-based, while parsed `x` and `y` are 0-based. The renderer turns pointer state into `on("pointerclick", ...)` events on the boxes under that cell. Text runs are not independent pointer targets.

## Own dimensions and terminal modes

Pass the initial width in columns and height in rows to `createRoot()`. When your environment reports a new size out of band, call `root.resize(width, height)`. Passing the existing size does nothing.

Some environments encode resize notifications in their input stream. The root dispatches the parsed `input` event first, then applies the new dimensions and redraws. A listener that calls `flush()` synchronously during that event still sees the old dimensions. Let the root apply the resize rather than translating the same notification into a second resize call.

The rest of the session remains yours:

- Put a physical terminal into raw mode if you need individual keystrokes rather than line-buffered input.
- Enter and leave the alternate screen if the app should use it.
- Enable mouse reporting if the app needs pointer events.
- Hide and restore the cursor if appropriate for the screen you draw.
- Stop reading input and restore the terminal on your application's exit paths.

The capture script needs none of these operations because it writes to a file. If your only target is an interactive Node terminal, use [`@pitlane/tui/node`](/package/tui/node) rather than recreating its stream and signal handling.

## Handle both error paths

A reconciliation failure from a caller-driven `render()` throws. A component might throw while rendering, or a host element might reject a style field. Keep a `try`/`finally` around the operations that own the root so those failures also lead to cleanup.

Scheduled component updates, queued tasks, and host commit failures report through a cancelable `error` event. Painting happens during commit, so even a direct call to `render()` can report a paint failure through this event rather than throw it to its caller. A `try`/`catch` around `render()` is not a replacement for an error listener.

The recording claims errors with `event.preventDefault()` and saves them, then unmounts the root. After cleanup, it throws the first error instead of writing a successful recording. An unclaimed error is rethrown asynchronously so the platform reports it. A terminal-specific failure is a `TerminalRenderError` whose `type` identifies the failure, while a component can throw any value.

Reconciliation does not roll back mutations that happened before a failure. When you need a clean recovery, unmount the failed root and create a replacement. Reestablish any screen state your transport owns before sending the replacement's frames.

The Node runner chooses that error policy for you. It treats root `error` events as fatal, restores the terminal, then rejects `closed`, even if another listener also calls `preventDefault()`. The zero-I/O root does not have a `closed` promise. Your transport decides when a session is finished and how errors reach its caller.

## Release the session

`unmount()` removes the component tree and aborts component signals, settles pending updates, then stops the root's input and animation timers. It is idempotent. The zero-I/O root leaves the last frame on the screen rather than clearing it or changing terminal modes.

The album browser's input listeners already use `{ signal: handle.signal }`, so they disappear with their components. Do the same for subscriptions your components add. Register timer cleanup with the component's signal rather than assuming that removing the component stops JavaScript timers:

```tsx
import type { Handle } from "@remix-run/ui";
import { Text } from "@pitlane/tui";

function Ticker(handle: Handle) {
    let ticks = 0;
    let timer = setInterval(() => {
        ticks++;
        handle.update();
    }, 1000);

    handle.signal.addEventListener("abort", () => clearInterval(timer), { once: true });

    return () => <Text>Ticks: {ticks}</Text>;
}
```

Root listeners registered by the embedding code have their own lifetime. If that code reuses a root or retains subscriptions elsewhere, give those listeners an `AbortController` owned by the session. `handle.signal` only covers the component that created it.

After unmounting, late `writeInput()` and `resize()` calls are ignored. Rendering into the old root throws. Stop your transport's reads and writes as part of its own teardown even though the root tolerates late input.

The [root API](https://github.com/pitlane-tools/pitlane/blob/main/packages/tui/src/lib/root.ts) documents its options and events, and the [Node runner](https://github.com/pitlane-tools/pitlane/blob/main/packages/tui/src/lib/node.ts) shows terminal restoration around that API. To replace the terminal backend itself, write a `RendererHost` from [`@remix-run/ui/renderer`](https://github.com/markmals/remix/blob/ui-universal-renderer/packages/ui/src/renderer.ts) for your own target, the way this package does for tty.

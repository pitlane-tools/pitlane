---
title: Terminal applications
description: Build an interactive terminal album browser with the experimental @pitlane/tui renderer, Box and Text elements, style mixins, keyboard input, and pointer events.
---

# Terminal applications

The Remix component model does not assume the DOM. [`@pitlane/tui`](/package/tui/) renders the same setup and render functions a browser app writes into terminal cells, using [`@bomb.sh/tty`](https://github.com/bombshell-dev/tty) for layout, input parsing, and cell-diffed output. This guide builds an album browser in three files: `albums.ts` holds the data, `app.tsx` holds the components, and `main.tsx` starts the Node runner that owns the screen.

One reconciler drives both targets. [`@remix-run/ui`](https://github.com/remix-run/remix/tree/main/packages/ui) owns the component lifecycle, keyed identity, context, `handle.update()`, and the `mix` prop, and a [`RendererHost`](https://github.com/markmals/remix/blob/ui-universal-renderer/packages/ui/src/renderer.ts) decides what a tree of nodes becomes. The DOM host creates elements and applies CSS; `@pitlane/tui` creates terminal boxes and text runs, then paints them through tty. The DOM host is untouched by anything in this guide.

::: warning `@pitlane/tui` is experimental and unpublished

The package is not on npm, and it does not work against a published Remix. `@remix-run/ui@0.8.0` has no `./renderer` subpath. The host interface `@pitlane/tui` builds on lives on the `ui-universal-renderer` branch of [markmals/remix](https://github.com/markmals/remix). Inside a [Pitlane checkout](https://github.com/pitlane-tools/pitlane) that resolves: `@pitlane/tui` comes from the workspace, and the package and its demo each take a direct Git dependency on that fork's built `preview/ui-universal-renderer` branch, which is the `@remix-run/ui` build that vends the renderer subpath. Nothing is pinned workspace-wide, so every other package keeps the published `remix` it already depends on. Outside a checkout there is nothing to install yet, and this shape will change when the renderer is merged upstream and published.

:::

## Set up a terminal project

Work inside a Pitlane checkout. The existing demo is the fastest way to see the renderer run before you write anything:

```sh
mise install
pnpm -C demos/tui start
```

`mise install` brings up the toolchain, and its postinstall hook installs the workspace. Put the album browser in `demos/albums-tui`, so its dependencies resolve from the same workspace. From the checkout root:

```sh
mkdir demos/albums-tui
```

Its `package.json` declares three dependencies and the one script that runs it:

```jsonc
{
    "name": "albums-tui",
    "private": true,
    "type": "module",
    "scripts": {
        "start": "node --import @remix-run/node-tsx main.tsx",
    },
    "dependencies": {
        "@bomb.sh/tty": "0.9.0",
        "@pitlane/tui": "workspace:*",
        "@remix-run/ui": "markmals/remix#preview/ui-universal-renderer&path:packages/ui",
    },
    "devDependencies": {
        "@remix-run/node-tsx": "0.1.1",
        "@types/node": "^25.5.0",
    },
    "engines": {
        "node": ">=24.3.0",
    },
}
```

`@bomb.sh/tty` is a direct dependency because the app imports its sizing and color helpers itself. `@pitlane/tui` does not re-export them. `@remix-run/ui` is a direct dependency because `@pitlane/tui` only names it as a peer. The Git specifier is what points that peer at the fork build carrying `./renderer`, taken from `preview/ui-universal-renderer`, the branch the fork publishes built output to. `@remix-run/node-tsx` is the loader the `start` script uses. Install from the checkout root so the new `demos/*` package is linked:

```sh
pnpm install
```

Its `tsconfig.json` covers JSX and module resolution:

```jsonc
{
    "compilerOptions": {
        "strict": true,
        "types": ["node"],
        "lib": ["ES2024", "DOM", "DOM.Iterable"],
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "target": "ESNext",
        "allowImportingTsExtensions": true,
        "rewriteRelativeImportExtensions": true,
        "verbatimModuleSyntax": true,
        "skipLibCheck": true,
        "noEmit": true,
        "jsx": "react-jsx",
        "jsxImportSource": "@remix-run/ui",
    },
}
```

Those are the JSX settings a browser Remix app uses, with the import source naming the `@remix-run/ui` package this app depends on directly. Its JSX runtime produces host-agnostic nodes, and the root you render them into decides what they become. The DOM libraries supply types used by Remix's JSX declarations, not browser globals at runtime. `node --import @remix-run/node-tsx` runs the TSX directly without a build step.

## Draw the first frame

Start with a component that fills the screen and a runner that renders it.

```tsx
// demos/albums-tui/app.tsx
import type { TerminalRoot } from "@pitlane/tui";
import type { Handle } from "@remix-run/ui";
import { grow, rgba } from "@bomb.sh/tty";
import { Box, style, Text } from "@pitlane/tui";

export function AlbumBrowser(handle: Handle<{ terminal: TerminalRoot }>) {
    return () => (
        <Box
            mix={style({
                bg: rgba(18, 20, 28),
                layout: {
                    width: grow(),
                    height: grow(),
                    direction: "ttb",
                    padding: { left: 2, right: 2, top: 1, bottom: 1 },
                    gap: 1,
                },
            })}
        >
            <Text mix={style({ color: rgba(136, 209, 240) })}>Albums</Text>
            <Text mix={style({ color: rgba(150, 163, 184) })}>Ctrl+C to quit.</Text>
        </Box>
    );
}
```

```tsx
// demos/albums-tui/main.tsx
import { createRoot } from "@pitlane/tui/node";

import { AlbumBrowser } from "./app.tsx";

const terminal = await createRoot();

try {
    terminal.render(<AlbumBrowser terminal={terminal} />);
    await terminal.closed;
} finally {
    terminal.unmount();
}
```

Run `pnpm -C demos/albums-tui start` from the checkout root. The screen fills with a dark panel, a blue heading, and a hint line.

`createRoot()` from [`@pitlane/tui/node`](/package/tui/node) is the runner that owns the terminal. On startup it takes over four things:

- stdin, in raw mode
- the alternate screen
- the cursor, hidden for the session
- mouse reporting, enabled

From then on it is a pipe in both directions: input bytes to the parser, finished frames to stdout. It needs interactive streams, so piping output to a file fails immediately with `The Node TUI renderer requires interactive stdin and stdout`.

Await `terminal.closed` to wait for teardown and terminal restoration. The runner's active input stream keeps Node running, not the promise itself. The session closes on `unmount()`, Ctrl+C, `SIGINT`, `SIGTERM`, or stdin reaching EOF. The `finally` block covers other exits, and a repeated `unmount()` does nothing.

The outer `Box` grows to fill the terminal because the renderer emits no layout box of its own. tty gives every frame an implicit root container sized to the terminal, and your tree lays out inside it. A tree of bare `Text` runs is legal and lays out the same way, with no panel painted behind it.

The component takes the root as a prop. Nothing in the tree needs it yet, but keyboard input arrives on the root rather than on elements, so every interactive component in this guide reads it from props or context.

## Size and place boxes in cells

Terminal layout counts cells, not pixels: widths are columns and heights are rows. The sizing helpers come from `@bomb.sh/tty` and describe one axis each:

- `fixed(26)` is exactly 26 columns wide, or 26 rows tall.
- `grow(min?, max?)` takes the space left over along the parent's direction.
- `fit(min?, max?)` shrinks to its content.
- `percent(0.5)` takes a fraction of the parent.

A box's `layout` also carries `direction` (`"ltr"` for a row, `"ttb"` for a column), `padding` per side, `gap` between children, and `alignX` and `alignY` for how children sit in leftover space. `padding` and `gap` count cells like the sizes above.

These are the layout fields we'll use in the album browser. There is no CSS here: no selectors, inheritance, cascade, or media queries. `style()` writes the fields tty's element and text ops accept, and an unsupported field reports an error rather than being silently dropped.

## Compose appearance with style

`style()` is a mixin built with `createMixin`, the same machinery behind the [`css()`](/guides/styling) mixin and `on()`. Pass one to `mix`, or an array when an element needs several:

```tsx
// inside a render function:
let row = style({ layout: { width: grow(), height: fixed(1) } });

return (
    <Box mix={[row, selected && style({ bg: rgba(30, 35, 48) })]}>
        <Text>{album.title}</Text>
    </Box>
);
```

Styles merge shallowly, in the order the mixins are listed. A later `style()` overrides the top-level fields it names and leaves the rest alone, so the conditional entry above changes `bg` and keeps `layout`. Because merging happens from scratch on every render, dropping that conditional entry clears exactly the field it contributed.

Shallow means shallow: a later `layout` replaces the earlier `layout` object instead of merging into it. Split the parts you want to override separately into their own mixins, or write one `layout` with the final values.

A `Box` and a `Text` take different fields. A box accepts `layout`, `bg`, `cornerRadius`, `border`, `clip`, `floating`, and `transition`. A text run accepts `color`, `bg`, `fontSize`, `fontId`, `wrap`, `attrs`, and `caret`. Applying a box field to a `Text` reports a `TerminalRenderError` with type `UNSUPPORTED_STYLE`. The [style types](https://github.com/pitlane-tools/pitlane/blob/main/packages/tui/src/lib/style.ts) define the supported fields.

`Text` is a single styled run, so nesting a `Box` or another `Text` inside it fails with `UNSUPPORTED_NESTING`. Put separately styled runs next to each other inside a `Box`. Strings, numbers, fragments, and components that return them are fine as children, and a bare string inside a `Box` becomes its own unstyled run.

## List the albums

Give the app some data to browse.

```ts
// demos/albums-tui/albums.ts
export interface Album {
    artist: string;
    id: string;
    title: string;
    tracks: number;
    year: number;
}

export const albums: Album[] = [
    { artist: "Michael Jackson", id: "thriller", title: "Thriller", tracks: 9, year: 1982 },
    { artist: "Fleetwood Mac", id: "rumours", title: "Rumours", tracks: 11, year: 1977 },
    { artist: "Stevie Wonder", id: "innervisions", title: "Innervisions", tracks: 9, year: 1973 },
    { artist: "Daft Punk", id: "discovery", title: "Discovery", tracks: 14, year: 2001 },
];
```

The layout is a column with a heading, a growing middle row, and a status line. Inside the middle row, the list grows and the detail panel is a fixed 26 columns:

```tsx
// inside the AlbumBrowser render function:
return (
    <Box
        mix={style({
            bg: background,
            layout: {
                width: grow(),
                height: grow(),
                direction: "ttb",
                padding: { left: 2, right: 2, top: 1, bottom: 1 },
                gap: 1,
            },
        })}
    >
        <Text mix={style({ color: accent })}>Albums</Text>
        <Box mix={style({ layout: { width: grow(), height: grow(), direction: "ltr", gap: 2 } })}>
            <Box
                mix={style({
                    layout: { width: grow(), height: grow(), direction: "ttb" },
                    clip: { vertical: true },
                })}
            >
                {order.map(album => (
                    <AlbumRow key={album.id} album={album} />
                ))}
            </Box>
            <AlbumDetails album={order.find(album => album.id === selectedId)} />
        </Box>
        <Text mix={style({ color: muted })}>{status}</Text>
    </Box>
);
```

`clip: { vertical: true }` on the list is what keeps a long list from pushing the status line off the bottom of the screen. On a short terminal the rows that do not fit are simply not drawn. tty has no scrolling API in 0.9.0, so a list longer than the screen needs your own windowing: slice `order` to the rows that fit and track the offset in setup scope.

## Read the keyboard

Keyboard input arrives as an `input` event on the root, not on elements. Register the listener in setup scope and tie it to `handle.signal` so it goes away with the component:

```tsx
// inside the AlbumBrowser setup function:
let order: Album[] = [...albums];
let selectedId = order[0]?.id;
let status = "Up/Down select · Enter queue · s sort by year · q quit";
let terminal = handle.props.terminal;

terminal.addEventListener("input", navigate, { signal: handle.signal });

function navigate(event: TerminalInputEvent): void {
    let key = event.detail;
    if (key.type !== "keydown" && key.type !== "keyrepeat") return;
    if (key.ctrl || key.alt) return;

    let index = order.findIndex(album => album.id === selectedId);

    switch (key.code) {
        case "ArrowDown":
        case "j":
            selectedId = order[Math.min(index + 1, order.length - 1)]?.id;
            break;
        case "ArrowUp":
        case "k":
            selectedId = order[Math.max(index - 1, 0)]?.id;
            break;
        default:
            return;
    }

    handle.update();
}
```

`event.detail` is the parsed event, and its `type` tells you what the parser found in the bytes: `keydown`, `keyrepeat`, `keyup`, `mousedown`, `mouseup`, `mousemove`, `wheel`, `resize`, or `cursor`. A few details are worth knowing before you match on them:

- `code` identifies keys such as `"ArrowDown"`, `"Enter"`, `"Escape"`, `"Backspace"`, `"F5"`, and `" "` for space. This app's letter shortcuts use lowercase codes.
- `key` is the parser's name for the same press, and a `keydown` also carries `text` when the press produced a character. Bind shortcuts on `code`, and collect typed characters from `text`.
- Modifiers appear only when held: `ctrl`, `alt`, and `shift` are `true` or absent. Ctrl+C arrives as `code: "c"` with `ctrl: true`, and the Node runner treats it as a quit before your handler can repurpose it.
- `keyrepeat` and `keyup` need a terminal that reports event types (Kitty keyboard enhancement level 2 or higher). Matching `keydown` alone works everywhere, and matching `keyrepeat` too gets you auto-repeat where the terminal supports it.

Everything else is ordinary Remix UI: `selectedId` is a variable in setup scope, and `handle.update()` schedules the re-render that draws the new selection. The renderer diffs the frame and writes only the cells that changed.

## Keep state with the row, not the position

Each row owns whether the album is queued, so give it its own component, setup scope, and input listener. `handle.context` carries the selection down without threading props through the list. Set `AlbumBrowser`'s handle type to `Handle<{ terminal: TerminalRoot }, Library>` so descendants reading its context receive the `Library` type:

```tsx
// in app.tsx:
interface Library {
    readonly selectedId: string | undefined;
    readonly terminal: TerminalRoot;
    select(id: string): void;
}

// inside the AlbumBrowser setup function:
handle.context.set({
    get selectedId() {
        return selectedId;
    },
    terminal,
    select(id) {
        selectedId = id;
        handle.update();
    },
});
```

```tsx
// in app.tsx:
function AlbumRow(handle: Handle<{ album: Album }>) {
    let library = handle.context.get(AlbumBrowser);
    let queued = false;

    library.terminal.addEventListener(
        "input",
        event => {
            let key = event.detail;
            if (key.type !== "keydown" || key.ctrl || key.alt) return;
            if (library.selectedId !== handle.props.album.id) return;
            if (key.code === "Enter" || key.code === " ") toggle();
        },
        { signal: handle.signal },
    );

    function toggle(): void {
        queued = !queued;
        handle.update();
    }

    // ...
}
```

The `key={album.id}` in the list is what makes `queued` belong to the album instead of to the third row on screen. Add a sort to prove it:

```tsx
// inside the navigate function, alongside the arrow keys:
case "s":
    order = [...order].sort((first, second) => first.year - second.year);
    status = "Sorted by year. Queued albums kept their own state.";
    break;
```

Press `s` and the rows reorder while every queue marker follows its album. The reconciler matches the new children against the old ones by key, then moves the existing components without re-running their setup functions. Drop the key and the rows become positional: the components stay where they are while their props change, and each queue marker stays behind on whatever album now occupies that row.

Each row also registers its own listener with its own `handle.signal`. Remove an album from `order` and the row's component is released, which aborts that signal and removes the listener with it.

## Handle clicks

Pointer events are the one kind of input that arrives on elements. Attach them with `on()` from `@remix-run/ui`, on a `Box`:

```tsx
// inside the AlbumRow render function:
return (
    <Box
        mix={[
            style({
                bg: selected ? panel : background,
                layout: { width: grow(), height: fixed(1), direction: "ltr" },
            }),
            on("pointerclick", () => {
                library.select(album.id);
                toggle();
            }),
        ]}
    >
        <Text mix={style({ color: selected ? accent : foreground })}>
            {selected ? ">" : " "} {queued ? "*" : " "} {album.title}
        </Text>
    </Box>
);
```

A box can listen for `pointerenter`, `pointerleave`, and `pointerclick`. The handler receives a `TerminalPointerEvent` with the box's `id` and the box itself as `currentTarget`, plus the abort signal `on()` gives every handler. That signal aborts with reason `EventReentry` when the same handler is dispatched again and with `AbortError` when the element goes away, which is what makes async work inside a click handler cancelable.

A click means a press and a release over the same box. tty hit tests one cell at a time and reports the pointer as being over every box that contains it, so clicking a row also fires the events registered on its ancestors. Each of those is its own dispatch on its own element, with nothing to stop and no propagation to cancel. `Text` is never hit tested, so put the listener on the surrounding `Box`.

Box ids are generated per element unless you pass `id`, and an explicit id must be unique within the frame. tty reports a repeat as a `DUPLICATE_ID` render error through the root, which the next guide covers along with the rest of the error channel.

Hover depends on the terminal sending mouse-motion reports, so `pointerenter` and `pointerleave` may never fire in a terminal that only reports clicks. Wheel ticks do arrive on the `input` event as `type: "wheel"`. tty 0.9.0 has no scroll API, so scrolling is yours to write by changing what you render.

## Quit and restore the terminal

Quitting is `terminal.unmount()`. The runner removes its stream and signal listeners and tears down the tree, then puts the terminal back: alternate screen, cursor, raw mode, and a resolved `closed`:

```tsx
// inside the navigate function:
case "q":
case "Escape":
    terminal.unmount();
    return;
```

Escape has a quirk worth knowing. A lone `ESC` byte is ambiguous, since it also starts every escape sequence, so the parser holds it for a short latency window (25 ms by default) before emitting it as a key. A quit bound to Escape lands a moment after the keypress, while `q` is immediate.

Ctrl+C, `SIGINT`, `SIGTERM`, and stdin EOF go through the same teardown, so your app does not need separate handlers for them. Scheduled rendering and paint failures also close the Node runner and reject `closed`. Caller-driven reconciliation failures can throw directly from `render()`, so the `finally` block is still needed. [Embedding terminal renderers](/guides/embedding-terminal-renderers) covers both error paths.

Report errors outside the `try`/`finally` that owns the terminal. That puts the screen back before logging, whether the failure came from `render()` or from `closed`:

```tsx
// demos/albums-tui/main.tsx
import { createRoot } from "@pitlane/tui/node";

import { AlbumBrowser } from "./app.tsx";

try {
    let terminal = await createRoot();
    try {
        terminal.render(<AlbumBrowser terminal={terminal} />);
        await terminal.closed;
    } finally {
        terminal.unmount();
    }
} catch (error) {
    console.error("Album browser stopped:", error);
    process.exitCode = 1;
}
```

## The finished app

Here is the whole component file, with the palette, the detail panel, and the pieces from the sections above in one place.

```tsx
// demos/albums-tui/app.tsx
import type { TerminalInputEvent, TerminalRoot } from "@pitlane/tui";
import type { Handle } from "@remix-run/ui";
import { fixed, grow, rgba } from "@bomb.sh/tty";
import { Box, style, Text } from "@pitlane/tui";
import { on } from "@remix-run/ui";

import type { Album } from "./albums.ts";
import { albums } from "./albums.ts";

const background = rgba(18, 20, 28);
const panel = rgba(30, 35, 48);
const foreground = rgba(232, 237, 242);
const muted = rgba(150, 163, 184);
const accent = rgba(136, 209, 240);

interface Library {
    readonly selectedId: string | undefined;
    readonly terminal: TerminalRoot;
    select(id: string): void;
}

export function AlbumBrowser(handle: Handle<{ terminal: TerminalRoot }, Library>) {
    let order: Album[] = [...albums];
    let selectedId = order[0]?.id;
    let status = "Up/Down select · Enter queue · s sort by year · q quit";
    let terminal = handle.props.terminal;

    handle.context.set({
        get selectedId() {
            return selectedId;
        },
        terminal,
        select(id) {
            selectedId = id;
            handle.update();
        },
    });

    terminal.addEventListener("input", navigate, { signal: handle.signal });

    function navigate(event: TerminalInputEvent): void {
        let key = event.detail;
        if (key.type !== "keydown" && key.type !== "keyrepeat") return;
        if (key.ctrl || key.alt) return;

        let index = order.findIndex(album => album.id === selectedId);

        switch (key.code) {
            case "q":
            case "Escape":
                terminal.unmount();
                return;
            case "ArrowDown":
            case "j":
                selectedId = order[Math.min(index + 1, order.length - 1)]?.id;
                break;
            case "ArrowUp":
            case "k":
                selectedId = order[Math.max(index - 1, 0)]?.id;
                break;
            case "s":
                order = [...order].sort((first, second) => first.year - second.year);
                status = "Sorted by year. Queued albums kept their own state.";
                break;
            default:
                return;
        }

        handle.update();
    }

    return () => (
        <Box
            mix={style({
                bg: background,
                layout: {
                    width: grow(),
                    height: grow(),
                    direction: "ttb",
                    padding: { left: 2, right: 2, top: 1, bottom: 1 },
                    gap: 1,
                },
            })}
        >
            <Text mix={style({ color: accent })}>Albums</Text>
            <Box
                mix={style({
                    layout: { width: grow(), height: grow(), direction: "ltr", gap: 2 },
                })}
            >
                <Box
                    mix={style({
                        layout: { width: grow(), height: grow(), direction: "ttb" },
                        clip: { vertical: true },
                    })}
                >
                    {order.map(album => (
                        <AlbumRow key={album.id} album={album} />
                    ))}
                </Box>
                <AlbumDetails album={order.find(album => album.id === selectedId)} />
            </Box>
            <Text mix={style({ color: muted })}>{status}</Text>
        </Box>
    );
}

function AlbumRow(handle: Handle<{ album: Album }>) {
    let library = handle.context.get(AlbumBrowser);
    let queued = false;

    library.terminal.addEventListener(
        "input",
        event => {
            let key = event.detail;
            if (key.type !== "keydown" || key.ctrl || key.alt) return;
            if (library.selectedId !== handle.props.album.id) return;
            if (key.code === "Enter" || key.code === " ") toggle();
        },
        { signal: handle.signal },
    );

    function toggle(): void {
        queued = !queued;
        handle.update();
    }

    return () => {
        let { album } = handle.props;
        let selected = library.selectedId === album.id;

        return (
            <Box
                mix={[
                    style({
                        bg: selected ? panel : background,
                        layout: { width: grow(), height: fixed(1), direction: "ltr" },
                    }),
                    on("pointerclick", () => {
                        library.select(album.id);
                        toggle();
                    }),
                ]}
            >
                <Text mix={style({ color: selected ? accent : foreground })}>
                    {selected ? ">" : " "} {queued ? "*" : " "} {album.title}
                </Text>
            </Box>
        );
    };
}

function AlbumDetails(handle: Handle<{ album: Album | undefined }>) {
    return () => {
        let { album } = handle.props;

        if (album === undefined) {
            return (
                <Box mix={style({ bg: panel, layout: { width: fixed(26), height: grow() } })}>
                    <Text mix={style({ color: muted })}>No album selected</Text>
                </Box>
            );
        }

        return (
            <Box
                mix={style({
                    bg: panel,
                    layout: {
                        width: fixed(26),
                        height: grow(),
                        direction: "ttb",
                        padding: { left: 1, right: 1 },
                    },
                })}
            >
                <Text mix={style({ color: foreground })}>{album.title}</Text>
                <Text mix={style({ color: muted })}>{album.artist}</Text>
                <Text mix={style({ color: muted })}>
                    {album.year} · {album.tracks} tracks
                </Text>
            </Box>
        );
    };
}
```

Run the type checker, then start the app. Mise puts the checkout's TypeScript on your `PATH`, and `-p` points it at the demo's own `tsconfig.json`:

```sh
tsc -p demos/albums-tui
pnpm -C demos/albums-tui start
```

Move with the arrow keys or `j`/`k`, queue an album with Enter or a click, press `s` to sort, and `q` to quit.

## What the terminal renderer does not do

This renderer is an experiment with a deliberately narrow surface. Its elements are terminal boxes and text runs, styled through `style()`, and that is the whole vocabulary: DOM elements, CSS, DOM-dependent mixins, `innerHTML`, hydration, frames, and client navigation are all absent. A component that calls `handle.frame.replace()` or `handle.frame.reload()` gets an error saying frames require the DOM runtime. `style()` and `on()` are ordinary Remix mixins running the same lifecycle they run in the browser.

Two paths continue from here. [Embedding terminal renderers](/guides/embedding-terminal-renderers) replaces the Node runner with a root that performs no I/O, which is what you need when a test, a remote stream, or a host application already owns the terminal. To target something that is neither the DOM nor a terminal, write a host of your own against `createRenderer` and `RendererHost` in [`@remix-run/ui/renderer`](https://github.com/markmals/remix/blob/ui-universal-renderer/packages/ui/src/renderer.ts), the interface this package builds on.

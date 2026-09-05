# @pitlane/tui demo

A local task queue rendered to the terminal with `@pitlane/tui`. It executes no commands. Each task owns a run count in component setup scope, so reversing the keyed list demonstrates state staying with its task rather than its row position.

## Run it

The demo consumes the workspace build of `@pitlane/tui`, and both take `@remix-run/ui` from the fork branch that exports `@remix-run/ui/renderer`. No published `@remix-run/ui` does, so the dependency is a pnpm Git dependency rather than an npm range.

From the repo root:

```sh
vp install
vp -C packages/tui run build
```

Then, in an interactive terminal (raw mode and mouse reporting need a real TTY):

```sh
pnpm -C demos/tui start
```

Equivalently, from this directory: `node --import @remix-run/node-tsx main.tsx`.

## Controls

- Up/Down or `k`/`j`: select a task
- Enter or Space: increment the selected task's local run count
- Click a task: select and increment it
- `r`: reverse the list without resetting task state
- `x`: remove the selected task and dispose its input listener
- `a`: add a new task with fresh state
- `q`, Escape, or Ctrl+C: quit and restore the terminal

Resize the terminal to exercise tty's layout and full redraw. At 40 columns by 16 rows, the initial queue and all keyboard controls remain visible.

## What it shows

`app.tsx` uses normal Remix component setup and render functions, context, `handle.update()`, `handle.signal`, `Box`, and `Text`. Layout and appearance use `mix={style(...)}` from `@pitlane/tui`; pointer events compose with `on()` from `@remix-run/ui`. `main.tsx` connects the Node terminal root and waits for its `closed` promise. The backend is `@bomb.sh/tty` for layout and input, not a DOM shim.

The DOM and terminal backends share one `@remix-run/ui/renderer` host interface and reconciliation engine. See [`packages/tui`](../../packages/tui) for the terminal-specific operations and boundaries.

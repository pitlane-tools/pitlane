# @pitlane/tui

## Unreleased

Experimental terminal renderer for Remix 3, built on Remix UI's host-operation
API (`@remix-run/ui/renderer`) and `@bomb.sh/tty` 0.9.0. The renderer started
life as the `remix/tui` experiment in `remix-run/remix`; this package is that
work moved into Pitlane, with the same public API under a new name.

- `Box` and `Text` use the normal Remix `mix` prop, with `style()` for layout
  and appearance and `on()` from `@remix-run/ui` for pointer events. They support
  component state, context, keyed updates, parsed input, and terminal resizing.
- `@pitlane/tui` does no I/O: supply dimensions and a `write` sink, feed it
  input bytes, and it renders frames. `@pitlane/tui/node` manages interactive
  Node streams, enters the alternate screen, and restores terminal state on
  teardown.
- Error reporting uses the portable `RendererErrorEvent` shape from
  `@remix-run/ui/renderer`, so no browser `ErrorEvent` global is required and
  Node 24 works as is. tty engine failures arrive as `TerminalRenderError`,
  whose `type` names the failure.
- Requires a Remix UI build that exports `@remix-run/ui/renderer`. No published
  `@remix-run/ui` does, so this package and its demo take `@remix-run/ui` as a
  pnpm Git dependency on the `preview/ui-universal-renderer` branch of
  [markmals/remix](https://github.com/markmals/remix). Once the universal
  renderer ships upstream, the dependency becomes a `remix` peer and the
  imports move to `remix/ui`. Nothing here is published to npm yet: install it
  from this workspace.

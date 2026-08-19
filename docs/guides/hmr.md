---
title: Hot module replacement
description: How @pitlane/dev hot-updates a Remix 3 app during vite dev, covering which component edits swap in place, which remount, how server-only edits revalidate through the frame runtime, and the requirements and limits of both halves.
---

# Hot module replacement

`vite dev` updates a running app in place. Editing a component swaps its new code in without remounting, so hydrated islands keep their open menus, input values, and counters. Editing a server-only module refetches the current page through your fetch handler and reconciles the new HTML into the DOM, which keeps that same island state while the server output changes underneath it.

Both halves come with `remix()` and need no configuration. Neither exists in a production build, because the transforms are `apply: "serve"` only. For the rest of the plugin's behavior, see [Using the Vite plugin](/guides/vite-plugin).

## What each kind of edit does

| You edit | What happens | What keeps its state |
| --- | --- | --- |
| The render function of an HMR-compatible component | Its new code is swapped in place | Every island, including this one |
| The setup scope of an HMR-compatible component | That component remounts | Every other island |
| A component export the transform skips | The page refetches and reconciles | Every other island |
| A server-only module | The page refetches and reconciles | Every island |
| A non-component module the browser imports | The importing island updates, output can go stale | Every island (see [limits](#limits)) |
| CSS | Vite's own CSS handling | Every island |

No row in that table is a full page reload. A reload is the fallback when revalidation cannot run at all, covered under [requirements](#requirements).

## Component HMR

Component edits run through the [`remix/ui-hmr`](https://github.com/remix-run/remix/tree/main/packages/ui-hmr) transforms. The browser transform runs in the client environment and the server transform in your server environments, and both emit the standard `import.meta.hot.accept()` protocol that Vite's own HMR runtime drives. `@pitlane/dev` supplies the wiring and one transform of its own, described below.

### Which exports are boundaries

An exported symbol is injected with the HMR runtime with when all of these hold (e.g. when it is "HMR-compatible"):

- **The file ends in `.tsx` or `.jsx`** and does not live under `node_modules`. A component in a `.ts` file is never injected with the HMR runtime.
- **The export is named and top level.** Default exports are skipped, because the hydration protocol needs an export name.
- **The name starts with a capital letter.** `Counter` qualifies, `counter` does not.
- **The setup function returns a render function**, or the export is a `clientEntry(import.meta.url, setup)` call.

All four of these authoring styles qualify:

```tsx
export const Counter = clientEntry(import.meta.url, handle => {
    /* ... */
});
export const Toggle = clientEntry(import.meta.url, function Toggle(handle) {
    /* ... */
});
export const Card = handle => () => <div />;
export function Panel(handle) {
    /* ... */
}
```

`remix/ui-hmr` only recognizes a setup function that carries a name. To allow you to define your components using arrow functions, `@pitlane/dev` rewrites qualifying arrow exports before `remix/ui-hmr` sees them. `export const Counter = clientEntry(url, handle => …)` becomes `export const Counter = clientEntry(url, function Counter(handle) { … })` in the dev transform only. Setup functions never rely on a lexical `this` or `arguments`, so the rewrite is behavior-identical. If `remix/ui-hmr` declines to inject the component with the HMR runtime, the named-function rewrite is discarded, which leaves non-component arrow functions untouched.

### State survives a render edit and resets on a setup edit

This is the line that decides whether your counter keeps counting. `remix/ui-hmr` hashes the setup scope, meaning the source from the start of the setup body up to its `return`. While that hash stays the same, the new render function replaces the old one and the live component keeps its state. Change it and the component is marked stale, then remounts.

```tsx
export const Counter = clientEntry(import.meta.url, handle => {
    let count = 0; // setup scope: editing this line remounts and count returns to 0
    let step = 1;

    function increment() {
        // still setup scope
        count += step;
        handle.update();
    }

    return () => (
        // everything below swaps in place, count intact
        <button mix={[on("click", increment)]}>
            Count: <span>{count}</span>
        </button>
    );
});
```

Iterating on markup and styles keeps the count. Changing how state is declared resets it, which is the correct outcome, because the new setup scope describes different state.

### Exports the transform skips

An export that misses one of the four conditions is left alone, and nothing is logged. The edit still reaches the server, so the server-data half picks it up. The page refetches and the DOM updates, other islands keep their state, and the edited component remounts. The change is never lost. It costs that one component's state.

To make such a component hold its state across edits, check it against the four conditions above.

## Server-data HMR

Editing the document, a middleware, a route handler, a data module, or anything else the browser never loads refetches the current page and reconciles it. Hydrated island state survives. This is the Remix 3 analog of React Router's loader and action revalidation, driven through the frame runtime rather than a client data router.

### How a server edit reaches the browser

1. The changed file is classified in your server environment. A file counts as server-only when the client module graph does not serve it as a script.
2. The plugin broadcasts a `pitlane:server-update` event to the browser.
3. A virtual module, injected into your client entry, receives the event and calls `navigate(location.href, { history: "replace", resetScroll: false })` from `remix/ui`.
4. The frame runtime refetches the page through your fetch handler and reconciles the new HTML in place.

Because step 3 is an ordinary Remix navigation, everything a normal frame reload preserves is preserved here, and everything it resets is reset here.

### What counts as server-only

The classification asks one question per changed file: does the client module graph serve this file as a script? Only script modules count. Plugins that scan your sources for their own reasons register other node types for ordinary server files, and Tailwind's content scanner is the common case: it registers an asset node for every file it scans. Counting those would mark every server module as client-owned and switch server-data HMR off for the whole app.

Files ending in `.ts`, `.tsx`, `.js`, and `.jsx` are considered. Other file types are left to the plugins that own them.

### Bursts collapse into one refetch

The broadcast waits 50ms. Two things fall out of that. A save that touches several files refetches _once_ instead of _once per file_. And the request cannot reach your fetch handler while Vite is still applying the update to the server environment, which on slower runtimes (such as workerd) can produce an error in dev mode.

Overlapping revalidations coalesce in the browser too. A revalidation that arrives while one is in flight queues a single follow-up rather than stacking.

## Requirements

| Requirement | Why | When unmet |
| --- | --- | --- |
| A client entry file (e.g. `entry.browser.tsx`) | The revalidation listener is injected into it | Server-data HMR is not installed |
| Remix's navigation interception is intact | Revalidation goes through `navigate()` | Server edits leave the page unchanged |
| `serverEnvironments` matches your config | It selects which environment classifies files as server-only | Neither half can tell client from server |

Fully server-rendered apps (`clientEntry: false`) have no hydrated state to protect and no client runtime to receive the event, so server-data HMR is not registered for them. Reload to see server changes.

If a platform plugin renames the server environment, pass the same names to `remix({ serverEnvironments })`. `@cloudflare/vite-plugin` with `viteEnvironment: { name: "ssr" }` matches the default and needs nothing. This is the same option the `clientEntry()` transform uses, so a mismatch shows up as broken hydration too.

::: warning Footgun Warning

Revalidation is an ordinary Remix navigation, so the frame runtime has to see it. An app that installs its own `navigate` listener and calls `stopImmediatePropagation()` for every navigation opts out of frame revalidation. Server-only edits then reach the server and leave the page untouched, with nothing logged in the browser. `remix/ui` exposes no public frame-reload API, so the plugin cannot work around it.

Let same-URL replacements through if you intercept navigation yourself:

```ts
navigation.addEventListener("navigate", event => {
    if (event.navigationType === "replace" && event.destination.url === location.href) return;
    event.stopImmediatePropagation();
});
```

:::

## Limits

**A shared module the browser imports can render stale output.** Editing a non-component module that a hydrated island imports (a constants file, a formatting helper) updates the island's boundary and keeps its state, but the rendered output can keep showing the previous value, including after an interaction re-renders the component. Reload to pick it up. Component modules and server-only modules are the two reliable boundaries.

**The first edit after a dependency change can be missed.** Installing or re-pinning a dependency makes Vite rebuild its client dependency cache. The first edit after that reaches the server but not the browser. One reload settles it. The cause is Vite's dependency prebundling rather than the plugin.

**Production is untouched.** Both transforms are dev-only, so no wrapper indirection and no runtime imports reach a build. Nothing about HMR changes `vite build` output.

## How this maps to Remix's HMR packages

[`remix/ui-hmr`](https://github.com/remix-run/remix/tree/main/packages/ui-hmr) provides the component transforms plus the browser and server runtimes. `@pitlane/dev` runs those transforms and owns the server-data half. The arrow normalization is its own addition, so that arrow exports qualify for instrumentation.

[`remix/node-hmr`](https://github.com/remix-run/remix/tree/main/packages/node-hmr) is deliberately not used. It supervises a child Node process and provides `import.meta.hot` through Node's module customization hooks, which is the job Vite's module runner already does here. Its fetch-proxy and restart behavior would duplicate the dev server rather than add to it.

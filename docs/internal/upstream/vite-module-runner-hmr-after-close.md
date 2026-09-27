# Upstream: Vite module runner applies HMR updates after `close()`

Draft bug report for [vitejs/vite](https://github.com/vitejs/vite/issues), written to be filed by hand. It is the upstream half of [pitlane-tools/pitlane#38](https://github.com/pitlane-tools/pitlane/issues/38) — the docs dev server exiting with code 1 when a config-dependency restart overlapped component HMR. Everything from "Title" to "Suggested fixes" is the report; ["Our workaround"](#our-workaround) at the end is Pitlane-local and should not be pasted upstream.

## Title

Module runner runs HMR accept callbacks after `ModuleRunner.close()`, crashing the dev server when a restart overlaps an update

## Versions

Reproduced on `vite@8.1.5` and on `vite@8.3.1` (latest at the time of writing). The code involved is unchanged between them: `HMRClient.warnFailedUpdate` through `fetchUpdate` in `packages/vite/src/shared/hmr.ts` is byte-for-byte identical (`v8.1.5:233-308`, `v8.3.1:237-312` — an unrelated `try`/`finally` added to `prunePaths` shifts the numbers), and `packages/vite/src/module-runner/runner.ts:95-120` is identical in both. Line references below are `v8.3.1`.

System info:

```text
Node 26.10.0, macOS 27.0 arm64
vite 8.3.1 (repro below) and vite 8.1.5 (first sighting)
```

## Describe the bug

When a Vite dev server restarts because a config dependency changed, `restartServer` closes the runnable environment, which closes its `ModuleRunner`. An HMR `update` payload that was already being processed keeps going. The re-import of the updated module fails (the runner is closed), the failure is caught, and the module's accept callback is then invoked with `undefined` anyway. A callback that responds to `undefined` the documented way — by calling `import.meta.hot.invalidate()` — hits the `import.meta.hot` getter, which now throws `[module runner] HMR client was closed.`.

That rejection has nowhere to go. The in-process transport subscribes to the server hot channel with a bare `EventEmitter` listener, so the returned promise is discarded and Node terminates the process with an unhandled rejection.

### Actual behavior

The reproduction below prints this and exits 1, without ever reaching its final `console.log('survived')`:

```text
accept called, module = undefined
.../node_modules/vite/dist/node/module-runner.js:1253
				if (!this.hmrClient) throw Error("[module runner] HMR client was closed.");
				                           ^

Error: [module runner] HMR client was closed.
    at Object.get [as hot] (.../node_modules/vite/dist/node/module-runner.js:1253:32)
    at eval (.../mod.js:10:43)
    at .../node_modules/vite/dist/node/module-runner.js:387:94
    at .../node_modules/vite/dist/node/module-runner.js:523:50
    at .../node_modules/vite/dist/node/module-runner.js:504:78
    at Array.forEach (<anonymous>)
    at HMRClient.queueUpdate (.../node_modules/vite/dist/node/module-runner.js:504:56)
    at async Promise.all (index 0)
    at async .../node_modules/vite/dist/node/module-runner.js:853:68
```

In a real dev server the process itself is what exits, mid-restart, leaving the developer to start it again by hand. It was first seen as:

```text
build/expressive-code.ts changed, restarting server...
(ssr) hmr update /app/components/shell.tsx
(ssr) hmr update /app/home/page.tsx
Error: [module runner] HMR client was closed.
```

### Expected behavior

An update that is still in flight when the runner closes should be dropped. The runner is being torn down; its accept callbacks have nothing left to attach to, and the module they would run against was never re-evaluated. The restarted server should come up as it does when the two events do not overlap.

## Reproduction

Three files, no framework, no plugins beyond a transform that stalls the update long enough to make the race deterministic.

```sh
mkdir vite-hmr-after-close && cd vite-hmr-after-close
npm init -y && npm install vite@8.3.1
```

`mod.js`:

```js
export const value = 1;

if (import.meta.hot) {
    import.meta.hot.accept(module => {
        console.log("accept called, module =", module);
        if (!module) import.meta.hot.invalidate("did not evaluate");
    });
}
```

`repro.mjs`:

```js
import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = realpathSync(dirname(fileURLToPath(import.meta.url)));

// Stall the re-import of the updated module so the runner can close while the
// update is still in flight, the way a config-dependency restart does.
let slow = false;

const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true, ws: false },
    plugins: [
        {
            name: "slow-update",
            async transform(_code, id) {
                if (slow && id.endsWith("mod.js")) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            },
        },
    ],
});

const environment = server.environments.ssr;
await environment.runner.import("/mod.js");

slow = true;
for (const mod of environment.moduleGraph.getModulesByFile(join(root, "mod.js")) ?? []) {
    environment.moduleGraph.invalidateModule(mod);
}
environment.hot.send({
    type: "update",
    updates: [
        { type: "js-update", path: "/mod.js", acceptedPath: "/mod.js", timestamp: Date.now() },
    ],
});

// Let the `update` payload start being processed. `createHMRHandlerForRunner`
// returns early if the runner is already closed when the payload arrives, so the
// bug needs the update to be in flight first — which is the real-world shape.
await new Promise(resolve => setTimeout(resolve, 0));

// What `server.restart()` does to the runnable environment.
await environment.runner.close();

await new Promise(resolve => setTimeout(resolve, 400));
console.log("survived");
await server.close();
```

`node repro.mjs` prints `accept called, module = undefined`, then the `[module runner] HMR client was closed.` stack, and exits 1. It never reaches `survived`. Moving the `runner.close()` call after the update lands — raise the `setTimeout` before it to `300` — prints `accept called, module = [Object: null prototype] [Module] { value: [Getter] }` and `survived`, exit 0.

## Root cause

The teardown path and the update path both hold a reference to the same `HMRClient`, and only the teardown path knows the runner is gone.

1. `restartServer` (`packages/vite/src/node/server/index.ts:1389`) calls `server._closeServer('restart')`, which awaits `environment.close()` (`:648`).
2. `RunnableDevEnvironment.close` (`packages/vite/src/node/server/environments/runnableEnvironment.ts:67`) awaits `this._runner.close()`.
3. `ModuleRunner.close` (`packages/vite/src/module-runner/runner.ts:107`) clears the caches, sets `this.hmrClient = undefined`, sets `this.closed = true`, and disconnects the transport.
4. Meanwhile the `update` payload reached the runner through `createServerHotChannel`'s `send` (`packages/vite/src/node/server/hmr.ts:1173`, `outsideEmitter.emit('send', payload)`) and the listener registered by `createServerModuleRunnerTransport`'s `connect` (`packages/vite/src/node/ssr/runtime/serverModuleRunner.ts:105`).
5. `createHMRHandlerForRunner` (`packages/vite/src/module-runner/hmrHandler.ts:7`) checks `if (!hmrClient || runner.isClosed()) return` once, on entry (`:12`). Its `update` branch then awaits `hmrClient.queueUpdate(update)` (`:22`) and never re-checks.
6. `HMRClient.queueUpdate` (`packages/vite/src/shared/hmr.ts:256`) awaits every queued `fetchUpdate` promise and calls each returned closure.
7. `HMRClient.fetchUpdate` (`:268`) awaits `this.importUpdatedModule(update)`, which the runner supplies as `({ acceptedPath }) => this.import(acceptedPath)` (`packages/vite/src/module-runner/runner.ts:71`) and which now throws `Vite module runner has been closed.` (`:273`). The `catch` reports it through `warnFailedUpdate` and leaves `fetchedModule` as `undefined` — but still returns the closure at `:296`.
8. That closure calls each qualified accept callback with `undefined` (`:299-305`). The callback reaches for `import.meta.hot`, whose getter (`packages/vite/src/module-runner/runner.ts:390`) throws `[module runner] HMR client was closed.` because `hmrClient` is gone.
9. Nothing awaits step 5's promise: `EventEmitter.emit` discards the return value of its listener, so the rejection surfaces as an unhandled rejection and Node exits 1.

The `full-reload` branch of the same handler already anticipates this. It re-checks `runner.isClosed()` inside its import loop, both before importing and after a failed import (`packages/vite/src/module-runner/hmrHandler.ts:50` and `:54`). The `update` branch has no equivalent check.

The `import.meta.hot` throw is not itself wrong — it is a deliberate signal that a closed runner has no HMR context. The bug is that an update belonging to a closed runner is still being applied, so user code is asked to react to a module that was never evaluated.

## Suggested fixes

**Skip callbacks for updates that outlive the runner.** Give `HMRClient` a closed flag, set it from `ModuleRunner.close`, and return early from the closure `fetchUpdate` produces. This is the smallest change and the one we run locally:

```ts
// packages/vite/src/shared/hmr.ts
export class HMRClient {
  private closed = false

  public close(): void {
    this.closed = true
  }

  private async fetchUpdate(update: Update) {
    // ...
    return () => {
      if (this.closed) return
      // ...
    }
  }
}

// packages/vite/src/module-runner/runner.ts
public async close(): Promise<void> {
  this.resetSourceMapSupport?.()
  this.clearCache()
  this.hmrClient?.close()
  this.hmrClient = undefined
  this.closed = true
  await this.transport.disconnect?.()
}
```

Alternatives, if the flag is unwelcome:

- **Re-check in the handler.** Have the `update` branch of `createHMRHandlerForRunner` check `runner.isClosed()` after `queueUpdate` resolves, matching what the `full-reload` branch already does. This stops the `vite:afterUpdate` notification but not the accept callbacks themselves, which run inside `queueUpdate` — so it is a smaller fix that does not actually close the hole.
- **Do not return a closure when the import failed.** `fetchUpdate` could return `undefined` when `importUpdatedModule` threw, instead of invoking accept callbacks with `undefined`. That changes behavior for ordinary failed updates too (a module with a syntax error would no longer notify its accept callback), so it is a bigger decision than the closed flag.
- **Suppress the false `warnFailedUpdate`.** Independently of the crash, an update cancelled by a restart logs `Failed to reload <path>. This could be due to syntax errors or importing non-existent modules.`, which points the developer at a problem that does not exist.

**Related hardening.** Any error thrown from a server-side accept callback takes down the dev server, because `connect({ onMessage })` registers an async listener on a bare `EventEmitter` and the rejection is never observed. Reporting those through the environment logger instead would keep one bad callback from killing the process.

## Our workaround

`patches/vite@8.1.5.patch` (pnpm `patchedDependencies` in `pnpm-workspace.yaml`) applies the closed-flag fix to the built `dist/node/module-runner.js` that ships in the package. It is the same three edits shown above, written against the bundled output.

The patch is keyed to `vite@8.1.5` exactly, which is what every workspace holding a `vite` dependency that serves a dev server resolves — `docs`, `demos/content-vite`, `packages/content`, and `packages/dev`. Two resolutions sit outside it: the root workspace still resolves `vite@8.1.4`, used by Vitest, which never runs the restart path; and `demos/theme` aliases `vite` to `@voidzero-dev/vite-plus-core`, a different package a `vite` patch cannot reach. pnpm fails the install if the patch stops matching a resolved version, so a version bump surfaces this file rather than silently dropping the fix.

Delete `patches/vite@8.1.5.patch`, drop the `patchedDependencies` entry from `pnpm-workspace.yaml`, and run `pnpm install` once the fix lands upstream.

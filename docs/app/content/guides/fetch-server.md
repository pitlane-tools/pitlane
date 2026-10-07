---
title: Fetch server
description: Serve a Vite app's development requests through the Fetch handler your server module exports, with fetchServer() from pitlane/vite-plugin-fetch-server, alone or beside assets().
---

# Fetch server

`fetchServer()` connects `vite dev` to your application's server code. Every request Vite does not answer itself goes to the `fetch(request)` method of a server module you name, and its response goes back to the browser. Vite transforms that module like the rest of your app. An edit applies on the next request, without a server restart.

Any app can use the plugin. It needs no router, renderer, or Pitlane runtime, only a module that exports `{ fetch }`. It covers development only and leaves the production build and preview alone.

## Install

Through the umbrella package, which most apps already depend on:

::: code-group

```sh [npm]
npm add pitlane
```

```sh [yarn]
yarn add pitlane
```

```sh [pnpm]
pnpm add pitlane
```

```sh [bun]
bun add pitlane
```

```sh [deno]
deno add npm:pitlane
```

```sh [vp]
vp add pitlane
```

```sh [vlt]
vlt add pitlane
```

```sh [nub]
nub add pitlane
```

:::

The scoped package also works on its own, with Vite 8.1 or later as its peer dependency:

::: code-group

```sh [npm]
npm add -D @pitlane/vite-plugin-fetch-server
```

```sh [yarn]
yarn add -D @pitlane/vite-plugin-fetch-server
```

```sh [pnpm]
pnpm add -D @pitlane/vite-plugin-fetch-server
```

```sh [bun]
bun add -d @pitlane/vite-plugin-fetch-server
```

```sh [deno]
deno add --dev npm:@pitlane/vite-plugin-fetch-server
```

```sh [vp]
vp add -D @pitlane/vite-plugin-fetch-server
```

```sh [vlt]
vlt add -D @pitlane/vite-plugin-fetch-server
```

```sh [nub]
nub add -D @pitlane/vite-plugin-fetch-server
```

:::

Examples on this page import from `pitlane/vite-plugin-fetch-server`. With the scoped package, import the same `fetchServer` from `@pitlane/vite-plugin-fetch-server`.

## Write the server module

The module's default export is an object with a `fetch` method. It receives a standard `Request` and returns a `Response` or a promise of one:

```ts
// src/http.ts
export default {
    greeting: "Hello from src/http.ts",

    async fetch(request: Request): Promise<Response> {
        let url = new URL(request.url);
        if (url.pathname === "/") return new Response(this.greeting);
        return new Response("Not found", { status: 404 });
    },
};
```

`fetch` is called as a method of the default export, so it can read the object's other properties through `this`, as `greeting` does here. A router object that exposes `fetch` qualifies too.

## Add the plugin

Pass the module's path as `entry`:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { fetchServer } from "pitlane/vite-plugin-fetch-server";

export default defineConfig({
    plugins: [fetchServer({ entry: "src/http.ts" })],
});
```

Run `vite dev` and open the printed URL. The page reads `Hello from src/http.ts`. Change `greeting`, save, and reload the page: the new text appears without a server restart.

`entry` is required. The plugin assumes no filename or directory, and it never derives the path from your build inputs, so it is the path you pass and nothing else. It is resolved the way Vite resolves a module the server loads, so a path relative to the project root works.

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `entry` | none, required | Path to the server module. |
| `environment` | `"ssr"` | The Vite environment that loads `entry`. It must be one whose modules run inside the dev server process. |

### With `assets()`

The plugin composes with the asset plugin from `pitlane/assets/vite-plugin`. Asset metadata and request serving stay separate concerns, each with its own plugin:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { assets } from "pitlane/assets/vite-plugin";
import { fetchServer } from "pitlane/vite-plugin-fetch-server";

export default defineConfig({
    environments: {
        client: { build: { outDir: "dist/client" } },
        ssr: {
            build: {
                outDir: "dist/server",
                rolldownOptions: { input: "src/http.ts" },
            },
        },
    },
    plugins: [assets(), fetchServer({ entry: "src/http.ts" })],
});
```

The server build input and `entry` name the same file here because this app chose to. They are separate settings. The build input controls what `vite build` emits, while `entry` controls what `vite dev` serves.

A Remix app does not add this plugin itself. [`remix()`](/guides/vite-plugin) composes it with its own server entry.

## What reaches your handler

The plugin is Vite's fallback for application requests. Requests Vite answers on its own come first, such as files in `public/` and modules the browser imports. Middleware from other plugins, such as `assets()`, also runs first. Whatever is left goes to your handler, including `/`. Unless you set Vite's `appType` yourself, the plugin sets it to `"custom"`, so Vite does not answer HTML requests from an `index.html`. An `appType` you set is kept as is.

The handler sees the request as the browser sent it:

- `request.url` is the full original URL, including any query string and the configured Vite `base`. With `base: "/app/"`, a request for `/app/echo?x=1` arrives as `http://localhost:5173/app/echo?x=1`.
- The method, headers, and body are passed through unchanged.
- The host and protocol come from the connection. `Forwarded`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers are ignored, so a client cannot rewrite `request.url` with them.

Responses keep their status line and every header, including repeated `Set-Cookie` headers. A streamed body reaches the browser chunk by chunk as your handler produces it, not after it finishes. When the client disconnects, `request.signal` aborts and a streaming body is cancelled, so long-running work can stop.

## Edits

Each request loads the module through Vite's module runner. After you edit the server module or anything it imports, the next request runs the new code. The plugin keeps no handler between requests, so there is no stale copy to restart away.

Edits do not reload the browser. This plugin only serves requests, so component hot module replacement, or a page refresh after a server edit, has to come from another Vite plugin or from you reloading the page.

## Errors

When a request fails, you get Vite's development error page and Vite logs `Internal server error:` with the message and stack in the terminal. The response status is 500, and a page with the Vite client loaded shows its error overlay. That covers:

- an error your `fetch` method throws or a promise it rejects;
- a server module or one of its imports that fails to load or to transform, such as a syntax error or a missing file;
- a server module whose default export has no `fetch` method.

A failed request never falls through to another handler or reuses an earlier response. Fix the code and the next request runs it.

An error after a streamed response has started cannot become an error page, because the status and headers are already sent. The connection closes instead.

## Configuration errors

These stop `vite dev` at startup with a message naming the problem:

- `entry` is missing or an empty string. That holds even when the environment has exactly one build input, or has an `index` input. Pass the path explicitly.
- `environment` names an environment the Vite config does not have.
- `environment` names an environment whose modules do not run inside the dev server process. Cloudflare's Vite plugin creates one of these: its code runs in workerd, and the Cloudflare plugin serves its requests. Leave `fetchServer()` out of that config rather than pointing it elsewhere.

## Limits

- Development only. The plugin does nothing during `vite build` or `vite preview`, and opens no port of its own. In production, run the built server module with your platform's server.
- The `environment` must run its modules in the dev server process, which Vite's default `ssr` environment does. Runtimes that serve requests themselves bring their own Vite integration.
- No trusted-proxy handling. During development the request URL always reflects the dev server's own host and protocol.

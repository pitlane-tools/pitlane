# @pitlane/vite-plugin-fetch-server

Serve `vite dev` requests through the Fetch handler your server module exports.

`fetchServer({ entry })` sends every request Vite does not answer itself to the `fetch` method of `entry`'s default export. The module is loaded through Vite's module runner on each request, so it is transformed like the rest of your app and an edit takes effect on the next request without a restart. It works with any framework, or none: all it needs is a module exporting `{ fetch }`.

```ts
// src/http.ts
export default {
    async fetch(request: Request): Promise<Response> {
        return new Response(`You asked for ${new URL(request.url).pathname}`);
    },
};
```

```ts
// vite.config.ts
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [fetchServer({ entry: "src/http.ts" })],
});
```

## Install

```sh
npm install --save-dev @pitlane/vite-plugin-fetch-server
# or
vp add -D @pitlane/vite-plugin-fetch-server
```

Requires `vite@>=8.1.0` as a peer.

## `fetchServer(options)`

| Option | Default | Meaning |
| --- | --- | --- |
| `entry` | none, required | Path to the server module. Never inferred from build inputs. |
| `environment` | `"ssr"` | The Vite environment that loads `entry`. It must be runnable, running its modules inside the dev server process. |

- **Development only.** The plugin does nothing during `vite build` or `vite preview` and opens no port of its own.
- **A fallback.** Files in `public/`, modules the browser requests, and other plugins' middleware come first. The plugin sets `appType: "custom"` unless your config sets one.
- **Requests and responses as sent.** The URL, including the Vite `base`, plus the method, headers, body, status, repeated headers, and streamed bodies pass through unchanged. A client disconnect aborts `request.signal` and cancels a streaming body. Forwarded headers are not trusted.
- **Errors go to Vite.** A throwing handler, a module that fails to load, or a default export without `fetch` produces Vite's development error page and an `Internal server error:` log line.
- **Configuration errors stop startup.** A missing or empty `entry`, an environment that does not exist, and a non-runnable environment, such as Cloudflare's, each fail with a message. Leave the plugin out where a runtime integration serves requests itself.

## With `@pitlane/assets`

```ts
// vite.config.ts
import { assets } from "@pitlane/assets/vite-plugin";
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
import { defineConfig } from "vite";

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

The [Fetch server guide](https://pitlane.tools/guides/fetch-server) covers the full behavior.

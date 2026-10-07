---
"@pitlane/vite-plugin-fetch-server": minor
---

New package. `fetchServer({ entry })` serves `vite dev` requests through the `fetch` method of your server module's default export. The module is loaded through the environment's module runner on every request, so an edit applies to the next request without a restart. It replaces the request serving that `@hiogawa/vite-plugin-fullstack` did, and does not depend on Remix or `@pitlane/assets`.

`entry` is required and is never inferred from build inputs. `environment` defaults to `"ssr"` and must be a runnable environment. A missing environment, or one whose code runs outside the dev server process (such as Cloudflare's), is a startup error, so leave the plugin out where a runtime integration serves requests itself. Requests and responses go through `@remix-run/node-fetch-server`, which keeps the original URL, method, headers, body, status, repeated headers, streaming, and client-disconnect cancellation, and ignores forwarded headers. Handler, import, and transform errors go to Vite's development error page. The plugin applies to `vite dev` only, sets `appType: "custom"` unless your config sets one, and requires Vite 8.1 or later.

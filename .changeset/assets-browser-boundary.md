---
"@pitlane/assets": minor
---

`assets()` accepts `allowFiles`, `allowPackages`, and `denyFiles`, the browser boundary options of `remix/assets`, and reads them the same way. Setting `allowFiles` turns the boundary on: `vite build` fails, listing each file and its importer, when a file outside it would reach the client output, including files that server code links and the build copies there. `vite dev` fails the browser transform of such a module and refuses to serve such a file. Without `allowFiles` nothing changes. With `remix()`, pass the options as `remix({ assets: { allowFiles, … } })`. Upgrade if you deploy the same app to the `remix/assets` Node server and to a bundled host such as Oxygen or Cloudflare, so a file the Node server refuses no longer ships silently from the build.

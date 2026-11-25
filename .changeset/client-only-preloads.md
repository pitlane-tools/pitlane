---
"@pitlane/assets": patch
---

Server-environment modules in a build's asset manifest now have an empty `preloads` list, and their stylesheets are unchanged. The resolver only ever read preloads from the client graph, and a server module's preloads named server chunks that browsers never load. They still made up most of the manifest: on one large Remix app deployed as a Cloudflare Worker, `__pitlane_assets_manifest.js` dropped from 8.7 MB to 1.5 MB. The server parses that file when it starts, so cold starts get faster. An integration that calls `createAssetManifest` and reads a server module's `preloads` itself now gets an empty list.

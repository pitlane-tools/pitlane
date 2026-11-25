---
"pitlane": minor
---

Roll up `@pitlane/data-table-d1@0.4.0` and `@pitlane/assets@0.2.2`, and move the package set to Remix 3.3:

- `pitlane/data-table-d1` reads rows the same as Remix's SQLite driver. `json()` columns come back parsed, `boolean()` columns as `true` or `false`, and `timestamp()` columns as `Date` objects. Dates bind as UTC text in raw `sql` statements and `batch()`. An upsert with a separate `update` object writes the columns it names, and `orderBy()` rejects any direction other than `asc` or `desc`.
- Production asset manifests no longer list preloads for server-environment modules. Server stylesheets are unchanged. On a large Cloudflare Worker app the manifest dropped from 8.7 MB to 1.5 MB, which the server parses at startup.
- `vite dev` starts on Windows when a browser entry is named by a project-relative key such as `getScriptEntry("src/entry.browser.ts")`.

The umbrella's peer is now `remix@^3.3.0`, because the D1 driver builds its SQL from compilers that Remix 3.3 first exports. Upgrade `remix` to 3.3 at the same time. An app that wrote `JSON.stringify()` output to a `json()` column should pass the value itself. Installed guides are verified against Remix 3.3.0. The umbrella remains on its alpha release channel.

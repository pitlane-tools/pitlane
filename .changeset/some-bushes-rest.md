---
"@pitlane/assets": patch
---

`vite dev` no longer fails to start on Windows with `[assets] Could not analyze "src/entry.browser.ts" for the "client" development asset manifest: There is a new version of the pre-bundle for "C:\…\src\entry.browser.ts", a page reload is going to ask for it.` A browser entry named by a project-relative key, such as `getScriptEntry("src/entry.browser.ts")`, resolved to a backslash path on Windows, which Vite's module graph does not recognize, so building the development asset manifest failed. Browser entries now resolve to the forward-slash module IDs Vite uses. Upgrade if you develop on Windows; macOS and Linux behave as before.

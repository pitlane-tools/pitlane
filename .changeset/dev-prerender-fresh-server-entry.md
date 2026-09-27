---
"@pitlane/dev": patch
---

Prerender every build through the server bundle that build just produced. When two builds ran in the same process, such as a watch rebuild or consecutive builds in a test run, prerendering could reuse the first build's fetch handler and route map. This happened when both bundles had the same modification time, or when the plugin ran under Vite's module runner (for example, in Vitest). Pages could then render stale content, or a build could pass that should have failed.

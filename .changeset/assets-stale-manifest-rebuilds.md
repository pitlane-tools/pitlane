---
"@pitlane/assets": patch
---

The development manifest no longer stays out of date after a build that changes kept interrupting. Under `vite dev`, `assets()` builds the manifest again when a module it reads is invalidated mid-build, and gives up after three builds so a plugin that invalidates modules on every transform cannot hold the request forever. Vite then cached the manifest it gave up on, and it stayed cached, missing the last change's stylesheets and browser entries, until another edit invalidated it. That was most likely on a cold start, where Vite's dependency optimizer re-runs and invalidates the browser module graph. The next import of `@pitlane/assets/manifest` now builds it again, and a build that completes uninterrupted is cached as before.

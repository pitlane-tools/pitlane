---
"@pitlane/content": patch
---

Keep content prebuilds from deleting the running app's optimized browser dependencies. This fixes `504 (Outdated Optimize Dep)` errors that could leave MDX updates and client-side navigation broken until the dev server restarted.

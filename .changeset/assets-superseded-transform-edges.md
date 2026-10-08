---
"@pitlane/assets": patch
---

The development manifest no longer keeps what a module imported, or which browser entries it named, before an edit. Under `vite dev`, `assets()` can transform one module more than once at the same time: the manifest's discovery and the module runner each ask for it, or an edit invalidates the module mid-transform. If a transform of the old code finished last, the manifest kept that code's stylesheets and literal `getScriptEntry()` and `getHref()` inputs until the module changed again, including in the first manifest a dev server built. A transform whose module was invalidated after its request began now records nothing, and a manifest being built when that happens is built again.

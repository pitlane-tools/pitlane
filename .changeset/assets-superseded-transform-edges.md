---
"@pitlane/assets": patch
---

The development manifest no longer keeps a module's stylesheets from before an edit. Under `vite dev`, `assets()` can transform one module twice at once: the manifest's discovery and the module runner each ask for it, or an edit invalidates the module mid-transform. If the transform of the old code finished last, the manifest kept that code's imports, and `getStylesheets()` returned the old stylesheets until the module changed again. A transform that an invalidation superseded now records nothing. When two transforms of one module disagree, the next manifest transforms it again.

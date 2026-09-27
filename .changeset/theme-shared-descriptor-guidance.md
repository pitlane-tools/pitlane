---
"@pitlane/theme": patch
---

Clarify that fixed CSS mixin descriptors can be shared when created with an explicit element type. Inline calls still infer that type from `mix`; sharing style objects remains appropriate across different element types. The API and runtime behavior are unchanged.

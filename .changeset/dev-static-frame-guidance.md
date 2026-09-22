---
"@pitlane/dev": patch
---

Recommend separate prerendered frame URLs as the default workaround for documents being served into frames. Document links use `data-rmx-src` for the static frame response, preserving fully static navigation without frame headers or runtime SSR. Document Cloudflare assets-only deployment; retain Worker-first rendering as an optional hybrid alternative. The app supplies the frame routes and link attributes. The plugin's API and generated output are unchanged.

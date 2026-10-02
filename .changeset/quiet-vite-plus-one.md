---
"@pitlane/dev": patch
---

Documentation only. No code changed.

The README's compatibility table now lists what CI tests: Vite 8 (the latest 8.x), Vite+ 1.0, and Node 26. Its troubleshooting covers Vite+ 1.0's `Expected @voidzero-dev/vite-plus-core@…, but found vite@…` error. The fix is to alias `vite` to `npm:@voidzero-dev/vite-plus-core@^1.0.0` beside `vite-plus@^1.0.0`, rather than to the `@latest` core the README used to suggest.

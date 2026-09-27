---
"@pitlane/content": patch
"@pitlane/crawler": patch
"@pitlane/data-table-d1": patch
"@pitlane/dev": patch
"@pitlane/theme": patch
---

Documentation only. No code changed.

- Every README now says where the documentation is published as Markdown for AI agents and other LLM tools: `https://pitlane.tools/llms.txt` indexes every page, `https://pitlane.tools/llms-full.txt` holds them all in one file, and any page URL with `.md` appended returns that page as Markdown.
- The `@pitlane/content` README gains the Vite setup the content guide describes. That setup covers the `satteri` and `vite-plugin-satteri` dev dependencies, and a `vite.config.ts` registering `satteri()` with `jsxImportSource: "remix/ui"`, `headings()`, `rawStyles()`, and `contentLayer()` before `remix()`. Before this, the README named `contentLayer()` but not the plugins it has to sit beside, and an MDX file compiled without `jsxImportSource: "remix/ui"` is a React component rather than a Remix one.
- The `@pitlane/content` entry-point table lists `@pitlane/content/hot`, and the README describes the four `@pitlane/content/internal/*` entry points as internal and unstable, with what each one is for: reuse by a plugin for a bundler other than Vite.

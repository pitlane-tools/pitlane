---
"@pitlane/content": minor
---

Give headings the ids GitHub gives them. `headings()` now lowercases a heading, removes every character outside letters, marks, digits, and connector punctuation, and turns each space into a hyphen without collapsing or trimming any of them — the algorithm GitHub uses, and the one Astro's `rehype-heading-ids` uses through the same `github-slugger` package. `## Databases & Data Loading` was `databases-data-loading` and is now `databases--data-loading`; `## Jenni’s Quesadillas` was `jenni-s-quesadillas` and is now `jennis-quesadillas`.

Any heading containing punctuation or symbols therefore gets a different `id` than it did before, so an anchor written by hand against the old ids needs updating once. In exchange, a table of contents carried over from GitHub or Astro keeps landing without being rewritten. A heading that slugs to nothing at all, such as `## 🎉`, still falls back to `heading` rather than to the empty `id` GitHub produces.

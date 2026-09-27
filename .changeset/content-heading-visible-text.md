---
"@pitlane/content": patch
---

Read a heading's `text`, and the `id` made from it, from what the heading shows on the page. Three kinds of heading change, and an anchor written by hand against one of them needs checking once:

- Inline HTML now contributes its words and not its tags. `## <span>Visible</span> text` was `<span>Visible</span> text` with the `id` `spanvisiblespan-text`, and is now `Visible text` with `visible-text`.
- An image no longer contributes its alt text, which matches GitHub and Astro. `## [A](url) ![Cat photo](cat.png)` was `a-cat-photo` and is now `a-`, keeping the space before the image as GitHub does.
- In MDX, an expression that is a single string literal now contributes its value. `## Hello {"world"}` was `hello-` and is now `hello-world`, and `## The {"{"} key` reads `The { key`. Any other expression, such as `{name}`, still contributes nothing.

Headings without inline HTML, images, or expressions keep their `text` and `id`.

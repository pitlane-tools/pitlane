---
id: decision.0001
title: Static Documentation Delivery
status: proposed
established-by: proposal.0004
supersedes: []
---

# Static Documentation Delivery

## Summary

Every page of pitlane.tools is rendered once at build time and served as a Cloudflare static asset. No request reaches a renderer. Reader preferences are applied in the browser, never by personalizing a response. This is a delivery decision, not a judgement that Remix cannot serve documentation.

## Context

Proposal 0004 rebuilt the documentation site as a Remix application on Pitlane's own packages. The first implementation server-rendered every document on Cloudflare Workers: each request called the compiled MDX body, rendered the component tree, resolved styles, serialized hydration metadata, and produced HTML, with the response marked `private, no-store` so that cookie-stored preferences (package manager, Vite or No Build) could personalize it. The build already rendered every page for Markdown exports and the search index; those documents were thrown away rather than published.

The site has two kinds of page with very different shapes. Sixteen authored pages are ordinary prose with a handful of code groups. One hundred and eight generated reference pages range from small to the `ThemedCSSProps` interface: 19,675 intrinsic JSX nodes before code blocks expand, 1,716 highlighted examples, 2,209 outline headings, 46,589 DOM elements, 3.2 MB of HTML.

The account is on Workers Free, which documents a 10 ms CPU budget per request. Cloudflare rejected a limit override on that plan (error 100328). The initial branch preview served the dense page as two complete documents, one empty HTTP 200, and two error 1101 responses out of five attempts; a remote diagnostic named the cause: `Worker exceeded CPU time limit`.

The tension was between three things the site wanted at once: cookie-personalized HTML at a stable URL, a dense reference that is expensive to render on every request, and a hosting plan whose CPU budget is a hard ceiling rather than a cost. Only two of the three can hold.

### What the measurements established

Every figure below is Cloudflare's own `workersInvocationsAdaptive` CPU, not client latency, on immutable preview versions. They are sampled estimates, not per-request traces; the reports linked from the pull request carry their limits. Sources: [deployment blocker](https://github.com/pitlane-tools/pitlane/pull/32#issuecomment-5825962571), [CPU headroom](https://github.com/pitlane-tools/pitlane/pull/32#issuecomment-5827611770), [attribution investigation](https://github.com/pitlane-tools/pitlane/pull/32#issuecomment-5837934699), [mixed delivery](https://github.com/pitlane-tools/pitlane/pull/32#issuecomment-5839331525).

Request rendering did not fit the budget, and not only for the dense page:

| Route, server-rendered                    | Complete / attempted |             CPU p50 | CPU p95 |
| ----------------------------------------- | -------------------: | ------------------: | ------: |
| `/guides/vite-plugin`                     |            100 / 100 |             12.5 ms | 24.2 ms |
| `/guides/content`                         |            100 / 100 |             20.5 ms | 28.4 ms |
| `/guides/content-no-build`                |              16 / 21 |             21.0 ms | 52.1 ms |
| `/package/theme/function/css`             |                4 / 9 |              9.5 ms | 10.8 ms |
| `/package/theme/interface/ThemedCSSProps` |                0 / 5 | no completed render |       — |

Of 275 attempted requests, 25 returned HTTP 500 and 8 returned HTTP 200 with a truncated body. Cloudflare recorded the failures as `exceededResources` at almost exactly 10,000 µs. The first two hundred-request phases succeeded despite exceeding the documented budget and later phases failed, which is why a short smoke run of successful responses never established headroom.

The cost was rendering, not the platform and not the payload. Controls on the same version: a two-byte prepared response cost 0.55 ms; routing 1.06 ms; a minimal Remix document through the render middleware 2.31 ms. A synthetic page with 100 styled outline links, freshly rendered, cost 27.5 ms; the same bytes from a prepared string cost 0.54 ms. Returning the real 2.2 MB reference document as pre-encoded bytes cost 2.58 ms at p50 (3.42 ms p95) against 12.63 ms as a string. Rendering is where the budget goes; returning what was already rendered is cheap.

Local profiling agreed on where rendering spends its time. A warm dense render took 120–145 ms in Node and 146–162 ms in local workerd, about 28% of it in garbage collection and 13% in style-class processing. Remix hashes each style object to look it up in its render-context cache, so the 2,209 outline rows recompute a key to rediscover three rules. Removing the outline and the code-block UI as diagnostic controls, keeping the same pre-highlighted code, took the render from 109 ms to 22 ms. Hoisting shared style objects did not change it (13.48 versus 13.50 ms). No optimization short of not rendering was demonstrated to fit 10 ms with margin.

Personalization was narrower than the delivery assumed. All 124 pages rendered through the built Worker under all 16 preference combinations produced 1,984 responses: the 108 reference pages were byte-identical across every combination, 10 authored pages had 16 variants, and 6 authored pages had 2. The whole site was being marked private and rendered per request to vary 172 authored outputs.

The intermediate step, publishing only the 108 reference pages statically, was deployed and measured. Reference requests showed no Worker invocation rows at all: Cloudflare's assets-first routing served them without running the Worker. The remaining server-rendered guides still measured 9.1–15.2 ms p50 and 21.9–24.8 ms p95, so the Free plan gave no dependable headroom for even the cheap half of the site.

## Decision

Pitlane's documentation site is fully static.

- The build renders every public document — shell, navigation, outline, metadata, hydration descriptors, and body — and publishes it as an HTML file at its canonical path. `wrangler.jsonc` serves those assets first; no Worker code runs for a document request. Canonical redirects and the 404 are static configuration and a static document.
- Response HTML never depends on a request. Reader preferences (package manager, and the remembered Vite/No Build choice) are stored in the browser and applied there. Every alternative a preference selects is present in the HTML: package-manager commands live in native `<details>` disclosures with the default open, and Vite and No Build are separately addressable URLs, so a page is complete and correct without JavaScript.
- One narrow early script restores the stored package manager before commands paint. Everything else that moves is a Remix component after hydration, and soft navigation fetches the next complete static document.
- The same build runs one Remix application. There is no separate site compiler, no request-time renderer kept alive for a subset of pages, and no prepared-variant selector in a Worker.

The decision covers pitlane.tools. It says nothing about what Pitlane's packages should support for other sites: `@pitlane/dev` still builds a fetch handler, and server rendering remains a first-class target for applications whose pages genuinely vary per request.

## Rationale

Static delivery is the only option that satisfied all of the measured constraints at once, and it did so by removing the work rather than shrinking it. Cloudflare serves matching static assets without invoking the Worker, documented as free and unlimited on the Free plan, so the CPU budget stops being a constraint on the documents at all. The measured mixed deployment confirmed it: zero invocation rows for static documents.

The alternative of making request rendering cheap enough was investigated to its end before being set aside. Profiling and the controlled fixtures attributed the cost to legitimate rendering work — repeated style resolution across thousands of rows, hydration metadata for 1,716 copy buttons, serialization of 3 MB of markup — not to a bug that a fix would remove. Reducing it meant redesigning the outline and the code-block components, which is worthwhile browser-side work but would still leave the site betting its availability on a 10 ms ceiling with no measured margin. The prepared-bytes control showed that the same document costs 2.58 ms to return once rendered; the honest conclusion was that the rendering should happen once.

Giving up cookie-personalized HTML was the real price, and the site's own structure made it affordable. The reference, 87% of the pages, never varied. The authored pages varied only in which install command was open and which build-mode link was current. Native `<details>` keeps every command reachable without JavaScript, and separately addressable Vite and No Build URLs keep the build mode a property of the document rather than of the reader. What remains — restoring a remembered manager before paint — is one small script. The no-JavaScript contract is preserved in substance: a reader without JavaScript sees a correct page with every alternative available, and only loses persistence of their choice.

Keeping one Remix application matters as much as the static output. The site exists partly to demonstrate the stack. A site-specific compiler that bypassed `@pitlane/content`, or a Worker that selected among prepared variants, would have been more machinery to explain and would not have demonstrated anything Pitlane wants people to build.

Buying a paid plan was raised early and withdrawn before the diagnosis was complete. It would have converted an availability failure into a cost while leaving the dense page at 150–300 ms of CPU per request. It also would have made the documentation site's reliability depend on billing for a property the pages did not need.

## Alternatives considered

- **Server-render every document with cookie-aware responses** — the original design. Measured at 9–21 ms p50 for guides and unbounded for the dense reference on a 10 ms budget, with truncated 200 responses and 500s under a modest sequential load. Setting aside the plan, it spends rendering CPU on every request to produce documents that are 87% invariant.
- **Optimize request rendering until it fits** — investigated with profiling, controlled fixtures, and style-object hoisting. The cost was attributed to repeated style resolution, hydration metadata, and serialization proportional to page size; the fixes are component redesigns that reduce the cost without bounding it. Still worth doing for browser performance, and deferred as such, but not a delivery strategy.
- **Mixed delivery: static reference, server-rendered guides** — implemented and deployed. It proved assets-first routing and native Remix reconciliation between static and rendered documents, but the sixteen guides still measured over budget at p50 with no dependable headroom, and it kept two delivery paths alive for one site.
- **Prepared variants selected by a small Worker** — 172 authored outputs (10 × 16 + 6 × 2) is finite, so a Worker could pick one by cookie. Never implemented or measured. It keeps a request-time path and a cookie contract for a handful of pages whose variation is a disclosure state, and adds a second publishing mechanism to reason about.
- **Static article-only navigation with a persistent shell** — reduces navigation payload, but requires the shell and the article to agree about the current URL across a boundary Remix's frame reconciliation already handles for complete documents. Not selected; complete-document soft navigation was measured as adequate.
- **Separately retrieved article assets and nested article frames** — the same coordination cost without the payload benefit once complete documents are static. Not selected.
- **Upgrade to Workers Paid** — raises the ceiling without removing the dependence on it, and turns reliability into billing. Withdrawn before the diagnosis was complete.

## Consequences

### Good

- Document requests never run Worker code. Availability no longer depends on a CPU budget, and the site's cost on the Free plan is zero regardless of page density or traffic.
- The 2.2 MB reference page that could not complete a request is now served the same way as a 20 KB guide.
- The build is the single source of every artifact: HTML, Markdown twins, `llms.txt`, sitemap, search index, and redirects come from the same render, so they cannot disagree.
- The delivery tests assert the contract directly: every document exists as a file at its canonical path, responses are byte-identical across all preference combinations, and every package-manager alternative is present in the HTML.
- The site remains an ordinary Remix application built through `@pitlane/content` and `@pitlane/dev`. Prerendering is the same mechanism any Pitlane application can use.

### Bad

- Preferences are not applied without JavaScript. A reader who disables it gets every alternative, but the page opens on the default manager and does not remember a choice.
- One early inline script exists outside Remix's component model to restore the stored manager before first paint. It is the only imperative bootstrap on the site and must stay narrow; any second one should reopen this decision.
- Every page carries all of its alternatives. Authored pages are larger than a personalized response would be, and the dense reference remains 2.2 MB uncompressed; its browser-side cost (48,480 live elements, 2,209 outline links) is not solved by this decision and remains deferred work.
- Any future page whose content genuinely varies per request — per-user, per-region, or time-sensitive — cannot be added without revisiting this decision, because the site has no request renderer to put it in.
- Search runs entirely in the browser through a build-time Pagefind index. A search that needs request-time ranking or a live corpus is out of scope while this decision stands.

## Revision history

| Date       | Change                                                     | Proposal      |
| ---------- | ---------------------------------------------------------- | ------------- |
| 2026-09-26 | Proposed, recording the delivery outcome of proposal 0004. | proposal.0004 |

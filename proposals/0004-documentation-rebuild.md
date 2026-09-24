---
id: proposal.0004
title: Documentation Rebuild
authors: [Mark Malstrom]
status: draft
pull-request: https://github.com/pitlane-tools/pitlane/pull/32
issues: []
supersedes: []
---

# Documentation Rebuild

## Summary

Rebuild Pitlane's guides and API documentation with Remix and Pitlane, adopting the Remix documentation design and symbol-per-page reference organization. Preserve topical guides, Cloudflare Workers hosting, and interactive enhancements. Measure runtime costs before and after. Production launch waits for a separate home-page port.

## Motivation

Pitlane's documentation currently demonstrates Vue and VitePress rather than the Remix stack it teaches. Its VoidZero theme places it visually alongside Vite, Oxc, and related tools. Readers should recognize the Remix relationship while continuing to find Pitlane's existing material, examples, and package reference.

The migration also provides an opportunity to understand the cost of documentation interactions. Lower runtime JavaScript is a goal, but removing useful interactions or inventing a byte threshold would misrepresent the agreed outcome. The human wants measured differences and an informed decision about any regressions.

## Domain grounding

### Established context

[Remix client entries](https://guides.remix.run/interactivity/#cliententry) establish selective hydration boundaries. Static content can remain HTML while individual controls run in the browser. Server-side component rendering does not require browser hydration.

[Cloudflare asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) serves matching static assets without invoking the Worker by default. Worker-first routing deliberately changes that property. [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/) derives canonical trailing-slash behavior from configuration and asset layout.

[Pagefind](https://pagefind.app/) indexes built HTML and loads portions of its index for browser searches. Browser search does not inherently require downloading the complete index. Worker search exchanges browser engine/index costs for request-time work and network round trips.

The visual references are [Remix Guides](https://guides.remix.run/rendering-ui/) and [Remix API](https://api.remix.run/api/remix/ui/server/function/renderToString/). Direct browser inspection established their shared reading layout, different navigation structures, responsive controls, system-font body text, blue links, pink metadata, and light/dark surfaces. The reference search modal opened, but results failed with a Pagefind metadata error during inspection; its successful retrieval behavior was not verified.

### Relevant constraints and principles

Content compilation, complete-page prerendering, and client hydration are separate operations. Precompiled Markdown alone does not eliminate request-time page rendering. A client-rendered SPA can be statically hosted while carrying substantial browser work.

Repository evidence: `@pitlane/dev` prerenders requests through the built fetch handler; `@pitlane/content` supports prebuilt bodies. Parameterized route patterns do not enumerate document slugs. The current crawler writes HTML to directory indexes, which can change canonical URLs compared with VitePress's flat HTML files. Static frame responses need their own addressable assets when their representation differs from a full document.

### Quality bar

Reading, ordinary links, and deep links work without JavaScript. Enhancements preserve meaningful browser history, keyboard operation, focus, and error feedback. Content reflows at narrow widths; code and signature overflow stays local to its panel. See [WCAG reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

A guide is a topic-oriented document. A tutorial is an ordered learning experience, reserved for future work. A package module is an import surface; a symbol is a documented export or member associated with that surface. Navigation groups and generated filenames are presentation choices, not symbol identity.

### Remaining uncertainty

The combined content, prerendering, and assets-first deployment pipeline has not been exercised for this site. The repository pins Remix rc.2 while the inspected upstream site identifies rc.3; exact APIs need version-specific verification. Search placement and API identity edge cases remain review questions below.

## Existing baseline

`docs/.vitepress/config.ts` owns metadata, navigation, code highlighting, and Markdown exports. TypeDoc and typedoc-plugin-markdown generate module-sized API pages under `docs/package/`; `.typedoc/` retains TypeScript 6 because TypeDoc needs its compiler API. These generated files are not authored sources.

Guides use callouts, package-manager code groups, included partials, and Vite/No Build variants. The build emits Markdown counterparts, `llms.txt`, `llms-full.txt`, a sitemap, and a 404 document. Those outputs and reader preferences deserve preservation. VitePress classes, theme-specific selectors, and DOM-scanned navigation are incidental implementation details.

`wrangler.jsonc` serves matching assets first. `worker.ts` handles remaining canonicalization and genuine 404s. Production HTTP probes confirmed 200 responses for a guide and its Markdown counterpart, 307 canonical redirects, and a 404 for an unknown path. Branch previews use `wrangler versions upload`; main-branch pushes deploy production.

An exploratory browser load of `/guides/vite-plugin` fetched 20 same-origin JavaScript resources totaling 190,007 encoded bytes and 1,031,275 decoded bytes, including automatic page prefetch. This excludes cross-origin analytics and does not measure execution. A repeatable baseline is required before implementation.

## Proposed solution

Use Remix to render the documentation and Pitlane for its build integration, content handling, and styling capabilities. Generate complete public documents during the build and retain asset-first Workers delivery. Limit browser execution to the requested enhancements.

Adopt the Remix documentation shell while retaining Pitlane branding. Guides retain topical organization; API reference moves to symbol pages. Existing content remains authoritative.

The recommended search approach for review is a build-generated, lazily loaded Pagefind index. It matches the static publication lifecycle and avoids introducing a request-time service. Worker-backed search remains a viable alternative if measured browser cost or search requirements justify it. This recommendation is not settled until the human selects an approach.

## Detailed design

### Content and navigation

Guide and deployment documentation retain their topics, subtopics, examples, and existing routes. Do not add chapter numbers, imply a required reading sequence, or rewrite the prose into a tutorial. Navigation may group related topics and offer adjacent links without presenting prerequisites.

Vite and No Build variants remain separately addressable. Shared partials remain authoring inputs rather than published pages. Callouts, code groups, highlighted examples, copy-code controls, and copy/download Markdown controls remain available. Package-manager and build-mode preferences persist across navigation. Storage unavailable to the browser must not prevent reading or choosing a variant.

HTML, Markdown exports, navigation metadata, and search documents must use the same resolved guide variant. Internal documentation and excluded partials must remain unpublished and unindexed.

### Symbol-per-page reference

Generate reference content from the package exports and TSDoc. Keep module overview pages as discovery surfaces with links to their symbols. Each documented symbol page presents its import context, name, kind, description, applicable signatures and type parameters, parameters, return value, examples, and documented errors. Omit sections with no content.

A symbol's identity must be scoped by its public module and containing declaration where applicable. Display-name collisions must not depend on traversal order or numeric filename suffixes. Overloads of the same callable appear together. References in signatures and prose link to the corresponding documented target.

Before approval, resolve page ownership for class/interface members and symbols re-exported through multiple modules. Those choices govern canonical URLs and search deduplication.

Preserve old reference destinations through an explicit migration map. URL fragments are not sent to a Worker, so moving a module anchor to a symbol page cannot be solved solely with server redirects. Old module pages must provide useful compatibility anchor targets and destination links even without JavaScript. Optional client redirection may enhance those targets without being their only useful behavior.

### Presentation and interactions

Use the reference's restrained reading shell: compact left navigation, central article, contextual outline, blue links, pink metadata, light and dark surfaces, and restrained code panels. Retain Pitlane's name and logo. Guide navigation remains topical; API navigation follows modules and symbols. Do not copy the reference's marketing links, unavailable chapters, or unrelated branding assets.

At narrow widths, document navigation and the page outline remain separately accessible. All disclosures have accessible names and state. Dialogs and overlays support keyboard dismissal, appropriate focus placement, and focus restoration. Respect reduced-motion preferences.

Retain enhanced navigation transitions. Ordinary anchors remain valid document links; direct loads, reloads, back/forward navigation, and fragment navigation must work. A navigation failure must not leave stale content presented under a new URL. Prerender any separate frame representations the chosen enhancement requires, preserving metadata and avoiding duplicate document shells.

### Search contract

Search covers public guides, deployment documentation, module overviews, and symbol pages. Results distinguish topical guidance from API reference and identify the package/module for symbols. Exact exported names must be discoverable, including repeated names under different modules. Results link to canonical pages or valid section anchors.

The interface includes keyboard opening, query entry, loading state, results, no-results feedback, and a visible recoverable error state. A search failure does not disable navigation or reading. Do not eagerly transfer the entire corpus as part of every document load.

Search placement remains open. Browser search would build and deploy its index with the documents and load the engine/index on demand. Worker search would require a defined query endpoint, build-coupled index, input limits, bounded work, failure responses, and caching behavior before implementation approval. It must not make ordinary documentation assets Worker-first.

### Build and deployment

Keep Cloudflare Workers, the existing production domain, and branch-preview mechanism. Run content compilation, API generation, and syntax highlighting during the build. Enumerate every published document explicitly or from authoritative content metadata, including symbols and any separate navigation representations.

Preserve canonical URL behavior deliberately rather than inheriting new trailing slashes from directory-index output. Preserve real 404 status codes, metadata, sitemap entries, Markdown counterparts, and LLM indexes. Missing frame assets must not return the home page or a successful document shell.

The home-page design and port are separate work. This proposal can reach a reviewable preview independently, but must not merge into the production-deploying branch or launch until the home page is also ported. The existing home page may remain in the review workspace during this phase. That temporary state is not the completed migration or authorization to publish mixed stacks.

### Comparative measurements

Capture a reproducible baseline before implementation and repeat it against the completed preview with the same browser, viewport, cache conditions, network/CPU settings, routes, and interactions. Record versions, commits, and methodology with results on the PR.

Measure a representative guide, both build-mode variants, an API overview, and dense reference content. Where one old module page becomes several symbol pages, measure an equivalent lookup task as well as individual page loads.

Separate initial loading, automatic prefetch, subsequent navigation, and first/repeated search. Report compressed and decoded JavaScript bytes, script execution/main-thread work, relevant loading timings, search latency, and total transferred data including any WASM/index fragments. Distinguish first-party and third-party costs. Use repeated samples and report variation rather than a single timing.

Report deployed Worker size and measured invocations/CPU for ordinary assets, missing routes, and search if server-backed. Local timings cannot substitute for production-like Worker measurements. Identify unavailable metrics explicitly.

There is no preset byte or timing threshold. The readiness report names improvements and regressions, explains tradeoffs, and leaves acceptance to the human. Functionality and accessibility remain required even when a shortcut would reduce bytes.

## Compatibility

Preserve existing guide URLs, build-mode selections, package-manager preferences where feasible, generated-reference destinations, Markdown access, and HTTP status semantics. Any unavoidable preference-key migration or URL change must be documented before approval. Package APIs themselves do not change.

## Implications on adoption

Contributors continue authoring guides in Markdown and reference prose in TSDoc. Renderer-specific syntax and generation tooling change internally. Preserve TypeDoc's separate compiler environment unless evidence establishes a supported replacement. Use compatible scoped Pitlane packages; the reserved umbrella package is not an implementation dependency.

No published package release is required solely for the site migration. Necessary package changes would need explicit scope review and their own release treatment.

## Scope

The documentation renderer, guides/deployment surfaces, symbol reference generation, associated navigation and enhancements, output compatibility, and comparative measurements form one documentation migration.

### Out of scope

Home-page creative direction and implementation; production launch before that separate port; tutorial authoring; package API redesign; unrelated framework features; historical multi-version documentation.

## Preview

- Artifact: the existing Cloudflare Workers branch preview linked by `preview.yml`.
- Reason: readers can exercise real routes, responsive layouts, navigation, search, and generated output on the deployment target.

Preview URLs are public to anyone who has them. A green workflow alone is insufficient: exercise the deployed output. Keep the PR draft during proposal development.

## Policies and decisions checked

None: `policies/` and `decisions/` currently contain only their index documents.

`VISION.md` requires explicit composition, Remix-owned framework behavior, and provider-native hosting. This proposal uses build-time tooling for build-time work and retains Cloudflare configuration. Process references that currently call guides VitePress pages must be updated when the renderer changes; historical proposals remain historical records.

## Future directions

A tutorial section could provide chapter-based learning without changing the meaning of guides. The home page will receive a separate creative design pass and must be ported before production launch.

## Alternatives considered

- Lazy browser search: recommended for review because the corpus changes with deployment and a chunked index avoids a search service. Browser engine/index costs still require measurement.
- Worker-backed search: viable when smaller browser payloads justify server execution and operational complexity. Needs a concrete engine/index and query contract before selection is complete.
- Request-time rendering of every documentation page: provides flexibility this build-time corpus does not require and loses the current assets-first advantage.
- Retaining module-sized API pages: simpler link migration, but the human explicitly prefers symbol-per-page organization.
- Adopting Remix's chapter sequence for guides: conflicts with Pitlane's topical guides and planned distinction between guides and tutorials.

## Open questions

- [NEEDS CLARIFICATION: Select lazy browser search or Worker-backed search; the recommendation is lazy browser search, subject to the human's preference and the measurement report.]
- [NEEDS CLARIFICATION: Should members have independent pages, or remain sections on their containing class/interface page? The recommendation is independent pages for top-level exports, with members on the containing type page.]
- [NEEDS CLARIFICATION: For the same declaration exported through multiple public modules, should each export surface have its own page or share a canonical declaration page? The recommendation is one canonical declaration page with explicit public import paths and links from every exporting module.]

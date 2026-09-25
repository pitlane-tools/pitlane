---
id: proposal.0004
title: Documentation Rebuild
authors: [Mark Malstrom]
status: awaiting-implementation
pull-request: https://github.com/pitlane-tools/pitlane/pull/32
issues: []
supersedes: []
---

# Documentation Rebuild

## Summary

Rebuild Pitlane's guides and API documentation with Remix and Pitlane, adopting the Remix documentation design and symbol-per-page reference organization. Preserve topical guides, Cloudflare Workers hosting, and interactive enhancements. Measure runtime costs before and after. Production launch waits for a separate home-page port.

## Motivation

Pitlane's documentation currently demonstrates Vue and VitePress rather than the Remix stack it teaches. Its VoidZero theme places it visually alongside Vite, Oxc, and related tools. Readers should recognize the Remix relationship while continuing to find Pitlane's existing material, examples, and package reference.

The migration also provides an opportunity to understand the cost of documentation interactions. Use Remix and Pitlane for application concerns while preparing fixed reference content at build time. Expressive Code owns generated reference code-block presentation and copying. Removing useful interactions or inventing a byte threshold would misrepresent the agreed outcome. The human wants measured differences and an informed decision about any regressions.

## Domain grounding

### Established context

[Remix client entries](https://guides.remix.run/interactivity/#cliententry) establish selective hydration boundaries. Static content can remain HTML while individual controls run in the browser. Server-side component rendering does not require browser hydration.

[Cloudflare asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) serves matching static assets without invoking the Worker by default. Worker-first routing deliberately changes that property. [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/) derives canonical trailing-slash behavior from configuration and asset layout.

[Remix navigation](https://github.com/remix-run/remix/blob/main/packages/ui/docs/frames.md) represents the document as a top-level frame. `run()` reconciles ordinary document responses without requiring separately targeted article frames. Component state can survive matching updates, and removed components receive lifecycle cancellation.

[Pagefind](https://pagefind.app/) indexes built HTML and loads portions of its index for browser searches. Browser search does not inherently require downloading the complete index. Worker search exchanges browser engine/index costs for request-time work and network round trips.

The visual references are [Remix Guides](https://guides.remix.run/rendering-ui/) and [Remix API](https://api.remix.run/api/remix/ui/server/function/renderToString/). Direct browser inspection established their shared reading layout, different navigation structures, responsive controls, system-font body text, blue links, pink metadata, and light/dark surfaces. The reference search modal opened, but results failed with a Pagefind metadata error during inspection; its successful retrieval behavior was not verified.

### Relevant constraints and principles

Content compilation, complete-page prerendering, and client hydration are separate operations. Precompiled Markdown alone does not eliminate request-time page rendering. A client-rendered SPA can be statically hosted while carrying substantial browser work.

Repository evidence: `@pitlane/dev` builds a default-exported fetch handler and supplies client-entry transforms and asset imports; `@pitlane/content` supplies prebuilt content components. Content compilation does not require publishing HTML at public document paths. A small browser experiment against the installed runtime confirmed coherent title, description, canonical URL, navigation selection, and component lifecycle updates through native soft document navigation.

### Quality bar

Reading, ordinary links, and deep links work without JavaScript. Enhancements preserve meaningful browser history, keyboard operation, focus, and error feedback. Content reflows at narrow widths; code and signature overflow stays local to its panel. See [WCAG reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

A guide is a topic-oriented document. A tutorial is an ordered learning experience, reserved for future work. A package module is an import surface; a symbol is a documented export or member associated with that surface. Navigation groups and generated filenames are presentation choices, not symbol identity.

### Remaining uncertainty

The deployed investigation measured excessive request-time rendering cost and established that all 108 reference documents are invariant across the 16 supported preference combinations, after normalizing randomized hydration identifiers. All 16 authored documents remain preference-sensitive. See the [attribution and architecture investigation](https://github.com/pitlane-tools/pitlane/pull/32#issuecomment-5837934699) for measurements and limitations. Complete prerendered reference documents still need verification against Workers asset routing and native Remix navigation; prepared-response benchmarks do not establish that integration. The repository pins Remix rc.2, so verify against installed APIs. The design does not require nested static-frame transport. Retain the exercised MDX authoring and headless checking coverage while changing documentation components.

## Existing baseline

`docs/.vitepress/config.ts` owns metadata, navigation, code highlighting, and Markdown exports. TypeDoc and typedoc-plugin-markdown generate module-sized API pages under `docs/package/`; `.typedoc/` retains TypeScript 6 because TypeDoc needs its compiler API. These generated files are not authored sources.

Guides use callouts, package-manager code groups, included partials, and Vite/No Build variants. The build emits Markdown counterparts, `llms.txt`, `llms-full.txt`, a sitemap, and a 404 document. Those outputs and reader preferences deserve preservation. VitePress classes, theme-specific selectors, and DOM-scanned navigation are incidental implementation details.

`wrangler.jsonc` serves matching assets first. `worker.ts` handles remaining canonicalization and genuine 404s. Production HTTP probes confirmed 200 responses for a guide and its Markdown counterpart, 307 canonical redirects, and a 404 for an unknown path. Branch previews use `wrangler versions upload`; main-branch pushes deploy production.

An exploratory browser load of `/guides/vite-plugin` fetched 20 same-origin JavaScript resources totaling 190,007 encoded bytes and 1,031,275 decoded bytes, including automatic page prefetch. This excludes cross-origin analytics and does not measure execution. A repeatable baseline is required before implementation.

## Proposed solution

Build one conventional Remix application using `@pitlane/dev`, `@pitlane/content`, and `@pitlane/theme`, with delivery chosen according to the document's dependence on reader preferences. Render complete preference-invariant API reference documents at build time and publish them as native Workers static assets. Render preference-sensitive authored guides as complete cookie-aware documents on requests. Use the same application components and content definitions for both paths, with Remix's native soft document navigation rather than a separately fetched article representation.

Adopt the Remix documentation shell while retaining Pitlane branding. Guides retain topical organization; API reference moves to symbol pages. Existing content remains authoritative.

Use a build-generated, lazily loaded Pagefind index for browser search. It matches the static publication lifecycle and avoids introducing a request-time service. Revisit Worker-backed search with the human if the measured browser costs justify changing this decision.

## Detailed design

### Content and navigation

Guide and deployment documentation retain their topics, subtopics, examples, and existing routes. Do not add chapter numbers, imply a required reading sequence, or rewrite the prose into a tutorial. Navigation may group related topics and offer adjacent links without presenting prerequisites.

Vite and No Build variants remain separately addressable. Shared partials remain authoring inputs rather than published pages. Callouts, code groups, highlighted examples, copy-code controls, and copy/download Markdown controls remain available. Package-manager and build-mode preferences persist across navigation. Storage unavailable to the browser must not prevent reading or choosing a variant.

HTML, Markdown exports, navigation metadata, and search documents must use the same resolved guide variant. Internal documentation and excluded partials must remain unpublished and unindexed.

### Symbol-per-page reference

Generate reference content from the package exports and TSDoc. Keep module overview pages as discovery surfaces with links to their symbols. Each documented symbol page presents its import context, name, kind, description, applicable signatures and type parameters, parameters, return value, examples, and documented errors. Omit sections with no content.

A documented declaration has one canonical page even when multiple public modules re-export it. Distinguish declarations by their defining module and containing declaration where applicable, rather than by display name alone. Display-name collisions must not depend on traversal order or numeric filename suffixes. Overloads of the same callable appear together. References in signatures and prose link to the corresponding documented target.

Top-level exports receive independent pages. Class and interface members remain addressable sections on their containing type's page. Each canonical page lists its public import paths, and every exporting module links to it. Re-exports must not create duplicate symbol pages or duplicate search results; public aliases remain discoverable and lead to the canonical declaration.

Preserve old reference destinations through an explicit migration map. URL fragments are not sent to a Worker, so moving a module anchor to a symbol page cannot be solved solely with server redirects. Old module pages must provide useful compatibility anchor targets and destination links even without JavaScript. Optional client redirection may enhance those targets without being their only useful behavior.

### Presentation and interactions

Use the reference's restrained reading shell: compact left navigation, central article, contextual outline, blue links, pink metadata, light and dark surfaces, and restrained code panels. Retain Pitlane's name and logo. Guide navigation remains topical; API navigation follows modules and symbols. Do not copy the reference's marketing links, unavailable chapters, or unrelated branding assets.

At narrow widths, document navigation and the page outline remain separately accessible. All disclosures have accessible names and state. Dialogs and overlays support keyboard dismissal, appropriate focus placement, and focus restoration. Respect reduced-motion preferences.

Retain enhanced navigation transitions through Remix's document reconciliation. Ordinary anchors remain valid document links; direct loads, reloads, back/forward navigation, and fragment navigation must work. A navigation failure must not leave stale content presented under a new URL. The next document response supplies its article, metadata, breadcrumbs, selected navigation item, and outline together.

### Idiomatic application structure

Follow the repository's `.agents/docs/cookbook.md`, checking its patterns against the installed Remix and Pitlane APIs. Keep static content server-only. Application UI uses `clientEntry` components with serializable props, component-owned state, event mixins, and lifecycle-scoped effects. Generated reference code blocks are the explicit exception: Expressive Code renders their markup and styles at build time and supplies their browser copying behavior. Do not build a custom copy Web Component or application-wide DOM installer.

Render application controls through the component tree, preserving their hydration metadata and resolving client modules through Pitlane's build integration. Reconciliation preserves matching component state and disposes removed components. Reference bodies enter the article as trusted build-generated HTML, without per-block Remix hydration or request-time style generation. Do not serialize the entire article into a hydrated application merely to share state.

The browser entry bootstraps Remix and configures application navigation and frame resolution. It also loads Expressive Code's browser modules once; its library-owned enhancement must work for initial reference markup and markup inserted by soft navigation. Do not create an application-owned enhancement registry. Shared helpers may implement preference persistence or other non-visual protocols.

Use Remix's routing, rendering, navigation, and component primitives where they own the concern. Measure the resulting JavaScript and execution costs without treating a smaller bundle as grounds to abandon those conventions.

Use `@pitlane/theme` as the application's styling system, not merely as a source of variables for a separate handwritten stylesheet system. Define the documentation theme with `createTheme` and typed schemas, render its `<Theme />` component in the document shell, and use its typed token accessor throughout component styles. Express component styling through `css()` mixins and use `tva()` for meaningful variants. Layout, typography, responsive rules, and interaction states belong with their components or focused shared style definitions.

In the new Remix reader, use `lightDark()` with the system color scheme. Remove the light/dark/system selector and theme preference from cookies, query overrides, and legacy-storage migration; old theme preferences have no effect. Appearance follows system changes without navigation and works without JavaScript. Static styling does not require hydration. Expressive Code uses GitHub Light and GitHub Dark themes selected by the system, with JetBrains Mono as the code font. Its build-generated CSS is an explicit third-party styling exception and must load without JavaScript. Leave the existing VitePress site's appearance and implementation unchanged; it will be replaced separately.

### Static reference and cookie-aware guide delivery

One Vite-built application entry exposes the standard fetch handler used in development and deployment. Compose Remix routes, controllers, and rendering middleware with Pitlane's build integration and Cloudflare's platform integration. Resolve browser assets through `?assets=` imports and `@pitlane/dev/runtime`, not a separately maintained asset-manifest protocol.

Render complete API reference documents during the build, including the shell, navigation, outline, metadata, hydration descriptors, and build-generated TypeDoc body. Serve them at their canonical public URLs through Cloudflare's assets-first routing without invoking the application Worker. Eligibility depends on the complete response being independent of reader preferences, not merely its article body; the current 108 reference pages satisfy this boundary. Do not use an in-Worker HTML cache as the static delivery mechanism.

On an authored guide request, the controller resolves the explicit URL, content entry, and preference cookies, then renders a complete document through the existing component path. Do not publish static guide HTML that would bypass those preferences. Preserve anchors, readable Markdown exports, and Pagefind content on both delivery paths. Markdown parsing, API extraction, Expressive Code rendering, and syntax highlighting remain outside request-time execution.

Ordinary links target public document URLs. Remix's native soft navigation fetches and reconciles the next complete document. Metadata, breadcrumbs, selected navigation, and the table of contents derive from the same resolved document. Do not introduce an application-owned DOM synchronization registry or public static article-frame endpoints. Build-generated headings and content metadata remain authoritative; the Worker must not parse rendered HTML to recover them.

Build-mode and package-manager selections persist in cookies. The server applies them before sending preference-sensitive guide documents; reference documents do not vary with these cookies. Navigating through a static reference page must not clear or replace the reader's preferences. Controls work through ordinary links or form submissions, with JavaScript enhancing updates to avoid full navigation where possible. Validate cookie values against the supported choices; absent or invalid preferences use the documented default. Blocked cookies must not prevent reading or making a selection for the current response.

An explicit Vite or No Build variant URL takes precedence over the cookie, including deep links. Use the cookie as the default for navigation that does not explicitly choose a variant. Render the corresponding prebuilt content entry.

Render package-manager code groups with the server-selected alternative visible initially, without corrective browser scripting. Groups lacking that manager use their designated default. Preserve the existing choices and working native form submissions. Enhanced submissions use Remix document navigation so all controls and examples agree with the persisted selection.

Use small, host-only preference cookies with `Secure`, `SameSite=Lax`, and an explicit lifetime. Build-mode and package-manager preferences require neither a session database nor signed tokens. Preserve their existing localStorage preferences through a one-time browser-assisted migration only when no corresponding cookie exists; explicit new selections take precedence. Do not migrate stored appearance choices. The server cannot recover legacy browser storage on an initial request, so document that first-visit limitation.

Serve cookie-dependent guide responses and preference mutations without shared caching, using `Cache-Control: private, no-store`. Complete reference HTML, CSS, images, fonts, scripts, search assets, and generated Markdown bypass application execution on matching requests. Static reference responses must not contain personalized state or set preference cookies.

Verify direct reference and guide loads and preference submissions with JavaScript disabled, then exercise enhanced navigation in both directions between static references and SSR guides, back/forward, deep links, and preference changes. Confirm the initial response contains the complete article, guide examples reflect the selected preferences, navigation retains one shell, and readers with different cookies cannot reuse personalized guide responses. Verify that static reference requests bypass the Worker and preserve metadata, heading targets, outline behavior, and Expressive Code copying after soft navigation. Compare complete reference output across all supported preference combinations, normalizing only runtime-generated hydration identifiers, to guard its static eligibility.

### Search contract

Search covers public guides, deployment documentation, module overviews, and symbol pages. Results distinguish topical guidance from API reference and identify the package/module for symbols. Exact exported names must be discoverable, including repeated names under different modules. Results link to canonical pages or valid section anchors.

The interface includes keyboard opening, query entry, loading state, results, no-results feedback, and a visible recoverable error state. A search failure does not disable navigation or reading. Do not eagerly transfer the entire corpus as part of every document load.

Build and deploy the Pagefind index with the content. Load the browser search engine and relevant index chunks on demand rather than during ordinary reading. Index article content with canonical document destinations rather than exposing frame URLs as search results. Measure first and repeated searches; any move to Worker-backed search requires a human-reviewed revision based on those results.

### Build and deployment

Keep Cloudflare Workers, the existing production domain, and branch-preview mechanism. Run content compilation, API generation, syntax highlighting, and complete reference-page rendering during the build. Enumerate every published document from authoritative content metadata, including symbols. Publish reference HTML alongside the existing static assets, retaining the guide routes and preference actions in the Worker. Generate Pagefind, Markdown exports, sitemap, and LLM indexes from the same content and rendering definitions, not a second reader application. Do not introduce static article-frame endpoints.

Preserve canonical URL behavior deliberately rather than inheriting new trailing slashes from directory-index output. Preserve real 404 status codes, metadata, sitemap entries, Markdown counterparts, and LLM indexes. Unknown documents and removed article-frame paths must not return the home page or a successful document shell.

The home-page design and port are separate work. This proposal can reach a reviewable preview independently, but must not merge into the production-deploying branch or launch until the home page is also ported. The existing home page may remain in the review workspace during this phase. That temporary state is not the completed migration or authorization to publish mixed stacks.

### Comparative measurements

Capture a reproducible baseline before implementation and repeat it against the completed preview with the same browser, viewport, cache conditions, network/CPU settings, routes, and interactions. Record versions, commits, and methodology with results on the PR.

Measure a representative guide, both build-mode variants, an API overview, and dense reference content. Where one old module page becomes several symbol pages, measure an equivalent lookup task as well as individual page loads.

Separate initial loading, automatic prefetch, subsequent navigation, and first/repeated search. Report compressed and decoded JavaScript bytes, script execution/main-thread work, relevant loading timings, search latency, and total transferred data including any WASM/index fragments. Distinguish first-party and third-party costs. Use repeated samples and report variation rather than a single timing.

Report deployed Worker size and measured invocations/CPU separately for complete document rendering, preference submissions, static assets, missing routes, and search if server-backed. Include the HTML transfer and Worker cost of native soft document navigation. Local timings cannot substitute for production-like Worker measurements. Identify unavailable metrics explicitly.

There is no preset byte or timing threshold. The readiness report names improvements and regressions, explains tradeoffs, and leaves acceptance to the human. Functionality and accessibility remain required even when a shortcut would reduce bytes.

### MDX authoring and tooling

Use MDX for guides that benefit from explicit, reusable Remix documentation components rather than recreating VitePress's component syntax as a new Markdown dialect. Plain prose and fenced code examples may remain Markdown. Fenced examples are displayed source, not executable MDX expressions. Converting a guide must preserve its public URL, heading destinations, build-mode variants, and readable Markdown export. Markdown exports must express the rendered meaning of documentation components rather than expose unresolved imports or JSX tags.

Provide full typechecking and IntelliSense for the executable portions of authored MDX in VS Code: imports and exports, JSX components and their props, expressions, and declared document props. Completion, hover information, and go-to-definition must resolve to the actual documentation components and their types. Unknown components, missing required props, invalid prop values, unresolved imports, and invalid expressions must produce diagnostics at the originating MDX location.

The initial tooling candidate is [MDX Analyzer](https://github.com/mdx-js/mdx-analyzer), including its official VS Code extension and strict `mdx.checkMdx` configuration. Its documentation supports JSDoc types rather than TypeScript syntax inside MDX. Put substantial typed logic in imported `.ts` or `.tsx` modules; use JSDoc for document-local types. Recommend the required extension in shared workspace configuration and document setup without relying on personal editor settings.

Configure analysis for Remix's `remix/ui` JSX runtime and actual component contracts. Do not substitute React component types, broad `any` declarations, or diagnostic suppression to make MDX appear supported. Prefer explicit component imports; if components are provided implicitly, derive their type map from the same component registry used by rendering so editor availability cannot drift from runtime availability.

Editor parsing must agree with the build's authoring syntax, including frontmatter and any supported Markdown extensions. MDX Analyzer documents support for parser plugins but does not support arbitrary remark transformers. Treat transformed exports and provided components as explicit typing boundaries. Frontmatter remains schema-validated by the content layer; syntax highlighting or a declaration for `*.mdx` alone does not establish that document bodies are typechecked.

Provide a reproducible command-line MDX check and include it in the documentation quality gate. Verify that it visits every authored MDX page and shared MDX partial and reports source-positioned diagnostics. The existing TypeScript command must not be assumed to check MDX merely because it accepts imports from `.mdx` files. Fenced code examples are outside executable-MDX checking; this requirement does not silently introduce a separate example-compilation project.

Before treating the tooling choice as settled, exercise a representative document with the repository's actual Remix components and selected TypeScript version. Confirm completion, hover, and definition navigation in VS Code, then deliberately introduce an invalid prop and an expression type error: both the editor and command-line gate must report them, and both must clear after correction. Also verify valid imports, frontmatter, and shared components remain accepted by the build.

Compatibility between MDX Analyzer, Sätteri's compilation, Remix's component types, and TypeScript 7 is unverified. Establish the supported version matrix and headless checking mechanism as the first implementation gate. An isolated compatible TypeScript tool dependency is an option to evaluate, following the existing TypeDoc precedent; do not downgrade the whole repository or reduce the promised authoring support silently. If the required coverage cannot be delivered, return the tooling choice to the human.

## Compatibility

Preserve existing guide URLs, build-mode selections, package-manager preferences where feasible, generated-reference destinations, Markdown access, and HTTP status semantics. Any unavoidable preference-key migration or URL change must be documented before approval. Package APIs themselves do not change.

## Implications on adoption

Contributors author guides in Markdown or MDX. Guides that compose callouts, code groups, shared examples, or other documentation components use MDX; simple pages may remain Markdown. Authored guides keep their existing compiled component rendering and cookie-aware request handling. API reference continues to derive from package exports and TSDoc, with Expressive Code blocks, but complete reference documents are rendered at build time and served as static assets.

Preserve TypeDoc's separate compiler environment unless evidence establishes a supported replacement. Use compatible scoped Pitlane packages; the reserved umbrella package is not an implementation dependency.

No published package release is required solely for the site migration. Necessary package changes would need explicit scope review and their own release treatment.

## Scope

The documentation renderer, Markdown/MDX authoring and editor/typechecking tooling, guides/deployment surfaces, symbol reference generation, associated navigation and enhancements, output compatibility, and comparative measurements form one documentation migration.

### Out of scope

Home-page creative direction and implementation; production launch before that separate port; tutorial authoring; package API redesign; unrelated framework features; historical multi-version documentation.

Fix the architecture of this documentation site first. A new documentation package, generic configuration API, external starter, or package extraction is not part of this work. Consider extraction only after the site's implementation works and demonstrates a worthwhile reusable boundary.

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

- Lazy browser search: selected because the corpus changes with deployment and a chunked index avoids a search service. Browser engine/index costs remain part of the measurement report.
- Worker-backed search: deferred unless measurements justify its server execution and operational complexity. Revisit with the human rather than changing search placement automatically.
- Fully static documents with browser-applied preferences: not selected for authored guides because it would change initial-response and no-JavaScript behavior. Preference-invariant reference documents need no browser correction and are served statically.
- Prebuilt content with request-time document rendering (Approach A): originally selected for all documents. Deployed measurements and the preference-invariance check motivated the human-approved revision to complete static reference documents with cookie-aware guide rendering. Keep one application and native document reconciliation.
- Separately retrieved article assets and nested article frames (Approach B): not selected. Both delivery paths return complete documents and require neither mechanism.
- Static article-only navigation with a persistent shell (Approach C): not selected. It can reduce navigation payload but requires additional cross-region coordination.
- Retaining module-sized API pages: simpler link migration, but the human explicitly prefers symbol-per-page organization.
- Adopting Remix's chapter sequence for guides: conflicts with Pitlane's topical guides and planned distinction between guides and tutorials.

## Open questions

The human approved revising the existing architecture to serve complete preference-invariant reference documents statically while retaining cookie-aware guide rendering. Fix this site's architecture before considering package extraction. Content structure, symbol organization, search, authoring support, and the separate home-page production gate remain unchanged. Return any conflict with these contracts to the human; do not substitute optimizations for the approved application architecture.

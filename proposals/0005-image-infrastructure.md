---
id: proposal.0005
title: Image Infrastructure
authors: [Mark Malstrom]
status: draft
pull-request: https://github.com/pitlane-tools/pitlane/pull/48
issues: []
supersedes: []
---

# Image Infrastructure

## Summary

Introduce `@pitlane/image` and `@pitlane/image-cloudflare` to make responsive image rendering and runtime transformation reusable across Remix applications. Start from an existing application implementation, preserving explicit adapter construction and browser-safe markup while reviewing its source restrictions, cache assumptions, and error contract before extraction.

## Motivation

An existing Remix application already owns image infrastructure: responsive markup, transformation URLs, request validation, endpoint middleware, and a Cloudflare Images adapter. Other applications need the same boundary without copying application-local utilities or depending on a particular hosting configuration. Pitlane's vision already names image optimization as a portable capability with provider adapters.

This proposal concerns one capability and its first adapter, not an image management service. The reference implementation supplies concrete experience without defining the final package contract.

## Domain grounding

### Established context

The problem spans browser resource selection, image geometry and codecs, HTTP representation caching, untrusted source resolution, and provider execution models. Optimizing an image means delivering an appropriate representation for its display context, not merely compressing a file. The browser, application, encoder, and cache each know different parts of that context.

#### Browser selection, layout, and accessibility

The [HTML image model](https://html.spec.whatwg.org/multipage/images.html#srcset-attributes) and [browser-engine guidance on descriptive images](https://web.dev/learn/images/descriptive) distinguish resource description from resource selection. A `w` descriptor describes the resource's actual natural width; `sizes` describes its expected layout slot, not a CSS sizing instruction. Density descriptors and width descriptors must not be mixed. The browser retains discretion over which candidate it selects, including reuse of an already cached larger resource.

This creates a cross-layer invariant: a URL advertising a 1600-pixel candidate must actually deliver that width. An encoder that clamps a small source rather than upscaling can violate the claim. Merely capping candidate widths at a provider maximum is insufficient; source dimensions and crop geometry matter too. A consistent crop at several resolutions is responsive sizing; different compositions across breakpoints are art direction.

[LCP guidance](https://web.dev/articles/optimize-lcp) recommends making the important image discoverable through `src` or `srcset` in initial HTML, avoiding lazy loading for it, and using priority hints selectively. Smaller bytes alone do not fix delayed discovery. [W3C's alternative-text guidance](https://www.w3.org/WAI/tutorials/images/decision-tree/) makes the text alternative a contextual author decision: decorative or redundant images can use an empty alternative; functional images must communicate their function.

[Unpic's public documentation](https://unpic.pics/lib/) provides relevant prior art: it translates provider URLs rather than implementing codecs, supports explicit provider selection, and acknowledges provider-specific operations. Reusing that work does not establish that its entire type surface or default layout policy is the right public contract for Pitlane.

#### HTTP representation identity and freshness

[RFC 8246 §2](https://www.rfc-editor.org/rfc/rfc8246.html#section-2) defines `immutable` as a promise that a representation will not change during its freshness lifetime. Transformation parameters alone do not establish this: replacing `/images/photo.jpg` changes every derivative of that source even if their URLs are unchanged. Versioned source paths can support the promise; a deployment by itself does not invalidate a browser's cached response.

[RFC 9111 §§2, 4.1, and 5.2.2](https://www.rfc-editor.org/rfc/rfc9111.html) distinguishes cache identity, freshness, and validation. `no-cache` permits storage but requires validation before reuse; `no-store` prohibits storage. If output depends on `Accept`, caches must distinguish those negotiated representations. Source validators and content lengths describe source bytes, not newly encoded derivative bytes.

[RFC 9110 §9.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.2) requires HEAD to omit response content but permits omission of fields determined only while generating it. Encoding and discarding an image is therefore a possible implementation, not a protocol requirement.

#### Source resolution and resource boundaries

The [WHATWG URL Standard](https://url.spec.whatwg.org/) separates paths, queries, and fragments and normalizes dot segments, including percent-encoded dot segments. URL parsing is not itself authorization. [OWASP's SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) explains why arbitrary remote image URLs introduce a substantially different boundary: destination restrictions must survive parsing, name resolution, and redirects.

Cloudflare's [static-assets binding documentation](https://developers.cloudflare.com/workers/static-assets/binding/) says that matching uses the URL pathname, and binding requests apply `html_handling` and `not_found_handling`. An asset fetch is not equivalent to reading an exact file from a filesystem: a fallback response can be HTML rather than the requested image. A successful HTTP status alone does not establish a valid image source.

#### Cloudflare execution

Cloudflare's [Images binding documentation](https://developers.cloudflare.com/images/optimization/binding/) establishes that the binding accepts image byte streams, exposes transformations separately from output encoding, and requires an explicit output format. It also states that binding responses are not automatically cached. Returning cache headers, having a cache that stores the response, and avoiding another encoder invocation are separate properties.

The offline local implementation supports only a subset of transformations. Passing an offline resize cannot establish production-equivalent fit, format, or animation behavior.

#### Provider capabilities are not interchangeable codecs

The documented request-time interfaces differ:

| Provider | Source ownership and transformation interface | Consequence |
| --- | --- | --- |
| [Cloudflare Images binding](https://developers.cloudflare.com/images/optimization/binding/) | The application supplies a stream; the binding transforms and encodes it. | A read/encode adapter fits this execution model. |
| [Netlify Image CDN](https://docs.netlify.com/build/image-cdn/overview/) | The platform fetches a local or allowed remote URL through `/.netlify/images`; width, height, fit, format, and quality are URL parameters. | URL construction is the integration boundary; a caller-supplied stream is not the documented contract. |
| [Vercel Image Optimization](https://vercel.com/docs/image-optimization#image-transformation-url-format) | The platform receives `url`, `w`, and `q` through `/_vercel/image`; resizing preserves source aspect ratio. | Exact-box cropping and explicit per-request output format are not shared guarantees. |

**Inference:** a stream encoder is a valid capability, but not the universal identity of an image provider. The portable part can describe supported image requests and produce delivery URLs; a local transformation endpoint is one execution strategy. Pretending every host can satisfy the same read/encode contract would either require extra infrastructure or silently lose behavior.

Cloudflare's [limits documentation](https://developers.cloudflare.com/images/get-started/limits/) specifically limits binding input to 20 MB. Its remote-image and hosted-storage tables describe different interfaces and must not be copied wholesale into a binding contract. SVG delivery and animation also have distinct behavior; support for a container format does not establish that resizing, animation preservation, or SVG sanitization works through every interface.

### Relevant constraints and principles

- A source locator, source revision, transformation, and derivative representation are different concepts. A path is not evidence of immutable bytes.
- A display box, source pixel dimensions, and encoded output dimensions are different measurements. CSS fitting does not change encoded pixels; encoder cropping changes image content.
- The public endpoint is a resource-consumption boundary as well as an input-validation boundary. Bounded dimensions limit one operation, not the number of distinct operations a client may request.
- Source authorization must apply to the same canonical path that the source reader consumes. Request parsing must not silently discard inputs that callers expected to affect source identity.
- Provider configuration, source publication, cache provisioning, and deployment routing remain application-owned.

### Quality bar

Application markup and URL construction must run without Cloudflare bindings. Requests must not escape the configured source namespace or trigger unsupported transformations. Errors must distinguish missing images from infrastructure failures. Responsive markup must preserve an accessible text alternative and layout dimensions without imposing site-specific CSS.

### Remaining uncertainty

Standards settle HTTP and browser semantics, not acceptable image quality, cache staleness, crop policy, candidate widths, or an application's spending limit. Recommendations below are product judgments and remain subject to human approval. No deployed transformation, visual quality comparison, cache-hit measurement, or browser performance benchmark has been performed for this draft.

### Direct observations and evidence limits

A local JavaScript URL API experiment during this research confirmed that `/images/../private.jpg` and `/images/%2e%2e/private.jpg` normalize to `/private.jpg`, while `/images/a%2Fb.jpg` retains its encoded separator in `pathname`. A source query and fragment remain separate from `pathname`; duplicate `w` parameters remain visible through `getAll`, while `get` returns only the first. This establishes parser behavior, not downstream static-asset behavior or a deployed vulnerability. It supports explicit normalization and duplicate-parameter rules rather than assuming a successful parse is sufficient.

## Existing baseline

The baseline is an existing private application's image infrastructure. The following summarizes inspected code; identifying project details and application content are intentionally omitted.

- Its portable entry defines `ImageAdapter.read(src)` and `encode(source, request)`, `createImages(options)`, and `createImageEndpoint(options, adapter)`.
- Its request layer serializes `src`, `w`, `h`, `f`, and `q`; restricts normalized source paths to a prefix; accepts dimensions from 1 through 4000 and quality from 1 through 100; and checks output formats against an allowlist.
- Its component uses `@unpic/core/base` and `unpic` to derive responsive image attributes for Remix. It disables Unpic's inline styling, requires width and height, and forwards `srcset` as Remix's `srcSet`.
- Its Cloudflare adapter reads source bytes through an explicitly supplied static-assets binding and encodes them with an explicitly supplied Images binding. It supports AVIF, JPEG, PNG, and WebP, defaults to WebP, and requests cover fitting when resizing.
- Application composition shares one formats configuration between browser-safe construction and endpoint handling.

The URL factory defaults quality to 80. The endpoint defaults to `/_image`, permits GET and HEAD, returns 405 with `Allow: GET, HEAD` for other methods, rejects invalid transformations with 400, and passes unrelated paths downstream. It encodes HEAD requests before returning headers without a body.

Preserve the explicit composition and separation between rendering and server resources. Do not blindly preserve the site's assumptions: all read exceptions currently become 404, responses receive a year-long immutable cache directive by default, public prop types expose Unpic types, and unsupported component formats silently fall back. These observations identify extraction decisions; this proposal does not claim that the site's deployed behavior is broken.

Inspected consumers exercise fixed-layout images, custom candidate widths, priority loading, decorative alternatives, and explicit JPEG URLs for non-browser consumers. These establish requirements worth preserving without publishing application-specific content or source paths.

## Proposed solution

Recommended approach, pending human selection: extract portable responsive rendering and delivery-URL construction into `@pitlane/image`, with a separately composed local transformation endpoint and Cloudflare execution in `@pitlane/image-cloudflare`. Preserve the useful factory composition, but do not freeze the baseline's stream adapter as the contract every future provider must implement. The provider comparison exposes a real boundary decision; this draft recommends revising it before implementation rather than promising drop-in equivalence for unsupported operations.

```text
Image props → delivery URL → provider-owned delivery
                          → or local endpoint → source reader → encoder → response
```

The source is the original image, the transformation is a requested operation, and the derivative is the resulting representation. An adapter is an execution capability, not the identity of an image. A static-assets path is the first source locator, not a universal model of image storage.

## Detailed design

The following defines the recommended scope for discussion, not an approved implementation contract. Open questions below must be resolved before tests, guides, or production code are written.

### Package responsibilities

`@pitlane/image` owns Pitlane's image-request vocabulary, deterministic URL construction, validation, and Remix rendering. A local endpoint may remain a separately imported core facility, but its read/encode contract must be named as an endpoint execution capability rather than a requirement of every delivery provider. Browser rendering must work with a URL-producing integration alone, without importing router middleware or Cloudflare types. Public types remain Pitlane-owned. Exact export paths and the capability contract remain open; this recommendation does not introduce a generalized hosting layer.

`@pitlane/image-cloudflare` depends on the portable contract and accepts explicitly supplied Images and static-assets bindings. It does not import application environment globals, create bindings, configure Wrangler, or provision Cloudflare resources. Its initial source backend is the static-assets binding used by the baseline; R2 and arbitrary remote fetching are not promised.

### Proposed local-endpoint behavior

- An application shares endpoint path, source prefix, and supported format configuration between markup generation and endpoint handling.
- The default endpoint path is `/_image`; the default source namespace is `/images/`.
- Transformation URLs encode source, optional width and height, output format, and quality. Generated URLs include quality 80 when omitted by the caller.
- Only normalized local source paths inside the configured namespace are accepted. Invalid source or transformation input is rejected before source I/O. Dimensions are bounded integers from 1 through 4000; quality is an integer from 1 through 100; explicit formats must be supported.
- The endpoint delegates unrelated paths, handles GET and HEAD, and rejects other methods with 405 and an appropriate Allow header. HEAD returns no response body.
- Cloudflare maps supported format names to their media types. Recommend retaining WebP as the local endpoint's explicit default and quality 80 as a starting policy, not as a measured optimum. Generated URLs should name their resolved format. Keep exact-box cover cropping available for existing consumers, but make crop intent explicit rather than deriving it from every HTML width/height pair.
- The component requires an explicit text alternative, permitting an empty string for decorative images, and width and height for layout reservation. Application styles remain responsible for visual sizing.

### Research-backed recommendations: rendering and capabilities

**Keep browser rendering independent of encoding.** Recommend a URL-producing delivery contract with explicit supported operations, alongside the local endpoint's separate execution contract. Reject unsupported explicit crop or format requests rather than ignoring them. This preserves direct Cloudflare use without claiming that Vercel's width-only service can reproduce exact-box derivatives. Netlify and Vercel implementations remain out of scope; their documented behavior constrains the abstraction, not the delivery schedule.

**Keep Unpic private initially.** Reuse the baseline's dependency where it satisfies Pitlane's declared behavior, but expose Pitlane-owned props and no provider auto-detection requirement. Start with fixed and constrained layouts, explicit `sizes` overrides, and configurable candidate widths. For fixed layout, the known slot can produce `sizes`; for a container-dependent layout, recommend requiring an explicit description rather than silently treating the image as viewport-wide. Keep width and height attributes and require explicit `alt`, including `alt=""`; do not infer decoration from an omitted prop. Application CSS still owns visual layout.

**Make candidate geometry truthful.** Generate sorted, unique width descriptors with the same composition and aspect ratio at every rung. Distinguish display dimensions from source dimensions. Recommend accepting author-supplied source metadata to bound non-upscaled candidates, without requiring build-time discovery or render-time image I/O. When source dimensions are unknown, settle whether the selected transformation guarantees exact output dimensions or responsive candidate generation must be restricted; do not silently advertise widths the encoder may not return. A crop may constrain both source axes, so a source-width-only cap is not sufficient for every target ratio.

**Expose loading intent, not viewport guesses.** Preserve an explicit priority mode that emits eager/high-priority markup for the likely LCP image, with ordinary lazy loading available for below-the-fold images. Callers must be able to request eager loading without boosting every visible image to high priority. Do not gate image URLs on client JavaScript or inject preload tags indiscriminately.

**Choose format behavior explicitly.** For the initial local endpoint, prefer format-bearing URLs over new automatic Accept negotiation. This keeps non-browser consumers deterministic and avoids an extra negotiated-cache contract. It trades automatic per-client format selection for simplicity; future negotiated delivery must correctly handle Accept preferences and cache variation. Do not emit a typed `<picture>` source whose URL can return a different format. Neither mandatory AVIF output nor always-on format fan-out is justified by this research.

**Do not treat every asset as an optimizable still image.** Recommend documenting the initial contract around still raster images, leaving SVGs and animations on ordinary application-owned image URLs until preservation and failure semantics are explicitly agreed. This is a proposed boundary, not evidence that the reference application needs migration for those formats. Do not silently flatten an animation or claim SVG sanitization through the binding based on documentation for a different Cloudflare delivery interface.

### Research-backed recommendations: source and HTTP contract

These are recommendations derived from the sources above, not claims that a standard prescribes Pitlane's policy.

**Make cache policy explicit at endpoint construction.** Remove the automatic year-long immutable default. Require the application to choose `cacheControl`: versioned source paths can opt into a long immutable lifetime; mutable paths choose an acceptable short freshness lifetime or `no-cache`. This avoids an arbitrary universal TTL without pretending that `no-cache` saves encoder work. Do not invent derivative ETags from source ETags, forward source content lengths after transformation, or apply a successful image's cache policy to errors. Recommend `no-store` for endpoint-generated errors. Documentation must distinguish browser freshness, provider cache configuration, and actual encoder avoidance.

**Keep the initial source boundary public, local, and path-only.** Do not forward a user's Request, cookies, authorization, hostname, or arbitrary URL to the source reader. Use a normalized prefix ending in `/`, reject queries and fragments rather than silently dropping them, and validate the canonical path before I/O. Reject ambiguous encoded separators, backslashes, control characters, and malformed encoding; define permitted encoded filenames before implementation rather than repeatedly decoding until something looks safe. Explicitly reject duplicate transformation keys. Use one canonical numeric and parameter serialization for generated URLs. The adapter must not follow a source redirect into unrestricted network fetching.

**Separate absent sources from failed sources.** Recommend 400 for invalid transformation requests, 404 only for an explicitly absent asset, and propagation of unexpected source/encoder exceptions to the application's server error boundary. Do not turn provider outages into missing images or serve the original image silently after a failed transform. Reject non-image fallback responses before encoding; a declared image content type is an early filter, not proof of valid image bytes. Unsupported or corrupt bytes need a documented adapter error classification before the contract is settled.

**Treat HEAD as an efficiency question, not a byte-generation requirement.** Preserve identical request validation and no response body on both successful and unsuccessful HEAD responses. Prefer inspecting source availability and known representation metadata without encoding merely to discover Content-Length; omit unknown generated fields. However, a source-exists check alone cannot prove that encoding would succeed. Settle that error-parity tradeoff and the source-reader metadata contract before replacing the baseline's encode-and-discard behavior. If encoding remains necessary, explicitly dispose of the output stream.

**Separate validity from abuse limits.** Retain the existing 4000-pixel bound as a proposed application ceiling, not as a Cloudflare limit or a complete cost defense. Document total pixel area, accepted source size, candidate count, and transformation cardinality as different constraints. Recommend a finite shared candidate-width policy for generated markup; do not claim it restricts hand-written URLs unless the endpoint enforces it too. Application/platform rate limiting and spending controls remain outside this package's implementation scope.

### Boundaries requiring resolution

The recommendations now identify the choices rather than leaving them wholly open: URL delivery versus endpoint execution, truthful candidate geometry, explicit cache policy, and precise source/error handling. The exact capability and source-metadata APIs, responsive candidate defaults, permitted source encoding, HEAD error parity, and still-image boundary need approval and specification before implementation.

## Compatibility

Neither proposed package is part of Pitlane's released baseline. Adoption is opt-in. Application-local factories are migration evidence, not a published compatibility promise. Changes to URLs, rendering props, cache behavior, or deployment composition must be enumerated before a reference consumer is migrated.

## Implications on adoption

Applications install the portable package and the selected adapter separately, configure their own source assets and Images binding, and register the endpoint explicitly. The browser entry imports only portable functionality. The adoption guide must explain Cloudflare configuration, local emulation limits, cache ownership, and source update behavior. Migrating external applications or templates is not authorized by this proposal-writing request.

## Scope

- One portable image capability package and its Cloudflare static-assets/Images adapter.
- Behavioral tests for validation, rendering, endpoint responses, and adapter boundaries after intent is approved.
- Standalone guides, generated API documentation, package metadata, and consumer-visible changeset notes during implementation.
- Installation and real image transformation verification through package previews during implementation.

### Out of scope

- Netlify and Vercel adapters, without designing away their future participation.
- Uploads, image libraries, asset management, arbitrary remote image proxies, R2 integration, watermarking, and provider provisioning.
- Build-time image pipelines, generated asset manifests, and a new deployment abstraction.
- Automatic migration of external applications or templates; release and adoption require their own authorization.

## Preview

This draft changes only a proposal and has no executable preview. During implementation, add both packages to the existing `pkg-preview.yml` package preview coverage and verify installation from `https://pkg.pr.new/pitlane-tools/pitlane/@pitlane/<name>@<sha>`. Exercise generated markup and GET/HEAD/error behavior in a consumer, then transform a real source with the Cloudflare binding. Package preview URLs are public. Published guides use the existing Workers documentation preview; that static documentation site is not an image transformation test server.

## Policies and decisions checked

- Policies: None; the directory contains only its README.
- `decision.0001` — Static Documentation Delivery, currently proposed. It concerns pitlane.tools, not consumer runtime capabilities. This proposal does not add request-time document rendering or a transformation service to the documentation site.
- `VISION.md` — Honors direct package installation, Pitlane-owned capability contracts, explicit provider construction, runtime-first behavior, and native hosting configuration. The vision already lists both package names. Prioritizing this proposal does not implement or remove the preceding planned packages.

## Future directions

Other provider adapters could implement the agreed capability boundary. Additional source backends would need their own authorization and caching semantics; neither is promised by this proposal.

## Alternatives considered

1. **Minimal extraction of the existing utilities.** Lowest migration cost, but freezes Unpic-facing public types and site-specific caching/error assumptions into a package contract.
2. **Portable delivery contract plus local endpoint execution — recommended.** Preserves the useful implementation while acknowledging that providers do not expose interchangeable codecs. Makes rendering, source identity, errors, and caching explicit. Costs an additional conceptual distinction, but avoids requiring URL-based providers to accept byte streams or pretending they support cropping.
3. **URL/rendering helpers only, with application-owned endpoints.** Smaller package surface and fewer server guarantees, but leaves validation and endpoint behavior duplicated and does not capture much of the established infrastructure.

These are alternatives for human selection, not a settled decision.

## Open questions

- [NEEDS CLARIFICATION: Approve the recommended separation of portable URL delivery from local endpoint execution, including explicit rejection of unsupported operations, rather than requiring every provider to implement read/encode?]
- [NEEDS CLARIFICATION: Approve private Unpic reuse, fixed/constrained layouts with explicit slot sizing, and author-supplied source metadata for truthful candidates; what exact props, candidate defaults, and unknown-source behavior should be specified?]
- [NEEDS CLARIFICATION: Approve required explicit cache policy and versioned source paths for immutable caching, rather than a universal immutable default?]
- [NEEDS CLARIFICATION: Approve the path-only public-source and error recommendations; settle permitted encodings, metadata/error types, and HEAD error parity before implementation?]
- [NEEDS CLARIFICATION: Approve explicit format URLs and a still-raster initial scope, with SVG/animation delivery remaining application-owned until separately specified?]

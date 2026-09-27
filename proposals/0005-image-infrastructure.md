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

Introduce `@pitlane/image` and `@pitlane/image-cloudflare` to make responsive image rendering and runtime transformation reusable across Remix applications. Start from malstrom.me's existing implementation, preserving explicit adapter construction and browser-safe markup while reviewing its source restrictions, cache assumptions, and error contract before extraction.

## Motivation

malstrom.me already owns application-local image infrastructure: responsive markup, transformation URLs, request validation, endpoint middleware, and a Cloudflare Images adapter. Other Remix applications need the same boundary without copying the site's utilities or depending on its hosting configuration. Pitlane's vision already names image optimization as a portable capability with provider adapters.

This proposal concerns one capability and its first adapter, not an image management service. The user requested both packages together and identified malstrom.me as the baseline. The precise extraction boundary remains a human design decision.

## Domain grounding

### Established context

Cloudflare's [Images binding documentation](https://developers.cloudflare.com/images/optimization/binding/) establishes that the binding accepts image byte streams from sources such as static fetch responses and R2, exposes transformations separately from output encoding, and requires an explicit output format. A source location, a transformation, and an encoded response are therefore distinct concepts.

The same documentation states that binding responses are not automatically cached. Returning cache headers and configuring a platform cache are different responsibilities. Its local offline implementation supports only a subset of transformations; production-equivalent verification cannot be inferred from an offline resize alone.

### Relevant constraints and principles

- Source identity is not derivative identity. A path plus dimensions does not identify immutable bytes if the source at that path can change.
- The public endpoint receives untrusted URLs even when the application normally generates them. Source authorization and transformation bounds belong at that boundary.
- Image dimensions used to reserve layout space and dimensions requested from an encoder have related but different meanings. Rendering must not require access to an encoder or Workers bindings.
- Provider configuration and resource provisioning remain application-owned, consistent with Pitlane's vision.

### Quality bar

Application markup and URL construction must run without Cloudflare bindings. Requests must not escape the configured source namespace or trigger unsupported transformations. Errors must distinguish missing images from infrastructure failures. Responsive markup must preserve an accessible text alternative and layout dimensions without imposing site-specific CSS.

### Remaining uncertainty

The draft has not yet established the final responsive-image API, the dependency boundary around Unpic, or a portable cache and source-versioning contract. These are design questions, not facts established by the baseline. Provider behavior has been researched from documentation; no deployed image transformation was exercised during this proposal-only change.

## Existing baseline

The inspected baseline is `~/Developer/Projects/malstrom.me/app/utils/images/`, with application composition in `app/images.ts`:

- `index.ts` defines `ImageAdapter.read(src)` and `encode(source, request)`, `createImages(options)`, and `createImageEndpoint(options, adapter)`.
- `request.ts` serializes `src`, `w`, `h`, `f`, and `q`; restricts normalized source paths to a prefix; accepts dimensions from 1 through 4000 and quality from 1 through 100; and checks output formats against an allowlist.
- `component.tsx` uses `@unpic/core/base` and `unpic` to derive responsive image attributes for Remix. It disables Unpic's inline styling, requires width and height, and forwards `srcset` as Remix's `srcSet`.
- `cloudflare.ts` reads source bytes through an explicitly supplied static-assets binding and encodes them with an explicitly supplied Images binding. It supports AVIF, JPEG, PNG, and WebP, defaults to WebP, and requests cover fitting when resizing.
- `app/images.ts` shares one formats configuration between browser-safe construction and endpoint composition.

The URL factory defaults quality to 80. The endpoint defaults to `/_image`, permits GET and HEAD, returns 405 with `Allow: GET, HEAD` for other methods, rejects invalid transformations with 400, and passes unrelated paths downstream. It encodes HEAD requests before returning headers without a body.

Preserve the explicit composition and separation between rendering and server resources. Do not blindly preserve the site's assumptions: all read exceptions currently become 404, responses receive a year-long immutable cache directive by default, public prop types expose Unpic types, and unsupported component formats silently fall back. These observations identify extraction decisions; this proposal does not claim that the site's deployed behavior is broken.

## Proposed solution

Recommended approach, pending human selection: extract a deliberately small portable contract and responsive Remix integration into `@pitlane/image`; put Cloudflare binding construction and transformation mapping in `@pitlane/image-cloudflare`. Keep the existing factory shape where it expresses that contract, but do not make application-local cache or error assumptions public defaults without agreement.

```text
Application image props → portable image URL → validated endpoint request
    → adapter reads source bytes → adapter encodes derivative → HTTP response
```

The source is the original image, the transformation is a requested operation, and the derivative is the resulting representation. An adapter is an execution capability, not the identity of an image. A static-assets path is the first source locator, not a universal model of image storage.

## Detailed design

The following defines the recommended scope for discussion, not an approved implementation contract. Open questions below must be resolved before tests, guides, or production code are written.

### Package responsibilities

`@pitlane/image` owns Pitlane's transformation request and adapter contracts, deterministic URL construction, source and parameter validation, endpoint composition, and the Remix image component. Importing rendering functionality must not require a Cloudflare runtime. Public contracts must be Pitlane-owned rather than aliases that require users to understand Unpic.

`@pitlane/image-cloudflare` depends on the portable contract and accepts explicitly supplied Images and static-assets bindings. It does not import application environment globals, create bindings, configure Wrangler, or provision Cloudflare resources. Its initial source backend is the static-assets binding used by the baseline; R2 and arbitrary remote fetching are not promised.

### Proposed baseline behavior to preserve

- An application shares endpoint path, source prefix, and supported format configuration between markup generation and endpoint handling.
- The default endpoint path is `/_image`; the default source namespace is `/images/`.
- Transformation URLs encode source, optional width and height, output format, and quality. Generated URLs include quality 80 when omitted by the caller.
- Only normalized local source paths inside the configured namespace are accepted. Invalid source or transformation input is rejected before source I/O. Dimensions are bounded integers from 1 through 4000; quality is an integer from 1 through 100; explicit formats must be supported.
- The endpoint delegates unrelated paths, handles GET and HEAD, and rejects other methods with 405 and an appropriate Allow header. HEAD returns no response body.
- Cloudflare maps supported format names to their media types and uses WebP when no format is requested. Resizing uses cover fitting, matching the baseline; arbitrary provider transformations are not part of the initial contract.
- The component requires an explicit text alternative, permitting an empty string for decorative images, and width and height for layout reservation. Application styles remain responsible for visual sizing.

### Boundaries requiring resolution

The exact prop surface and responsive candidate algorithm must be specified independently of Unpic's incidental defaults. The final endpoint contract must define missing-source versus source-read failure, encoder failure, HEAD stream disposal, unsupported explicit formats, and cache behavior for mutable sources. The source normalization contract must cover encoded traversal, separators, URL query and fragment handling, and prefix boundaries. These are requirements for settling this draft, not implementation work deferred beyond it.

## Compatibility

Neither proposed package is part of Pitlane's released baseline. Adoption is opt-in. malstrom.me's local factories are migration evidence, not a published compatibility promise. Any changes to its URLs, rendering props, cache behavior, or deployment composition must be enumerated before using it as the implementation's consumer smoke test.

## Implications on adoption

Applications install the portable package and the selected adapter separately, configure their own source assets and Images binding, and register the endpoint explicitly. The browser entry imports only portable functionality. The adoption guide must explain Cloudflare configuration, local emulation limits, cache ownership, and source update behavior. Migrating malstrom.me or templates is not authorized by this proposal-writing request.

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
2. **Portable contract with a reviewed extraction — recommended.** Preserves working composition while making source, rendering, error, and cache guarantees intentional. Requires resolving the bounded questions below before implementation.
3. **URL/rendering helpers only, with application-owned endpoints.** Smaller package surface and fewer server guarantees, but leaves validation and endpoint behavior duplicated and does not capture much of the established infrastructure.

These are alternatives for human selection, not a settled decision.

## Open questions

- [NEEDS CLARIFICATION: Which approach should this proposal pursue: minimal extraction, the recommended reviewed portable contract, or URL/rendering helpers only?]
- [NEEDS CLARIFICATION: What responsive layouts and public props must the first component support, and should Unpic remain a private implementation dependency?]
- [NEEDS CLARIFICATION: What cache default and source-versioning contract should apply when an asset can change at the same path?]
- [NEEDS CLARIFICATION: What exact source-normalization, missing-source, read-failure, encoder-failure, unsupported-format, and HEAD behavior should the public endpoint guarantee?]

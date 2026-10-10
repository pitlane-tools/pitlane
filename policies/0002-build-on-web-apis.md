---
id: policy.0002
title: Build on Web APIs
status: active
established-by: pull-request.87
supersedes: []
---

# Build on Web APIs

## Introduction

This policy records the second of the development principles in `VISION.md`, which Pitlane shares with Remix 3. It settles which types and primitives a Pitlane API is built from when the platform already defines one.

## The rule

Build public APIs on Web-standard APIs, such as `Request`, `Response`, `Headers`, `URL`, `FormData`, `Blob`, `File`, streams, `AbortSignal`, and `EventTarget`, wherever a standard covers the need, instead of Node-specific, provider-specific, or Pitlane-invented equivalents.

## Why this exists

Web APIs are the one set of abstractions available on every runtime Pitlane targets: Cloudflare, Netlify, Vercel, Deno Deploy, and plain Node, Bun, or Deno, as well as the browser and service workers. An API that takes a Node `IncomingMessage` or a provider's request object works on one of those and has to be wrapped for the rest.

Shared abstractions also reduce context switching. A person or model who knows `fetch` already knows how a Pitlane server entry, a controller, and a development bridge such as `@pitlane/vite-plugin-fetch-server` exchange requests and responses.

## What it applies to

- Applies to: the public API of every `@pitlane/*` package, including the shapes of handlers, middleware, cancellation, events, and streamed or uploaded data.
- Does not apply to: the construction boundary of a provider adapter, which accepts the provider's own binding, as `createD1Database(env.DB)` accepts a D1 database. Nor does it apply to the plugin API of a Vite plugin, which is Vite's to define.

## Enforcement

- Tier: prose
- Mechanism: proposal review and the excellence pass.
- Prose justification: deciding whether a Web standard covers a need is a judgement about the domain. A lint rule that bans `node:` imports would reject legitimate build tooling and still miss a Pitlane-invented type that duplicates a standard.

## How to comply

1. Before introducing a type for a request, response, URL, body, stream, signal, or event, check whether a Web standard already defines it, and use that standard when it does.
2. Keep runtime-specific APIs inside the package's implementation or behind an adapter, never in the types an application holds.
3. When no standard fits, say so in the proposal or pull request so the reviewer can check the claim.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

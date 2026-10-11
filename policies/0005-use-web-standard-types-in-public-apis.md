---
id: policy.0005
title: Use Web-Standard Types in Public APIs
status: active
established-by: pull-request.87
supersedes: []
---

# Use Web-Standard Types in Public APIs

## Introduction

This policy is derived from development principle 2, _Build on Web APIs_, in `VISION.md`. It settles which types a Pitlane API is built from when the platform already defines one.

## The rule

Build public APIs on Web-standard types, such as `Request`, `Response`, `Headers`, `URL`, `FormData`, `Blob`, `File`, streams, `AbortSignal`, and `EventTarget`, wherever one covers the need, instead of Node-specific, provider-specific, or Pitlane-invented equivalents.

## Why this exists

Web APIs are the one set of abstractions every Pitlane target shares: Cloudflare, Netlify, Vercel, Deno Deploy, plain Node, Bun, and Deno, plus the browser and service workers. An API that takes a Node `IncomingMessage` or a provider's request object works on one of them and has to be wrapped for the rest. A reader who knows `fetch` already knows how a server entry, a controller, and `@pitlane/vite-plugin-fetch-server` exchange requests and responses.

## What it applies to

- Applies to: the public API of every published `@pitlane/*` package, including handlers, middleware, cancellation, events, and streamed or uploaded data.
- Does not apply to: the construction boundary of a provider adapter, which accepts the provider's own binding, as `createD1Database(env.DB)` does; or the plugin API of a Vite plugin, which is Vite's to define.

## Enforcement

- Tier: prose
- Mechanism: proposal review and the excellence pass.
- Prose justification: deciding whether a standard covers a need is a judgement about the domain. A ban on `node:` imports would reject legitimate build tooling and still miss a Pitlane-invented type that duplicates a standard.

## How to comply

1. Before adding a type for a request, response, URL, body, stream, signal, or event, check whether a Web standard defines one, and use it when it does.
2. Keep runtime-specific APIs in the implementation or behind an adapter, never in the types an application holds.
3. When no standard fits, say so in the proposal or pull request so the reviewer can check the claim.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

---
id: policy.0010
title: Keep Third-Party Types out of Public Declarations
status: active
established-by: pull-request.87
supersedes: []
---

# Keep Third-Party Types out of Public Declarations

## Introduction

This policy is derived from development principle 4, _Avoid Dependencies_, in `VISION.md`, which requires dependencies to be wrapped completely behind Pitlane-owned APIs. It settles the observable test of "completely": what a package's published declarations may import.

## The rule

A published package's declarations must not reference a third-party type unless `.agents/dependencies.json` allows that dependency's types to be public.

## Why this exists

A type in a public signature is part of the API. When it belongs to a dependency, that dependency's releases change Pitlane's API, and replacing it becomes a breaking change for every caller. That is what made removing `@hiogawa/vite-plugin-fullstack` a public API break in proposal 0005. When this policy was written, `@pitlane/content` exposed `satteri`'s `CompileOptions` and plugin-entry types, which the October audit had already flagged.

## What it applies to

- Applies to: every built declaration file of a published `@pitlane/*` package.
- Always allowed: the package itself, other `@pitlane/*` packages, `remix`, and runtime modules with a scheme, such as `node:*` and `cloudflare:*`.
- Allowed by the ledger: `vite` in Vite plugins, whose API is Vite's, and `csstype` in `@pitlane/theme`, a permanent exception because it is types only and supplies the CSS value unions `ThemedCSSProps` is built on. `satteri` in `@pitlane/content` is a temporary exception until [#88](https://github.com/pitlane-tools/pitlane/issues/88) replaces those types.

## Enforcement

- Tier: check
- Mechanism: `tools/policies/declarations.ts` scans each package's built `dist` declarations and fails on any other import. A package that has not been built is a failure, not a pass. It runs through `vp run policies`, which builds the packages first, in `vp run check` and in the `Policies must hold` CI job.

## How to comply

1. Describe what a dependency needs from the caller with a small Pitlane-owned interface, as `@pitlane/content`'s `render.ts` does, and translate it internally.
2. Set `publicTypes: true` in the ledger only with a reason the reviewer accepts, and say whether the exception is permanent or tracked by an issue.
3. Run `vp run policies`.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

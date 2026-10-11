---
id: policy.0014
title: Import by Audience in Documentation
status: active
established-by: pull-request.87
supersedes: []
---

# Import by Audience in Documentation

## Introduction

This policy is derived from development principle 6, _Distribute Cohesively_, in `VISION.md`, and from the packaging strategy that section describes. The same API is reachable as `pitlane/<name>` and as `@pitlane/<name>`, and the two serve different readers. This policy settles which one each document uses.

## The rule

Import from `pitlane/<name>` in app-facing guides, and from `@pitlane/<name>` in package READMEs.

## Why this exists

Guides teach an application, and an application installs `pitlane` for one install and one namespace, so a guide that imports `@pitlane/assets` teaches a dependency the app does not have. A README serves a project that installs only that package, so a README that imports `pitlane/assets` teaches an import that project cannot resolve under a strict package manager. Mixing the two in one document also leaves an agent unsure which to copy.

## What it applies to

- Applies to: import specifiers inside fenced code in `docs/app/content/guides/`, `docs/app/content/deployment/`, and `docs/app/content/_partials/`, and in the README of every published `@pitlane/*` package.
- Does not apply to: package names mentioned in prose, the umbrella's own README, or generated API pages.
- Exception: a guide passage written for a reader the umbrella cannot serve may import `@pitlane/<name>`. Examples are an app with no bundler, since `pitlane` has Vite as a peer, a project using the package without Remix, and a `./internal/*` subpath the umbrella does not re-export. Mark each such fence with a comment on the line before it containing `policy.0014: scoped package`, and say in the surrounding prose why the scoped package is used.

## Enforcement

- Tier: check
- Mechanism: `tools/policies/import-style.ts`, run by `vp run policies` in `vp run check` and in the `Policies must hold` CI job.

## How to comply

1. In a guide, write `import { x } from "pitlane/<name>"`.
2. In a package README, write `import { x } from "@pitlane/<name>"`.
3. For a deliberate scoped-package passage in a guide, add `<!-- policy.0014: scoped package -->` in Markdown or `{/* policy.0014: scoped package */}` in MDX before its fence.
4. Run `vp run policies`.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

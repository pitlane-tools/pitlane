---
id: policy.0004
title: Avoid Dependencies
status: active
established-by: pull-request.87
supersedes: []
---

# Avoid Dependencies

## Introduction

This policy records the fourth of the development principles in `VISION.md`, which Pitlane shares with Remix 3. It settles when a package may take a third-party dependency and how that dependency may reach the package's users. Dependencies are strategic liabilities, not prohibited tools.

## The rule

Add a third-party dependency only when the change that adds it justifies it, and wrap it completely behind a Pitlane-owned API so that none of its types or behavior form part of the package's public contract.

## Why this exists

Every dependency is code Pitlane ships but does not control: its releases, its bugs, its install size, its peer requirements, and its idea of what the API should be. When its types leak into a public API, replacing it becomes a breaking change for every application.

`@pitlane/dev` once built its asset manifests through `@hiogawa/vite-plugin-fullstack`, a dormant package that declared a Vite 7 peer while Pitlane ran Vite 8 and carried the only advisory in Pitlane's production dependency graph. Pitlane's own agent references taught applications its `?assets=` query imports, so replacing it with `@pitlane/assets` in proposal 0005 came with a public API break. The long-term goal is Remix as the only foundational dependency where practical, with most others replaced by Pitlane packages over time.

## What it applies to

- Applies to: `dependencies` and `peerDependencies` of every published `@pitlane/*` package.
- Does not apply to: Remix, which is the foundational dependency; a provider SDK or binding type that a provider adapter depends on by design, which is part of that adapter's documented API; Vite as the peer of a Vite plugin; or `devDependencies` and repository tooling, which never reach an application.

## Enforcement

- Tier: prose
- Mechanism: proposal review and the code-quality inline review, which look at every new entry in a package's `package.json`.
- Prose justification: whether a dependency is necessary and whether its types have leaked are judgements. A check could list new dependencies but could not decide whether one was worth taking.

## How to comply

1. Before adding a dependency, check whether Remix, a Web API, or an existing Pitlane package already provides what you need.
2. If you still need it, state in the proposal or pull request what it provides and why writing it in Pitlane is not yet worth it.
3. Import it only inside the package's implementation. Re-export none of its types, and translate its errors and options into Pitlane's own.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

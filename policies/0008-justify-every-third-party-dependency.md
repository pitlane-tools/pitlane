---
id: policy.0008
title: Justify Every Third-Party Dependency
status: active
established-by: pull-request.87
supersedes: []
---

# Justify Every Third-Party Dependency

## Introduction

This policy is derived from development principle 4, _Avoid Dependencies_, in `VISION.md`, which treats dependencies as strategic liabilities rather than prohibited tools. It settles how a dependency gets into a published package: through a written reason that a reviewer can see and later revisit.

## The rule

Record every third-party dependency of a published package in `.agents/dependencies.json`, with the reason Pitlane depends on it rather than vendoring or reimplementing it.

## Why this exists

A dependency added without a reason is a dependency nobody re-examines. Pitlane's October audit (`docs/internal/dependency-audit-2026-10.md`) had to reconstruct, for each one, why it was there. Several had outlived their reason: `@hiogawa/vite-plugin-fullstack` was dormant, declared a Vite 7 peer while Pitlane ran Vite 8, and carried the only advisory in Pitlane's production dependency graph. The ledger keeps that reasoning current and makes adding a dependency a visible decision in the diff.

## What it applies to

- Applies to: `dependencies`, `peerDependencies`, and `optionalDependencies` of every published `@pitlane/*` package.
- Does not apply to: `remix`, the foundational dependency; other `@pitlane/*` packages; `devDependencies`; or the umbrella `pitlane`, whose dependencies are the scoped packages and their lifted peers.

## Enforcement

- Tier: check
- Mechanism: `tools/policies/dependencies.ts` fails when a dependency has no ledger entry or an empty reason, and when an entry names a dependency that no longer exists. It runs through `vp run policies` in `vp run check` and in the `Policies must hold` CI job.

## How to comply

1. Before adding a dependency, check whether Remix, a Web API, or an existing Pitlane package covers the need, and apply [policy.0009](0009-vendor-or-reimplement-small-dependencies.md).
2. Add the dependency's ledger entry in the same change, saying what it provides and why owning it is not yet worth it. Set `publicTypes` as [policy.0010](0010-keep-third-party-types-out-of-public-declarations.md) requires.
3. Remove the entry when you remove the dependency.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

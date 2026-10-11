---
id: policy.0013
title: Re-export Every Package Through the Umbrella
status: active
established-by: pull-request.87
supersedes: []
---

# Re-export Every Package Through the Umbrella

## Introduction

This policy is derived from development principle 6, _Distribute Cohesively_, in `VISION.md`. Each concern ships as its own `@pitlane/*` package, and the `pitlane` umbrella presents all of them through one namespace and one installed documentation surface. This policy settles what the umbrella must cover.

## The rule

Re-export every public export of every published `@pitlane/*` package through the `pitlane` umbrella at the matching `pitlane/<package>` subpath.

## Why this exists

Extremely composable ecosystems are hard to learn and use. Without the umbrella, an application installs and version-matches a dozen packages and learns a dozen import roots. An agent would also have no single installed place to find documentation that matches the installed versions. A package the umbrella misses is one that guides cannot teach and that the installed index does not list. The umbrella's design is recorded in [decision.0003](../decisions/0003-umbrella-package.md).

## What it applies to

- Applies to: every published `@pitlane/*` package and each of its public exports.
- Does not apply to: exports under `./internal/` or private workspace packages. It also does not decide when the umbrella releases, which decision.0003 covers.

## Enforcement

- Tier: check
- Mechanism: `generateUmbrella` in `packages/pitlane/scripts/generate.ts` fails when `packages/pitlane/manifest.json` leaves a public export out, names one that does not exist, maps two subpaths to one export, or re-exports an internal one. `packages/pitlane/tests/generated.test.ts` runs it against the real workspace in the `pitlane` entry of `.github/workflows/test.yml`.

## How to comply

1. When a package gains, renames, or removes a public export, update `packages/pitlane/manifest.json`.
2. Run `vp run generate` in `packages/pitlane` and commit the result.
3. Run `vp test` in `packages/pitlane`.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

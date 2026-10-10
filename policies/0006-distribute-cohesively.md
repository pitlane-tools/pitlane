---
id: policy.0006
title: Distribute Cohesively
status: active
established-by: pull-request.87
supersedes: []
---

# Distribute Cohesively

## Introduction

This policy records the sixth of the development principles in `VISION.md`, which Pitlane shares with Remix 3. It settles how Pitlane's many small packages reach users as one product: each concern ships as its own `@pitlane/*` package, and the `pitlane` umbrella presents all of them through one namespace and one documentation surface.

## The rule

Re-export every public export of every published `@pitlane/*` package through the `pitlane` umbrella at the matching `pitlane/<package>` subpath.

## Why this exists

Extremely composable ecosystems are hard to learn and use. Without the umbrella, an application installs and version-matches a dozen packages and learns a dozen import roots, and an agent has no single installed place to find documentation that matches the installed versions.

The umbrella's design, and the reasons for pinning exact versions and releasing it by hand, are recorded in [decision.0003](../decisions/0003-umbrella-package.md).

## What it applies to

- Applies to: every published `@pitlane/*` package and each of its public exports.
- Does not apply to: exports under `./internal/`, which are never re-exported, or private workspace packages. It also does not decide when the umbrella releases, which decision.0003 covers.

## Enforcement

- Tier: check
- Mechanism: `generateUmbrella` in `packages/pitlane/scripts/generate.ts` fails when `packages/pitlane/manifest.json` leaves a public export out, names one that does not exist, maps two subpaths to one export, or re-exports an internal one. `packages/pitlane/tests/generated.test.ts` runs it against the real workspace, and the `pitlane` entry in `.github/workflows/test.yml` runs that test on every pull request.

## How to comply

1. When a package gains, renames, or removes a public export, update `packages/pitlane/manifest.json` to match.
2. Run `vp run generate` in `packages/pitlane` and commit the result.
3. Run `vp test` in `packages/pitlane`.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

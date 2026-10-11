---
id: policy.0012
title: Try a New Package Before Extending One
status: active
established-by: pull-request.87
supersedes: []
---

# Try a New Package Before Extending One

## Introduction

This policy is derived from development principle 5, _Demand Composition_, in `VISION.md`. It settles where a new feature goes: into a package of its own first, into an existing package only when that is impossible, and together with other code only when the two always change together.

## The rule

A proposal that adds a feature to an existing package must say why the feature cannot be a new package, and whether splitting the existing package first would keep both single-purpose.

## Why this exists

A package that grows a second purpose forces every application that wanted the first purpose to take the second, and it couples releases that should be independent. Proposal 0005 is the worked example. Replacing the asset integration inside `@pitlane/dev` did not grow `dev`: asset resolution shipped as `@pitlane/assets` and the development request bridge as `@pitlane/vite-plugin-fetch-server`, both usable without Remix. The principle's own limit applies too: prerendering ships as `remix({ prerender })` rather than as `@pitlane/prerender`, because it is the build plugin running the crawler and a separate package would have no purpose of its own.

## What it applies to

- Applies to: proposals that add behavior to an existing package.
- Does not apply to: fixes and changes inside a package's existing purpose, or tightly coupled modules that almost always change together in both directions, which belong in one package.

## Enforcement

- Tier: template
- Mechanism: the **Package placement** section of `.agents/templates/PROPOSAL.md` asks the question, and proposal review and the excellence pass check the answer.

## How to comply

1. Answer "Where it lives" under **Package placement** in the proposal.
2. If the feature extends an existing package, consider splitting that package first.
3. If it belongs in an existing package because the two change together, give the evidence of that coupling.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

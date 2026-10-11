---
id: policy.0011
title: Make Every Package Usable on Its Own
status: active
established-by: pull-request.87
supersedes: []
---

# Make Every Package Usable on Its Own

## Introduction

This policy is derived from development principle 5, _Demand Composition_, in `VISION.md`, which requires every package to be useful and documented when installed directly, without the `pitlane` umbrella. It settles the minimum documentation that makes that true.

## The rule

Every published package must have a README that installs it as `@pitlane/<name>` and imports it from `@pitlane/<name>`.

## Why this exists

A composable package that can only be learned through the umbrella's guides is not composable in practice. The guides teach `pitlane/<name>` imports ([policy.0014](0014-import-by-audience-in-documentation.md)), so the README is the one place a project installing only `@pitlane/assets` learns what to install and import. The agent-readability review behind [PR #47](https://github.com/pitlane-tools/pitlane/pull/47) found `@pitlane/content`'s README missing the Vite setup that only its guide stated, so the direct path did not work from the README alone.

## What it applies to

- Applies to: the `README.md` of every published `@pitlane/*` package, which npm shows and the umbrella installs beside each subpath.
- Does not apply to: the umbrella `pitlane`, whose README covers the whole namespace.

## Enforcement

- Tier: check for the install and import, prose for completeness
- Mechanism: `tools/policies/readme.ts`, run by `vp run policies` in `vp run check` and in the `Policies must hold` CI job. Reviewers check that the README's setup is complete enough to work without the guides.
- Prose justification: whether a setup is complete depends on what the package needs, which only a reader can judge.

## How to comply

1. Start the README with the `@pitlane/<name>` install and the smallest working example importing from it.
2. Name every peer and setup step the package needs, such as a Remix peer, a provider SDK, or a Vite plugin registration.
3. Run `vp run policies`.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

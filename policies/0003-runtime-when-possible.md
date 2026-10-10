---
id: policy.0003
title: Runtime When Possible
status: active
established-by: pull-request.87
supersedes: []
---

# Runtime When Possible

## Introduction

This policy records the third of the development principles in `VISION.md`, which Pitlane shares with Remix 3. It settles whether a package's core behavior may depend on a bundler, compiler, type generator, or other pre-runtime step.

## The rule

A runtime-oriented package must expose a core API that works directly in a JavaScript runtime and whose core tests run without bundling, and any build-time integration it gains must remain an optional optimization of that API.

## Why this exists

Designing from build-time assumptions first distorts the API. A function that only works once a plugin has rewritten its call sites cannot be called from a test, a script, a service worker, or an application built with another bundler, and the plugin becomes a prerequisite every consumer inherits.

`@pitlane/theme` shows the intended shape: `createTheme` runs at runtime with no build step, and a future build integration may extract or optimize its CSS without becoming required. `@pitlane/assets` keeps its resolver and manifest generator independent of Vite and puts its Vite adapter at `/vite-plugin`.

## What it applies to

- Applies to: runtime-oriented packages, including capability interfaces, provider adapters, controller middleware, and framework-adjacent features such as `@pitlane/theme` and `@pitlane/content`.
- Does not apply to: a package whose stated purpose intrinsically requires build-time integration, such as `@pitlane/vite-plugin-remix`, `@pitlane/vite-plugin-fetch-server`, an asset generator, or a provider type generator. Those use build-time integration directly rather than maintain an artificial runtime-only version.

## Enforcement

- Tier: prose
- Mechanism: proposal review and the excellence pass. Each package's `vp test` suite, which runs in `.github/workflows/test.yml`, is where its core tests demonstrate the runtime API.
- Prose justification: whether a package's purpose intrinsically requires build-time integration is a judgement about that package. A check cannot tell an intrinsic build step from a convenient one.

## How to comply

1. Decide in the proposal whether the package is runtime-oriented or exists to integrate with a build. State which, and why.
2. For a runtime-oriented package, write the core API and its tests first, so they import the package's source and call it directly.
3. Add a bundler plugin or other static integration afterwards, and only as an optimization the core API does not depend on.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

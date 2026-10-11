---
id: policy.0006
title: Keep Bundler Integration at a Vite Plugin Subpath
status: active
established-by: pull-request.87
supersedes: []
---

# Keep Bundler Integration at a Vite Plugin Subpath

## Introduction

This policy is derived from development principle 3, _Runtime When Possible_, in `VISION.md`. A runtime-oriented package may gain a build integration, but only as an optional optimization of an API that works without it. This policy settles where that integration lives, so that a reader can see the boundary in the import path.

## The rule

A runtime-oriented package must put its bundler integration at a `/vite-plugin` subpath, and none of its other public entries may import a bundler, directly or transitively.

## Why this exists

When a package's root imports Vite, every consumer pays for Vite, including a test, a script, a service worker, or an app built with another bundler, and the runtime API quietly becomes dependent on the plugin. `@pitlane/assets` and `@pitlane/content` already follow this shape: the resolver and the content runtime import no bundler, and each Vite adapter lives at `/vite-plugin`. That is also what let the Rsbuild example use `@pitlane/assets/build` without Vite.

## What it applies to

- Applies to: every public subpath of a published `@pitlane/*` package other than `/vite-plugin`. A bundler here means Vite, Vite+, Rolldown, Rollup, esbuild, webpack, or Rspack.
- Does not apply to: packages named `@pitlane/vite-plugin-*`, whose stated purpose is build-time integration; or `./internal/*` subpaths, which are not public API.

## Enforcement

- Tier: check
- Mechanism: the Oxlint rule `pitlane/no-bundler-imports` in `tools/lint/pitlane.ts`, configured in the root `vite.config.ts` with the list of modules that make up each package's Vite plugin. Outside those modules it reports any bundler import, type-only included, and any import of a plugin module, which together keep the bundler out of every other entry transitively. `vp lint` runs it inside `vp check`, and the `Policies must hold` CI job runs it too.

## How to comply

1. Put Vite-specific code in the package's `/vite-plugin` entry, or in modules only that entry imports, and add those modules to the rule's `pluginModules` list.
2. When runtime code needs build output, accept it as data, as `createAssetResolver(manifest)` does, rather than importing the bundler to produce it.
3. Run `vp lint`.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

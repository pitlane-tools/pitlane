---
id: policy.0007
title: Decide Whether a Package Is Runtime-Oriented
status: active
established-by: pull-request.87
supersedes: []
---

# Decide Whether a Package Is Runtime-Oriented

## Introduction

This policy is derived from development principle 3, _Runtime When Possible_, in `VISION.md`. The principle exempts packages whose purpose intrinsically requires build-time integration, and that exemption is only as good as the decision to apply it. This policy settles when and where that decision is made.

## The rule

A proposal that adds a package or changes its behavior must state whether the package is runtime-oriented or exists to integrate with a build, and why.

## Why this exists

Starting from bundler or code-generation assumptions distorts an API, and the distortion is cheapest to prevent before the first line is written. Once a package's core depends on a plugin rewriting its call sites, separating the two is a breaking change. `@pitlane/theme` was designed runtime-first, so a future build optimization can stay optional. `@pitlane/vite-plugin-remix` is build-time by purpose and correctly does not maintain an artificial runtime version.

## What it applies to

- Applies to: proposals that add a package or change a package's behavior.
- Does not apply to: changes made without a proposal. Those still follow [policy.0006](0006-keep-bundler-integration-at-a-vite-plugin-subpath.md).

## Enforcement

- Tier: template
- Mechanism: the **Package placement** section of `.agents/templates/PROPOSAL.md` asks the question, and proposal review checks the answer against the detailed design.

## How to comply

1. Answer "Runtime or build-time" under **Package placement** in the proposal.
2. For a runtime-oriented package, design the core API and its tests to work without a bundler, and plan any build integration as an optional `/vite-plugin` subpath.
3. For a build-time package, name the build integration its purpose requires.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

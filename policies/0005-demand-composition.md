---
id: policy.0005
title: Demand Composition
status: active
established-by: pull-request.87
supersedes: []
---

# Demand Composition

## Introduction

This policy records the fifth of the development principles in `VISION.md`, which Pitlane shares with Remix 3. It settles where new behavior lives and what a package owes someone who installs it on its own.

## The rule

Keep every package single-purpose and useful and documented when installed directly without the `pitlane` umbrella, and attempt each new feature as a new package before adding it to an existing one.

## Why this exists

A composable abstraction is easy to add to an existing program and easy to remove from it. A package that grows a second purpose forces every application that wanted the first to take the second, and it couples changes that should ship separately.

Proposal 0005 is the worked example. Replacing the asset integration inside `@pitlane/dev` did not grow `dev`: asset resolution shipped as `@pitlane/assets` and the development request bridge as `@pitlane/vite-plugin-fetch-server`, both usable without Remix, and `@pitlane/dev` became `@pitlane/vite-plugin-remix`, which composes them.

The principle also names its own limit. Prerendering ships as `remix({ prerender })` rather than as a separate `@pitlane/prerender`, because it is the build plugin running the crawler and a separate package would have no purpose of its own.

## What it applies to

- Applies to: the boundary of every published `@pitlane/*` package, and the decision of where any new feature goes.
- Does not apply to: tightly coupled modules that almost always change together in both directions, which belong in the same package. Nor does it forbid explicit dependencies on Remix, a Pitlane capability contract, or a provider SDK, which are allowed when the package documents them.

## Enforcement

- Tier: prose
- Mechanism: proposal review and the excellence pass, which ask whether a change belongs in the package it touches.
- Prose justification: package boundaries and coupling are design judgements. No deterministic check can tell a single purpose from two.

## How to comply

1. For a new feature, first propose it as a new package. Say in the proposal why that is impossible if it is.
2. If it must extend an existing package, consider splitting that package first so the result stays single-purpose.
3. Give every package a README that explains how to install and use it directly with its `@pitlane/*` imports, and name any Remix, capability-contract, or provider SDK it depends on.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

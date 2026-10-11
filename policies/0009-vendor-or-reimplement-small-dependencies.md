---
id: policy.0009
title: Vendor or Reimplement Small Dependencies
status: active
established-by: pull-request.87
supersedes: []
---

# Vendor or Reimplement Small Dependencies

## Introduction

This policy is derived from development principle 4, _Avoid Dependencies_, in `VISION.md`, which expects most dependencies to be replaced by Pitlane code over time. It settles the cheapest case: a dependency whose used surface is small enough to own outright.

## The rule

When the part of a dependency Pitlane uses is small, vendor it with its license or reimplement it, rather than depending on the package.

## Why this exists

A small dependency carries most of the costs of a large one: its release schedule, its peer ranges, its install footprint, its supply-chain exposure, and its ideas about the API. Owning a few dozen lines costs little and removes all of those. The October audit found exactly this case in `vite-plugin-satteri`, a 78-line wrapper that pulled in `smol-toml` and a second copy of `yaml`, and recommended folding it into Pitlane.

## What it applies to

- Applies to: any third-party code a published `@pitlane/*` package uses at runtime or exposes in its types.
- Does not apply to: dependencies whose value is their size or their correctness work, such as a Markdown compiler (`satteri`), a YAML parser (`yaml`), or generated CSS types (`csstype`); a package another dependency already installs, so dropping it saves nothing, as the audit found for `magic-string`; or `devDependencies` and repository tooling.

## Enforcement

- Tier: prose
- Mechanism: the reason [policy.0008](0008-justify-every-third-party-dependency.md) requires in `.agents/dependencies.json` must say why the dependency is not vendored or reimplemented, and the reviewer checks it.
- Prose justification: whether a surface is "small" enough to own is a judgement about effort, risk, and maintenance. Line counts alone would misjudge a short but subtle parser.

## How to comply

1. Measure what the package actually uses from the dependency, not the dependency's size.
2. If that is small, copy it into the package with the upstream license notice and a note naming the source version, or rewrite it against Pitlane's own types.
3. Otherwise, record in the ledger why owning it is not worth it yet.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

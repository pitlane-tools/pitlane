---
id: policy.0015
title: Write Source Checks as Oxlint Rules
status: active
established-by: pull-request.87
supersedes: []
---

# Write Source Checks as Oxlint Rules

## Introduction

This policy governs how other policies are enforced rather than deriving from a principle in `VISION.md`. It extends `.agents/rules/enforcement-hierarchy.md`, which requires a rule to become a check wherever it can. It settles which kind of check to write: an Oxlint rule, or a module run by `vp run policies`.

## The rule

Write a check that inspects JavaScript or TypeScript source one file at a time as a TypeScript rule in the local Oxlint plugin, `tools/lint/pitlane.ts`, and write every other check as a `tools/policies` module.

## Why this exists

A source rule enforced by Oxlint reports where the author is working, in the editor and in `vp check`, with the file, line, and range of the offending code. The same rule written as a script reports later, from a separate command, and has to parse and walk the source itself. The reverse also holds: Oxlint sees one source file at a time, so a check over `package.json`, built declarations, Markdown, or the whole repository forced into a lint rule would need workarounds that make it harder to read and easier to break.

## What it applies to

- Applies to: new and changed checks that enforce a policy in this repository.
- Fits Oxlint: a rule that can decide from one source file's syntax, its imports, and the path of the file they resolve to, such as [policy.0006](0006-keep-bundler-integration-at-a-vite-plugin-subpath.md)'s bundler-import rule.
- Does not fit Oxlint: checks over package manifests and the dependency ledger, built output, Markdown and MDX, cross-file invariants that need the whole repository, and checks owned by another tool, such as TypeDoc's validation for [policy.0001](0001-document-every-public-export.md).

## Enforcement

- Tier: prose
- Mechanism: review of every change under `tools/lint/` and `tools/policies/`.
- Prose justification: whether a check fits a per-file lint rule depends on what it has to read. That is a design judgement no check can make.

## How to comply

1. Before writing a check, decide whether it can be answered from one source file. If it can, add a rule to `tools/lint/pitlane.ts`, configure it in the `lint` block of the root `vite.config.ts`, and end its messages with the policy id.
2. Otherwise, add a `tools/policies/<name>.ts` module exporting `check(root)`, with a `node:test` suite beside it, and add it to `tools/policies.ts`.
3. Name the mechanism in the policy's Enforcement section.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

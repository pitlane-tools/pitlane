---
id: policy.0004
title: Write Documentation That Stands Alone as Markdown
status: active
established-by: pull-request.87
supersedes: []
---

# Write Documentation That Stands Alone as Markdown

## Introduction

This policy is derived from development principle 1, _Model-First Development_, in `VISION.md`. Agents mostly read Pitlane's guides and READMEs as plain Markdown, either installed in `node_modules/pitlane` or as the `.md` export on pitlane.tools, with none of the site's interface. This policy settles how they are written so that nothing is lost on the way.

## The rule

Write every guide and package README so its Markdown is complete without the site: give every fenced code block its language, and never refer to the page's interface.

## Why this exists

The agent-readability review behind [PR #47](https://github.com/pitlane-tools/pitlane/pull/47) found two failures of this kind. Code that loses its language loses the one signal that tells an agent whether a block is TypeScript, shell, or configuration. And the prerendering guide told its reader that "the control at the top of the page chooses which setup this guide describes", a control that does not exist in the exported Markdown. PR #47 fixed the export pipeline. What remains is how authors write.

## What it applies to

- Applies to: pages under `docs/app/content/guides/`, `docs/app/content/deployment/`, and `docs/app/content/_partials/`, and every package `README.md`.
- Does not apply to: generated API pages under `docs/app/content/api/`, which [policy.0001](0001-document-every-public-export.md) covers through TSDoc, or internal documents under `docs/internal/`.

## Enforcement

- Tier: check for code-block languages, prose for the interface rule
- Mechanism: `tools/policies/code-fences.ts`, run by `vp run policies` in `vp run check` and in the `Policies must hold` CI job.
- Prose justification: a sentence that points at the interface can be phrased many ways. Reviewers catch it by reading the exported `.md`.

## How to comply

1. Open every fence with its language, for example `ts`, `sh`, `jsonc`, or `text` for output.
2. Describe a choice the page offers in words, and link to the alternative page rather than to a control.
3. Run `vp run policies`, and read the page's `.md` export once before submitting a new guide.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

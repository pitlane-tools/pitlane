---
id: policy.0001
title: Document Every Public Export
status: active
established-by: pull-request.87
supersedes: []
---

# Document Every Public Export

## Introduction

This policy is derived from development principle 1, _Model-First Development_, in `VISION.md`. It settles where an agent learns a package's API. Agents read the installed `.d.ts` files and their TSDoc, which is the API layer of the installed documentation ([decision.0002](../decisions/0002-installed-documentation-for-agents.md)), and the API reference on pitlane.tools is generated from the same comments.

## The rule

Every public export of a published package must carry a TSDoc summary, and every type its signatures name must itself be exported and documented.

## Why this exists

The agent-readability review behind [PR #47](https://github.com/pitlane-tools/pitlane/pull/47) found 14 reference pages with empty descriptions. It also found six types, among them `Content`, `ReferenceSchema`, and `Leaf`, that appeared in signatures but had no page of their own. An agent reading those signatures had nothing to go on but the names. PR #47 fixed every instance, but nothing stopped them from coming back: when this policy was written, 24 exported functions, interfaces, and methods had no comment.

## What it applies to

- Applies to: functions, classes, interfaces, type aliases, variables, and enums exported from any public subpath of a published `@pitlane/*` package, including the methods of exported interfaces.
- Does not apply to: exports under `./internal/`, or the individual properties of an exported type. A type that is deliberately internal may be listed in its package's `intentionallyNotExported` setting in `.typedoc/<package>.json`, and the reviewer checks that each such listing is justified.

## Enforcement

- Tier: check
- Mechanism: `.typedoc/base.json` turns on TypeDoc's `notDocumented`, `notExported`, and `invalidLink` validation and treats validation warnings as errors. `vp run docs:api` therefore fails on a gap. It runs inside `vp run check` and in the preview workflow on every push.

## How to comply

1. Write a summary for each new export that says what it does and when to use it, not one that restates its name. Add `@example` to an entry point a reader starts from.
2. Export and document any type that appears in a public signature.
3. Run `vp run docs:api` before submitting.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

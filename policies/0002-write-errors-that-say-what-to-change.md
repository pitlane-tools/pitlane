---
id: policy.0002
title: Write Errors That Say What to Change
status: active
established-by: pull-request.87
supersedes: []
---

# Write Errors That Say What to Change

## Introduction

This policy is derived from development principle 1, _Model-First Development_, in `VISION.md`. An error message is often the only documentation an agent reads in the middle of a task. This policy settles what it has to contain.

## The rule

An error thrown or reported by a public API must name the input or configuration that caused it and say what to change.

## Why this exists

An agent that hits an error retries with whatever the message suggests. "Invalid options" leads it to guess. A message that names the option, the value it got, and what is accepted leads it to the fix. Wrong instructions are worse than none: `@pitlane/content`'s errors once told users to import `@pitlane/content/vite`, a specifier the umbrella layout no longer let a strict package manager resolve, and that had to be fixed during the umbrella work ([decision.0003](../decisions/0003-umbrella-package.md)).

## What it applies to

- Applies to: errors thrown, rejected, or logged by public APIs of published `@pitlane/*` packages, including Vite plugin errors and build-time validation.
- Does not apply to: assertion failures for states the package's own invariants rule out, which indicate a Pitlane bug rather than a user mistake.

## Enforcement

- Tier: prose
- Mechanism: the code-quality inline review and the excellence pass. Tests that cover a failure assert on the parts of the message that carry the fix.
- Prose justification: whether a message tells a reader what to change is a judgement about its wording. No check can decide it.

## How to comply

1. Include the offending value or the option's name, and say what is accepted or what to do instead.
2. When the fix is an import or an option, give it exactly, for example `import { x } from "pitlane/content"`, and keep it in step with the package's current exports.
3. Cover each user-facing failure with a test that asserts on that information.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

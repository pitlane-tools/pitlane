---
id: policy.0003
title: Keep Version-Specific Guidance in Installed Documentation
status: active
established-by: pull-request.87
supersedes: []
---

# Keep Version-Specific Guidance in Installed Documentation

## Introduction

This policy is derived from development principle 1, _Model-First Development_, in `VISION.md`, and from the way Remix 3 gives agents its documentation, which Pitlane adopted in [decision.0002](../decisions/0002-installed-documentation-for-agents.md). It settles where guidance that depends on a Pitlane version may live.

## The rule

Put guidance that a release could make wrong only in documentation that ships with that release: guides, package READMEs, and TSDoc. Keep skills and `AGENTS.md` lines limited to the mental model and to where the installed documentation is.

## Why this exists

An agent believes whatever it reads first. A skill or an `AGENTS.md` line that names an API is copied into apps once and then drifts from every later release, while the installed `pitlane` package always describes the version the app has. Remix 3 works this way: its skill holds only the mental model and how to search `node_modules/remix/INDEX.md`. Vercel's Next.js evaluation, cited in decision.0002, found that a passive pointer to installed documentation outperformed a skill holding the documentation.

## What it applies to

- Applies to: Pitlane-maintained skills, the `AGENTS.md` guidance in target templates, and any other agent-facing guidance outside the installed package.
- Does not apply to: this repository's own `.agents/` process guidance, which describes how Pitlane is developed rather than how its API is used.

## Enforcement

- Tier: prose
- Mechanism: review of every change to a Pitlane-maintained skill or template `AGENTS.md`.
- Prose justification: whether a sentence names something a release could change is a judgement about its content. No check can decide it.

## How to comply

1. When a skill or `AGENTS.md` line needs an API detail, move the detail into a guide or README and point to it.
2. Write the pointer to the installed copy (`node_modules/pitlane/INDEX.md`), not to pitlane.tools, which describes the latest deploy.
3. Tell the agent to prefer installed documentation over the skill and over its own memory when they disagree.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

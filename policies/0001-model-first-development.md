---
id: policy.0001
title: Model-First Development
status: active
established-by: pull-request.87
supersedes: []
---

# Model-First Development

## Introduction

This policy records the first of the development principles in `VISION.md`, which Pitlane shares with Remix 3. It settles who Pitlane's source, documentation, tooling, and abstractions are written for: language models are a primary reader and user of all of them, alongside people.

## The rule

Write every source file, document, tool, and public API so that a model can understand and use it correctly from what is checked in or installed, without context that exists only in a conversation or a person's head.

## Why this exists

Most code written against Pitlane will be written or changed by an agent, and an agent knows only what it can read. Behavior that depends on a magic global, a hidden configuration file, an unwritten convention, or a documentation site for a different version is behavior an agent will guess at, and its guesses end up in applications.

That cost is why Pitlane prefers explicit adapters to magic imports, keeps provider configuration checked in rather than generated, and ships documentation inside the `pitlane` package so it matches the installed version ([decision.0002](../decisions/0002-installed-documentation-for-agents.md)).

## What it applies to

- Applies to: package source and public types, TSDoc comments, guides, READMEs, error messages, repository tooling, target templates, and Pitlane-maintained skills.
- Does not apply to: the product direction, also in the principle, of building abstractions that let applications use models at runtime. That is a roadmap item tracked in `VISION.md`, not a rule a single change can comply with.

## Enforcement

- Tier: prose
- Mechanism: proposal review, the excellence pass, and the cross-artifact review, which read a change the way an agent arriving cold would.
- Prose justification: whether a reader without the conversation can use an API correctly is a judgement about clarity. No deterministic check measures it.

## How to comply

1. Make configuration and dependencies explicit at the call site. Do not rely on globals, filename conventions, or generated state a reader cannot find.
2. Document every public export in TSDoc, since `docs/app/content/api/` is generated from it, and write a guide for any user-visible behavior.
3. Make errors name what went wrong and what to do about it.
4. Before submitting, read the change as a reader who never saw the conversation that produced it, and fix anything that reader would have to guess.

## Revision history

| Date       | Change                   | Proposal        |
| ---------- | ------------------------ | --------------- |
| 2026-10-10 | Established this policy. | pull-request.87 |

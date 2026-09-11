---
id: policy.<NNNN>
title: <Title Case>
status: draft
established-by: proposal.<NNNN>
supersedes: []
---

# <Title Case>

<!--
Delete this instruction and replace every <placeholder>. A policy records one durable
rule for future work. Keep it narrow enough to enforce and clear enough to apply
without reconstructing the pull-request discussion that created it.
-->

## Introduction

<!--
Give a short description of this policy's purpose. Name the recurring decision it
settles and the protected outcome. This orients a reader before they encounter the
rule itself; it is not a history of the proposal that established the policy.
-->
<The purpose of this policy.>

## The rule

<!--
State one imperative sentence. Use “must,” “must not,” or another direct instruction
that an author can follow. If the rule takes a paragraph to state, it is probably two
policies and should be split before it becomes hard to enforce.
-->
<Imperative rule.>

## Why this exists

<!--
Describe the failure, cost, or repeated ambiguity that motivated the rule. Give a
concrete example when one is available. A policy whose motivating failure cannot be
named is a preference; explain why the preference must become a durable constraint.
-->
<Failure or cost this policy prevents.>

## What it applies to

<!--
State the work, artifacts, conditions, and exceptions covered by this rule. Also
state explicitly what it does not apply to. Boundaries prevent later readers from
extending a policy beyond the failure it was created to prevent.
-->

- Applies to: <work, artifacts, or conditions>
- Does not apply to: <explicit exclusion>

## Enforcement

<!--
Name the enforcement tier from .agents/rules/enforcement-hierarchy.md: check, task,
template, or prose. Describe the mechanism that enforces this rule and who runs or
uses it. If the tier is prose, justify why the rule could not be enforced as a check.
Choose the strongest practical tier rather than documenting an unenforced preference.
-->

- Tier: <check | task | template | prose>
- Mechanism: <command, task, template, or instruction>
- Prose justification: <why a check cannot enforce this rule, if tier is prose>

## How to comply

<!--
Give the concrete steps an author takes before submitting work. Link to the required
artifact, command, or workflow when useful. A reader should be able to comply without
inventing a local convention or searching through the proposal that created the rule.
-->

1. <First action.>
2. <Required verification or artifact.>
3. <Escalation or exception procedure, if any.>

## Revision history

<!--
Record each substantive change after the policy is established, including a link to
the proposal that changed it. Start with this policy's establishment. Keep the table
in chronological order so a future reader can reconstruct the rule's evolution.
-->

| Date         | Change                   | Proposal        |
| ------------ | ------------------------ | --------------- |
| <YYYY-MM-DD> | Established this policy. | proposal.<NNNN> |

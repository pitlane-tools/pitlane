---
name: tracking-defects
description: Use when a defect discovered during a proposal or pull request may be legitimate future work outside the current proposal. Do not use to defer promised work.
---

# Tracking Defects

Defects can surface during Proposal, Implementation, automated validation, adversarial review, or human review. Record durable, out-of-scope defects as GitHub issues.

## The decisive test

A defect that prevents the current implementation from satisfying its proposal is current work. Normally fix it before the PR is accepted.

**Primary anti-pattern:** Never file an issue to defer work the proposal already requires.

Create or reuse an issue only when the defect is outside the proposal's scope, already exists on the default branch, affects another change or repository, or is otherwise legitimate future work.

## Search before creating

Check open **and** closed issues before creating anything. Duplicates are the second failure mode.

```sh
gh issue list --state open --limit 100 --search '"<symptom or behavior>" in:title,body'
gh issue list --state closed --limit 100 --search '"<symptom or behavior>" in:title,body'
```

Search by observable symptom, affected area, and reproduction. Reuse the applicable open issue. Reopen a closed issue when the same defect is present again; create a linked successor only for a materially distinct recurrence.

## Write an issue that stands alone

A future reader has no access to the conversation. Include:

- Concise incorrect and expected behavior.
- Reproduction steps or a minimal reproduction when available.
- Relevant environment or version information.
- Useful links to the proposal, PR, test, or code where it was found.
- Known constraints, suspected causes, and related defects.
- Why it is outside the current proposal's scope.

```sh
gh issue create --title "Reject malformed import records" --label bug --body-file - <<'EOF'
## Description
Malformed import records are accepted instead of rejected.

## Expected behavior
The import rejects malformed records with a validation error.

## Actual behavior
The import accepts the record and defers validation.

## Reproduction
1. Run `<command>` with `<minimal malformed record>`.
2. Observe successful import.

## Context
Discovered under proposal.<NNNN> in PR #<number>. This is out of scope because <reason>. Environment: <version>. Related: <link or none>. Suspected cause: <cause or unknown>.
EOF
```

Apply the repository's existing labels, types, milestones, projects, parent issues, and dependency relationships when those conventions exist.

## Preserve the path to resolution

When an out-of-scope defect is relevant to the current PR and deliberately deferred, link the issue from the PR or a review comment. The deferral must be explicit and durable.

If later work fixes it incidentally, update or close the issue with the PR or commit that resolved it. Never leave it stale.

## Red flags

- Filing an issue for work the proposal requires.
- Filing without searching existing open and closed issues.
- An issue body that only makes sense to someone who read the chat.
- Deferring a defect without linking it from the PR.
- Closing a PR with discovered defects neither fixed nor filed.

Any of these means stop and repair the record.

## Related skills

- `reviewing-an-implementation` — lists linked, deliberately deferred defects for human review.

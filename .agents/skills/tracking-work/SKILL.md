---
name: tracking-work
description: Use when finding ready work, claiming or closing a task, recording a defect discovered during a proposal or pull request, deciding whether discovered work is in scope or should be deferred, handing off across sessions, or deciding between a local checklist and durable project tracking.
---

# Tracking Work

Beads (`bd`) is the project's work graph: ready work, blockers, discovered follow-ups, and durable memory. A local checklist tracks the current turn's execution. It is not project state, and it does not survive a context reset.

## Start

```sh
bd prime     # workflow context and persistent memories
bd ready     # what can be started now
bd show <id> # read an item before touching it
```

If `bd prime` prints nothing, check `bd where` for an active workspace.

## The decisive test

**A defect that prevents the current implementation from satisfying its proposal is current work. Fix it.**

Filing an item to defer work the proposal already requires is the primary failure of this skill. Create or reuse an item only when the work is outside the proposal's scope, already present on the default branch, belongs to another feature or repository, or is otherwise legitimate future work that must outlive this pull request.

## Search before creating

Duplicates are the second failure.

```sh
bd search "<symptom keyword>" --status open,in_progress,blocked,deferred,closed --limit 0
bd list --desc-contains "<symptom keyword>" --status open,in_progress,blocked,deferred,closed --limit 0
```

`bd search` matches titles and IDs; `bd list --desc-contains` reaches the body text a title never mentions. Name every state: a claimed, blocked or deferred item is still a duplicate, and a narrower `--status` hides it. `--limit 0` lifts the 50-result default, which otherwise drops matches status-blind — the duplicate you miss is the one past the cut.

Search by observable symptom, affected area, and reproduction. Reuse the applicable open item. Reopen a closed one when the same defect returns; create a linked successor only for a materially distinct recurrence.

## Write an item that stands alone

A future reader has no access to this conversation. Include the incorrect behavior, the expected behavior, reproduction steps or a minimal reproduction, relevant environment or version information, links to the proposal, PR, test, or code where it was found, known constraints and suspected causes, and why it is outside the current proposal's scope.

```sh
bd create "Import accepts malformed records" \
  --type=bug --priority=1 \
  --description="Expected: the import rejects malformed records with a validation error. Actual: the record is accepted and validation deferred. Repro: run the import with a record missing its identifier. Found under proposal.0007 in PR #42; out of scope because that proposal does not change import validation."
```

Priorities are `0`–`4`, `0` highest, default `2`. Apply the project's existing types and labels. Link a blocking relationship so `bd ready` stays honest about what can actually be started.

## Claim, close, remember

```sh
bd update <id> --claim          # atomic; claim before starting
bd close <id> --reason="Fixed in PR #42"
bd remember "<durable project fact>"
```

Close only when the work is actually done. If later work fixes a deferred defect incidentally, close it with the PR or commit that resolved it rather than leaving it stale.

Durable knowledge — a constraint learned the hard way, a decision too small for a record and too costly to rediscover — goes in `bd remember`, never in a markdown memory file.

## Preserve the path to resolution

When a deferred defect is relevant to the current pull request, link its item from the PR or a review comment, and list it under **Defects discovered and deferred** in the readiness report. The deferral must be explicit and durable.

## Rules

- Never run `bd edit`; it opens an interactive editor and hangs a non-interactive agent. Use `bd update` flags.
- Never run `bd hooks install`; hk owns the git hooks and runs `bd hooks run <hook>` as a step.
- Use `--json` when parsing output programmatically.
- Never create a markdown TODO file as the source of truth.

## Red flags

- Filing an item for work the proposal requires.
- Filing without searching every state, including claimed, blocked, deferred and closed items.
- An item body that only makes sense to someone who read the chat.
- Deferring a defect without linking it from the PR.
- Closing a PR with discovered defects neither fixed nor filed.
- Claiming an item you are not about to start, or closing one that is not done.

Any of these means stop and repair the record.

## Related skills

- `reviewing-an-implementation` lists linked, deliberately deferred defects for the readiness report.
- `systematic-debugging` finds root cause before a defect is either fixed or described accurately enough to file.

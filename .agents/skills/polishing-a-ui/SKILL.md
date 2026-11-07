---
name: polishing-a-ui
description: Use when the human is refining how an interface looks or is operated (layout, spacing, sizes, type, color, motion, controls, wording), whether during implementation, during human review, or between proposals, or asks to make a screen look or feel right.
---

# Polishing a UI

Look and feel — how an interface looks and how it is operated — is decided by the human on the running UI, not in a proposal. Polish is that loop: the human looks, asks, and looks again. Keep the loop fast, and notice when a request stops being polish.

## What counts

| Look and feel: polish | What the feature does: proposal path |
| --- | --- |
| Layout, sizes, spacing, type, color, icons, motion | What a user can do or find out |
| Which control presents a choice; what activating an element opens | States and outcomes the user observes |
| Wording of labels and messages | What a message must tell the user; words that are themselves a requirement |
| How a screen meets an accessibility commitment | The commitment itself |
| A command-line tool's colors, alignment, progress display, help wording | Its commands, flags, exit codes, machine-readable output |

The test: would the sentence change if the screen were redesigned while the feature did the same thing? A change that removes something a user could do or find out is never polish. When a request could be either, ask the human which it is in one line before acting.

A look-and-feel detail an earlier proposal happens to pin, such as a window width or a button's color, is still polish. Change it and leave the proposal alone; it is the history of what was decided then.

## The loop

1. Get the interface running where the human can see it — a development server, a simulator or installed build, or the pull-request preview — and keep it current after every change.
2. Make one change, or one small coherent set, at a time. Say what changed and where to look.
3. When the human is weighing options, show them rather than describe them.
4. The human keeps or reverts each change. Continue until they are satisfied.
5. Commit kept changes at natural points. The message names what changed and, when it is not obvious, why.

Outside an approved proposal, suggest look-and-feel changes but make only the ones the human directs.

## Keep the other representations true

- `mise run check` passes before every push.
- A test that breaks because it asserted look and feel is rewritten to assert behavior, never re-pinned to the new look. A behavior assertion is never weakened.
- Update any guide that names, shows, or places an on-screen element you changed.
- Never break an accessibility commitment or a platform requirement.
- When the human applies the same rule repeatedly, such as a spacing scale, a type ramp, or sentence-case labels, suggest recording it as a policy. Record it only after discussing it with them.

## Landing it

| Where | What happens |
| --- | --- |
| A proposal being implemented or in `active-review` | Commits on its branch, then a refreshed preview. No proposal edit, no status change, no readiness report, no adversarial review. |
| Between proposals | No proposal question. Land it the way the project lands other changes made without a proposal: a branch and pull request with a changeset where the project works through pull requests, otherwise commits. Say which in one line. |

## When a request changes what the feature does

Stop on that request and keep polishing the rest. In review, it goes through the proposal first, after the human returns the work with `returned-for-revisions`. Between proposals, ask the human whether they want a proposal for it.

## Red flags

| You are about to | Instead |
| --- | --- |
| Edit a proposal to record look and feel | Commit the code; the running UI is the record |
| Change a status or post a readiness report for a polish round | Push, refresh the preview, and say what changed |
| Ask "Do you want a proposal?" for spacing, color, a control, or wording that is not a requirement | Make the change |
| Change words a proposal makes a requirement (legal text, text a user types or matches, a fixed term) | Treat it as what the feature does: take the proposal path |
| Polish without a running UI the human can see | Start one first |
| Update a test's expected color, size, or label to match the new look | Rewrite the test to assert behavior |
| Call a change to what a user can do "polish" | Stop and take the proposal path |

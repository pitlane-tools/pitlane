---
name: completing-a-feature
description: Use after a human has reviewed a pull request and the accepted change needs integration, release, and cleanup. Do not use before human review.
---

# Completing a Feature

**Phase 5.** Complete work in this order: **process feedback → record policies and decisions → update the vision → merge → release when the human asks → dependent-repo updates → cleanup**.

Some work reaching this phase has no proposal, because the human declined one. Then the agreed request and pull-request scope is what completion is measured against, every step below that sets a proposal status is skipped, and none of them is a reason to write a proposal after the fact.

## 1. Process feedback

Read the human's PR comments and direct commits before acting. Classify each item:

| Feedback changes | Action |
| --- | --- |
| The implementation | Fix it, then rerun the affected implementation loop and review evidence. |
| Intended design | Update the proposal first with the human, then rerun tests → guides → code → quality gates → review against the revision. |

Never encode a design change in code, tests, or guides while leaving the proposal stale.

While revisions are outstanding, the proposal is `returned-for-revisions`, which the human sets when requesting changes. Return to Phase 2 for a design revision or Phase 3 for implementation. If reworking the design reopens a question, record a clarification marker — `returned-for-revisions` is exempt from the marker rule so honest rework remains possible. At the end of Phase 3, hand off to `reviewing-an-implementation`, which alone owns the coupled status, readiness-report, and pull-request transition. Do not set proposal status when reposting.

## 2. Record policies and decisions

After feedback establishes the feature's final shape, record only knowledge that outlives its proposal.

**The usual answer is that there is none.** Most features establish no policy and no decision, and recording nothing is the correct outcome rather than a step you skipped. Empty `policies/` and `decisions/` directories are healthy. A record written because the phase has a slot for it is one nobody follows and everybody has to read.

| Record   | Distinguishing test                                                              |
| -------- | -------------------------------------------------------------------------------- |
| Policy   | It constrains future work: “always or never do X.”                               |
| Decision | It explains a choice future work must understand: “we chose X over Y because Z.” |

If it does not outlive this proposal, it belongs in the proposal and nowhere else.

Before recording either:

1. Discuss it with the human. Neither is an agent-only conclusion.
2. Confirm the originating proposal id.
3. Use the canonical template. Both records carry `established-by: proposal.<NNNN>`.

### Enforce policies first

A policy that can be enforced by a check **must** be. Before writing prose, try to express it as a validator rule, continuous-integration step, or template section, per `.agents/rules/enforcement-hierarchy.md`.

Keep prose for judgment a deterministic check cannot decide. Prose policies are the ones that rot.

### Supersede; never rewrite history

Never edit a policy or decision into a different meaning. Never delete one.

1. Write a new record with `supersedes: [<old id>]`.
2. Set the old record's `status: superseded`.
3. Preserve the old rationale and link.

The validator enforces the pairing. A correction that does not change meaning may amend the existing record; a changed rule or rationale requires supersession.

## 3. Update the vision

Reread `VISION.md` at the repository root. Update it when the accepted change alters the project's capabilities, MVP, or direction. Bump `updated` to the current date — `mise run validate` requires `title` and an `updated` of the form `YYYY-MM-DD`.

A release is the event that makes the vision wrong, and never in only one place. `.agents/skills/releasing-pitlane-packages/SKILL.md` § “1. Bring VISION onto this PR — before the merge” tabulates every location a publish makes stale, plus the package-specifier rule and the rationalizations for skipping the check. Work through that table rather than the one place you remember. The edit belongs on the branch, before the merge, so the merge carries it — which is why this step precedes the next one.

Consult the human before a substantial rewrite. Do not turn a narrow completion change into a new vision exercise.

## 4. Merge

Merge only after human acceptance. Preserve the record of what was proposed, what was implemented, why decisions were made, what review found, and how the final state differs from earlier revisions.

The history shows both strategies, and the split is deliberate. Squash is the common case: `a4f462e crawler: static prerendering (#6)` and `2617cd3 chore: move every package onto remix@3.0.0-rc.1 (#12)` each have one parent. `c97d28a theme: schema-tree authoring, replacing the DTCG document (#9)` has two, and its body says why: “Merged rather than squashed. Each commit records a design decision or a defect found while implementing, and the branch is being pruned, so the history lives here.” `git show --no-patch --format=%p <commit>` tells them apart — one hash for a squash, two for a merge. `.agents/skills/releasing-pitlane-packages/SKILL.md` § “2. Land the PR so the intent outlives the branch” owns the choice. Either way, do not leave the reasoning only on a branch that is about to be pruned.

The human sets `accepted` when they accept the work. Set `implemented` only after it is merged **and** released — not before, because an unshipped proposal marked implemented misrepresents the record. Accepted, merged, and unreleased is a normal resting state here rather than a step someone skipped: the changeset note sits in `.changeset/` until the human asks for a version, the proposal stays `accepted`, and the completion report says exactly that — the behavior is on `main`, the release is pending. Never manufacture a release to clear a status, and never report one that has not happened.

## 5. Release — only when the human asks

Merging does not begin a release, and pending changesets do not accumulate into one. What the merge must carry is the capture: a changeset note under `.changeset/` for every package whose consumers see a difference, naming those packages and the semver level, written with `mise run changeset` and committed under the scope of the work it describes. Nothing on the branch edits a `version` field or writes a `CHANGELOG.md` section — preparation generates both, later, and only on request.

When the human does ask, `.agents/skills/releasing-pitlane-packages/SKILL.md` is the ordered procedure: review the `mise run changeset:status` plan with them, dependent bumps included, then prepare the version, tag it, and cut the release. Follow it rather than reconstructing it. A release is a Git tag plus a published GitHub release on `main`. That release event is the only trigger of `.github/workflows/publish.yml`, so nothing else ships a version — never a branch tag, never `changeset publish`, never `npm publish` for a package that already exists. A package the starter templates depend on also needs `.agents/skills/adopting-packages-into-templates/SKILL.md`: the package publishes first, then the templates branch merges. A package's **first** publish cannot go through the workflow at all and is performed by hand, exactly once, from a laptop.

**Never publish without explicit human confirmation.** Approval to merge is not approval to release, and a request to prepare a version is not approval to publish it.

## 6. Update dependent repositories

A dependent's preview dependency is a `pkg.pr.new` URL — or a tarball override — in its manifest. Replace it with the published range everywhere it appears, lockfile included, and mark the PR ready only after CI is green against the published package rather than against the preview it used to install. `.agents/skills/releasing-pitlane-packages/SKILL.md` § “4. Move dependents onto the published version” lists the edits each dependent needs and the npm propagation and release-age gates that make an early move fail.

## 7. Clean up

After release and dependent updates, remove temporary files, tear down preview configuration and published prerelease artifacts, and prune the feature branch locally and remotely.

> **Explicit human confirmation required:** Branch deletion, force-push, and tearing down published prerelease artifacts are the most destructive operations in this process. Ask before any of them, even when cleanup appears routine.

Cleanup runs when confidence is highest. Treat it as a separate destructive operation, not an automatic epilogue.

## Red flags

- You fixed a design-change comment without revising the proposal.
- You ignored a direct human commit.
- You recorded a policy or decision without the human.
- You wrote a prose policy before checking whether automation can enforce it.
- You changed an old policy or decision's meaning in place.
- You merged without preserving why the final state differs.
- A package's consumers see a difference and no changeset note describes it.
- You edited a version or hand-wrote a changelog entry instead of writing a note.
- You reported work as released, or set `implemented`, while its version is still pending.
- You wrote a proposal at completion for work the human declined one for.
- You released because the PR merged.
- A dependent PR still uses a preview version after release.
- A preview or prerelease artifact outlives its PR.
- You deleted a branch, force-pushed, or tore down a published prerelease artifact without explicit human confirmation.

Any of these means stop and return to the relevant ordered step.

## Related skills

- `reviewing-an-implementation` — produces the preview and readiness record consumed during human review.

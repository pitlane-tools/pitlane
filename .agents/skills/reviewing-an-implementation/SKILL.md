---
name: reviewing-an-implementation
description: Use when an implemented proposal has fresh validation evidence and needs its self-check, independent refutational review, human-exercisable preview, and ready-for-review handoff.
---

# Reviewing an Implementation

**Phase 3 — Implementation.** Check the work against the proposal, have an agent without your context try to break it, then hand it to the human. This procedure does not decide whether the human accepts the work.

Begin after applicable validation has fresh evidence under [`.agents/rules/verification.md`](../../rules/verification.md). Proceed in this order:

1. Self-check.
2. Dispatch [`adversarial-review`](../adversarial-review/SKILL.md); consume its report.
3. Produce the preview.
4. Post the readiness report and make the pull request ready together.

## 1. Self-check

Read the proposal, the changed tests, the affected guides, and the diff together. For each observable behavior in Detailed design — including boundary cases, errors, defaults, and side effects that could disagree — confirm that it is tested, described where a user would look when it is user-facing, and implemented. Then look the other way: anything implemented that the proposal and guides do not describe is scope creep or a gap in the proposal.

Then ask whether this is the implementation that should remain. Does its structure fit the domain the proposal describes, or does it leak implementation conveniences into a package's public surface? Is there a simpler realization that expresses the proposal better, or complexity inherited from the baseline that no longer earns its place?

Resolve each disagreement in exactly one way:

| Resolution | Use when | Action |
| --- | --- | --- |
| Fix the wrong artifact | Intent has not changed | Correct the tests, guides, or code, and rerun the affected gates. |
| Revise the proposal | Intent or scope changed | Discuss with the human first, then derive the affected artifacts again. |
| Record the divergence | It remains deliberate for human review | Name the behavior, sources, impact, and reason in the readiness report. |

You may edit tests, guides, and code. You must not revise a proposal without the human.

## 2. Independent review

Dispatch the `adversary` agent: fresh context, and a different model by virtue of its role in `.omp/config.yml`. Give it the proposal, the commit range, and the commands that verify the work. Tell it to try to show the work is not done — behavior missing or wrong relative to the proposal, edge cases the tests miss, invariants covered only by examples, tests that would still pass with a broken implementation, security or data-loss risks — to confirm findings by running code, to ignore style, naming, and formatting, and to report without editing.

Do not replace this dispatch with your own review. Consume its report:

| Report item | Response |
| --- | --- |
| Confirmed defect inside the proposal's scope | Fix it and refresh the affected evidence. Run the review once more only when the fix was substantial. |
| Suspicion | Verify it or drop it; never fix it blind. |
| Proposal gap | Surface it to the human; do not silently choose an interpretation. |
| Finding outside the proposal's scope | Never widen the change to fix it. Decline it with reasoning, or file it through [`tracking-work`](../tracking-work/SKILL.md). |
| Declined finding | Preserve it with reasoning for the readiness report. |

A disputed finding does not disappear because you decline it.

## 3. Produce the preview

A preview is **the cheapest realistic artifact through which the human can exercise the changed behavior.**

| Requirement | Meaning                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| Cheapest    | Do not stand up production infrastructure merely for review.              |
| Realistic   | Do not substitute screenshots, transcripts, or descriptions for behavior. |

Reviewing prose is not reviewing behavior. This repository has exactly two mechanisms, and both already run in CI on every push to a branch other than `main`:

| What the change touches | Preview |
| --- | --- |
| A package's behavior | the pkg.pr.new build: `npm i https://pkg.pr.new/pitlane-tools/pitlane/@pitlane/<name>@<sha>` |
| The docs site, or any guide | the Workers preview URL that `preview.yml` comments on the pull request |

So this step confirms rather than builds: install the package build in an empty directory, or open the preview URL, exercise the changed behavior there, and link it with what to try. A green workflow is not evidence, per [`.agents/rules/verification.md`](../../rules/verification.md). A change touching both surfaces links both; a pure refactor with no exercisable surface produces no preview, and the readiness report says so plainly rather than fabricating one.

A pkg.pr.new build is installable by anyone with the URL, and the Workers preview version is reachable, so neither is private — but neither is a release either. Keep the preview's lifetime tied to the pull request.

## 4. Report readiness and mark ready

Compose the pull-request comment from [`.agents/templates/READINESS_REPORT.md`](../../templates/READINESS_REPORT.md). Fill every template section and add the self-check's recorded divergences and their resolutions.

| Report section | Required content |
| --- | --- |
| Proposal | State `FULLY` implemented only when every promised behavior exists. For `PARTIALLY`, name completed and omitted behavior, limitations, and reason. Silent partial implementation is not allowed. |
| What was built | Delivered behavior, not internals. |
| How to exercise it | The preview install command or URL, or an honest absence, plus setup, actions, and expected results. |
| Validation performed | Every command actually run in this session and its observed result, per `.agents/rules/verification.md`. Never report an unrun gate as passing. |
| Adversarial findings adopted | Each accepted or fixed finding, or `- None.` |
| Adversarial findings declined, with reasoning | Every declined finding and why it was declined, or `- None.` This section is always present. |
| Defects discovered and deferred | Each deliberate, out-of-scope defect as a linked Beads item from `tracking-work`, or `- None.` |
| Remaining limitations | Known behavior gaps or `- None.` |
| What to look at first | The first behavior, preview action, or diff the human should inspect. |

Declined adversarial findings keep the independent review useful. Do not quietly omit a narrow, uncomfortable, or disputed finding.

### Posting the comment

This repository configures no service account, so post from the authenticated `gh` identity and say so in the report: `Posted from <identity>; no service account is configured.` Do not imply bot authorship.

```sh
gh pr comment <pr-number> --body-file readiness-report.md
gh pr ready <pr-number>
```

### Make the coupled transition into Phase 4

At the end of Phase 3, these three actions form one transition and MUST NOT be separated:

1. Move the proposal to `status: active-review`.
2. Post the readiness report.
3. Flip the pull request from draft to ready with `gh pr ready <pr-number>`.

Work for which the human declined a proposal has no status to set: post the report and mark the pull request ready without inventing one. Do not leave the proposal, report, and pull-request state disagreeing. Ready means the work is human-reviewable, not correct or accepted. Never set `accepted`; only the human may do so in Phase 4, which starts Phase 5 completion.

## Red flags

- Your self-check reviewed style instead of comparing the proposal, tests, guides, and code.
- A disagreement between them has no recorded resolution.
- You widened the change to fix a finding outside the proposal.
- You changed proposal intent without the human.
- You skipped independent adversarial review or dropped a declined finding.
- The preview is fabricated, detached from the pull request, or a bare URL.
- The report claims a validation gate you did not run.
- You marked the pull request ready without the proposal status and report.

Correct the record before handoff.

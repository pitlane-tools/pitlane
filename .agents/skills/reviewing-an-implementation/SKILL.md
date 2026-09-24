---
name: reviewing-an-implementation
description: Use when an implementation has fresh validation evidence and needs its Phase 3 comparison, independent refutational review, human-exercisable preview, and ready-for-review handoff. The contract may be an approved proposal or the agreed request and pull-request scope when the human declined a proposal.
---

# Reviewing an Implementation

**Phase 3 — Implementation.** Compare the independent representations before asking a human to review the changed behavior. This procedure owns the confirmatory review, adversarial dispatch, preview, and readiness handoff. It does not decide whether the human accepts the work.

## Inputs and order

Read these together before review. Add the current vision, policies, and decisions when they constrain the change.

| Input | Read |
| --- | --- |
| Intent | Current proposal, or the agreed request and pull-request scope when the human declined one |
| Executable behavior | Changed tests |
| Human-facing behavior | Affected guides |
| Concrete behavior | Implementation |

Proceed in this order:

1. Cross-artifact review.
2. Dispatch `adversarial-review`; consume its report.
3. Produce the preview.
4. Post the readiness report and make the pull request ready together.

Begin after applicable validation has fresh evidence under `.agents/rules/verification.md`, and after the excellence pass and the ordered inline reviews in `implementing-a-proposal` have no open findings. A substantive fix made here re-enters those gates before the cross-artifact review runs again.

## 1. Cross-artifact review

This is a comparison of representations, not a code-quality review. Build a behavior inventory before judging alignment.

### Build the behavior inventory

Use one row per observable behavior. The four evidence columns are proposal, tests, guides, and code. Tick a source only when it explicitly covers the behavior. Investigate every row that is not fully ticked.

| Behavior                 | Proposal | Tests | Guides | Code |
| ------------------------ | -------- | ----- | ------ | ---- |
| Reject malformed records | ✓        | ✓     | ✓      | ✓    |
| Preserve input order     | ✓        | ✓     | —      | ✓    |

Keep boundary cases, errors, defaults, and observable side effects as separate rows when they can disagree. Do not tick a source because it probably implies the behavior.

### Make all six checks

For every inventory row, establish all of these:

1. Tests cover what the proposal promises.
2. Guides describe what the tests exercise.
3. Code implements what the proposal and guides describe.
4. No documented behavior is missing from the implementation.
5. No implemented behavior is absent from the proposal and guides — this catches scope creep.
6. Implementation details have not silently changed scope or intent.

### Confirm the release note

When the change alters what a package's consumers see, `.changeset/` on this branch holds a note for it: the right package names, a semver level the behavior justifies, and prose someone deciding whether to upgrade can read. A missing note is a gap like any other row, and so is one that names the wrong packages or understates the level. A branch that bumped a `version` field or wrote a `CHANGELOG.md` section instead is itself the finding; preparation generates both, on request, and not here.

That note is what a future release would ship. It is not a release, and nothing in the review describes the change as released or versioned.

### Resolve every gap

Each non-full row resolves in exactly one way.

| Resolution | Use when | Action |
| --- | --- | --- |
| Fix the wrong artifact | Intent has not changed | Correct the tests, guides, or code, then recheck the row. |
| Revise the proposal | Intent or scope changed | Discuss with the human first. Then derive affected tests, guides, and code again. |
| Record the divergence | It remains deliberate for human review | Name the behavior, affected sources, impact, and reason in the readiness report. |

You MAY edit tests, guides, and code to remove a disagreement. You MUST NOT revise a proposal without the human; that is a design change.

Record the inventory, each gap, and its resolution. `ALIGNED` requires a fully ticked inventory. A record with deliberate gaps is `DIVERGENCES RECORDED`; a human design decision is `REVISION REQUIRED`.

## 2. Dispatch and consume adversarial review

Dispatch a separate subagent with fresh context for the `adversarial-review` skill. Pitlane does not vendor that skill; it is dispatched by name and the harness supplies it at user level. Use the strongest available portability rung: different model family, then different model, then a fresh-context run. Supply the current proposal, tests, guides, and implementation. The adversary reports only; it never edits the artifacts.

If the harness does not provide the skill, the dispatch contract in this section is the whole requirement: a fresh-context subagent on the strongest available different model, given the proposal, tests, guides, and implementation, reporting only, looped until its verdict is `CONVERGED`, with declined findings preserved for the readiness report.

Do not replace this dispatch with your own review. The adversary attacks un-enumerated edges, test quality, interpretation, security surface, and proposal gaps from a refute-by-default stance.

Consume its report before continuing:

| Report item      | Response                                                                  |
| ---------------- | ------------------------------------------------------------------------- |
| Confirmed defect | Fix it, refresh affected evidence, and repeat the required review stages. |
| Suspicion        | Verify it or drop it; never fix it blind.                                 |
| Proposal gap     | Surface it to the human; do not silently choose an interpretation.        |
| Declined finding | Preserve it with reasoning for the readiness report.                      |

Repeat the adversarial stage after a defect fix. Continue until its verdict is `CONVERGED`. A disputed finding does not disappear because you decline it.

## 3. Produce the preview

A preview is **the cheapest realistic artifact through which the human can exercise the changed behavior.**

| Requirement | Meaning                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| Cheapest    | Do not stand up production infrastructure merely for review.              |
| Realistic   | Do not substitute screenshots, transcripts, or descriptions for behavior. |

Reviewing prose is not reviewing behavior. Pitlane has exactly two preview mechanisms, and both already run in CI on every push to a branch other than `main`:

| What the change touches | Preview |
| --- | --- |
| A package's behavior | the pkg.pr.new build from `pkg-preview.yml`: `npm i https://pkg.pr.new/pitlane-tools/pitlane/@pitlane/<name>@<sha>` |
| The docs site, or a guide | the Cloudflare Workers preview version that `preview.yml` uploads and comments on the pull request |

Because both previews already exist for the branch, this step confirms rather than builds: install the package build or open the docs preview from the branch's own run, see the changed behavior in it, and link it with what to try. Preview the surface the proposal changed; do not produce both by habit. A pure refactor with no exercisable surface produces no preview. State that plainly in the readiness report rather than fabricating one.

**The human must be able to open or install it directly.** A downloadable build artifact is not a preview — reviewing it would mean unzipping a file and starting a local server, which is enough friction that the change gets reviewed as prose instead. The one exception is a command-line tool, where installing the binary is the real act. If your preview step ends in "upload artifact" for anything else, it is not finished.

Verify the preview installs or renders before linking it; a green workflow is not evidence, per `.agents/rules/verification.md`. Each mechanism has its own failure mode. `pkg-preview.yml` builds each package from inside its own directory and publishes crawler, dev, theme, and data-table-d1 in a single `pkg-pr-new publish` — crawler before dev because `@pitlane/dev` imports it at runtime, and both named in the same invocation because that is what rewrites dev's `workspace:^` range to a resolvable pkg.pr.new URL; a publish that omits the dependency ships the `workspace:` specifier verbatim and every install fails with `EUNSUPPORTEDPROTOCOL` while the job stays green. `preview.yml` fails the job when wrangler's output carries no preview URL, and the URL it comments is a `wrangler versions upload` version that routes no production traffic — merging the pull request is what publishes. It edits its own previous comment on each push instead of stacking a new one, so the link to report is the one that comment currently carries.

Build from the pull-request revision. Give repository-accessible humans a stable link or installation location; they must not build the artifact themselves. The readiness report links it and states required setup, what to try, and the expected result. A bare URL is insufficient. Keep the preview's lifetime tied to the pull request.

Neither preview is private. A pkg.pr.new build is installable by anyone holding the URL, and the uploaded Workers version is reachable by anyone who opens it; state that public status in the readiness report rather than implying review access is restricted. A prerelease published to a public registry is public forever, which is why a preview is never published to npm — pkg.pr.new is what previews packages here. Teardown belongs to Phase 5 cleanup through `completing-a-feature`.

## 4. Report readiness and mark ready

Compose the pull-request comment from `.agents/templates/READINESS_REPORT.md`. Fill every template section and add the cross-artifact inventory verdict, divergences, and resolutions.

When the human declined a proposal, use the PR number in the report title. In the Proposal section, state that decision, link the agreed request or pull-request scope, and assess completeness against that scope. Do not invent a proposal ID or link.

| Report section | Required content |
| --- | --- |
| Proposal | State `FULLY` implemented only when every promised behavior exists. For `PARTIALLY`, name completed and omitted behavior, limitations, and reason. Silent partial implementation is not allowed. |
| What was built | Delivered behavior, not internals. Name the pending release note and the semver level it claims; do not report a version that has not been prepared. |
| How to exercise it | Preview link or honest absence, setup, actions, and expected results. |
| Validation performed | Every command actually run in this session and its observed result, per `.agents/rules/verification.md`. Never report an unrun gate as passing. |
| Adversarial findings adopted | Each accepted or fixed finding, or `- None.` |
| Adversarial findings declined, with reasoning | Every declined finding and why it was declined, or `- None.` This section is always present. |
| Defects discovered and deferred | Each deliberate, out-of-scope defect as a linked GitHub issue from `tracking-defects`, or `- None.` |
| Remaining limitations | Known behavior gaps or `- None.` |
| What to look at first | The first behavior, preview action, or diff the human should inspect. |

Declined adversarial findings keep the independent review useful. Do not quietly omit a narrow, uncomfortable, or disputed finding.

### Post from the authenticated identity

No service account is configured in this repository: nothing in `.github/workflows/` or the repository documentation provisions a bot token or GitHub App installation token for posting. Confirm the authenticated identity, post from it, and say so in the report: `Posted from <identity>; no service account is configured.` Do not imply bot authorship.

```sh
gh auth status
gh pr comment <pr-number> --body-file readiness-report.md
gh pr ready <pr-number>
```

If a service account is configured later, confirm its identity the same way and post with its token instead.

```sh
GH_TOKEN="$SERVICE_ACCOUNT_TOKEN" gh pr comment <pr-number> --body-file readiness-report.md
GH_TOKEN="$SERVICE_ACCOUNT_TOKEN" gh pr ready <pr-number>
```

### Make the coupled transition into Phase 4

At the end of Phase 3, these three actions form one transition and MUST NOT be separated:

1. Move the proposal to `status: active-review`.
2. Post the readiness report.
3. Flip the pull request from draft to ready with `gh pr ready <pr-number>`.

When the human declined a proposal for this work, the transition is two actions rather than three: post the readiness report and flip the pull request to ready. There is no status to move, and writing a proposal to have one to move is the wrong repair.

Do not leave the proposal, report, and pull-request state disagreeing. Ready means the work is human-reviewable, not correct or accepted. Never set `accepted`; only the human may do so in Phase 4, which starts Phase 5 completion.

## Red flags

- You reviewed code quality instead of comparing representations.
- A behavior-inventory row is not fully ticked and has no recorded resolution.
- You changed proposal intent without the human.
- You skipped independent adversarial review or dropped a declined finding.
- The preview is fabricated, public by accident, detached from the pull request, or a bare URL.
- A package's consumers see a difference and nothing in `.changeset/` describes it.
- The report calls the change released or versioned while only a note is pending.
- The report claims a validation gate was not run.
- You marked the pull request ready without the readiness report, or — where a proposal exists — without its status.

Correct the record before handoff.

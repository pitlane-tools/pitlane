---
name: implementing-a-proposal
description: Use when an approved proposal is ready for Phase 3 implementation, including a substantive bug fix whose root cause is known. Do not use for proposal authoring or trivial inline edits.
---

# Implementing a Proposal

Phase 3 preserves proposal intent in independent tests, guides, and code.

**Hard order:** failing tests → guides → code → quality gates. Do not reverse, combine, or defer these stages.

## Preconditions

- The proposal has `status: awaiting-implementation`, or the human returned it for implementation with `status: returned-for-revisions`; neither has an unresolved clarification marker.
- Phase 1 — preparation — created the branch, pushed it to `origin`, and opened a draft pull request.
- Read the proposal's **Detailed design**, relevant vision, policies, decisions, affected tests, guides, and project conventions.
- Tests derive from **Detailed design**. Acceptance criteria are an occasional supplement, never the primary source.
- Raise a conflict or ambiguity. Do not silently choose behavior or expand scope.

## Slice and dispatch

Slice by atomic observable behavior. Keep shared state, an interface contract, or coupled behavior with one owner.

| Slice shape | Dispatch boundary |
| --- | --- |
| Independent behavior | One implementer and a complete tests → guides → code cycle |
| Shared interface or state | One implementer for the combined behavior |
| Cross-cutting change | One owner for the shared boundary; split callers only after its contract is stable |

Never parallel-dispatch implementers onto the same files. Do not split a coherent small change merely to create concurrency.

For each slice, in the order that protects shared boundaries:

1. Curate a brief with the applicable Detailed design, governing records, affected artifacts, nearby conventions, and commands from `mise tasks`.
2. Make external behavior and scope explicit. Do not make the implementer infer omitted intent.
3. Dispatch one implementer and instruct it not to commit.
4. Require the ordered cycle below and clean quality gates before the next review gate.
5. Resolve its reported status. Never silently retry an identical dispatch.
6. After every slice is integrated and clean, run the proposal-wide inline reviews.

| Implementer status | Controller action |
| --- | --- |
| `DONE` | Continue only after the reported gates are clean. |
| `DONE_WITH_CONCERNS` | Resolve correctness or scope concerns before review; retain observations for reviewers. |
| `NEEDS_CONTEXT` | Supply the missing material and re-dispatch. Never ask it to guess intent. |
| `BLOCKED` | Classify missing context, reasoning shortfall, oversized slice, or proposal conflict; supply context, escalate the model, re-slice, or stop and raise the conflict. |

## Do inline only when trivial

Skip dispatch only when the coordination cost exceeds the work:

- Renaming a constant
- Fixing a one-line typo
- Adding one missing case to an existing test file
- Updating a comment

Do it inline. The required order still applies whenever production behavior changes.

## 1. Failing tests

### Iron Law

```text
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

If you wrote production code first, **delete it and start over**. Do not keep it as reference, adapt it while writing the test, or inspect it for the test design. **Delete means delete.**

The test is evidence only when you watched it fail for missing behavior. A test that first runs against finished code can describe what was built rather than what the proposal requires.

### Red → green → refactor

| Stage | Required action |
| --- | --- |
| **RED** | Write one focused test for one observable behavior from Detailed design. Name it idiomatically with the proposal id and behavior it verifies. |
| **Verify RED** | Run it — `vp test` from inside `packages/<name>`, or `mise run tools:test` for the record tooling. Confirm an expected assertion fails because behavior is missing — not because of setup, an import, or a typo. If it passes, correct the test. |
| **GREEN** | Write the minimum production code that makes the test pass. Do not add untested defenses, future flexibility, or unrelated refactors. |
| **Verify GREEN** | Run the test and the relevant suite — `vp test` in the package, `mise run tools:test` when the record tooling changed. Confirm they pass with no warnings, leaked logs, or skipped success. |
| **Refactor** | Remove duplication and improve the design while tests stay green. Add no behavior. Then begin the next RED test. |

Never commit while red. At a green natural boundary, follow [`.agents/rules/commit-discipline.md`](../../rules/commit-discipline.md).

### Invariants require properties

An invariant uses universal language: **always**, **never**, **for any**, or **for all**. Its test **must be property-based**, not merely a collection of examples.

Examples prove only the inputs you imagined. A property exercises the required relation across generated valid inputs. The adversarial review flags an invariant covered only by examples because it targets the inputs those examples omit.

| Invariant | Required property |
| --- | --- |
| Blank after trimming is invalid | For all strings that trim to blank, validation rejects. |
| Round trip | For all valid values, `decode(encode(value))` equals the original value. |
| Idempotence | For all inputs, `normalize(normalize(value))` equals `normalize(value)`. |

Watch the property fail in RED. Keep clear example tests alongside it; they document boundaries and named cases. Do not force property testing on a single mapping, constant, or formatting rule with no universal claim.

### Stop and restart

| Red flag | Required correction |
| --- | --- |
| Code exists before its failing test | Delete the code. Start again with RED. |
| A new test passes immediately | Correct the test until it fails for the required missing behavior. |
| A test errors before asserting behavior | Fix setup and rerun until the expected assertion fails. |
| “I will test after” or “keep this as reference” | Delete the code. Start again with RED. |
| Examples are the only coverage for an invariant | Add a failing property-based test before implementation. |

## 2. Guides

Not every change needs a guide. Ask whether it alters what a user does, sees, or must know. A workflow fix, an internal refactor, or a validator rule with no user-facing surface needs none, and writing one produces documentation describing behavior nobody observes. When in doubt, ask rather than manufacturing a guide to satisfy a list.

When a change does warrant one, write the interface as prose from the proposal before production code exists. That forces the behavior to be explainable independently of how it was built. A guide written from finished code documents whatever was implemented, including its accidents.

Write for someone who has never read the proposal and never will. Explain what they can do, what they observe, prerequisites, errors, and durable effects — not private data structures, control flow, file layout, or implementation rationale.

Guides live at `docs/guides/<slug>.md` and are published on the docs site. Find the guide that already owns the workflow and extend it in the usual case. Add a guide only when no guide covers the workflow or combining them would make audience or behavior ambiguous. Do not duplicate overlapping instructions. Use [`.agents/templates/GUIDE.md`](../../templates/GUIDE.md) when adding a guide.

Preserve the page's VitePress frontmatter: `title` and `description` stay accurate, because both feed the page title and its meta and Open Graph description. A new page also needs an entry in the shared `guides` sidebar array in `docs/.vitepress/config.ts`, the one array serving both `/guides/` and `/deploy/`. The build does not fail without that entry; it publishes a page the site never links to. Links between pages are checked: `mise run docs:build` fails on a link to a page that does not exist, so a guide and the pages it links land together. Vale lints published prose — `.omp/hooks/vale-prose.ts` reports findings after every edit under `docs/guides/`, and `mise run docs:prose` runs it over all of it.

Never hand-edit anything under `docs/package/`. That tree is TypeDoc output — gitignored, and overwritten by the next `mise run docs:api`. API prose belongs in the TSDoc comment in `packages/<name>/src/`; narrative prose belongs in `docs/guides/`.

| Include | Exclude |
| --- | --- |
| Inputs, prerequisites, actions, outcomes, errors, constraints, defaults, and durable effects | Internal implementation details users cannot observe |
| Exact rules that tests exercise | Hedges that turn a tested rule into an option |
| Worked examples with real prerequisites | Invented, stale, copied, or destructive examples without a safe executable path |

Every worked example **must actually run** against the real interface exactly as printed. Correct it or remove it.

### Compare guides with tests — mandatory

Before any production code:

1. Read the proposal-derived guide and failing tests side by side.
2. List every behavior each artifact mentions.
3. Treat anything in one list and not the other as a defect in one of them.
4. Resolve every difference by correcting the guide, correcting the test, or revising the proposal with the human.
5. Only then give the agreement to the implementer as the code contract.

This comparison is load-bearing. Without it, the guide is decorative and the tests are an unreviewed interpretation. If a guide was written or rewritten from implementation, discard the code-shaped prose, derive it again from the proposal, and repeat the comparison.

## 3. Code

Implement only the agreement among Detailed design, failing tests, and guide. Keep the production change minimal; do not add behavior that those artifacts do not require.

When a test is difficult to write, simplify the interface rather than compensate with excessive mocking or setup. Test real code; isolate only inputs you cannot control, such as network, time, or randomness.

If an unknown failure appears, stop implementation and use [`.agents/skills/systematic-debugging/SKILL.md`](../systematic-debugging/SKILL.md) to establish root cause before changing code.

## 4. Quality gates and inline reviews

Run `mise run check`, which depends on `docs:build`, `validate`, and `tools:test` before it runs `oxfmt --check`, `oxlint`, and `tsc`. A changed package also needs `vp test` and `vp run build` from inside `packages/<name>`. Follow [`.agents/rules/verification.md`](../../rules/verification.md) for completion evidence.

Perform these reviews sequentially. A finding returns the affected behavior to tests, guides, or code; rerun its gates and repeat the review that found it. Self-review can catch clear mistakes but never substitutes for either review.

| Gate | Reviewer examines | May start when |
| --- | --- | --- |
| Proposal compliance | Detailed design, tests, guides, code, scope, and every required behavior | All implementation slices and quality gates are clean |
| Code quality | Project conventions, names, duplication, boundaries, errors, complexity, and tests that assert observable behavior | Proposal-compliance is clean |

The proposal-compliance reviewer returns approval or concrete gaps. The code-quality reviewer reports only concrete, important issues. Do not start code-quality review while proposal-compliance has open findings.

## Handoff to review

After both inline reviews are clean, set no proposal status.

1. Hand off to [`.agents/skills/reviewing-an-implementation/SKILL.md`](../reviewing-an-implementation/SKILL.md). It owns every remaining Phase 3 review stage, dispatches `adversarial-review`, produces the preview, and performs the final coupled transition.

The adversarial reviewer is fresh-context, report-only, and uses a model distinct from the implementer where possible. It never edits implementation. Declined findings remain visible for human review.

## Dispatch constraints and model selection

- Never let an implementer commit.
- Never let self-review substitute for proposal-compliance, code-quality, cross-artifact, or adversarial review.
- Never begin the Phase 3 cross-artifact review before both inline gates are clean.
- Use the harness’s standard capable model for implementation and inline reviews.
- Use the strongest available model distinct from the implementer for adversarial review; cognitive diversity is the point.
- Escalate an implementer only for a reasoning shortfall, never for missing context.
- Do not use a low-reasoning model with untrusted recovery behavior for implementation or review.

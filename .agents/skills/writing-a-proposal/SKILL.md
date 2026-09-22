---
name: writing-a-proposal
description: Use when a new or substantial change needs definition before tests, guides, or code — especially when intent is unclear, designs compete, existing records may constrain the change, or human approval is required.
---

# Writing a Proposal

**Phase 2 — Proposal development.** A proposal is the one durable record of one coherent change. It makes intent concrete enough to derive tests, guides, and code without returning to the original conversation.

## First, ask whether this needs a proposal

Proposals are for changes that decide something: new or changed behavior, a real choice between approaches, anything establishing a policy or decision, anything touching the vision.

They are not for changes whose intent already exists. A bug has its correct behavior specified already — by the proposal that promised it, or by a contract too obvious to write down. Correcting an implementation is not defining one. Fixing a typo, a dead link, or a workflow whose behavior was never in question needs no proposal and often no pull request; describing it costs more than doing it.

State your recommendation, then ask whether the human wants a proposal. Always wait for explicit approval before creating one or opening a proposal-only branch or pull request. A request to implement something, a selected tool, answers to design questions, urgency, or your own assessment that work is substantial do not grant permission. Announcing that you will write a proposal is not asking.

If the human declines, proceed from the agreed request and pull-request scope with applicable verification and review. Do not create a proposal approval gate. If a real design choice emerges during a small fix, stop, explain the choice, and ask whether the human wants a proposal before creating one.

## Preparation comes first

After the human approves creating a proposal, confirm the change has a branch pushed to `origin` and an open draft pull request before writing it. The pull request is the durable workspace, and a proposal iterated anywhere else is a proposal the human cannot comment on.

## Output

Create exactly one `proposals/<NNNN>-<slug>.md`. Copy [`.agents/templates/PROPOSAL.md`](../../templates/PROPOSAL.md); do not replace it with a folder or auxiliary planning files.

- Use the next unused four-digit number and a kebab-case slug.
- Complete the template frontmatter: `id: proposal.<NNNN>`, Title Case `title`, `authors` as a non-empty list of real names — the validator checks only that the list is non-empty, so a leftover `<name>` placeholder passes — `status: draft`, the draft PR URL or number, and `supersedes`.
- Complete every template section: Summary, Motivation, Proposed solution, Detailed design, Compatibility, Implications on adoption, Scope, Out of scope, Preview, Policies and decisions checked, Future directions, Alternatives considered, and Open questions. Acknowledgments is optional.
- **Detailed design is what tests derive from.** Write it precisely enough that someone who is not the author could implement it without asking questions.
- Usually delete the template's Acceptance criteria section. Restating Detailed design as a checklist duplicates the specification in a form that drifts from it. Keep it only for a change with discrete outcomes the prose cannot express naturally — a structural change touching many independent things, or a migration with separable steps.

## Size before detail

One proposal covers one coherent change. Split before authoring when either is true:

- The motivation solves two unrelated problems.
- The change needs more than roughly six acceptance criteria.

Choose the smallest independently useful slice. A proposal with a broad motivation is not made coherent by a long scope section.

## Process

1. **Read the record.** Read `VISION.md`, `policies/`, and `decisions/` before proposing. In **Policies and decisions checked**, list each relevant record and its constraint; write `None` when none apply.

    If the change conflicts with a policy or decision, surface the conflict in that section. The human chooses either to revise the proposal or to supersede the record. Never quietly violate it.

2. **Discover one answer at a time.** Ask one question, wait for its answer, then ask the next. Use multiple-choice questions when the answer space is finite. Cover:
    - who needs the change and the outcome they seek;
    - the trigger, success condition, and boundaries;
    - dependencies, constraints, and affected records; and
    - what is deliberately out of scope.

    Do not guess. Ask, or record `[NEEDS CLARIFICATION: <question>]` in **Open questions** and continue.

3. **Compare approaches.** Present two or three viable approaches with tradeoffs. Recommend one and explain why. Ask the human to select an approach or direct a revision before treating the design as settled.

4. **Choose the preview now.** Select which of pitlane's two preview mechanisms exercises the changed behavior. Record it as the artifact in **Preview**, with the reason it is the cheapest realistic exercise of this change.

    | What the change touches | Preview |
    | --- | --- |
    | A package's behavior | the pkg.pr.new build from `pkg-preview.yml`: `npm i https://pkg.pr.new/pitlane-tools/pitlane/@pitlane/<name>@<sha>` |
    | The docs site, or a guide | the Cloudflare Workers preview version that `preview.yml` uploads and comments on the pull request |

    Both run in CI on every push to a branch other than `main`, so there is nothing to configure and nothing to tear down beyond the branch itself. Neither is private: a pkg.pr.new build installs for anyone holding the URL, and the uploaded Workers version is reachable by anyone who opens it — record that rather than a private access path that does not exist here. A change with no exercisable surface records that instead of naming a mechanism that cannot show it.

5. **Author the proposal.** Fill the template from the answers and selected approach. State behavior and boundaries plainly. Record rejected approaches and why they lost. Keep unresolved questions as markers rather than inventing answers.

6. **File unrelated defects.** If discovery reveals a defect outside this proposal's scope, file it as a GitHub issue. Discovering a defect is never a reason to expand the proposal or forget it. Use [`.agents/skills/tracking-defects/`](../tracking-defects/) for the judgment and filing process.

7. **Self-review.** Before showing the human, check:
    - every template section and frontmatter field is complete;
    - the motivation, behavior, criteria, scope, preview, and record check agree;
    - no unstated assumption remains outside an explicit clarification marker;
    - no rejected approach or out-of-scope item reappears as promised behavior; and
    - the proposal remains one coherent change.

    Fix clear defects. Count remaining clarification markers and present them to the human.

8. **Publish the draft.** Commit the proposal and push it as soon as it is coherent enough to react to. Do not polish it privately first — the draft pull request exists so the human can read and edit the proposal in place, and a proposal held back is a proposal being decided by the agent alone.

9. **Iterate on the pull request.** The human comments, requests changes, and may commit edits to the proposal directly. Read those commits before responding; they are instructions, not conflicts to resolve. Keep iterating — answering questions, revising the design, resolving markers — until the human is satisfied. This can take many rounds, and the proposal stays `draft` throughout.

10. **Wait for the human to close the draft.** The human decides when the proposal is settled and moves it to `status: awaiting-implementation`. They may ask you to make that edit; making it when asked is fine, deciding it is not.

    Never decide this yourself. `accepted` is a different and much later state — it records the human accepting the finished implementation, not permission to begin. An agent that reaches either conclusion unaided is an agent approving its own work.

## The gate, once a proposal exists

This gate applies when the human chose a proposal. It does not apply when the human declined one; use the agreed request and pull-request scope instead.

Once a proposal exists, never write tests, guides, or code until all of these are true:

1. The proposal file exists.
2. It contains zero `[NEEDS CLARIFICATION:` markers.
3. The human has set `status: awaiting-implementation`.

Then enter Phase 3 — Implementation with `implementing-a-proposal`.

## Red flags — stop and correct

| Symptom | Required response |
| --- | --- |
| No explicit approval to create a proposal | Ask whether the human wants one, then wait. |
| No pushed branch or draft pull request | Return to Phase 1 — Preparation. |
| Two unrelated motivations or more than roughly six criteria | Split the proposal. |
| A record conflicts with the change | Surface it; the human chooses revision or supersession. |
| An unknown detail has no clarification marker | Ask or add the marker. |
| Preview names no exerciseable artifact | Choose and record one before approval. |
| A newly discovered defect expands scope | File a GitHub issue; keep the proposal bounded. |
| Existing code suggests the design | Treat it as evidence, not authority; settle intent in the proposal. |

## Anti-patterns

- **Proposal as a conversation summary.** Record decisions and observable behavior, not chat history.
- **Folder-shaped planning.** The proposal is one document. Do not distribute its sections across files.
- **Approval by silence.** `draft` is not accepted. Only the human changes the status.
- **Preview at review time.** Decide it during Phase 2, then make it during Phase 3.
- **Implementation-led intent.** Existing code does not resolve open questions.

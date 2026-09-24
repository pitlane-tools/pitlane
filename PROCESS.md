# Workbench Agentic Development Process

This document describes the process I use for agentic development (“vibe coding”).

The process is intended to be generalizable to any modern agentic coding harness, including [Claude Code](https://claude.com/product/claude-code), [Codex](https://openai.com/codex/), [Copilot](https://github.com/features/copilot), [Pi](https://pi.dev/), and [Oh My Pi](https://omp.sh/). Throughout this document, the harness and the model driving it are collectively referred to as _the agent_.

This repository runs that process. [`AGENTS.md`](AGENTS.md) is the operative contract: it binds every artifact described below to a real path, task, and workflow in this repository, and it is what an agent follows when the two disagree on a detail.

The process starts with understanding the problem. For a substantive change, the agent grounds the domain, makes the intent explicit with the human, then represents that intent independently in tests, documentation, and code. The resulting behavior is reviewed from several perspectives and verified by a human before release. The human decides whether that intent needs a proposal.

## Goals

The Workbench process has several goals:

- Preserve a coherent long-term vision for the project even as individual features are developed independently.
- Make the intended behavior and scope of a feature explicit before implementation begins.
- Maintain multiple independently useful representations of that intent in proposals, tests, guides, and code.
- Make disagreements between those representations visible before a feature is released.
- Use agents for implementation and review without making the agent the final authority over product intent.
- Preserve enough design rationale, implementation history, and review discussion for future humans and agents to understand why the project is the way it is.
- Keep dependent projects synchronized as new functionality moves from development previews to production releases.

## Artifacts

The process produces and maintains several kinds of artifacts.

### Visions

A _vision_ describes the project as a whole, including its purpose, minimum viable product target, design principles, and a possible future for the project beyond the current implementation.

The vision establishes the long-term direction against which individual proposals can be evaluated. It is created once near the beginning of the project and maintained as the project evolves.

### Policies

A _policy_ records a rule that should continue to be enforced across future work.

Policies capture constraints or conventions that should not have to be rediscovered from previous implementations or review discussions.

### Decisions

A _decision_ records an architectural or technical choice that should be remembered, including enough context to understand why that choice was made.

Future work may supersede a decision, but should do so explicitly rather than accidentally.

### Proposals

A _proposal_ describes a specific change to the project in enough detail to serve as the specification for its implementation.

Proposals record the motivation, intended behavior, scope, and relevant design decisions of a feature. They remain part of the project's history after implementation. A future proposal may revise or supersede an earlier proposal.

### Tests

_Tests_ are executable specifications of the behavior described by a proposal.

They may include unit tests, integration tests, end-to-end tests, or other forms of automated verification implemented idiomatically for the implementation language and environment.

### Guides

_Guides_ are human-consumable Markdown documentation explaining how the proposed or implemented feature behaves and how it is used.

Guides provide a prose representation of the same behavior represented more formally by the proposal and tests.

### Code

_Code_ is the concrete implementation of the behavior described by the proposal, tests, and guides.

### Previews

A _preview_ is a prerelease form of the documentation or running software made privately available for human review.

A preview should be the cheapest realistic artifact through which a human can exercise the changed behavior. Both qualities matter: _cheapest_ rules out standing up production-grade infrastructure merely to review a change, and _realistic_ rules out screenshots, transcripts, and descriptions of what would happen.

What that artifact is depends on what the project is:

| Project             | Preview                                                |
| ------------------- | ------------------------------------------------------ |
| Library             | preview package deployment                             |
| Web application     | preview app deployment                                 |
| API                 | preview endpoint deployment                            |
| Documentation       | preview documentation deployment                       |
| Command-line tool   | installable executable                                 |
| Desktop application | installable build                                      |
| Mobile application  | installable build, via ad-hoc or internal distribution |

A project wires the mechanism matching its own shape. Previews are private by default; a project makes one public only deliberately, as when a library publishes its documentation.

In this repository the two mechanisms already exist, and both run on a push to any branch other than `main`:

| What the change touches | Preview |
| --- | --- |
| A package's behavior | the pkg.pr.new build from `pkg-preview.yml`: `npm i https://pkg.pr.new/pitlane-tools/pitlane/@pitlane/<name>@<sha>` |
| The docs site, or any guide | the Cloudflare Workers preview version that `preview.yml` uploads and comments on the pull request |

Both are public by consequence rather than by choice: a pkg.pr.new build is installable by anyone with the URL, and the Workers preview version serves no production traffic but is reachable. Neither is a release.

## Project Vision

A new project begins with the creation of its vision document.

The agent and I develop the vision together before normal feature work begins. The document describes both the minimum viable version of the project and the broader direction in which the project may evolve.

The vision is not a collection of committed feature specifications. Individual changes are still designed and implemented through proposals.

Unlike proposals, however, the vision is a living document. After accepted features materially alter the project's capabilities or direction, the vision is updated so that it continues to describe the project accurately.

## Feature Development

When the human chooses a proposal, substantial feature work proceeds through five phases:

1. preparation,
2. proposal development,
3. implementation,
4. human review, and
5. completion and release.

The process is iterative. Findings during implementation or review may cause the proposal itself to change, at which point the implementation is reevaluated against the revised proposal.

The primary agent is the strategist: it owns domain understanding, the conceptual model, proposal intent, delegation, and the excellence pass. Implementers realize bounded, already-understood behavior without redefining the proposal. A reframer challenges the formulation of the problem when it no longer explains the evidence. An independent adversary tries to falsify the finished work and reports findings without editing it.

Before entering the proposal path for a change, the agent states its recommendation, asks whether I want a proposal, and waits for explicit approval — even when the request sounds like a feature or asks for a proposal outright. This also applies before opening a proposal-only branch or pull request. A yes covers that proposal and its later revisions, not the next change. A request to implement a change, selection of a tool, or answers to design questions do not authorize proposal creation. Announcing a proposal is not asking permission.

If I decline a proposal, the agent proceeds from our agreed request and pull-request scope, retaining applicable verification and review. If a design choice emerges partway through a small fix, the agent explains the choice and asks whether I want a proposal before creating one.

### Agent orchestration

The `workflow` tool registered by `.omp/tools/dynamic-workflows/` is for a dependency graph of agent work: independent branches feeding a later synthesis, or branches chosen by an earlier result. A single small task stays inline, and a fixed batch of independent slices uses ordinary task delegation. Workflow scripts orchestrate subagents deterministically and expose phases, but each agent still needs bounded ownership, and the strategist still owns intent and review. A failed branch yields `null`; treat that as a missing result, not as evidence of success.

## Preparation

Work on a feature begins in an isolated Git branch. When that branch and its pull request exist only to carry a proposal, they are created after I have said yes to the proposal, never before.

The agent creates the branch, pushes it to the project's `origin` remote, and creates a draft pull request for the work.

The pull request becomes the durable workspace for the feature. It collects the proposal, implementation, review discussion, agent status reports, and other artifacts associated with the change.

The pull request remains a draft while the feature is being specified and implemented.

## Proposal Development

After I approve creating a proposal, the agent and I write it before implementation.

The proposal should make the intended change sufficiently concrete that the agent can derive tests, documentation, and an implementation from it without relying primarily on the original conversational request.

We iterate on the proposal until I am satisfied that it represents the feature I intend to build.

The proposal is preserved after the feature ships. It becomes part of the historical explanation of the feature rather than merely temporary planning material.

If future work changes that design, a later proposal may revise or supersede it.

### Ground the problem

When a change depends on domain knowledge that cannot safely be inferred from the request, the strategist grounds the problem before selecting an approach. It prefers authoritative sources and keeps established knowledge, observed repository behavior, inference, and untested hypotheses distinct. The context a reader needs to judge the proposal is recorded in its **Domain grounding** section; when no independent research is needed, the section says why rather than manufacturing it.

When important domain concepts, identities, relationships, states, or vocabulary change, an ontology review happens before those assumptions harden into the detailed design. A material conceptual conflict returns to grounding or to the proposal rather than being settled in code.

### Study the existing baseline

After grounding, the agent inspects the closest implementation, prototype, workflow, or prior attempt, and records in **Existing baseline** what works, what should be preserved, and what is incidental or compromised. Existing code is evidence of current behavior, not authority about the domain.

## Implementation

Once the proposal is sufficiently defined, the agent enters an implementation loop. The strategist delegates bounded slices together with their detailed design, domain constraints, baseline, quality bar, governing records, and verification commands. When an implementer reports that the supplied model conflicts with the evidence, that slice stops and the conflict returns to the strategist; repeated local fixes that stop explaining the problem call for reframing it with the human before continuing.

### Behavioral Tests

The agent first writes failing tests for the observable behavior the proposal specifies, wherever such tests add meaningful protection.

These tests establish an executable interpretation of the proposal before the implementation itself can influence what is considered correct.

The goal is not merely to increase test coverage, but to encode the externally meaningful behavior of the feature.

### Usage Guides

When the change has a user-facing surface, the agent then writes its guide from the proposal, before the production code exists. A change with no such surface needs no invented guide.

Writing the documentation before or alongside the implementation forces the intended interface to be explained independently from the code that implements it.

The agent compares the guides with the tests and verifies that they describe the same behavior.

### Implementation

The agent implements the feature against the proposal, tests, and guides.

Implementation continues until the project's quality gates pass. Depending on the project, these may include:

- formatting,
- linting,
- type checking,
- building,
- unit tests,
- integration tests,
- end-to-end tests, and
- other project-specific validation.

Passing the quality gates is necessary but not sufficient for the feature to be considered complete.

### Excellence Pass and Inline Reviews

Once the behavior works and validation passes, the strategist asks whether this is the implementation that should remain: does it express the grounded model, reuse the right boundaries, and present a clear interface without inherited or speculative complexity? Substantive corrections return to implementation, after which validation and this pass run again. A finding that changes intended behavior returns to the proposal and the human.

The strategist then obtains a proposal-compliance review and a code-quality review, in that order. Both are clean before the cross-artifact review begins. These inline reviews do not replace the independent adversarial review.

### Cross-Artifact Review

Once the implementation passes its automated checks, the agent reviews the proposal, tests, guides, and code together.

The purpose of this review is to find disagreement between the different representations of the feature.

In particular, the agent verifies that:

- the tests cover the behavior promised by the proposal;
- the guides describe the same behavior exercised by the tests;
- the code implements the behavior described by the proposal and guides;
- no substantial documented behavior is missing from the implementation;
- no substantial implemented behavior exists without being represented in the proposal or documentation; and
- implementation details have not unintentionally changed the original scope or intent.

### Adversarial Review

The implementation is then reviewed independently by a subagent using a different model from the primary agent.

The reviewing agent receives the proposal, tests, guides, and implementation and attempts to find weaknesses rather than continue implementation.

Its review considers issues such as:

- weak, misleading, or incomplete tests;
- implementation defects;
- security vulnerabilities;
- regressions;
- scope creep;
- undocumented behavior;
- inconsistencies between artifacts;
- violations of policies or decisions;
- unnecessary complexity;
- code smell;
- fragile architecture; and
- assumptions that have not been adequately validated.

The reviewing agent reports its findings to the primary agent.

The primary agent addresses findings it determines are legitimate. Findings it does not adopt are preserved and surfaced for human review rather than silently discarded.

The adversarial reviewer does not decide whether the feature is acceptable. Its role is to produce an independent attempt to falsify the primary agent's claim that the work is complete.

### Preview

After review findings are resolved, the agent produces the preview the proposal selected. Both of this repository's mechanisms already run in CI on every push to a branch other than `main`, so this step confirms rather than builds: install the package build or open the docs preview from the branch's own run, see the changed behavior in it, and link it with what to try. A green workflow is not evidence. A pure refactor with no exercisable surface produces no preview rather than a fabricated one.

### Readiness Report

After completing the implementation loop, the agent posts a comment to the pull request summarizing the state of the implementation against the proposal. This repository configures no service account, so the comment is posted from the authenticated `gh` identity and says so rather than implying bot authorship.

The report should make clear whether the proposal has been fully implemented, identify any remaining limitations or disputed review findings, and describe the validation that has been performed.

The agent then marks the pull request as ready for review.

Changing the pull request from draft to open status signals that the agent considers the implementation ready for human evaluation.

## Human Review

Human review determines whether the implementation actually satisfies the intended feature.

I review both the agent's readiness report and the artifacts produced during development. Depending on the feature, this may include:

- the code diff;
- the proposal;
- tests;
- rendered preview documentation;
- a preview application deployment; and
- a preview package consumed by draft pull requests in dependent projects.

Review is not limited to reading generated artifacts. The preview forms of the feature are intended to make the actual behavior directly inspectable whenever possible.

I leave general or inline pull request comments describing changes I want the agent to make. I may also edit and commit prose or code directly during review.

I then instruct the agent to process the review feedback. Additional context may be supplied directly to the agent when it does not belong in a pull request comment.

If the feedback changes the intended design rather than merely correcting its implementation, the agent updates the proposal first.

The agent then repeats the implementation process against the revised proposal: tests, guides, code, automated validation, the excellence pass, inline reviews, cross-artifact review, and adversarial review are reevaluated as necessary.

Implementation and human review therefore form a loop:

**proposal → tests → guides → code → automated validation → excellence pass → inline reviews → cross-artifact review → adversarial review → preview → human review → revision**

The loop continues until I accept the feature.

## Policies and Decisions

Feature development may reveal information that should outlive the proposal itself.

When a feature establishes a rule that future work should continue to enforce, the agent should record or update that rule as a policy, after discussion with me.

When a feature establishes an architectural choice that future work needs to understand, the agent should record or update that choice as a decision, after discussion with me.

Policies and decisions are therefore not substitutes for proposals. A proposal explains a particular change; policies and decisions extract the durable constraints and architectural knowledge discovered while making that change.

Future proposals should be evaluated against the current vision, policies, and decisions.

## Defect Tracking

During proposal development, implementation, automated validation, adversarial review, or human review, the agent may discover defects that should be preserved independently of the current pull request.

A defect that prevents the current implementation from satisfying its proposal remains part of the current work and should normally be fixed before the pull request is accepted. The agent should not create an issue merely to defer work required by the proposal.

A defect may instead be recorded as a GitHub issue when it is outside the scope of the current proposal, already exists on the main branch, affects another feature or project, or otherwise represents legitimate future work that should survive beyond the current pull request.

Before creating a new issue, the agent checks the repository's existing open and closed issues for the same defect to avoid creating duplicates.

When a new issue is necessary, the agent creates it using the [`gh`](https://cli.github.com/) CLI. The issue should contain enough information for a future human or agent to understand and reproduce the defect without depending on the conversational context in which it was discovered.

At minimum, a defect should record:

- a concise description of the incorrect behavior;
- the behavior that was expected instead;
- reproduction steps or a minimal reproduction when available;
- relevant environmental or version information;
- links or references to the proposal, pull request, test, or code where the defect was discovered when useful; and
- any known constraints, suspected causes, or related defects that would help a future investigation.

For example:

```sh
gh issue create \
  --title "Parser rejects nested optional routes" \
  --label bug \
  --body-file - <<'EOF'
## Description

The route parser rejects nested optional route segments that should be valid.

## Expected behavior

`($lang).($region).products.tsx` should produce two nested optional route segments.

## Actual behavior

Route discovery fails with an invalid segment error.

## Reproduction

1. Create `app/routes/($lang).($region).products.tsx`.
2. Run the route discovery command.
3. Observe the invalid segment error.

## Context

Discovered while implementing #123.

The current proposal does not alter optional-route parsing, so this defect is outside its scope.
EOF
```

The agent applies the repository's normal issue labels, types, milestones, projects, parent issues, or dependency relationships when those conventions exist.

When a newly discovered defect is relevant to the current pull request but intentionally outside its scope, the agent links the resulting issue from the pull request or an appropriate review comment. This makes the decision to defer the defect explicit and leaves a durable path from the context in which it was discovered to the future work needed to resolve it.

If subsequent work fixes the defect incidentally, the agent updates or closes the issue with a reference to the pull request or commit that resolved it rather than leaving the issue stale.

## Completion

Once the feature has passed human review, the agent completes the work required to integrate and release it.

### Vision Update

The agent reviews the project vision and updates it when the completed feature changes the project's current capabilities, minimum viable product, or broader direction.

Because the vision is intended to describe the project as it currently exists and where it is heading, accepted work should not leave it stale.

The agent may consult me before making substantial changes to the vision.

### Merge

The agent merges the pull request into the project's main branch.

The merge should preserve enough information for future humans or agents to recover:

- what was proposed;
- what was implemented;
- why important decisions were made;
- what problems were discovered during review;
- what changes were requested; and
- how the final implementation differs from earlier revisions.

The proposal and relevant pull request history therefore form part of the long-term knowledge base of the project rather than disposable development scaffolding.

### Release

Package changes are captured with their implementation in `.changeset/*.md` notes containing the affected packages, semver intent, and consumer-facing explanation. Feature pull requests leave versions and numbered changelog sections unchanged. Accepted work may be merged and remain unreleased; its notes wait for a human request.

On request, the agent reviews the complete `mise run changeset:status` plan with me, including computed dependent bumps. `mise run changeset:version` then consumes the pending notes, updates versions and changelogs, and refreshes the lockfile. The preparation is committed and reviewed under the normal repository rules. Preparing versions does not authorize publication.

In this repository that mechanism is a Git tag plus a published GitHub release on `main`, which is the only trigger `.github/workflows/publish.yml` listens for. The ordering around it — what must be updated before the merge, and what is still in its pre-release state after the tag — is `.agents/skills/releasing-pitlane-packages/SKILL.md`. A package that the starter templates depend on adds one more rule, in `.agents/skills/adopting-packages-into-templates/SKILL.md`: publish the package first, then merge the companion templates branch.

### Dependent Work

If other projects contain draft pull requests depending on a preview version of the feature, the agent updates those pull requests to consume the production release.

Once their dependency on unreleased work has been removed, the agent marks those dependent pull requests as ready for review when appropriate.

This allows work across multiple repositories to be developed against previews without leaving those preview dependencies in place after release.

### Cleanup

Finally, the agent removes development state that is no longer useful.

This includes pruning stale feature branches locally and remotely in both the primary project and dependent projects, removing obsolete preview configuration, and cleaning up other temporary artifacts created during development.

Cleanup concludes the feature process.

## Process Summary

At the project level:

**vision → feature proposals → implemented project → updated vision**

For each feature:

**branch → draft pull request → grounding and ontology review when needed → baseline study → proposal → tests → guides → code → validation → excellence pass → inline reviews → cross-artifact review → adversarial review → preview → ready pull request → human review → revision or acceptance → vision update → merge → release → dependent updates → cleanup**

The central invariant of the process is that no single artifact defines the feature by itself.

The proposal records intent. Tests encode behavior. Guides explain behavior. Code implements behavior. Previews expose behavior for direct inspection. Independent agent review attempts to find contradictions and defects. Human review determines whether the result is actually the feature that was intended.

Each representation acts as a check on the others.

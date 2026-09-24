# Pitlane agent contract

This repository runs the **Workbench** development process. [`PROCESS.md`](PROCESS.md) is the full description; this file is the operative contract. Its first half is the process, its second half the repository conventions the process operates on. Read it before doing anything substantial.

Two principles govern it:

1. **Understanding precedes intent; intent precedes implementation.** Learn the problem on its own terms before choosing what to build, and make the intended behavior explicit before writing code.
2. **No single artifact defines a feature by itself.** A proposal records intent, tests encode behavior, guides explain behavior, code implements behavior, and a preview exposes behavior. Each is written independently, so that disagreement between them is visible before release.

You do not move from a request straight to a solution, or from a solution straight to an implementation. The human decides whether intent needs a proposal.

## Start here, every session

```sh
mise run status
```

It reads the branch, the pull request, and the active proposal's status, then prints which phase the work is in and what happens next. Run it before asking where things stand, and again whenever you are unsure.

Nobody is expected to remember a command, a skill name, or an argument. "Keep going", "start a feature for X", or a plain description of a problem is a complete instruction — orient yourself from `mise run status` and proceed. None of those phrases authorizes a proposal, a proposal-only branch, or a draft pull request.

## Reasoning order

For substantial work, reason in this order:

```text
reality → understanding → conceptual model → intent → implementation → verification
```

Do not collapse these stages.

**Understanding** means learning the problem domain well enough to reason with its concepts, constraints, prior art, and standards of quality instead of generic software patterns.

**Conceptual model** means deciding what kinds of things exist in the problem, what tells them apart, how they relate, and which distinctions are fundamental rather than conveniences of the current code.

**Intent** is the human-reviewed decision about what Pitlane should do. It is recorded in the proposal, or in the agreed request and pull-request scope when the human declined one.

**Implementation** realizes that intent in tests, guides, and code.

A plausible implementation plan is not evidence that the problem is understood.

## Artifacts

| Artifact | Lives in | What it is |
| --- | --- | --- |
| **Vision** | `VISION.md` | Pitlane's purpose, target, principles, and direction. Living document. |
| **Policies** | `policies/` | Rules future work must keep enforcing. |
| **Decisions** | `decisions/` | Architectural choices, with the context that produced them. |
| **Proposals** | `proposals/` | The specification for one change. Preserved as history after it ships. |
| **Guides** | `docs/guides/` | Published prose explaining how a feature behaves and how it is used. |
| **Previews** | CI | The cheapest real artifact through which a human can exercise the change. |
| **Tests** | `packages/<name>/` | Executable specifications of the behavior a proposal describes. |
| **Code** | `packages/<name>/` | The implementation. |

Records are numbered `<NNNN>-<slug>.md` and carry `id`, `status`, and `title` frontmatter. `.agents/templates/` holds the canonical shape of each, and `mise run validate` enforces it.

Guides are the deliberate exception. They are published VitePress pages, they keep VitePress's `title` and `description` frontmatter, and the validator never reads them — a second record-shaped contract on the same pages would buy a reverse pointer the proposal already carries in prose. They are still a process artifact: written from the proposal, before the code.

The record itself is not published. `docs/` is what [pitlane.tools](https://pitlane.tools) builds, and `VISION.md`, `proposals/`, `policies/`, and `decisions/` all sit outside it.

Every proposal is evaluated against the current vision, policies, and decisions. When they disagree with what you are about to build, stop and raise it — never quietly deviate.

## Agent roles

These are responsibilities, not separate products. One harness and one model can hold several of them; what matters is that the work of each still happens.

**Strategist.** The primary agent. It owns domain grounding, the conceptual model, problem formulation, product and architectural reasoning, the proposal, decomposition and delegation, strategic conflicts surfaced during implementation, and the excellence pass. It must understand the problem well enough to judge the work it hands out — delegation is not a substitute for understanding.

**Implementer.** Receives a bounded, already-understood piece of work and realizes it in tests, guides, and code. It makes local implementation decisions. It does not silently redefine domain concepts, product behavior, proposal intent, or architecture; when implementation evidence contradicts the model it was given, it returns that conflict rather than encoding a new answer.

**Reframer.** An independent reasoning agent used when the formulation of the problem itself looks wrong, or repeated local work stops raising confidence. It challenges premises, boundaries, abstractions, and diagnoses; it is not a stronger implementer.

**Adversary.** Fresh context, different model, report-only. It tries to falsify the finished work and reports defects and proposal gaps. It never fixes them.

Three of those roles are real dispatch targets in this repository. `.omp/agents/implementer.md`, `.omp/agents/reframer.md`, and `.omp/agents/adversary.md` hold their briefs, and `.omp/config.yml` decides which model each one runs on through `modelRoles` and `task.agentModelOverrides`. Dispatch by name — `agent: "implementer"`, `"reframer"`, `"adversary"` — from `task`, from eval `agent()`, or from a `workflow` script, and pass no model: naming a model in the call bypasses the role and makes the mapping a lie. To change what a role runs on, edit `modelRoles` in `.omp/config.yml`, not the dispatch and not the agent file. The strategist is the session you are already in, so it has no agent file.

## Orchestrating agents

`.omp/tools/dynamic-workflows/` registers the Oh My Pi `workflow` tool in this repository. A deterministic JavaScript script calls `agent`, `parallel` with zero-argument functions, and `pipeline`, labels phases, and returns a final result.

Reach for it only when the shape of the work is a dependency graph: independent branches that feed a later synthesis, or a result that decides which agents run next. A single bounded task stays inline or goes to one agent; a fixed batch of independent slices with no dependent stage is ordinary `task` delegation. Give each agent bounded ownership and separate files, and have a final agent reconcile independent findings. A failed branch returns `null` — inspect it rather than reading it as success. The tool coordinates execution; it does not approve proposals, replace the strategist, or bypass tests and review.

## The feature loop

```
proposal consent, when a proposal is wanted → branch → draft PR
       → grounding → ontology review when concepts change → baseline study → proposal
       → tests → guides → code → validation
       → excellence pass → inline reviews → cross-artifact review → adversarial review
       → preview → readiness report
       → human review → revision → vision update → merge → release → cleanup
```

**Scale the process to the change.** The loop is written for substantial work — new or changed behavior, anything a reasonable person could build differently. A typo, a dead link, or a bug whose correct behavior was never in question does not need a proposal; fixing it is faster than describing it.

Some of those do not need a pull request either. Moving a file and deleting the empty directory behind it is a commit, not a review — there is nothing for a reviewer to agree or disagree with. The three conditions that allow a direct commit to `main`, and the reminder that an unnecessary pull request is cheap while a skipped one is not, are in [`.agents/rules/commit-discipline.md`](.agents/rules/commit-discipline.md#when-the-default-branch-is-reachable-directly).

Lean on one question: **does this change decide something?** If intent already exists because a proposal promised the behavior or the contract is too obvious to write down, you are correcting an implementation. State your recommendation about whether a proposal would help.

Always ask the human whether they want a proposal and wait for explicit approval before creating one or opening a proposal-only branch or pull request. Ask even when they said "start a feature" or "write a proposal" — only their answer to this question, for this change, is consent, and it covers that proposal's later revisions rather than the next change. Announcing that you will write a proposal is not asking. A request to implement something, a selected tool, or answers to design questions do not grant permission.

If the human declines a proposal, proceed from the agreed request and pull-request scope, retaining the applicable verification and review steps. Do not impose a proposal approval gate. If a real design choice emerges during a small fix, stop, explain it, and ask whether the human wants a proposal before creating one.

### 1. Preparation

Create a branch, push it to `origin`, and open a **draft** pull request before writing anything. The pull request is the durable workspace: proposal, implementation, review discussion, and status reports accumulate in one reviewable place. When the branch and pull request would exist only to hold a proposal, open them after the human has said yes to that proposal, not before.

Pushing the branch is also what starts the previews — `preview.yml` and `pkg-preview.yml` both fire on a push to any branch other than `main`, so the artifacts phase 3 needs exist from the first push onward.

### 2. Grounding and proposal

A proposal records a decision. It is not where an agent first works out what the problem means.

**2A. Ground the problem.** Decide whether the change depends on domain knowledge that cannot safely be inferred from the request — browser and bundler behavior, a specification, an upstream framework's semantics, accessibility or typography practice, or anything else Pitlane's packages have to be correct about. When it does, use `.agents/skills/grounding-a-problem/`. Prefer primary and authoritative sources, and keep established knowledge, repository evidence, inference, and untested hypotheses apart. Agent-written analysis does not become established knowledge because another agent repeated it. Do not open this stage with an implementation plan.

**2B. Review the ontology when the change is concept-heavy.** When the work introduces or changes important concepts, identities, relationships, states, classifications, ownership, or vocabulary — the kinds of things a package's public types and a guide's nouns commit you to — use `.agents/skills/ontology-review/`. It is not required for every proposal; use it when a mistaken model would distort APIs, data, behavior, or architecture. Material findings go back into the proposal, or back into grounding when the grounding was wrong.

**2C. Study the existing baseline.** Only after grounding, inspect the closest existing implementation, demo, workflow, or earlier attempt. Treat it as a specimen: identify what behavior or insight is worth keeping, name the compromises and accidental complexity, and do not mistake an implementation detail for a property of the domain. Existing code is evidence, not authority.

**2D. Write the proposal.** After the human approves creating one, write `proposals/<NNNN>-<slug>.md` and **push it to the draft pull request as soon as it is coherent enough to react to**. Do not polish it privately; the pull request is where it gets read, commented on, and edited directly. It records the problem and motivation, the grounded context needed to evaluate it, the relevant baseline, the proposed solution, the intended behavior in detail, scope and exclusions, compatibility and adoption implications, alternatives, and open questions.

Then iterate, for as long as it takes. The proposal stays `status: draft` throughout, and must end up concrete enough to derive tests, guides, and an implementation from **without** rereading the original conversation. Unresolved questions are marked `[NEEDS CLARIFICATION: <question>]` and resolved with the human, never guessed.

The human decides when the proposal is settled and moves it to `status: awaiting-implementation`. That is the gate for phase 3. They may ask you to make the edit; deciding it yourself is prohibited.

Skills: `.agents/skills/writing-a-proposal/`, plus `.agents/skills/grounding-a-problem/` and `.agents/skills/ontology-review/` when they apply.

### 3. Implementation

Strictly ordered, and it ends with review. Each artifact is an independent representation of the same intent; writing them out of order lets the code decide what "correct" means. A bounded slice you hand off goes to the `implementer` agent, with the brief described under Agent roles.

1. **Tests first.** Failing tests for the behavior the proposal's Detailed design specifies. `vp test` from inside `packages/<name>`.
2. **Guides next.** Written from the proposal, not from the code, into `docs/guides/`. Then compare them against the tests and confirm they describe the same behavior.
3. **Code last.** Implement against proposal, tests, and guides until `mise run check` and the package's own `vp test` and `vp run build` pass.

**Which of these a change needs is a judgement.** The order is not — when you write two of them, write them in this order. A change with no user-visible surface needs no guide, and inventing one produces documentation nobody reads. A change with nothing meaningfully testable needs no test, though say so out loud rather than skipping quietly: "hard to test" and "not worth testing" are different claims and only one of them is a reason.

Passing the quality gates is necessary, never sufficient. Then, still in this phase:

4. **Excellence pass** — with the behavior working, review the result against the grounded problem, the conceptual model, the proposal, and the domain's own quality bar. Ask not whether it works but whether this is the implementation that should remain: structure that fights the domain model, concepts introduced for implementation convenience that leak into a package's public surface, false distinctions the working system exposed, an API that satisfies the proposal but expresses the idea poorly, complexity inherited from the baseline. You identify the changes; an implementer makes substantive ones, then validation and this pass run again.
5. **Inline reviews** — proposal compliance first, then code quality. Resolve findings before advancing.
6. **Cross-artifact review** — read proposal, tests, guides, and code together and find where they disagree.
7. **Adversarial review** — dispatch the `adversary` agent: fresh context, a different model by virtue of its role, trying to falsify the claim that the work is done. It reports; it does not fix. Findings you decline are surfaced in the readiness report, never silently dropped. Skill: `adversarial-review`.
8. **Preview** — publish the cheapest real artifact through which the change can be exercised. Review of prose is not review of behavior.
9. **Readiness report** — post it to the PR linking the preview, set the proposal to `active-review`, and mark the PR ready. Make these updates together. If the human declined a proposal, post the report and mark the PR ready without creating a proposal or setting a proposal status.

A finding that changes what the feature should do goes back to the proposal and the human, not into the code. An implementer that reports a conflict between its instructions and the evidence hands the problem back rather than inventing an answer.

Skills: `.agents/skills/implementing-a-proposal/` for steps 1–3 and 5, `.agents/skills/excellence-pass/` for step 4, `.agents/skills/reviewing-an-implementation/` for steps 6, 8, and 9.

Pitlane has exactly two preview mechanisms, and both already run in CI:

| What the change touches | Preview |
| --- | --- |
| A package's behavior | the pkg.pr.new build: `npm i https://pkg.pr.new/pitlane-tools/pitlane/@pitlane/<name>@<sha>` |
| The docs site, or any guide | the Workers preview URL that `preview.yml` comments on the pull request |

Producing the preview therefore means confirming it installs or renders and linking it with what to try — not building a mechanism. A green workflow is not evidence. A change with no exercisable surface produces no preview; say that plainly in the report rather than inventing one.

### 4. Human review

The human reviews the report, the diff, and the preview. They comment on the PR; they may also commit directly. When feedback changes the intended design rather than correcting its implementation, **update the proposal first**, then re-run phase 3 against it.

Their verdict sets the status: `returned-for-revisions` to send it back, `accepted` to take it.

### 5. Completion and release

Update `VISION.md` if the change altered what Pitlane is, merge, release, update dependent repositories, then clean up. The release mechanics are `.agents/skills/releasing-pitlane-packages/`; a package the starters depend on adds `.agents/skills/adopting-packages-into-templates/`. Phase skill: `.agents/skills/completing-a-feature/`.

## Reframing hard problems

Repeated activity is not increasing understanding. Use `.agents/skills/reframing-a-problem/` when the evidence suggests the current formulation is itself wrong:

- repeated fixes keep exposing new contradictions;
- several locally reasonable approaches fail for apparently unrelated reasons;
- the implementation cannot proceed without violating a grounded domain constraint;
- a concept that should be simple needs a standing set of special cases;
- the current abstraction makes the domain awkward to express;
- an implementer hands back a strategic conflict instead of a result;
- you can describe symptoms but no coherent causal model.

Dispatch the `reframer` agent with the grounding, the proposal, the evidence, the approaches already tried, and the concrete failures; it challenges the premises independently. It does not change product intent on its own: its result comes back to you, and you decide whether to revise the grounding, the ontology, the proposal, the architecture, or the implementation. A change to intent goes to the human.

Use systematic debugging when the intended behavior is sound and the implementation is failing. Use reframing when the model of the problem may be wrong.

## Hard rules

- **Always ask before creating a proposal for this change.** Wait for explicit human approval; apply this even when you judge the work substantial, when they said "write a proposal", or when a design choice surfaces during implementation.
- **Never substitute planning for understanding.** A task list, an architecture sketch, or a plausible implementation strategy is not evidence that the problem is understood.
- **Never let generated knowledge become evidence.** Agent analysis stays inference until an authoritative source, the repository, or direct verification supports it.
- **Never treat an existing implementation as the domain.** Ground the problem first when independent domain knowledge exists, then read the code as a specimen.
- **Never silently encode an ontology decision.** A change to what kinds of things exist, their identity, relationships, lifecycle, states, or vocabulary goes back to the proposal.
- **Never let an implementer redefine intent or architecture to make implementation easier.** Strategic conflicts come back to the strategist.
- **When the human chooses a proposal, never implement it before approval.** The human sets `awaiting-implementation`. When they decline a proposal, use the agreed request and pull-request scope as the implementation contract.
- **Never write production code before its failing test.** If the behavior warrants a test at all and you wrote the code first, delete it and start over.
- **Never write guides from the finished code.** When a change warrants a guide, it is derived from the proposal. Whether it warrants one is a judgement; the direction of derivation is not.
- **Never claim work is done without running the verifying command this turn** and reading its output. See [`.agents/rules/verification.md`](.agents/rules/verification.md).
- **Never fix a bug before finding its root cause.** Skill: `.agents/skills/systematic-debugging/`.
- **Never let the adversarial reviewer edit code.** It reports; the implementer fixes.
- **Never delete a branch, force-push, or publish a release without explicit human confirmation.**
- **Never expand scope.** Implement only the agreed request or approved proposal. Resolve design changes with the human before changing that contract. A defect you discovered is not a licence to widen the work.
- **Never file an issue to defer work the proposal already requires.** Fix it.

## Policies and decisions

When a change establishes a rule future work must keep enforcing, record a **policy**. When it establishes an architectural choice future work must understand, record a **decision**. Discuss both with the human first; neither is a substitute for a proposal.

**Most changes establish neither, and that is the normal case.** The test is whether the knowledge outlives the change: if it does not, it belongs in the proposal and nowhere else. Both directories being empty is a healthy state, not a gap to fill. A record written speculatively is one nobody follows and everyone has to read.

A policy that can be enforced by a check should be — see [`.agents/rules/enforcement-hierarchy.md`](.agents/rules/enforcement-hierarchy.md). Prose is the tier most likely to be missed.

## Defects

You will find defects that are not the current proposal's problem — pre-existing on `main`, belonging to another package, or simply out of scope. Those become GitHub issues so they outlive the pull request.

A defect that stops the current implementation from satisfying its proposal is **not** one of these. It is the current work, and it gets fixed.

Search open and closed issues before filing. Write the issue so a reader who was never in this conversation can reproduce it. Link it from the PR when it was deliberately deferred, so the decision is visible. Skill: `.agents/skills/tracking-defects/`.

## Quality gates

```sh
mise run check       # docs:build, validate, tools:test, then oxfmt --check, oxlint, tsc
mise run fmt         # format
mise run validate    # the record: frontmatter, ids, cross-references
mise run tools:test  # the record tooling's own tests
mise run docs:prose  # Vale over the published prose
```

From inside `packages/<name>`: `vp test`, `vp run build`. `mise tasks` lists everything available.

## Also binding

- [`.agents/rules/verification.md`](.agents/rules/verification.md) — what proves a claim.
- [`.agents/rules/code-quality.md`](.agents/rules/code-quality.md) — what good code looks like here.
- [`.agents/rules/commit-discipline.md`](.agents/rules/commit-discipline.md) — commits, staging, push and pull-request policy.
- [`.agents/rules/enforcement-hierarchy.md`](.agents/rules/enforcement-hierarchy.md) — where a new rule belongs.

### Cross-cutting reasoning skills

- [`.agents/skills/grounding-a-problem/`](.agents/skills/grounding-a-problem/) — learn the problem domain before choosing a solution.
- [`.agents/skills/ontology-review/`](.agents/skills/ontology-review/) — check the conceptual model when important domain concepts change.
- [`.agents/skills/reframing-a-problem/`](.agents/skills/reframing-a-problem/) — challenge the formulation when the current model stops explaining reality.
- [`.agents/skills/excellence-pass/`](.agents/skills/excellence-pass/) — decide whether a working implementation is the one that should remain.
- [`.agents/skills/systematic-debugging/`](.agents/skills/systematic-debugging/) — find the root cause when the intended behavior is sound and the implementation is wrong.

# Repository conventions

## Tasks

Repo-level tasks live in `mise.toml` and run through Mise: `mise run status`, `mise run validate`, `mise run tools:test`, `mise run docs:dev`, `mise run docs:build`, `mise run fmt`, `mise run check`. Per-package tasks live in each package's `vite.config.ts` and run through Vite+: `vp test`, `vp run build` from inside `packages/<name>`. CI follows the same split — the docs, record, and leak workflows use Mise, the package workflows use Vite+.

## Releases

A release is a git tag plus a GitHub release on `main`. That is the only thing `.github/workflows/publish.yml` listens for (`on: release: types: [published]`), and it is the only route to npm for a package that already exists there. Never cut a tag or a release from a feature branch, and never reach for `npm publish` to ship a version the workflow could have shipped.

This section is the mechanics. The order around them — what to update before the merge, and what is still in its pre-release state after the tag — is `.agents/skills/releasing-pitlane-packages/SKILL.md`.

Feature and fix PRs capture consumer-visible package changes in `.changeset/*.md`, naming the affected packages and a patch, minor, or major bump. Write the body for someone deciding whether to upgrade. Keep package versions and numbered changelog sections unchanged until release preparation. Changes confined to repository tooling or agent guidance need no package release note.

From the repository root:

```sh
mise run changeset          # add a pending note
mise run changeset:status   # inspect pending packages and bump levels
```

Prepare versions only when the human requests it. Review the complete plan with them, including computed dependent bumps, before running:

```sh
mise run changeset:version
```

This consumes all pending notes, updates package versions and changelogs, and refreshes the pnpm lockfile. It neither commits, tags, nor publishes. Versions remain independent; private workspaces are excluded. Existing changelog history is retained. Land the preparation under the normal commit and review rules, then obtain explicit authorization to publish through the existing GitHub Release workflow. There is no automatically maintained release PR.

Keep capture, preparation, and publication distinct in commit messages:

- **`release:` is a commit scope reserved for version-only commits**, like `f6be34e release: @pitlane/dev@0.2.0 and @pitlane/theme@0.2.0`. A commit that also changes code or prose takes the scope of what it changes.
- **Never put "release `<package>` `<version>`" in a commit subject** unless the commit is that version-only bump. A subject that claims a release nobody performed costs a reviewer the time it takes to disprove it.

Checking what is actually published beats reasoning about it:

```sh
npm view @pitlane/dev versions     # what npm has
git ls-remote --tags origin        # what has been tagged
```

### A green job is not yet an installable package

`publish.yml` finishing green means npm accepted the publish. It does not mean anyone can install the version yet, and the two halves of the registry catch up in the order that looks most like failure:

| What                                                        | When it caught up       |
| ----------------------------------------------------------- | ----------------------- |
| `npm view <package> version`                                | about a minute          |
| `registry.npmjs.org/@pitlane/<name>/-/<name>-<version>.tgz` | two to six more minutes |

So there is a window, minutes long, where `npm view` names the new version and `npm install` still fails with a 404 on its tarball. All four releases on 2026-09-10 behaved this way. Do not re-cut a tag or re-run the workflow into it.

Read the job log instead of guessing. `+ @pitlane/<name>@<version>` and a `Provenance statement published to transparency log` line mean npm took it, and npm says so itself: `Your package is being processed and may take a few minutes to become available`.

The only check worth trusting is an install, which is what a consumer hits:

```sh
cd "$(mktemp -d)" && npm init -y >/dev/null
npm install @pitlane/<name>@<version>
```

That is also the gate for releasing a dependent. `pnpm pack` writes the resolved version into the dependent's manifest, so `@pitlane/dev` naming `@pitlane/crawler@^0.2.1` is uninstallable until crawler's own install works.

### A package's first publish is manual, once

`publish.yml` authenticates through npm Trusted Publishing (OIDC). A trusted publisher cannot be configured for a package that does not exist yet, so the workflow cannot perform a package's **first** publish: it fails with `ENEEDAUTH`, which is not a misconfiguration and not worth debugging. That is the one case where publishing from a laptop is correct.

Cut the tag and the GitHub release first, exactly as always. Then, from the released commit with a clean tree:

```sh
git checkout main && git pull --ff-only
git rev-parse --short HEAD '@pitlane/<name>@<version>^{commit}'   # must match

cd packages/<name>
vp test && vp run build          # the gates publish.yml would have run
npm pack --dry-run               # read the file list before it is permanent

npm login --auth-type=web
npm publish --access public --tag latest
```

Two flags earn their place. `--access public` is required because a scoped package defaults to restricted, and the default would publish something nobody can install. `--provenance` is **omitted**: it needs a CI OIDC token, so it fails from a laptop. That first version is the only one without a provenance attestation.

With 2FA set to `auth-and-writes`, `npm publish` opens a second browser approval after `npm login`. Both are interactive, so run them where a person can answer.

Afterwards, configure the trusted publisher on npmjs.com (package settings → Trusted Publisher → GitHub Actions, naming this repo and `publish.yml`). Every later version then goes through the release workflow, with provenance.

A first publish is the slow case: `npm view` itself 404s for several minutes, because the packument is being created rather than invalidated. The install check above is still the gate.

### Preview builds are not releases

`pkg-preview.yml` publishes an installable build of `@pitlane/crawler`, `@pitlane/dev`, `@pitlane/theme`, and `@pitlane/data-table-d1` to [pkg.pr.new](https://pkg.pr.new) on every branch push and pull request. Its job is named `preview` so a green check on a PR cannot be mistaken for a publish; it was called `publish` once, and it was. The npm workflow has no `push` or `pull_request` trigger and cannot run on a PR at all.

Releasing a package that the [templates](https://github.com/pitlane-tools/templates) depend on has one more ordering rule: publish the package first, then merge the companion templates branch. See `.agents/skills/adopting-packages-into-templates/SKILL.md`.

## Package reference docs are generated

Every page under `docs/package/` is emitted by TypeDoc from the packages' TSDoc comments and is gitignored. The whole TypeDoc setup lives in `.typedoc/`: one config per documented package (`dev.json`, `theme.json`, `crawler.json`, `data-table-d1.json`), each extending `base.json`, which registers the local theme and router in `plugin.mjs`. `mise run docs:api` runs them all.

Paths inside those configs resolve relative to the config file, not the repo root, so a package's entry points read `../packages/<name>/src/...` and its output `../docs/package/<name>`. Adding a documented package means adding a config there plus a line in the `docs:api` task.

`.typedoc/` is also a workspace package, and that is deliberate. TypeDoc is built on the TypeScript JS compiler API, which TypeScript 7 does not ship — 7 is a Go binary, and TypeDoc's peer range stops at 6.0.x. Its `package.json` therefore holds `typescript` as an alias for `@typescript/typescript6`, while the repo root and every package are on real `typescript@7`. `docs:api` runs from `.typedoc/` so TypeDoc picks up its own copy. Do not move TypeDoc back to the root: that is what made `typescript` mean 6 repo-wide, which in turn forced `@typescript/native-preview` on the `vp pack` declaration build.

Never edit a file under `docs/package/`; the next build overwrites it. Change the TSDoc comment in `packages/<name>/src/` instead. Narrative documentation belongs in `docs/guides/`.

## Docs prose linting

Hand-written user-facing docs are linted with [Vale](https://vale.sh) using the [vale-ai-tells](https://github.com/tbhb/vale-ai-tells) style package. Configuration lives in `.vale.ini`; synced styles land in the gitignored `.vale/` directory.

The oh-my-pi hook at `.omp/hooks/vale-prose.ts` automates this: after every successful `edit`/`write` touching those directories, it appends Vale's findings to the tool result, so the agent sees prose feedback immediately. The hook loads at session start and no-ops when `vale` is missing.

**When the hook is inactive (or you are a different agent), run Vale manually after every edit to a page under `docs/guides/`, and fix the findings before committing:**

```sh
vale docs/guides/styling.md   # one page
mise run docs:prose           # sync styles + lint all user-facing docs
```

If `vale` is not installed: `mise install`, or `brew install vale` followed by `vale sync` at the repo root.

Internal documents (`docs/internal/`, `docs/superpowers/`) are exempt, and so is the record: `VISION.md`, `proposals/`, `policies/`, and `decisions/` are not published, so Vale never sees them.

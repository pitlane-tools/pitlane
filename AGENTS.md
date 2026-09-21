# Pitlane agent contract

This repository runs the **Workbench** development process. [`PROCESS.md`](PROCESS.md) is the full description; this file is the operative contract. Its first half is the process, its second half the repository conventions the process operates on. Read it before doing anything substantial.

The governing principle: **no single artifact defines a feature by itself.** A proposal records intent, tests encode behavior, guides explain behavior, code implements behavior. Each is written independently, so that disagreement between them is visible before release.

You do not move directly from a request to an implementation.

## Start here, every session

```sh
mise run status
```

It reads the branch, the pull request, and the active proposal's status, then prints which phase the work is in and what happens next. Run it before asking where things stand, and again whenever you are unsure.

Nobody is expected to remember a command, a skill name, or an argument. "Keep going", "start a feature for X", or a plain description of a problem is a complete instruction — orient yourself from `mise run status` and proceed.

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

## The feature loop

```
branch → draft PR → proposal → tests → guides → code → validation
       → cross-artifact review → adversarial review → preview → readiness report
       → human review → revision → vision update → merge → release → cleanup
```

**Scale the process to the change.** The loop is written for substantial work — new or changed behavior, anything a reasonable person could build differently. A typo, a dead link, or a bug whose correct behavior was never in question does not need a proposal; fixing it is faster than describing it.

Some of those do not need a pull request either. Moving a file and deleting the empty directory behind it is a commit, not a review — there is nothing for a reviewer to agree or disagree with. The three conditions that allow a direct commit to `main`, and the reminder that an unnecessary pull request is cheap while a skipped one is not, are in [`.agents/rules/commit-discipline.md`](.agents/rules/commit-discipline.md#when-the-default-branch-is-reachable-directly).

Lean on one question: **does this change decide something?** If intent already exists — because a proposal promised the behavior, or because the contract is too obvious to write down — you are correcting an implementation, not defining one. Say which you think it is, in a line, before you start. Asking for more process is always granted without argument. When you discover partway through a small fix that a real design choice was hiding in it, stop and treat it as substantial work from that point.

### 1. Preparation

Create a branch, push it to `origin`, and open a **draft** pull request before writing anything. The pull request is the durable workspace: proposal, implementation, review discussion, and status reports accumulate in one reviewable place.

Pushing the branch is also what starts the previews — `preview.yml` and `pkg-preview.yml` both fire on a push to any branch other than `main`, so the artifacts phase 3 needs exist from the first push onward.

### 2. Proposal

Write `proposals/<NNNN>-<slug>.md` and **push it to the draft pull request as soon as it is coherent enough to react to**. Do not polish it privately — the pull request is where it gets read, commented on, and edited directly.

Then iterate, for as long as it takes. The proposal stays `status: draft` throughout, and must end up concrete enough to derive tests, guides, and an implementation from **without** rereading the original conversation. Unresolved questions are marked `[NEEDS CLARIFICATION: <question>]` and resolved with the human, never guessed.

The human decides when the proposal is settled and moves it to `status: awaiting-implementation`. That is the gate for phase 3. They may ask you to make the edit; deciding it yourself is prohibited.

Skill: `.agents/skills/writing-a-proposal/`.

### 3. Implementation

Strictly ordered, and it ends with review. Each artifact is an independent representation of the same intent; writing them out of order lets the code decide what "correct" means.

1. **Tests first.** Failing tests for the behavior the proposal's Detailed design specifies. `vp test` from inside `packages/<name>`.
2. **Guides next.** Written from the proposal, not from the code, into `docs/guides/`. Then compare them against the tests and confirm they describe the same behavior.
3. **Code last.** Implement against proposal, tests, and guides until `mise run check` and the package's own `vp test` and `vp run build` pass.

**Which of these a change needs is a judgement.** The order is not — when you write two of them, write them in this order. A change with no user-visible surface needs no guide, and inventing one produces documentation nobody reads. A change with nothing meaningfully testable needs no test, though say so out loud rather than skipping quietly: "hard to test" and "not worth testing" are different claims and only one of them is a reason.

Passing the quality gates is necessary, never sufficient. Then, still in this phase:

4. **Cross-artifact review** — read proposal, tests, guides, and code together and find where they disagree.
5. **Adversarial review** — an independent subagent, **fresh context and a different model**, tries to falsify the claim that the work is done. It reports; it does not fix. Findings you decline are surfaced in the readiness report, never silently dropped. Skill: `adversarial-review`.
6. **Preview** — publish the cheapest real artifact through which the change can be exercised. Review of prose is not review of behavior.
7. **Readiness report** — post it to the PR linking the preview, set the proposal to `active-review`, and mark the PR ready. Those three are one action.

Skills: `.agents/skills/implementing-a-proposal/` for steps 1–3, `.agents/skills/reviewing-an-implementation/` for steps 4, 6, and 7.

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

## Hard rules

- **Never implement substantial work without an approved proposal.** A conversational request is not a proposal. Corrections and fixes with unambiguous intent are not substantial work.
- **Never write production code before its failing test.** If the behavior warrants a test at all and you wrote the code first, delete it and start over.
- **Never write guides from the finished code.** When a change warrants a guide, it is derived from the proposal. Whether it warrants one is a judgement; the direction of derivation is not.
- **Never claim work is done without running the verifying command this turn** and reading its output. See [`.agents/rules/verification.md`](.agents/rules/verification.md).
- **Never fix a bug before finding its root cause.** Skill: `.agents/skills/systematic-debugging/`.
- **Never let the adversarial reviewer edit code.** It reports; the implementer fixes.
- **Never delete a branch, force-push, or publish a release without explicit human confirmation.**
- **Never expand scope.** Behavior not in the proposal does not get implemented. If it should exist, revise the proposal. A defect you discovered is not a licence to widen the work.
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

# Repository conventions

## Tasks

Repo-level tasks live in `mise.toml` and run through Mise: `mise run status`, `mise run validate`, `mise run tools:test`, `mise run docs:dev`, `mise run docs:build`, `mise run fmt`, `mise run check`. Per-package tasks live in each package's `vite.config.ts` and run through Vite+: `vp test`, `vp run build` from inside `packages/<name>`. CI follows the same split — the docs, record, and leak workflows use Mise, the package workflows use Vite+.

## Releases

A release is a git tag plus a GitHub release on `main`. That is the only thing `.github/workflows/publish.yml` listens for (`on: release: types: [published]`), and it is the only route to npm for a package that already exists there. Never cut a tag or a release from a feature branch, and never reach for `npm publish` to ship a version the workflow could have shipped.

This section is the mechanics. The order around them — what to update before the merge, and what is still in its pre-release state after the tag — is `.agents/skills/releasing-pitlane-packages/SKILL.md`.

A feature PR **may** carry the version bump and the changelog entry for the release it is heading toward: `@pitlane/dev@0.3.0` was tagged directly on the squashed PR commit that bumped it. That stages a release. It does not perform one, and the distinction is worth keeping visible in the history:

- **`release:` is a commit scope reserved for version-only commits**, like `f6be34e release: @pitlane/dev@0.2.0 and @pitlane/theme@0.2.0`. A commit that also changes code or prose takes the scope of what it changes.
- **Never put "release `<package>` `<version>`" in a commit subject** unless the commit is that version-only bump. A subject that claims a release nobody performed costs a reviewer the time it takes to disprove it. Note the bump in the body instead.

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

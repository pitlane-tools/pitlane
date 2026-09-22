# Commit Discipline

Commit often, atomically, and with messages a careful human would write. Commits are durable review units, not an afterthought.

## Natural commit points

Commit when the working tree is one coherent, internally consistent unit:

- A failing test, its implementation, and its verification are complete.
- A self-contained refactor is complete and its checks pass.
- A proposal, guide, policy, decision, or configuration change is complete and verified.

Do not commit half-edited, incomplete, or red work. Finish the thought — or stash and pivot — then commit.

## One logical change

One commit contains one logical change. If its description needs “and also,” split it. Keep unrelated dependency updates, formatting sweeps, and cleanup in separate commits or drop them.

## Scoped Commits

This repository uses [Scoped Commits](https://scopedcommits.com/), not Conventional Commits. Every ordinary subject is:

```text
<scope>: <imperative description>
```

Write an imperative, present-tense description: `add`, `fix`, `remove` — not `added` or `adds`. Keep the subject under roughly 72 characters, specific, and without a trailing period. Use an optional body for motivation or non-obvious trade-offs; wrap it at roughly 72 characters.

Do not write Conventional Commits `type(scope):` subjects. Scoped Commits lead with the area being changed.

The allowed scopes are:

| Scope | Use for |
| --- | --- |
| `proposal` · `policy` · `decision` | The corresponding record type |
| `guides` · `docs` | Pages under `docs/guides/`, and the published site |
| `tools` · `ci` · `mise` | The record tooling, workflows, and Mise task definitions |
| `agents` · `skills` · `rules` · `templates` · `hooks` | Agent process infrastructure |
| `readme` · `vision` | Project overview and direction |
| `treewide` | A genuinely repository-wide change with no narrower home |
| `<NNNN>-<slug>` | Work implementing that real proposal, such as `0007-export-queue` |

Product scopes — the packages and the other real areas of this repository — live in [`.agents/commit-scopes`](../commit-scopes), one scope per line. That file is the list; the `commit-msg` hook reads it, so it is not restated here. Add a scope there when a new package or area appears.

Prefer the narrowest scope that accurately describes the change; use `treewide` only for a true sweep.

Examples:

- `dev: instrument only exports shaped like Remix components`
- `theme: resolve a reference embedded in composite CSS text`
- `guides: reflow the option tables in the Vite plugin guide`
- `proposal: split token authoring from DTCG interchange`
- `hooks: enforce scoped commit subjects`
- `0003-token-composition: reject a duplicate scale key` — valid only once `proposals/0003-token-composition.md` exists; the hook checks for the file

Mechanical merge, revert, fixup, and squash commits are exempt. The `commit-msg` hook enforces ordinary subjects and scopes.

## Release commits

A release is a tag plus a GitHub release on `main`, never a commit. `AGENTS.md` and `.agents/skills/releasing-pitlane-packages/SKILL.md` own the mechanics; three of their rules are commit-message rules and belong here:

- A commit that implements a feature or a fix never carries a version bump. Work that changes what a package's consumers see adds a changeset note under `.changeset/` — write it with `mise run changeset` — and commits it alongside the work, under the scope of that work. The note names the packages and the semver intent; nothing hand-edits a `version` field or writes a numbered `## x.y.z` section into a `CHANGELOG.md`.

- `release:` is reserved for version-only commits, which are prepared only when the human asks for one. Such a commit holds exactly what `mise run changeset:version` produced — the generated changelog sections, the changeset notes it consumed, the rewritten package manifests, and the refreshed lockfile — and nothing else. A commit that also changes code or prose takes the scope of what it changes. Both such commits so far bumped several packages at once:

    ```text
    release: @pitlane/dev@0.2.0 and @pitlane/theme@0.2.0
    release: @pitlane/crawler@0.2.1, @pitlane/data-table-d1@0.2.1, and @pitlane/theme@0.4.1
    ```

- Never claim a release in a subject unless the commit is that version-only bump. Staging a release is what the changeset note does, and a note is not a version; a subject that claims a release nobody performed costs a reviewer the time it takes to disprove it.

## Staging

- Never use `git add .` or `git add -A`. Stage explicit paths only.
- Run `git status` before staging. Decide exactly what belongs in this commit.
- Run `git diff --staged` before committing. Unstage anything unexpected.
- Preserve the user's uncommitted changes. Do not discard, overwrite, stage, or reformat work you did not make.

## Commit hooks and history

- If a pre-commit hook fails, the commit did not happen. Fix the issue, re-stage, then create a new commit.
- Never bypass hooks with `--no-verify` unless the human explicitly asks.
- Default to a new commit. Amend only when the previous commit is local, the correction belongs to the same logical change, and amending makes history clearer.
- Never rewrite pushed history. Correct it with a new commit. A force-push is a history rewrite and requires explicit human confirmation.

## Never commit

- Secrets: environment files, credentials, tokens, and keys.
- Build output and generated artifacts the project does not track.
- Personal editor configuration unless the human explicitly asks.
- Large binaries unless the project explicitly tracks them.

If an unexpected secret appears in `git status`, stop and warn the human.

## Frequency

Prefer many small, focused commits to one large commit. Commit at each natural green boundary before beginning the next independent change.

## Push policy

Pushing the feature branch to `origin` is expected and routine: it creates and updates the draft pull request that serves as the durable workspace. Push early and push often.

This repository-level rule deliberately overrides the global agent rule that forbids pushing, opening a pull request, or otherwise sending commits upstream without an explicit request. Phase 1 cannot run without a pushed branch and a draft pull request, so both are authorized here; release, force-push, and branch deletion stay gated below.

### When the default branch is reachable directly

Work that decides something reaches the default branch by merging its pull request. That is the normal path and the one to assume.

A change that decides nothing may be committed straight to `main`. The test is whether a reviewer would have anything to say: when the diff is its own description, a branch and a pull request buy ceremony rather than review. Moving a file and deleting the directory it left behind is the canonical case; so are a typo, a dead link, a path left stale by an earlier move, and a generated file refreshed by its generator.

All three must hold:

- **No decision.** Intent already exists — a proposal promised the behavior, or the correct outcome was never in question. A change to how a package behaves fails this by definition, whatever its size.
- **Nothing to review.** The change is mechanical or factual, not a judgement someone could reasonably have made differently.
- **Verified by the gate.** `mise run check`, or the narrower task covering the change, passes — and passing is the whole proof, with no judgement left over.

Anything failing one of the three goes through a pull request. When it is genuinely unclear, open one: an unnecessary pull request costs seconds, and a skipped one costs a merged decision nobody saw. A human asking for a pull request is always right and never has to justify it.

Batching is not a way around this. Three mechanical commits may land together; a mechanical commit riding along with a substantive one may not.

Force-pushing, deleting a branch, publishing a release, and merging a pull request require explicit human confirmation. Merging happens in phase 5 after human acceptance, not because the agent judges the work acceptable.

---
name: releasing-pitlane-packages
description: Use when a human asks for a Pitlane package release — pending changesets have to become versions, a tag or GitHub release needs cutting, a published version has to reach dependent repos, or a companion PR in pitlane-tools/templates is waiting on a package that has not published yet. Also use when a release has landed and branches, draft PRs, or the vision document still describe the world before it.
---

# Releasing Pitlane Packages

## Overview

`AGENTS.md` owns the mechanics: a release is a git tag plus a GitHub release on `main`, that release event is the only route to npm, and a first publish is manual once. Read it. This skill owns the **order** around that tag — what a version is prepared from before it, and the things still in their pre-release state once it exists.

A release is finished when nothing upstream still describes the world before it and nothing downstream still points at a preview.

Feature work captures package changes in `.changeset/` notes. Prepare versions and changelogs only when the human requests it. Publishing through a GitHub Release requires explicit authorization; merging a feature or preparing its version does not grant it.

## Definition of done

All eight, every time. A release that stops after the tag is a release that left work for whoever notices next.

- [ ] `VISION.md` describes the world this PR creates, and the update is **on the branch** so the merge carries it
- [ ] The PR is landed, and the intent behind the work is retrievable from `main` without the branch
- [ ] The human asked for this release, and the plan `mise run changeset:status` printed — dependent bumps included — was reviewed with them before any version changed
- [ ] The tag is pushed and the GitHub release is published — one release per tag, dependency first
- [ ] `npm view` shows the version, checked rather than assumed
- [ ] Every dependent PR installs the published range, with no preview URL, tarball path, or override anywhere in its tree
- [ ] Every dependent PR that was drafted for an unpublished package is out of draft and green
- [ ] No branch for this work survives, local or remote, in any repo

## 1. Bring VISION onto this PR — before the merge

`VISION.md` is the project's account of itself, and a release is the event that makes it wrong. **Open it and check all six places before you merge anything.** Not the one you remember.

| Where in `VISION.md` | Goes stale when |
| --- | --- |
| The `N packages are on npm: …` paragraph | a package publishes its first version |
| The Meta-Framework capability table | a package adds or takes over a capability |
| `Planned package sequence` | a package ships, or a planned one is superseded |
| The package's own prose section | its API changes shape |
| `Release status` | a package joins the shipped set |
| `Reserved names` | `pitlane` or `create-pitlane` stops being a placeholder |

One more, easy to miss: a code sample naming a package that exists is written `@pitlane/<name>`, and a planned one keeps `pitlane/<name>`. A first publish flips its specifier everywhere the document imports it.

Write the edit yourself when the fact changed: a version claim, a `shipped at x.y.z`, a capability row for a package that now exists, an API sample that no longer compiles. **Ask the user first** when the edit changes direction rather than fact: killing or reordering a planned package, claiming a capability the document never claimed, or anything that changes what Pitlane says it is.

Commit it on the release branch, as its own `vision:` commit, before the merge. `17af271` is exactly that — the last commit on the branch before the `@pitlane/theme@0.3.0` merge, with `e7bd843` earlier on the same branch. Both predate the move to the repository root and so carry the `docs:` scope the document's old path implied.

Keep capability and API descriptions on the feature branch, marking unreleased work as pending. Update claims that name a version after preparation determines that version, in a separate `vision:` commit before the tag.

### The rationalizations, and what is true instead

| Excuse | Reality |
| --- | --- |
| "Additive minor bump; VISION only tracks settling changes" | It carries version claims and per-package API prose. A minor that changes either one makes the document wrong. |
| "The line already says shipped" | Issue #10 was three packages missing from a document that already said "shipped" about others. |
| "I'll sweep the docs after the release" | That is the sequence that produced #10. `f3c8ffb` is the cleanup nobody had scheduled. |
| "The PR author would have handled it" | Sometimes they did, on the branch. Where the commits are missing, you write them. |
| "It's unpublished, and gitignored docs regenerate" | `docs/app/content/api/` regenerates. `VISION.md` is hand-written and tracked at the repo root. |

## 2. Land the PR so the intent outlives the branch

The branch is about to be pruned. Decide where its reasoning goes **before** it is gone.

**Squash** when the branch is a single idea and its commits are steps toward it. The squash body is GitHub's commit list; write a real body when that list says nothing.

**Merge, not squash,** when each commit records a design decision or a defect found while implementing — that history has no other home once the branch is deleted. `c97d28a` is the precedent, and its body opens by saying so: "Merged rather than squashed. Each commit records a design decision or a defect found while implementing, and the branch is being pruned, so the history lives here."

Reading the precedent takes one command, so read it rather than guess: `git show --no-patch --format=%p <commit>` prints one hash for a squash and two for a merge. `a4f462e` has one; `c97d28a` has two.

```sh
gh pr merge <N> --merge --subject "<scope>: <what> (#<N>)" --body-file /tmp/merge-body.md --delete-branch
```

The subject takes the scope of what changed, never `release:` — that scope is reserved for version-only commits, and a subject claiming a release nobody performed costs a reviewer the time it takes to disprove. The body says what landed, what is breaking, and where the design record lives.

Three places hold the intent afterward, and a release should leave all three readable: the merge or squash commit body, the PR page (which keeps every commit even after the branch is deleted), and the proposal that designed the work.

The proposal is `proposals/<NNNN>-<slug>.md`, and the edit it needs is `status: implemented` — set after the release, never before, because an unshipped proposal marked implemented misrepresents the record. [`completing-a-feature`](../completing-a-feature/SKILL.md) owns that step; this skill only has to not leave it undone. Work the human declined a proposal for has no such file and gets no invented one: the pull request and the merge commit are its record, and there is no status to set.

Work that predates the record has its design in `docs/internal/designs/` instead, in a different shape: a prose `Status:` line rather than frontmatter. `285287b` is the template for updating one of those.

```
Status: **shipped in `@pitlane/theme@0.3.0`** (pitlane-tools/pitlane#9, merged).
Kept as the design record … Where it and the package disagree, the package is right.
```

## 3. Prepare the version — when the human asks — then tag it

Pending notes under `.changeset/` describe work for a future release. Prepare versions only on human request. First inspect the plan:

```sh
mise run changeset:status
```

Review all pending notes and the complete status plan with the human, including computed dependent bumps. Changesets can bump dependents when a new dependency version falls outside their current range. The version task consumes all pending notes, so agree the full scope before running it.

One thing preparation will not repair: a hand-written `## Unreleased` section someone left in a `CHANGELOG.md`. `changeset version` does not consume that section, so it survives into the published changelog. Migrate it into a note first, then prepare.

```sh
mise run changeset:version   # rewrites the manifests, writes the changelog sections, consumes the notes, refreshes the lockfile
```

The task neither commits, tags, nor publishes. Commit its generated changelogs, consumed notes, manifests, and lockfile together under `release:`, then land the preparation on `main` under [`.agents/rules/commit-discipline.md`](../../rules/commit-discipline.md). Do not use `changeset publish` or `changeset git-tag`; the existing GitHub Release publisher remains in place.

With that commit on `main` and explicit human authorization to publish, cut the tag:

```sh
git checkout main && git pull --ff-only
node -p "require('./packages/<name>/package.json').version"   # must equal the tag, or publish.yml fails the job
git tag -a "@pitlane/<name>@<version>" -m "<one line>"
git rev-parse --short HEAD "@pitlane/<name>@<version>^{commit}"   # both hashes must match
git push origin "@pitlane/<name>@<version>"
gh release create "@pitlane/<name>@<version>" --title "@pitlane/<name>@<version>" --notes-file /tmp/notes.md
```

**One release per tag.** A commit that bumps two packages gets two tags and two releases: `a4f462e` carries both `@pitlane/crawler@0.1.0` and `@pitlane/dev@0.5.0`. Release the dependency first — `pnpm pack` rewrites dev's `workspace:^` on crawler to the version the monorepo resolved, so dev's published manifest names a crawler version that has to exist on npm already or every install of dev fails.

**The release notes are written, not pasted.** Every release body in this repo is prose rewritten from the CHANGELOG for someone deciding whether to upgrade: what changed, a code sample of the new shape, what breaks, and links to the changelog and to the proposal that designed it. `@pitlane/crawler@0.1.0`'s CHANGELOG entry is five bullets; its release body is five paragraphs. A first publish also carries the `> [!NOTE]` explaining why that one version has no provenance attestation.

Then watch the thing that actually publishes, and check the registry rather than the checkmark:

```sh
gh run watch "$(gh run list --workflow=publish.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
npm view @pitlane/<name> versions
curl -sI https://registry.npmjs.org/@pitlane/<name>/-/<name>-<version>.tgz   # 200 before the packument catches up
```

A red publish job leaves the tag and the release in place with nothing on npm. Nothing downstream moves until `npm view` says the version exists.

## 4. Move dependents onto the published version

Find the existing checkout; do not clone a second one. `pitlane-tools/templates` lives at `~/Developer/Templates/pitlane` on this machine:

```sh
git -C ~/Developer/Templates/pitlane remote get-url origin
git -C ~/Developer/Templates/pitlane log --branches --not --remotes --oneline   # unpushed work lives here
```

A second clone hides whatever the first one has not pushed, and the first one is where the person works.

Each dependent PR needs four edits, and the second one is the one that gets forgotten:

1. **The range.** Replace the `pkg.pr.new` URL, the `file:/tmp/*.tgz` override, or the stale range with `^<version>` in every template's `package.json`, and with `"npm:@pitlane/<name>@^<version>"` in the `imports` map of each Deno template's `deno.jsonc`. Then prove it: `grep -rn 'pkg.pr.new\|file:/tmp' .` must find nothing, lockfile included.
2. **The release-age gate.** Add the package to `minimumReleaseAgeExclude` in the root `pnpm-workspace.yaml`, which gates resolution for every template, **and** in the `pnpm-workspace.yaml` of each template that declares the dependency, so a scaffolded app installs it too. `@pitlane/data-table-d1` sits in root plus `cloudflare`; `@pitlane/dev` sits in root plus all six. pnpm 11 blocks a version published minutes ago. The root omission is the one that reddens CI, and it does not fail with a release-age message: it churns resolution until the git-hosted remix preview re-prepares and dies on its own out-of-date lockfile. What you see is `ERR_PNPM_PREPARE_PACKAGE`, four layers from the cause, in every node template — including the ones that do not depend on the package at all. A missing per-template entry is quieter and worse: this repo stays green and the app somebody scaffolds hits the gate.
3. **The lockfile**, resolved from the real registry: `pnpm install`, then stage the changed paths by name. Never `git add -A` in a repo whose working tree you did not start clean.
4. **The PR body.** It was written to say the branch cannot merge yet. Lead it with what is now true: `> [!NOTE]` `This PR now depends on the published @pitlane/<name>@<version> release via the ^<version> range.`

### A dependent can be superseded rather than behind

Check what the branch actually contains before you edit its ranges:

```sh
gh pr view <N> --repo pitlane-tools/templates --json isDraft,mergeStateStatus,updatedAt
git -C ~/Developer/Templates/pitlane show <branch>:cloudflare/app/theme.ts | head -20
```

A `DIRTY` merge state plus code written against an API two breaking versions back is a superseded branch, not a stale range — bumping the range leaves every template shipping code that does not parse. Close it with a comment naming its replacement and redo the adoption on a fresh branch, which also skips the tarball-override dance in `adopting-packages-into-templates`: the package is already on npm by the time that branch exists. Closing someone's PR is a direction change; ask first.

## 5. Take the drafts to ready

A companion PR is a draft because it could not build against a package that did not exist. That condition is now cleared, so clear the draft — but only after CI has been green against the published package, not against the preview it used to install:

```sh
gh pr ready <N> --repo pitlane-tools/templates
gh pr checks <N> --repo pitlane-tools/templates --watch
gh pr merge <N> --repo pitlane-tools/templates --squash --delete-branch
```

Templates PRs squash; their titles are already written as squash subjects.

## 6. Prune the branches

`gh pr merge --delete-branch` removes the remote branch and the local one in the clone where you ran it. Everything else is manual, in both repos:

```sh
git log --branches --not --remotes --oneline    # FIRST: anything here is unpushed work, not garbage
git checkout main && git pull --ff-only
git fetch --prune
git branch -d <branch>                          # merged work: -d, and read what git refuses
git branch -D <branch>                          # only a branch deliberately abandoned, after the check above
git push origin --delete <branch>               # only if the merge did not
git branch -a --list '*<branch>*'               # expect nothing, in both clones
```

## 7. The staleness sweep

The same release makes other files wrong. Check them, fix what this release broke, and **report rather than bundle** anything that was already stale:

- `README.md` — the shipped-package list and its badges
- `docs/app/content/guides/` — a guide showing the old API (and `vale docs/app/content/guides/<page>.md` after any edit)
- Tracking issues — `gh issue close <N>` when this release is what closed it, and open one for a gap you found and are not fixing here
- Dependents you did not touch — a Deno template pinned to `^0.4.0` while the package is at `0.5.1` is a real finding, and a separate PR
- Packages in this repo that depend on the one you released. `mise run changeset:version` already bumped a workspace dependent whose `workspace:` range demanded it, so that companion bump was in the plan you reviewed. What it cannot decide is a dependent that is **already published** against a range this version leaves behind: `npm view @pitlane/dev dependencies` reports what the published dependent pins, `@pitlane/dev@0.5.1` pins `@pitlane/crawler: ^0.1.0`, and a `0.2.0` does not satisfy that range. Until the dependent publishes too, the release reaches nobody through it. Decide whether it needs a release of its own, and say so either way.

## Common mistakes

| Mistake | Do instead |
| --- | --- |
| Hand-editing a `version` field or a `CHANGELOG.md` section on a feature PR | Write a changeset note; preparation generates both |
| Running `mise run changeset:version` because notes have piled up | Preparation is on request; review `changeset:status` with the human first |
| `changeset publish` or `changeset git-tag` | Neither runs here; the existing GitHub Release workflow publishes |
| Preparing a version over a hand-written `## Unreleased` section | Migrate it into a note first; `changeset version` leaves it in place |
| Merging before VISION is updated | The update rides on the branch; the merge carries it |
| Squashing a branch whose commits each record a decision | `--merge` with a body that says why, like `c97d28a` |
| Release notes pasted from the CHANGELOG | Rewrite them for someone deciding whether to upgrade |
| One release for a commit that bumped two packages | One tag and one release each, dependency first |
| Merging a dependent PR on a green preview build | Merge only after `npm view` shows the published version |
| Swapping the range but not `minimumReleaseAgeExclude` | Root plus every template that declares it, or CI dies four layers away |
| `git add -A` in the dependent repo | Stage the changed paths by name; that tree may hold unpushed work |
| `gh repo clone` for a repo that already has a checkout | Find the existing one; it may hold unpushed commits |
| `git branch -D` to make the branch list clean | `-d` for merged work; `-D` only for a branch you decided to abandon |
| Bumping the range on a branch written against a two-generations-old API | Close it as superseded and redo the adoption |
| `npm publish` from a laptop for a package that already exists | The tag and the release; the laptop path is the first publish only |

## Red flags — stop

- About to run `mise run changeset:version` when nobody asked for a release
- About to cut a tag for a version prepared from a plan the human never saw
- About to merge a change to a package's behavior with nothing in `.changeset/` describing it
- About to run `gh pr merge` without having opened `VISION.md`
- About to `gh pr ready` while the branch still names a preview build
- About to merge a dependent PR while `npm view` has not shown the version
- Release notes that are the CHANGELOG with the bullets still in it
- A `release:` scope on a commit that changes code
- A tag cut from anything other than `main`

---
id: proposal.0004
title: Changesets for Deferred Package Releases
authors: [Mark Malstrom]
status: withdrawn
pull-request: https://github.com/pitlane-tools/pitlane/pull/28
issues: []
supersedes: []
---

# Changesets for Deferred Package Releases

Withdrawn at the maintainer's request. Changesets adoption with on-request release preparation needs no proposal. The additional details below are unapproved draft suggestions, retained as history.

## Summary

Use Changesets to capture package changes with their implementation, then prepare versions and changelogs when a maintainer requests a release. Preserve independent package versions, existing changelog history, and GitHub Release-triggered npm publication. Add a CI check so package-changing pull requests record a release-impact decision.

## Motivation

Pitlane records changes in package changelogs and GitHub releases, but feature pull requests currently prepare numbered changelog entries and version bumps themselves. That ties remembering a change to deciding when to release it. Changes that wait for a later release need a durable place to accumulate.

[PR #27](https://github.com/pitlane-tools/pitlane/pull/27) demonstrates the gap. It fixes content prebuilds invalidating Vite's browser dependency cache, but also reserves `@pitlane/content@0.1.2` before the maintainer has chosen to release the fix. Several unrelated fixes could belong in that eventual patch. Their authors should be able to record them without coordinating a version number or reconstructing the release from commit history later.

## Proposed solution

Commit a Markdown changeset alongside each releasable package change. It names the affected packages, the intended SemVer increment, and the consumer-visible change. Ordinary feature and fix pull requests stop editing package versions and numbered changelog entries.

On request, Changesets combines pending notes into a release plan and prepares the package manifests and changelogs. The maintainer reviews those changes in a release-preparation pull request. Publishing remains a separate, explicitly authorized action through the existing release workflow.

```text
Package change + pending changeset → merge → accumulate notes
Maintainer requests preparation → review versions and changelogs
Maintainer authorizes publication → existing GitHub Release workflow
```

## Detailed design

### Tooling and package scope

Add `@changesets/cli` as a root development dependency and initialize `.changeset/config.json`. The published stable CLI at proposal time is 3.0.3. Its Node and pnpm requirements fit the repository's Node 24 CI, Node 26 local toolchain, and pnpm 11. Installation stays locked through `pnpm-lock.yaml`.

Changesets covers all public workspace packages, including the reserved `pitlane` and `create-pitlane` packages. Private demos, the private root, and `.typedoc` are excluded from versioning and tagging by `privatePackages: { "version": false, "tag": false }`. Do not maintain a second handwritten package-name allowlist.

Configure `baseBranch: "main"`, `access: "public"`, `commit: false`, `fixed: []`, `linked: []`, `ignore: []`, `updateInternalDependencies: "patch"`, and `format: "oxfmt"`. Retain the standard Git-linked changelog generator, `@changesets/cli/changelog`, without introducing a GitHub token requirement for local version preparation. Packages remain independently versioned.

Use Changesets' dependency planning without replacing it. An out-of-range internal dependency update must appear in the dependent's release plan. An in-range dependency patch does not, by itself, promise a release of every dependent. Preserve the existing `workspace:` protocol and pnpm packing behavior.

### Capturing changes

A pending note lives in `.changeset/<slug>.md` and travels in the pull request that implements the change. Its frontmatter maps package names to `patch`, `minor`, or `major`; its body explains the change for a package consumer. Authors choose the increment under the existing package-version conventions. Commit messages do not determine release severity.

For the content fix, the note would be:

```md
---
"@pitlane/content": patch
---

Prevent content prebuilds from invalidating Vite's optimized browser dependencies, fixing 504 errors that interrupted MDX updates and client-side navigation.
```

Multiple notes may accumulate for one package. Preparing a release combines their text and uses Changesets' release calculation rather than incrementing the version once per note. Notes for unrelated changes stay separate. A note may name several packages when the same change applies to all of them; Changesets' partial-release restrictions then apply to that shared note.

The note records release intent without changing `package.json`, reserving a version number, creating a numbered changelog section, or publishing anything. Existing released changelog sections remain in place. Do not backfill already-published releases into pending changesets.

### Maintainer commands

Expose the installed CLI through root Mise tasks:

| Task | Behavior |
| --- | --- |
| `mise run changeset` | Add a changeset through the upstream CLI; accept its interactive and non-interactive arguments, including `--empty`. |
| `mise run changeset:status` | Report the pending release plan, including dependent packages, without changing files. |
| `mise run changeset:version` | Apply the pending release plan, generate changelog sections, consume the applied notes, and refresh the pnpm lockfile without running lifecycle scripts. |

The version task runs only when the maintainer requests release preparation. The default batch includes all pending notes. Selective preparation uses the upstream `--ignore` option and its dependency/shared-note safeguards; provide an argument path to that option without forwarding those arguments to the lockfile command. Do not build a separate selection or version-calculation system.

Preparation happens on a release-preparation branch with a clean working tree. The resulting diff is reviewed and committed by explicit paths. Neither Changesets nor the Mise tasks stage files, commit, push, tag, create a GitHub release, or publish to npm. A failed preparation or lockfile update stops the task and leaves the diff for inspection; it does not commit partial output or discard existing work.

Version preparation preserves historical release entries and adds the generated sections to each affected package's existing `CHANGELOG.md`. Its output includes dependency-release information when Changesets determines a dependent needs a release. An empty changeset produces no package bump or consumer-facing changelog entry.

### CI release-impact check

Add a read-only pull-request check using `changeset status --since <base-ref>`, with the PR's base history available. The ordinary target is `main`. The check examines new changesets on the pull request, so an unrelated pending note already on `main` cannot satisfy it.

When public packages changed but no new changeset exists, the check fails with instructions for adding a note or recording that no release is needed. Changes outside public packages do not require a package release. Test-only or tooling-only changes within a package may use an empty changeset whose body explains the no-release decision.

Release-preparation pull requests consume previously reviewed notes and introduce no new package behavior. They also carry an empty changeset explaining that decision, added after version preparation, so the same check applies without a branch-name or title-based bypass. That empty note does not schedule another release.

The standard check establishes the presence of a release-impact decision. It does not prove that every affected package is listed, that a bump level is correct, or that an empty note is justified; those remain review responsibilities. Do not claim stronger coverage or add a custom semantic classifier.

Use the existing `pull_request` validation boundary and read-only repository permissions. No privileged `pull_request_target` execution, release bot, or new publishing credentials are needed. Running the check locally remains available through the CLI with an explicit base ref.

### Release and process integration

Changesets owns pending notes and version/changelog preparation. `.github/workflows/publish.yml` continues to own npm publication, triggered by a published GitHub release on `main`. Preserve its package-tag checks, npm Trusted Publishing, provenance, pnpm packing, and dependency-first publication order. The existing one-time manual first-publish exception remains unchanged. Do not wire `changeset publish` or `changeset git-tag` into release preparation or CI.

GitHub release notes continue to be written for readers deciding whether to upgrade. Use the generated package changelog as the source for included changes, adding migration examples and compatibility information where useful. This removes the need to rediscover pending work while preserving the current release-note presentation.

Update the release conventions in `AGENTS.md`, `PROCESS.md`, `.agents/rules/commit-discipline.md`, and the affected implementation, review, completion, and release skills. The workflow must distinguish merged code with pending notes, prepared versions, and published packages. Replace the current convention that feature pull requests may prepare version bumps and numbered changelog entries. The `release:` commit scope remains for release-only metadata changes, including generated changelogs, consumed notes, and lockfile updates.

An accepted package change may merge without immediate publication. Its proposal remains `accepted` until the corresponding release has shipped; merging alone must not mark it `implemented`. Release completion must reconcile all proposals represented in the release batch, update published-version claims and dependent consumers, and retain the existing human gates for merge, publication, and branch deletion. No new proposal status is introduced. Vision and status reports must distinguish pending work from npm availability.

### Migrating the pending content fix

Keep the tooling adoption and PR #27 separate. Land the Changesets setup before merging the content fix, then update #27 against that setup: retain its implementation and regression test, replace its unshipped `0.1.2` changelog entry with the patch changeset, and return its manifest to the published baseline of `0.1.1`. The note belongs with the fix, so the adoption pull request must not queue a release note for code that has not landed.

Recheck npm and tags when performing the conversion. Never lower an already-published version or leave both a pending note and a numbered entry describing the same unreleased fix. If the fix has shipped before adoption, preserve that released history and omit its pending note. If it has merged but remains unreleased, the conversion belongs in the adoption change, with the published baseline verified first.

### Verification

Exercise the real CLI in disposable workspaces before implementation is declared ready. Adding a note must leave package versions and changelogs unchanged. Multiple pending notes must produce one calculated version with every note represented. Verify a mixed-severity batch, an empty no-release decision, private-package exclusion, and internal dependency propagation across a version-range boundary.

Run the CI command against separate base/head histories to prove that an old base-branch note cannot satisfy a new package change, an explicit empty note permits an intentional no-release change, and a release-preparation diff can pass without scheduling a follow-on release. Verify selective preparation rejects an ignored package that shares a changeset with a selected package and keeps unapplied notes pending.

After version preparation, verify the lockfile is consistent with a frozen install and that existing changelog entries remain present. Preparation must perform no registry writes or tag creation. Use focused permanent tests only for any Pitlane-owned behavior added around the CLI; do not duplicate Changesets' test suite merely to test its defaults.

## Compatibility

No consumer API or runtime behavior changes. Existing npm versions, package tags, and changelog history remain valid. The current public package names and independent versioning model are unchanged.

Maintainers stop making version bumps in ordinary feature pull requests. The publishing trigger and the requirement for explicit human authorization stay unchanged. Private workspace packages remain private and unversioned.

## Implications on adoption

Install the root development dependency through the normal workspace install. Contributors add a release-impact note to package-changing pull requests. Maintainers request version preparation when they are ready to review a release batch.

No GitHub App, Actions-created-PR permission, or additional secret is required. Changeset Markdown remains reviewable without running the CLI. Existing work prepared under the old process must be converted once, with npm availability checked before removing any numbered version entry.

## Scope

- Root Changesets dependency, configuration, and Mise commands for capture, status, and on-request preparation.
- Pull-request release-impact validation, with explicit no-release decisions supported.
- Updates to the existing contributor and agent release workflow, plus the pending-content-fix cutover.
- Real CLI verification of capture, preparation, dependency planning, and CI behavior without publishing.

### Out of scope

- Automatically maintained release pull requests, automatic merge, or publication on feature merges.
- Replacing `publish.yml`, its authentication, or the current package-tag scheme.
- Snapshot releases, prerelease channels, and replacing pkg.pr.new previews.
- Rebuilding historical changelogs from GitHub, versioned documentation hosting, or unrelated repository quality-gate repairs.

## Preview

- Artifact: no pkg.pr.new or Workers preview for this repository-maintenance change; neither exposes the root release commands. No new hosted preview mechanism is introduced.
- Exercise: the implementation branch provides the installed CLI and Mise tasks. A maintainer can use a disposable checkout to add sample notes, inspect `changeset:status`, run version preparation, and review the actual generated diff without building a new tool or publishing a package. The readiness report must include those commands and their observed results.

## Policies and decisions checked

- `policies/` and `decisions/` contain no policy or decision records. Their directory guidance was read.
- `VISION.md` permits necessary tooling dependencies and requires independently useful packages with their own releases. Changesets remains a development dependency, with no fixed or linked version groups.
- `AGENTS.md` and `PROCESS.md` retain GitHub Release-triggered npm publication and human authorization. Their feature-time version-bump convention changes as described above; the proposal requests that change explicitly.
- `.agents/rules/enforcement-hierarchy.md` favors deterministic checks over remembered prose. Release-impact presence is checked by CI; judging its accuracy remains a review responsibility.
- `.agents/rules/commit-discipline.md` retains explicit staging and human-gated publication. Changesets auto-commit is disabled.

## Future directions

An automatically maintained release-preparation pull request could use the same note format later. It would require a separate decision about repository permissions and validation of bot-authored changes. It is not needed for the selected on-request workflow.

## Alternatives considered

- Continue numbered changelog entries in feature pull requests: retains the need to reserve a version and coordinate unrelated pending changes before choosing a release.
- Keep handwritten `Unreleased` sections: records pending work, but leaves version calculation, dependency propagation, and concurrent edits to shared files with the maintainer.
- Maintain a Changesets release pull request automatically: provides a continuously updated release diff, but adds automation and permissions. The maintainer selected preparation on request.
- Move publication to Changesets: changes a working, human-gated publishing path beyond the requested problem. Keep the existing publisher.

## Open questions

The agreed direction is Changesets with on-request release preparation. This withdrawn draft imposes no approval gate or additional requirements.

## Acknowledgments

The [Changesets CLI](https://changesets.dev/guide/cli), [configuration reference](https://changesets.dev/guide/config), and [automation guide](https://changesets.dev/guide/automating) define the upstream behavior used here. Version 3.0.3 and its engine requirements were checked against npm while preparing this proposal.

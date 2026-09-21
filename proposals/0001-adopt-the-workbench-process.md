---
id: proposal.0001
title: Adopt the Workbench Development Process
authors: [markmals, Claude]
status: implemented
pull-request: none; adopted directly on main
issues: []
supersedes: []
---

# Adopt the Workbench Development Process

## Summary

Adopts the [Workbench](https://github.com/markmals/workbench) development process in this repository: a vision, numbered proposals, policies and decisions at the repository root, guides that stay where they already are, and previews that are already running in CI — enforced by a record validator, a CI job, a `commit-msg` hook, and a session hook. Keeps the documentation site and the TypeDoc generator exactly as they are.

This proposal is the first record, and it was written as the adoption landed rather than before it. That inversion is deliberate and is described under [The bootstrap exception](#the-bootstrap-exception).

## Motivation

Pitlane already had process; it had three of them, none of them enforced.

`docs/superpowers/plans/` and `docs/superpowers/specs/` hold five plans and six specs from a task-runner workflow that is no longer used — one design never got a plan. `docs/internal/proposals/` holds two hand-written design documents in a different shape, with no status, no identifiers, and no relationship to the pull requests that implemented them. `docs/internal/VISION.md` was the most load-bearing document in the repository — the release skill already told an agent to open it and check six specific places — and nothing tied it to the changes that made it stale.

Two skills, `releasing-pitlane-packages` and `adopting-packages-into-templates`, encode hard-won release ordering. Both start after a change is designed and implemented. Nothing covered the part before that: how a change gets specified, who decides it is settled, what a claim of "done" has to be backed by, and where a reviewer exercises the behavior instead of reading about it.

The result is the failure mode Workbench exists to prevent. An agent goes from a request to an implementation, writes tests that agree with whatever it built, and documents the result rather than the intent. Everything corroborates everything else and none of it is evidence.

A second, narrower motivation: the four packages that publish to npm (`@pitlane/dev`, `@pitlane/theme`, `@pitlane/crawler`, `@pitlane/data-table-d1`) are consumed by the starter templates and by real applications. Published behavior is expensive to take back, which raises the value of making intent explicit before the code exists.

## Proposed solution

Vendor Workbench's process infrastructure into this repository, then adapt it to what Pitlane actually has rather than adapting Pitlane to it.

The process is unchanged: five phases, tests before guides before code, a cross-artifact comparison, an adversarial pass from a different model, a preview a human can exercise, and a readiness report. What changes is every binding to a path, a command, or a workflow — those now name real ones.

```text
branch → draft PR → proposal → tests → guides → code → validation
       → cross-artifact review → adversarial review → preview → readiness report
       → human review → revision → vision update → merge → release → cleanup
```

The documentation site and its generators are untouched. `docs/` remains product documentation built by VitePress, `docs/package/` remains TypeDoc output, and the record lives outside `docs/` so the site never sees it.

## Detailed design

### What is vendored

| Path | What it is |
| --- | --- |
| `PROCESS.md` | The full process description, with pitlane's previews and release path bound into it. |
| `AGENTS.md` | The operative contract. Gains the process; keeps every existing repository convention. |
| `.agents/rules/` | `verification.md`, `code-quality.md`, `commit-discipline.md`, `enforcement-hierarchy.md`. |
| `.agents/skills/` | `writing-a-proposal`, `implementing-a-proposal`, `reviewing-an-implementation`, `completing-a-feature`, `tracking-defects`, `systematic-debugging`. |
| `.agents/templates/` | The canonical shape of a vision, proposal, policy, decision, guide, and readiness report. |
| `.agents/hooks/commit-msg` | Rejects a subject that is not a Scoped Commit, and a scope that is not real. |
| `tools/validate.mjs`, `tools/status.mjs` | The record validator and the one command that reports where the work is. Dependency-free. |
| `proposals/`, `policies/`, `decisions/` | The record. Each carries a `README.md` describing its frontmatter and lifecycle. |
| `.github/pull_request_template.md` | The phase checklist. |

### What is adapted, and why

**The vision moves to the repository root.** `docs/internal/VISION.md` becomes `VISION.md`, with the `title` and `updated` frontmatter the validator requires. It was already excluded from the site by `srcExclude: ["internal/**"]`, so nothing about publication changes; what changes is that the vision now sits beside the record that keeps it honest, and `mise run validate` fails when its `updated` date is not a date. Every reference in `releasing-pitlane-packages` is repointed. The two historical documents under `docs/internal/proposals/` keep their prose, including their stale line references — rewriting history to match a new convention is exactly what the supersession rules exist to prevent.

**Guides are a process artifact but not a record type.** Workbench validates `guides/<slug>.md` with `id`, `title`, and `describes: [proposal.NNNN]` frontmatter. Pitlane's guides are published VitePress pages under `docs/guides/` with `title` and `description`, linted by Vale, listed in a sidebar, and shipped to [pitlane.tools](https://pitlane.tools). Putting a second, record-shaped contract on the same pages would buy one reverse pointer at the cost of thirteen retrofitted pages, most of which predate the record and would carry `describes: []`. So `tools/validate.mjs` drops the guide type entirely, and the proposal's own prose carries the guide linkage. Guides keep their place in the order: written from the proposal, before the code, then compared against the tests.

**The record is not published.** `VISION.md`, `proposals/`, `policies/`, and `decisions/` sit outside `docs/`, which is the only directory VitePress builds. No sidebar entry, no record layout components, no clarification-marker plugin. The site keeps documenting the product.

**Previews are the two mechanisms that already exist.** Workbench ships a preview table keyed to repository shape and asks a project to wire the matching row. Both rows are already wired here, and both fire on a push to any branch other than `main`: `pkg-preview.yml` publishes installable package builds to pkg.pr.new, and `preview.yml` uploads a Cloudflare Workers preview version of the docs site and comments its URL on the pull request. Phase 3 therefore confirms the artifact installs or renders and links it with what to try; it does not build a mechanism. Neither preview is private, which is now stated where it matters instead of assumed.

**Release defers to the skill that already owns it.** `completing-a-feature` no longer says "inspect `mise tasks` for the release path". The path is a Git tag plus a published GitHub release on `main`, the only trigger `publish.yml` listens for, and the ordering around it stays in `releasing-pitlane-packages` and `adopting-packages-into-templates`. This proposal changes no release mechanics.

**Commit scopes come from real history.** `.agents/commit-scopes` lists the product scopes the hook accepts beyond its built-ins, each one corresponding to a package, a directory, or a documented convention. The `release:` scope keeps the meaning `AGENTS.md` already gave it: version-only commits, and never a subject claiming a release nobody performed.

**The push policy overrides the global rule.** The global agent rules forbid pushing without an explicit request. This process cannot run without a pushed branch and a draft pull request, because that pull request is the workspace where the proposal is read, commented on, and edited. `.agents/rules/commit-discipline.md` therefore makes pushing a feature branch routine and expected, prohibits pushing to `main`, and keeps force-push, branch deletion, merging, and publishing behind explicit human confirmation. Repository rules override global ones by design; this is that override, stated where a reader will find it.

### What is deliberately not vendored

- **Workbench's human-facing guides** (`getting-started`, `running-a-feature`, `writing-a-good-proposal`, `keeping-the-record`, `choosing-a-preview`, `adapting-your-harness`). `PROCESS.md`, `AGENTS.md`, and the record READMEs cover the same ground for this repository, and `docs/guides/` is product documentation, not process documentation.
- **A copy of the `adversarial-review` skill.** The harness already provides one at user level, and it is a superset of Workbench's. `reviewing-an-implementation` dispatches it by name and states the full contract inline — fresh context, strongest available different model, report-only, looped to `CONVERGED`, declined findings preserved — so a harness without the skill is still bound by the requirement.
- **The record's VitePress layout components and sidebar generation.** Consequence of not publishing the record.
- **Workbench's `mise.toml`, `package.json`, and formatter config.** Pitlane's toolchain wins; only tasks were added.

### Enforcement

Prose is the tier most likely to be missed, so every checkable part is a check.

| Tier | Mechanism |
| --- | --- |
| Checks | `mise run validate` (`tools/validate.mjs`); the `record` job in `.github/workflows/test.yml`; the `commit-msg` hook; Vale through `.omp/hooks/vale-prose.ts` |
| Tasks | `mise run check`, which now depends on `docs:build`, `validate`, and `tools:test`; `vp test` and `vp run build` per package |
| Templates | `.agents/templates/`, including the proposal's "Policies and decisions checked" section |
| Prose | `AGENTS.md`, the skills, and the rules |

Three new Mise tasks: `validate` (the record), `status` (where the work is and what happens next), and `tools:test` (the record tooling's own `node:test` suites — namespaced because package tests run through Vite+ from inside each package).

One new session hook: `.omp/hooks/process-status.ts` runs `mise run status` once per process and injects the result before the first turn, so the session that is supposed to start by orienting itself does, whether or not the agent remembers to.

### The bootstrap exception

This proposal was written alongside the change it describes, and the change landed directly on `main` rather than through a branch and a draft pull request. Its `pull-request` field says so.

That is a deliberate, single exception: the pull-request workflow the process depends on is part of what this change installs, and the human who owns the repository directed the adoption. Marking the proposal `implemented` records that the change is on `main` and has no release artifact, rather than claiming a review that did not happen. Every subsequent change goes through phase 1.

## Acceptance criteria

- [x] `mise run validate` reports zero violations against the record as committed.
- [x] `mise run status` reports the real branch, pull-request, and proposal state.
- [x] `mise run tools:test` passes, and `mise run check` depends on it.
- [x] The `commit-msg` hook accepts a real scope and rejects a Conventional Commits subject and an unknown scope. It also accepted every subject in this change's own twelve commits.
- [x] Every gate `mise run check` runs passes over the files this change touches: `docs:build`, `validate`, `tools:test`, `tsc`, and `oxfmt --check` and `oxlint` over `tools/`, `.omp/`, `.agents/`, and the record. `mise run check` as a whole still fails, on one cause that predates this change and lives in files it never touched: `oxlint` reports 51 errors in `demos/theme/remix.plugin.ts` and `docs/.vitepress/theme/**`, most of them `prefer-let` in Vue single-file components, the rest type-resolution errors for `.vue` and `.css` imports in a file `tsconfig.json` deliberately excludes. `oxfmt --check` also flagged `pnpm-workspace.yaml` at adoption; `157aaa4` reformatted it back to the repo's four-space indentation after pnpm rewrote it, so formatting is now clean repository-wide.
- [x] No file under `.agents/` refers to a path, task, or mechanism this repository does not have.
- [x] The published site is unaffected: `mise run docs:build` succeeds and emits no record page, and the sidebar is unchanged.

## Compatibility

No compatibility impact on published packages. Nothing in `packages/` changes, no manifest changes, and no generated documentation changes.

The one break is a workflow break for contributors and agents: a substantial change now requires a proposal before implementation, and the `commit-msg` hook rejects commit subjects that were previously accepted — an unscoped subject, or a Conventional Commits `type(scope):` subject. The hook is opt-in per clone (`ln -s ../../.agents/hooks/commit-msg .git/hooks/commit-msg`), and CI validates the record either way.

## Implications on adoption

`mise install` already provides Node and the toolchain; the record validator and status tool are dependency-free Node scripts, so there is nothing new to install. Adopting the process requires reading `AGENTS.md`, and installing the commit hook once per clone.

Reversible: deleting `proposals/`, `policies/`, `decisions/`, `tools/`, `PROCESS.md`, the vendored `.agents/` subdirectories, and the added Mise tasks restores the previous state, with `VISION.md` moved back under `docs/internal/`.

## Scope

- Vendor and adapt the process infrastructure listed above.
- Move the vision to the repository root with validator frontmatter, and repoint every reference to it.
- Drop the guide record type from the validator and its tests.
- Add the `validate`, `status`, and `tools:test` Mise tasks, and make `check` depend on them.
- Add the `record` job to `.github/workflows/test.yml`.
- Add `.agents/commit-scopes` from real history, and the `commit-msg` hook.
- Add `.omp/hooks/process-status.ts`.
- Merge the process contract into `AGENTS.md` ahead of the existing repository conventions. Those conventions keep their wording except for three corrections the process makes necessary: the `Tasks` paragraph gains the three new Mise tasks and names the `record` workflow, the Vale exemption line records that the root-level record is unpublished and unlinted, and the `pkg-preview.yml` paragraph names all four published packages instead of only `@pitlane/dev`.

### Out of scope

- **Publishing the record to pitlane.tools.** The site documents the product. Revisit with a proposal if the record ever needs a public face.
- **Retrofitting the legacy artifacts.** `docs/superpowers/` and `docs/internal/proposals/` stay as they are. The numbered record starts at this proposal.
- **Retrofitting `describes` frontmatter onto existing guides.** Follows from guides not being a record type.
- **Changing release mechanics.** Owned by `releasing-pitlane-packages`.
- **A service account for readiness reports.** None is configured; reports post from the authenticated `gh` identity and say so.

## Preview

- Artifact: the process itself, exercised locally — `mise run status`, `mise run validate`, `mise run tools:test`, the `commit-msg` hook against real and rejected subjects, and `mise run check` including the docs build.
- Reason: this change has no package surface and no site surface. The cheapest realistic exercise of "the process is installed and enforced" is running the commands that enforce it and reading their output. A pkg.pr.new build would contain nothing new, and the docs preview would render an unchanged site.

## Policies and decisions checked

- None. Both directories were empty when this proposal was written; it creates them.

## Future directions

- A policy recording the record's own conventions, if the validator ever proves insufficient to enforce them.
- A decision recording why guides are not a validated record type, should the question come back. It is currently answered here, which is where knowledge that does not outlive its change belongs.
- Wiring the readiness report to a service account, so bot authorship is distinguishable from human authorship.

## Alternatives considered

- **Keep the superpowers plan/spec workflow.** It produces a plan and a design document, both written by the agent, both before implementation — and nothing that independently checks the result. The two representations it maintains are the two that already agree.
- **Take the process as prose only, without the validator and hooks.** Cheaper by a day, and it decays first. The enforcement hierarchy is explicit that a rule an agent must remember is the weakest kind; the two failure modes here — a record whose identifiers drift from its filenames, and a proposal implemented while it still carries an unresolved question — are exactly the kind a deterministic check catches for free.
- **Publish the record with the product documentation.** Attractive for a repository whose product is developer tooling, and rejected for now: it couples the record's shape to the site's, adds a sidebar and layout surface to maintain, and puts draft proposals on a public page before they are settled.
- **Adopt Workbench by submodule or template sync.** Rejected: the adaptations above are not configuration, they are edits to the vendored prose. A synced copy would either lose them on every update or need a merge strategy nobody would run.

## Open questions

None.

## Acknowledgments

The process, the validator, the status tool, and most of the prose come from [Workbench](https://github.com/markmals/workbench), whose own `proposals/0001-workbench-2.md` is the worked example this proposal follows.

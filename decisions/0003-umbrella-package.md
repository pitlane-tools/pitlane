---
id: decision.0003
title: Umbrella Package
status: proposed
established-by: pull-request.55
supersedes: []
---

# Umbrella Package

## Summary

`pitlane` re-exports every public export of every `@pitlane/*` package at a `pitlane/*` subpath, generated from a hand-written manifest. It pins each package exactly, so any package release produces an umbrella release. Subpaths mirror package names; an adapter nests under its base only when Pitlane owns the base.

## Context

Pitlane ships each concern as its own `@pitlane/*` package, and VISION.md has always planned a `pitlane` package that presents them under one namespace, as `remix` does for `@remix-run/*`. Until this decision the name held a placeholder whose entry threw, on the reasoning that an umbrella over five packages was a second specifier for something a reader could already install.

Two things changed that. An app built from the templates installs most of the packages anyway, and agents need a single installed place to find documentation that matches the installed version (decision.0002), which only a package depending on all the others can be.

Remix's umbrella is the model: `packages/remix/manifest.json` maps each `remix/*` path to a `@remix-run/*` export, `scripts/generate-remix.ts` writes one re-export module per entry and the package's `exports`, `dependencies`, and lifted `peerDependencies`, and a test fails when the manifest misses an export. Remix versions with its own change-file tooling, which cascades every sub-package release to `remix`. Pitlane versions with Changesets, whose cascade only reaches a dependent whose range the new version leaves.

Two packages also look past their own name. `contentLayer()` keeps `@pitlane/content` bundled and out of dependency optimization so its manifest can be replaced, and `remix()` inlines `@pitlane/dev/runtime` into server builds. An app importing through `pitlane/*` would reach both through a package neither recognized.

## Decision

`packages/pitlane/manifest.json` maps every public export of every published `@pitlane/*` package to exactly one `pitlane/*` subpath. Exports under `./internal/` are never re-exported. A test fails when the manifest leaves an export out, names one that does not exist, maps two subpaths to one export, or re-exports an internal one.

Subpaths take the unscoped package name and the package's own subpath: `@pitlane/theme/schema` is `pitlane/theme/schema`, and `@pitlane/data-table-d1` is `pitlane/data-table-d1`. When Pitlane owns a base package and ships an adapter for it, the adapter nests under the base, as `remix/data-table/sqlite` nests under `remix/data-table`. An adapter for a base Pitlane does not own keeps its own name, which is why the D1 driver for Remix's data-table is not `pitlane/data-table/d1`.

`vp run generate` in `packages/pitlane` writes one module per entry under `src/` and the package's `exports`, `dependencies`, `peerDependencies`, and `peerDependenciesMeta`. A module export is re-exported binding for binding, default included; an ambient declaration file such as `@pitlane/dev/assets` is re-exported by reference. Peers are lifted at the narrowest range any package asks for, and are optional when any package lets them be. A test fails when the committed output differs from what the generator produces. There is no bare `pitlane` import.

The umbrella depends on every package at `workspace:*`, so each release pins exact versions and any package release makes Changesets release the umbrella too. `.changeset/prerelease.json` keeps the umbrella on a prerelease channel through `tools/version.ts`. The umbrella is tagged after the packages it pins, and its publish job waits until each pinned version installs.

A package whose behavior depends on how an app imports it treats `pitlane/<its subpath>` as itself.

## Rationale

Generating the umbrella from a manifest leaves exactly one judgement to a person, the subpath's name, and makes everything else checkable. A package that gains an export fails the umbrella's test until the export has a subpath, so the umbrella cannot silently fall behind.

Mirroring package names makes that judgement mechanical in the common case. Nesting adapters under their base reads better, and Remix does it, but `pitlane/data-table/d1` would imply a `pitlane/data-table` that Remix, not Pitlane, owns. The nesting rule is kept for the case where it is true.

Exact pins are what make an umbrella release mean something. With caret ranges an install of `pitlane@1.0.0-alpha.1` could resolve a newer `@pitlane/dev` than the one its release was built and documented against. They are also what makes Changesets cascade every package release to the umbrella without changing how it versions packages that depend on each other.

## Alternatives considered

- **Caret ranges, as Remix uses** — leaves room for deduplication with an app's own `@pitlane/*` installs. Changesets would not release the umbrella for an in-range patch, and an umbrella release would not identify the package versions it ships.
- **Changesets' `updateInternalDependents: "always"`** — cascades with caret ranges, but for every dependent in the workspace: each `@pitlane/crawler` patch would also release `@pitlane/dev`. It is also an option Changesets marks as unsafe and subject to change.
- **Changesets prerelease mode for the alpha** — prerelease mode applies to every package at once, so `@pitlane/dev` would ship `0.7.1-alpha.0` alongside the umbrella.
- **A bot that regenerates and commits, as Remix's `generate-remix.yaml` does** — needs a token that can push and retrigger CI. A failing test points at the one command to run, with nothing to provision.
- **Vendoring copies of each package into the umbrella** — one fewer install layer, but two copies of every module whenever an app also installs a package directly, and two builds to keep identical.

## Consequences

### Good

- An app can depend on `pitlane` alone and import everything Pitlane ships from one namespace.
- A package export missing from the umbrella is a test failure, not a bug report.
- Every package release reaches umbrella users through a new umbrella release, with no note to remember.

### Bad

- Every package release is followed by an umbrella release, so releases come in pairs at least.
- An app that installs both `pitlane` and a direct `@pitlane/*` package at another version gets two copies of that package.
- Bundling behavior that keys on a package name has to know about the umbrella: `@pitlane/content` now bundles all of `pitlane` in a server build, because Vite decides externalization per package rather than per subpath.
- The prerelease channel is Pitlane's own script around Changesets, and it refuses a package anything in the workspace depends on.

## Revision history

| Date       | Change                  | Proposal        |
| ---------- | ----------------------- | --------------- |
| 2026-10-03 | Proposed this decision. | pull-request.55 |

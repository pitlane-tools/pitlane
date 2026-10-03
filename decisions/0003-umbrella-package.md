---
id: decision.0003
title: Umbrella Package
status: proposed
established-by: pull-request.55
supersedes: []
---

# Umbrella Package

## Summary

`pitlane` re-exports every public export of every `@pitlane/*` package at a `pitlane/*` subpath, generated from a hand-written manifest. Each release pins exact package versions. It is released by hand, when enough package changes have accumulated, not after every package release. Subpaths mirror package names.

## Context

Pitlane ships each concern as its own `@pitlane/*` package, and VISION.md has always planned a `pitlane` package that presents them under one namespace, as `remix` does for `@remix-run/*`. Until this decision the name held a placeholder whose entry threw, on the reasoning that an umbrella over five packages was a second specifier for something a reader could already install.

Two things changed that. An app built from the templates installs most of the packages anyway, and agents need a single installed place to find documentation that matches the installed version (decision.0002), which only a package depending on all the others can be.

Remix's umbrella is the model: `packages/remix/manifest.json` maps each `remix/*` path to a `@remix-run/*` export, `scripts/generate-remix.ts` writes one re-export module per entry and the package's `exports`, `dependencies`, and lifted `peerDependencies`, and a test fails when the manifest misses an export. Remix versions with its own change-file tooling, which releases `remix` after every sub-package release. Pitlane versions with Changesets, which releases a dependent whenever a new version leaves the dependent's range.

Pitlane does not want an umbrella release per package release. Package releases are frequent and often small, and an umbrella release is the version an app upgrades as a whole, so it should arrive when enough has changed to be worth that.

Two packages also look past their own name. `contentLayer()` keeps `@pitlane/content` bundled and out of dependency optimization so its manifest can be replaced, and `remix()` inlines `@pitlane/dev/runtime` into server builds. An app importing through `pitlane/*` would reach both through a package neither recognized, and `@pitlane/content`'s errors would tell it to import a specifier a strict package manager does not let it import.

## Decision

`packages/pitlane/manifest.json` maps every public export of every published `@pitlane/*` package to exactly one `pitlane/*` subpath. Exports under `./internal/` are never re-exported. A test fails when the manifest leaves an export out, names one that does not exist, maps two subpaths to one export, or re-exports an internal one.

Subpaths take the unscoped package name and the package's own subpath: `@pitlane/theme/schema` is `pitlane/theme/schema`, and `@pitlane/data-table-d1` is `pitlane/data-table-d1`. When Pitlane owns a base package and ships an adapter for it, the adapter nests under the base, as `remix/data-table/sqlite` nests under `remix/data-table`. An adapter for a base Pitlane does not own keeps its own name, which is why the D1 driver for Remix's data-table is not `pitlane/data-table/d1`.

`vp run generate` in `packages/pitlane` writes one module per entry under `src/` and the package's `exports`, `dependencies`, `peerDependencies`, and `peerDependenciesMeta`. A module export is re-exported binding for binding, default included; an ambient declaration file such as `@pitlane/dev/assets` is re-exported by reference. Installing the umbrella installs every package, so each peer is lifted at the narrowest range any package asks for, and is optional only when every package that names it lets it be. This departs from Remix, which marks a peer optional when any package does; in Remix every lifted peer is optional in its own package, so its rule never has to choose. A test fails when the committed output differs from what the generator produces. There is no bare `pitlane` import.

The umbrella releases only when a pending Changesets note names `pitlane`. It depends on every package at `workspace:*`, so each release pins the versions current when it is prepared, and its changelog section lists them. `.changeset/release.json` declares `pitlane` as `manual`, and `tools/version.ts`, which `vp run changeset:version` runs, undoes the bump Changesets computes for it whenever no note names it. The same file keeps the umbrella on its prerelease channel. The umbrella is tagged after the packages it pins, and its publish job waits until each pinned version installs.

A package whose behavior depends on how an app imports it treats `pitlane/<its subpath>` as itself. Each runtime module of the umbrella adds the package it re-exports to the global set `Symbol.for("pitlane.umbrella.packages")` when it loads, and a package that names itself in a message reads that set to choose between `pitlane/<name>` and `@pitlane/<name>`.

## Rationale

Generating the umbrella from a manifest leaves exactly one judgement to a person, the subpath's name, and makes everything else checkable. A package that gains an export fails the umbrella's test until the export has a subpath, so the umbrella cannot silently fall behind.

Mirroring package names makes that judgement mechanical in the common case. Nesting adapters under their base reads better, and Remix does it, but `pitlane/data-table/d1` would imply a `pitlane/data-table` that Remix, not Pitlane, owns. The nesting rule is kept for the case where it is true.

Exact pins are what make an umbrella release mean something. With caret ranges an install of `pitlane@1.0.0-alpha.1` could resolve a newer `@pitlane/dev` than the one its release was built and documented against.

A note naming `pitlane` is the release decision, which keeps that decision with the person preparing the release. Undoing the bump is simpler than avoiding it: Changesets has no setting that withholds one package's dependency bumps, and exact pins put every package release out of range.

Registering through a global set keeps the umbrella's modules uniform and keeps packages from depending on the umbrella. A package asks "did the app reach me through `pitlane`?" at the moment it formats a message, after every module has loaded.

## Alternatives considered

- **Release the umbrella after every package release, as Remix does** — the umbrella is never behind, and nobody has to remember it. It also produces a stream of umbrella versions that differ by one patch each, which is the opposite of the cadence Pitlane wants.
- **Caret ranges, as Remix uses** — leaves room for deduplication with an app's own `@pitlane/*` installs. An umbrella release would not identify the package versions it ships.
- **Changesets' `ignore` for the umbrella** — Changesets skips an ignored package even when a note names it, so the umbrella could never be released through the normal preparation.
- **Changesets prerelease mode for the alpha** — prerelease mode applies to every package at once, so `@pitlane/dev` would ship `0.7.1-alpha.0` alongside the umbrella.
- **A bot that regenerates and commits, as Remix's `generate-remix.yaml` does** — needs a token that can push and retrigger CI. A failing test points at the one command to run, with nothing to provision.
- **Errors that name both specifiers** — always correct and needs no protocol, but a reader has to work out which one applies to them.
- **Vendoring copies of each package into the umbrella** — one fewer install layer, but two copies of every module whenever an app also installs a package directly, and two builds to keep identical.

## Consequences

### Good

- An app can depend on `pitlane` alone and import everything Pitlane ships from one namespace.
- A package export missing from the umbrella is a test failure, not a bug report.
- Umbrella releases are deliberate, and each changelog section says exactly which package versions it ships.
- An umbrella app's errors name specifiers it can import.

### Bad

- Package fixes reach umbrella users only when someone releases the umbrella, and nothing reminds anyone to.
- `vp run changeset:status` still lists the umbrella whenever a package it pins changes, because the bump is undone only during preparation.
- An app that installs both `pitlane` and a direct `@pitlane/*` package at another version gets two copies of that package.
- An app that imports a runtime subpath needs `pitlane` in `dependencies`, which installs `@pitlane/dev` and Vite in production too, as `remix` installs its CLI and test runner. An app that wants a lean production install has to use the scoped packages. Keeping development packages out of production is open for later design.
- Bundling behavior that keys on a package name has to know about the umbrella: `@pitlane/content` now bundles all of `pitlane` in a server build, because Vite decides externalization per package rather than per subpath.
- The release rules are Pitlane's own script around Changesets, and they refuse a package anything in the workspace depends on.

## Revision history

| Date       | Change                  | Proposal        |
| ---------- | ----------------------- | --------------- |
| 2026-10-03 | Proposed this decision. | pull-request.55 |

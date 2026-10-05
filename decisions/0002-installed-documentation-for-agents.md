---
id: decision.0002
title: Installed Documentation for Agents
status: accepted
established-by: pull-request.55
supersedes: []
---

# Installed Documentation for Agents

## Summary

Pitlane gives coding agents its documentation by installing it: the `pitlane` package ships its guides as plain Markdown, every package README, and a generated `INDEX.md`. A short `AGENTS.md` line and a small skill in each app point agents there. Neither carries version-specific API.

## Context

An agent writing Pitlane code has three places to learn the API from, and two of them are wrong for a pre-1.0 project whose minor releases break things.

- **Training data** describes whatever version existed when the model was trained, if it describes Pitlane at all.
- **pitlane.tools**, including `llms.txt` and the per-page Markdown, describes whatever was last deployed from `main`. An app pinned to an older `@pitlane/dev` reads the wrong guide, and reading it needs network access.
- **A skill** has to be invoked before it helps. Vercel's Next.js 16 evaluation found its skill was not invoked in 56% of runs and passed 53% of tasks, the same as no documentation. An `AGENTS.md` index pointing at documentation bundled in `node_modules/next/dist/docs/` passed 100% ([Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)). The gap has since narrowed for the strongest models, which score the same with or without the index ([Next.js evals](https://nextjs.org/evals)), but it remains for the rest.

Remix 3 settled on a split that answers all three. The `remix` package's `files` include `guides/`, `INDEX.md`, and a README beside each `remix/*` export, so the documentation an agent reads always matches the installed version. The app template's `AGENTS.md` points at a skill, and the skill holds only the mental model and how to search `node_modules/remix/INDEX.md`, telling the agent to treat installed documentation as canonical whenever the two disagree. The skill barely changes between versions because nothing version-specific lives in it. This repository already consumes Remix that way: `tools/update-remix-skills.sh` vendors that skill, and the skill sends agents to the installed index.

Pitlane's packages are published separately, so there was no single installed place for an index until the `pitlane` umbrella package existed (decision.0003).

## Decision

Agent guidance for Pitlane apps has three parts, each with one job.

- **The installed documentation** is the reference. The `pitlane` package ships every published guide as plain Markdown under `guides/`, each `@pitlane/*` README beside the subpath it documents, and an `INDEX.md` generated from them that lists guides by task and exports by subpath. Links between those files resolve to the installed copies, so an agent never leaves the installed version by following one. API declarations are the shipped `.d.ts` files and their TSDoc.
- **A skill** carries the mental model: what Pitlane is, how its pieces fit an app, and how to find the right installed file. It names no API that a release could change, and it tells the agent to prefer installed documentation over the skill and over its own memory.
- **`AGENTS.md`** in every app carries the one line that makes the first two reachable without relying on skill invocation.

The templates carry the `AGENTS.md` line and the skill. The plain-Markdown export that produces the installed guides is the same one that produces the Markdown pitlane.tools publishes, and it runs without building the documentation site.

## Rationale

Version match is the property that matters, and only documentation inside the installed package has it without effort from the app. A published guide is a snapshot of the code it ships with, so a guide in the tarball is right for that tarball by construction.

Passive pointers beat invocation. A one-line `AGENTS.md` entry is read every session, while a skill is read only when the agent decides to read it. Keeping the version-specific material out of the skill means the skill can be copied into a template once and left alone, which is what makes the arrangement cheap to maintain.

Following Remix keeps one convention in a Pitlane app. An agent working in one already searches `node_modules/remix/INDEX.md`, and `node_modules/pitlane/INDEX.md` works the same way.

## Alternatives considered

- **A skill holding the documentation** — one artifact to ship, and the shape most skills take. It drifts from the installed version the moment either changes, has to be re-copied into every app on every release, and helps only when invoked.
- **Fetching `llms.txt` from pitlane.tools** — already published and useful to a reader with no app. It describes the latest deploy rather than the installed version, and it needs the network.
- **Documentation inside each `@pitlane/*` package** — version-matched too, but it gives agents five indexes to search, and guides such as prerendering cover more than one package. The umbrella gives one index and one place for guides that span packages.
- **The documentation pasted into `AGENTS.md`** — always read, but it costs context in every session and goes stale as soon as the app upgrades.

## Consequences

### Good

- An agent reads documentation for the version the app has installed, offline.
- The skill and the `AGENTS.md` line stay stable across releases, so templates rarely need to touch them.
- The site and the package publish the same Markdown, so a guide fixed once is fixed in both.

### Bad

- The guidance reaches only apps that depend on `pitlane`. An app that installs individual `@pitlane/*` packages gets none of it.
- Every guide, README, and index adds to the tarball, and packing `pitlane` now depends on the Markdown export succeeding.
- Guide links have to be written so the export can rewrite them for the installed copy; a link it cannot map still points at the website.
- Templates must carry and update the `AGENTS.md` line and the skill.

## Revision history

| Date | Change | Proposal |
| --- | --- | --- |
| 2026-10-03 | Proposed this decision. | pull-request.55 |
| 2026-10-05 | Accepted; installed documentation remains a follow-up to the first umbrella release. | pull-request.55 |

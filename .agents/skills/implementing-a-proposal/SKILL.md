---
name: implementing-a-proposal
description: Use when an approved proposal is ready for Phase 3 implementation, or the human declined a proposal and agreed the request and pull-request scope instead. Includes a substantive bug fix whose root cause is known. Do not use for proposal authoring or trivial inline edits.
---

# Implementing a Proposal

Phase 3 turns an approved proposal into tests, guides, and code that agree with the proposal and with each other.

**Hard order when stages apply:** failing tests → guides → code → quality gates.

## Preconditions

- The proposal has `status: awaiting-implementation`, or the human returned it with `status: returned-for-revisions`; neither has an unresolved clarification marker.
- Or the human declined a proposal for this work: the agreed request and pull-request scope is the contract, and every step below that reads from a proposal reads from that scope instead. Do not write a proposal now to have one to derive from.
- Phase 1 — preparation — created the branch, pushed it to `origin`, and opened a draft pull request.
- Read the proposal's **Detailed design**, the code it touches, and the vision, policies, and decisions it names. Tests derive from Detailed design; acceptance criteria are an occasional supplement.
- When the design is ambiguous or conflicts with a record in a way that changes behavior, raise it. Do not choose silently or expand scope.

## Who does the work

Implement the proposal yourself by default. A single agent holding the whole change makes fewer handoff errors than one briefing implementers.

Split the work only into slices that are independent, touch separate files, and save real time by running in parallel. Give each subagent the behavior, the relevant Detailed design, constraints, scope, and verification commands — `.omp/agents/implementer.md` is the brief it reads. Integrate and commit its work yourself; an implementer never commits. When a subagent reports that the evidence contradicts the proposal's model, stop that slice and use [`reframing-a-problem`](../reframing-a-problem/SKILL.md); settle intent with the human before resuming.

## 1. Failing tests

```text
NO TEST-WORTHY PRODUCTION BEHAVIOR WITHOUT A FAILING TEST FIRST
```

- Write one focused test per observable behavior in Detailed design, named after the proposal id and the behavior.
- Run it — `mise run test:<pkg>` for a package, `mise run tools:test` for the record and policy tooling. Confirm it fails because the behavior is missing, not because of setup, an import, or a typo. If it passes, correct the test.
- If you wrote test-worthy production code first, delete it and start from the test.
- A claim that something holds "always", "never", "for any", or "for all" gets a property-based test that fails first, alongside example tests for named boundaries. Do not force properties onto a single mapping or constant.
- Test real code. Isolate only what you cannot control, such as the network, time, or randomness. When a test is hard to write, simplify the interface rather than adding mocks.
- When nothing can be meaningfully tested, say so and why before writing code.

## 2. Guides

Write a guide only when the change alters what a user does, sees, or must know. Write it from the proposal before production code exists, for a reader who will never read the proposal: inputs, prerequisites, actions, outcomes, errors, defaults, and durable effects, not internals.

Guides are published pages under `docs/app/content/guides/`. Extend the page that already owns the workflow; add one from [`.agents/templates/GUIDE.md`](../../templates/GUIDE.md) only when none does. Keep its `title` and `description` frontmatter accurate — both feed the page title and its meta and Open Graph description — and add a new page to `GUIDE_GROUPS` in `docs/app/components/navigation.ts`, the sidebar serving both `/guides/` and `/deploy/`; without that entry the build publishes a page the site never links to. `mise run docs:build` fails on a link to a page that does not exist, so a guide and the pages it links land together. Vale lints published prose: `.omp/extensions/vale-prose.ts` reports findings after every edit, and `mise run docs:prose` runs it over all of it. Every example must run as printed.

Never hand-edit anything under `docs/app/content/api/`. That tree is TypeDoc output — gitignored, and overwritten by the next `mise run docs:api`. API prose belongs in the TSDoc comment in `packages/<name>/src/`.

Then compare the guide with the failing tests. Anything one describes and the other does not is a defect in one of them; resolve it by correcting the guide or the test, or by revising the proposal with the human.

## 3. Code

Write the minimum production code that makes the tests pass and matches the guide. Add no behavior the proposal does not describe. When an unexplained failure appears, find its cause with [`systematic-debugging`](../systematic-debugging/SKILL.md) before changing code.

## 4. Gates and commits

Run `mise run check`, plus `mise run test:<pkg>` and `mise run build:<pkg>` for each package you changed, and read the output; [`.agents/rules/verification.md`](../../rules/verification.md) says what counts as evidence. Never commit while red.

A consumer-visible package change carries a release note on the branch: `mise run changeset` names the affected packages and the semver level, and the note is committed with the work under its scope. Write the body for someone deciding whether to upgrade. A change that releases nothing — repository tooling, agent guidance — carries `mise run changeset -- --empty` instead; the `changeset` job rejects a pull request that adds no note at all. Feature work leaves version bumps and numbered changelog entries to `mise run changeset:version`, run later on human request.

Commit at green boundaries following [`.agents/rules/commit-discipline.md`](../../rules/commit-discipline.md), and push.

## Then

Continue with [`reviewing-an-implementation`](../reviewing-an-implementation/SKILL.md). It owns the self-check, the independent review, the preview, and the handoff to the human. Set no proposal status before then.

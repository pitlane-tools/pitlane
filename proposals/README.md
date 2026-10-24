# Proposals

This directory holds the durable design record for one change per file.

Ask for and receive human permission before creating a proposal, including a proposal-only branch or pull request. If the human declines, use the agreed request and pull-request scope instead; do not invent a record here.

Name each file `<NNNN>-<slug>.md`, using the next four-digit number and a kebab-case slug. Required frontmatter is `id: proposal.<NNNN>`, `title`, `authors` as a non-empty list, `status`, `pull-request`, and `supersedes`. Optional `issues` is a list of issue references or URLs. The normal lifecycle is `draft` → `awaiting-implementation` → `active-review` → `accepted` → `implemented`.

| Status | Meaning | Decided by | Phase |
| --- | --- | --- | --- |
| `draft` | Being written and iterated on in the draft pull request. May carry `[NEEDS CLARIFICATION:`. | agent | 2 |
| `awaiting-implementation` | The human settled the proposal. Implementation is underway or not yet started. | human | 3 |
| `active-review` | First full pass at tests, guides and code exists; report posted and pull request marked ready. | agent | 4 |
| `returned-for-revisions` | The human requested changes. Back to implementation, or to the proposal if the design changed. | human | 4 → 3 or 2 |
| `accepted` | The human accepted the work; the vision update and final implementation record are underway. | human | 5 |
| `implemented` | The accepted implementation and final records are committed in the feature pull request before merge. Merge and any requested release remain separate. | agent | 5 |
| `rejected` | The human declined the change. Kept as record. | human | terminal |
| `withdrawn` | The author pulled it. Kept as record. | either | terminal |
| `superseded` | A later proposal replaced it. | either | terminal |

**Decided by** is about judgement, not keystrokes. The human may ask the agent to make the edit — that is fine. What an agent must never do is decide on its own that a proposal is settled enough to implement, or that finished work is good enough to accept. An agent that can reach those two conclusions unaided is an agent approving its own work.

After acceptance and the vision update, the agent records `implemented` in the original feature pull request before merging it. This status does not claim that the pull request merged or that a required release happened. The pull request records integration; keep a pending changeset and release visible in the proposal or pull request until separately requested, authorized, and performed. Already merged pull requests with an `accepted` record are inspected for their merged revision rather than changed through a status-only follow-up pull request. Work without a proposal has no status to set.

A proposal stays `draft` for as long as it takes. It is published to the draft pull request as soon as there is something to react to, and the human edits it there — directly, or by asking for changes — until they are satisfied. Iteration is the normal case, not a sign of a bad first draft.

History is preserved: never delete a superseded entry — mark it `superseded` and link its replacement through `supersedes`.

The numbered record starts at `0001`. Two directories hold writing that predates it, and neither is part of the record: `docs/internal/designs/` holds hand-written design documents, and `docs/superpowers/` holds the plan and spec pairs from the task-runner workflow this process replaced. They remain readable history, and the validator does not read them.

Nothing outside this directory is called "proposals". A design that predates the record and is still live gets adopted into it as a new numbered proposal rather than edited in place — `0003` came from `docs/internal/proposals/migration-tooling.md` that way. A design whose work already shipped stays where it was written.

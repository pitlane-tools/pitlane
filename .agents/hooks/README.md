# Hooks

Install the Git commit hook:

```sh
ln -s ../../.agents/hooks/commit-msg .git/hooks/commit-msg
```

You may set `core.hooksPath` instead. Nothing else enforces commit subjects: the `record` job in CI validates the record and its tooling, not commit messages, so an uninstalled hook is an unchecked subject.

`commit-msg` enforces [Scoped Commits](https://scopedcommits.com/): `<scope>: <imperative description>`. It rejects Conventional Commits `type(scope):` subjects outright — this repository leads with the area being changed, not with a change type. Allowed scopes are the built-in process scopes, a real `proposals/<NNNN>-<slug>.md` filename, and anything listed in [`../commit-scopes`](../commit-scopes). Merge, revert, `fixup!`, and `squash!` subjects are exempt.

| Lifecycle event                           | Run                                     |
| ----------------------------------------- | --------------------------------------- |
| After a file edit                         | `mise run fmt`                          |
| Before the agent declares a turn complete | `mise run check`                        |
| Session start                             | Read `AGENTS.md`, run `mise run status` |

Prose linting after an edit is already automated: `.omp/hooks/vale-prose.ts` appends Vale's findings to the tool result after every successful `edit`/`write` under `docs/guides/` or `docs/package/`. It no-ops when `vale` is missing, and when it is inactive the manual commands in `AGENTS.md` apply.

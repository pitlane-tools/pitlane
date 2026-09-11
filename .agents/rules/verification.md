# Verification

Claiming work is complete without verification is dishonesty, not efficiency.

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you have not run the verifying command **in this turn**, you cannot claim its result.

## The gate

```
1. IDENTIFY  — what command proves the claim?
2. RUN       — the full command, fresh, no shortcuts
3. READ      — full output, exit code, failure count
4. VERIFY    — does the output confirm the claim?
5. CLAIM     — only now
```

Skipping a step is lying.

## What proves what

| Claim                    | Required evidence                                                                                 | Insufficient                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| A package's tests pass   | `vp test` from inside `packages/<name>`, 0 failures, this turn                                    | "Last run was clean"; another package's suite  |
| A package builds         | `vp run build` from inside `packages/<name>`, exit 0, this turn                                   | `vp test` passing, or `tsc` passing            |
| The repo gates pass      | `mise run check` exit 0, this turn                                                                | One of its steps run alone                     |
| The record is valid      | `mise run validate` exit 0, this turn                                                             | Frontmatter that reads correctly               |
| The record tooling works | `mise run tools:test` exit 0, this turn                                                           | `mise run validate` passing on today's record  |
| Published prose is clean | `vale docs/guides/<page>.md`, or `mise run docs:prose`, no findings                               | The hook's report from before your last edit   |
| Bug fixed                | The failing reproduction now passes                                                               | Code changed, "I think it's fixed"             |
| Regression test works    | The full red-green proof below                                                                    | The test passing once against the fix          |
| Subagent finished        | `git status` and `git diff` show the changes                                                      | The subagent's own success report              |
| The preview works        | Install the pkg.pr.new build, or open the Workers preview URL, then exercise the changed behavior | `pkg-preview.yml` or `preview.yml` going green |
| A package is installable | `npm install @pitlane/<name>@<version>` in an empty directory                                     | `npm view` naming the version                  |
| Proposal implemented     | `mise run check` exit 0, plus the package's `vp test` and `vp run build`                          | The code looking right                         |
| All behavior implemented | The phase 3 behavior inventory, every row ticked or resolved                                      | Tests passing                                  |

`mise run check` runs `docs:build`, `validate`, and `tools:test`, then `oxfmt --check`, `oxlint`, and
`tsc`; `mise run fmt` and `mise run lint` rewrite files instead of reporting on them, so neither
proves a gate. And a version is not installable the moment `publish.yml` goes green: the packument
`npm view` reads catches up about a minute after the publish, its tarball two to six minutes later,
so an install in an empty directory is the only check that fails where a consumer would — see
`AGENTS.md`, "A green job is not yet an installable package".

The red-green proof for a regression test:

```
1. Write the test
2. Run it with the fix     — must PASS
3. Revert the fix
4. Run it                  — must FAIL
5. Restore the fix
6. Run it                  — must PASS again
```

Without step 4 you do not know the test catches the bug.

## Red flags — run the command first

"Should", "probably", "seems to", "I'm pretty sure" · "Done!" before running anything · committing
or opening a pull request without re-running the gates · trusting a subagent's report without
reading the diff · extrapolating from a partial check · wanting the work to be over.

## Applies before

Saying done, complete, fixed, passing, ready, or shipped · any positive statement about the state
of the work · committing · advancing a task · reporting a subagent's success onward · posting a
readiness report · merging.

The rule covers exact phrases, paraphrases, and anything that implies success.

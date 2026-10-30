# Enforcement Hierarchy

A rule an agent must remember is the weakest kind of rule. Under load, prose gets missed. Durable conventions are machine-enforced, not merely recalled. When you add a rule, reach down this hierarchy first.

## The tiers — strongest to weakest

| Tier | Mechanism | Role |
| --- | --- | --- |
| **Tier 0 — Checks** | hk's git hooks (`commit-msg` runs `node tools/check-scoped-commit.ts`, `pre-push` runs `mise run check`), GitHub Actions running that same task, the record validator in `tools/validate.ts`, the repository policies in `tools/policies/`, the `pitlane` Oxlint plugin in `tools/lint/`, TypeDoc validation in `mise run docs:api`, and the harness lifecycle wiring in `.omp/extensions/` | Deterministic; runs whether or not the agent remembers. A rule that can live here must. A check over one source file is an Oxlint rule; see policy.0015. |
| **Tier 1 — Tasks** | mise tasks the process invokes by name: `mise run check`, `mise run fmt`, `mise run validate`, `mise run status`, `mise run docs:prose`, and `mise run test:<pkg>` / `mise run build:<pkg>` for a package | Deterministic once invoked, but something must invoke them. |
| **Tier 2 — Templates** | `.agents/templates/` | Shape the work so the correct thing is the path of least resistance. |
| **Tier 3 — Prose** | `AGENTS.md`, `SKILL.md` files, and these rules | Necessary for judgment that cannot be mechanized; the tier most likely to be missed. |

## The rule

- Before writing a prose rule, ask whether a check or template could enforce it deterministically. If it can, build that instead — usually a new hk step, a new assertion in the validator, or an Oxlint rule, reached through a `mise` task so humans and CI run the same thing.
- Where a check already enforces a rule, do not also state it in prose — delete the prose.
- Keep judgment in prose. Good naming, the right abstraction, and a justified deviation are not cheap deterministic checks.

This hierarchy is why `completing-a-feature` requires attempting a check before writing a prose policy.

## Worked example — policies and decisions

`.agents/templates/PROPOSAL.md` carries a “Policies and decisions checked” section. It makes checking the existing record part of the path of least resistance, instead of a policy saying “remember to check policies.” That is a Tier 2 template solution, not a Tier 3 reminder.

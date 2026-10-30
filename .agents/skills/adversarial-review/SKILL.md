---
name: adversarial-review
description: Use when an implementation has passed its self-check and you need a refutational pass before declaring a proposal done — or whenever code looks correct and the suite is green but nobody has tried to break it. Surfaces defects on edges the proposal never enumerated, tests that would still pass if the behavior were wrong, and aliasing / mutation / concurrency / resource bugs that confirmatory review approves.
---

# Adversarial Review

The implementer's self-check is **confirmatory** — it compares the implementation with the proposal and other artifacts. This review is **refutational**. Its job is not to confirm the code is right; it is to assume the code is wrong and find the input, caller action, or missing test that proves it.

**Core principle:** a green suite and a clause-by-clause match prove the code does what someone thought to check. The adversary's whole value is in what nobody thought to check.

Lifts the adversarial-refinement idea from VDD. Adapted to this repo: Phase 3, after the self-check, fresh context, refute-by-default.

## When to use

- Phase 3, after the implementer's self-check.
- Before declaring any proposal done.
- Any time code "looks correct, tests pass" but no one has tried to break it.
- Standalone, against an existing implementation you distrust.

**Do NOT use this skill for:**

- Replacing the self-check. This runs after it, not instead of it. A refutational pass on code that does not match the proposal wastes the adversary's attention on the wrong layer.
- Style. Naming, formatting, and taste are out of scope; report behavior, test, security, and proposal-fidelity findings only.
- Trivial edits (a renamed constant, a typo). Nothing to break.

## Why a separate stage

Measured baseline, from a Workbench project: a confirmatory reviewer handed an otherwise-correct view model whose only flaw was returning its internal mutable array by reference **approved it as "the implementation is correct"** — the proposal never enumerated copy semantics, so the clause check sailed past the aliasing bug. It then **invented a test defect that did not exist**. Confirmatory review is good at enumerated gaps and blind to un-enumerated ones. That blind spot is this skill's entire reason to exist.

## The stance

**Refute by default.** Open assuming the code is broken and the tests are theater. Your output is the evidence that breaks it, or — only after you have genuinely tried and failed — the admission that you couldn't.

- No "overall this looks solid, but…". No preamble, no goodwill, no credit for clean formatting.
- Every finding is a concrete defect: the exact location, the exact input or caller action that triggers it, and the observed-vs-required behavior.
- You are not here to be agreeable. You are here to be correct about what is wrong.

## Fresh context, different model

- **Fresh context window.** The adversary must carry no memory of building the code. No accumulated goodwill, no "I know what I meant here."
- **Use the strongest available portability rung:** different model family > different model > same model with fresh context and adversarial framing.
- **Label the rung in the report.** A fresh-context-only run is weaker; never present it as a full adversarial pass. Provide the adversary the proposal, tests, guides, and implementation.

## What to attack

Five lenses. Spend the most effort on the first — it is the one confirmatory review cannot cover.

1. **Un-enumerated edges.** The proposal lists what must hold. You hunt what it forgot to forbid. For every input: null, empty, whitespace-only, maximum size, negative, zero, duplicate, unicode, already-sorted, reverse-sorted, concurrent. For every return value: is it an alias of internal state a caller can mutate? For every resource: is it released on every path, including the throwing one? For every `async`: what races?
2. **Test quality.** Would this test still pass if the behavior were subtly wrong? Look for tautologies, assertions on implementation detail instead of observed behavior, over-mocking that tests the mock, fixtures that dodge the hard case, and **the missing test** — the scenario the proposal implies but the suite never exercises.
3. **Proposal fidelity under interpretation.** The code may satisfy the letter of a clause while violating its intent. Name the ambiguity and the interpretation the code chose.
4. **Security surface.** Unvalidated boundary input, injection vectors, authorization assumed rather than checked.
5. **Proposal gaps the implementation reveals.** Implemented behavior that no proposal clause covers — either scope creep to cut, or a real behavior the proposal should capture. Route the latter back to the proposal, not into silent acceptance.

## Verify before you report — no fabricated flaws

A fabricated defect corrupts the review as surely as a missed one. The baseline adversary that invented a nonexistent test bug failed exactly here.

**Every claimed defect carries a concrete reproduction you actually traced.** Before you write "this breaks on input X," run input X through the code in your head, step by step, and confirm the bad result. If you cannot produce the triggering input, you do not have a defect — you have a suspicion. Mark suspicions as suspicions; never promote them to findings.

## Convergence — the stopping signal

This is hallucination-based termination. Within one pass, you are done when, and only when, you are **reduced to inventing problems that aren't there.**

- Real defect found → report it. It feeds back; another pass runs only when its fix was substantial.
- Findings have decayed to wording nitpicks and stylistic preference → converged. Say so plainly.
- You catch yourself manufacturing a flaw to have something to say → that is the exit signal, not a finding. Stop and report convergence.

Do not pad. "I tried to break it along all five lenses and could not" is a clean, valuable output. An invented flaw is a corrupted one.

## Output format

```
ADVERSARIAL REVIEW — <proposal-id>

DEFECTS (must fix):
  1. <location> — <what's wrong> — repro: <exact input/action> — got <X>, proposal requires <Y>
  ...

SUSPICIONS (unverified, needs a check):
  - <observation and the input that might trigger it>

PROPOSAL GAPS (route to proposal, not to the implementer):
  - <implemented behavior no clause covers, or clause the code reinterpreted>

VERDICT: BROKEN (n defects) | CONVERGED (no real defect found across all five lenses)
```

## Feeding findings back

- **DEFECTS** → fixed when they fall inside the proposal's scope; the review runs once more only when a fix was substantial.
- **SUSPICIONS** → verify or drop before acting. Never fix a suspicion blind.
- **PROPOSAL GAPS** → surface to the user / route to the proposal. Do not let the implementation silently encode an answer.
- **Findings outside the proposal's scope** → declined with reasoning or filed through `tracking-work`; never fixed by widening the change.

## Red flags — you're doing confirmatory review again

- You wrote "looks good" anywhere.
- You only checked the clauses and scenarios the proposal listed.
- You trusted the green suite as proof of correctness.
- You never constructed a single input designed to break the code.
- You reported a defect you didn't actually trace.

Any of these → you reverted to confirmation. Restart from the refute-by-default stance.

## Related skills

- `reviewing-an-implementation` — the self-check that precedes this stage and the readiness report that records declined findings.
- `implementing-a-proposal` — the discipline whose tests this stage tries to defeat.
- `systematic-debugging` — once a defect is confirmed, used to find its root cause before the fix.
- `.agents/rules/verification.md` — the gate this stage feeds.

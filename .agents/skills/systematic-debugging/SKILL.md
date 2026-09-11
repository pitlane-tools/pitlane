---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing or trying any fix. Find the root cause first; symptom fixes are failure.
---

# Systematic Debugging

Random fixes waste time and create new bugs. Quick patches mask underlying issues. Always find the root cause **before** attempting a fix.

**Lifted from superpowers' systematic-debugging skill.** Slimmed; the four-stage debugging flow is unchanged.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you have not completed debugging stage 1, you cannot propose a fix.

## When to use

Use for any technical issue:

- Test failures
- Bugs in dev or prod
- Unexpected behavior
- Performance problems
- Build failures
- Integration / signing / deployment issues

**Especially when:**

- Under time pressure (emergencies make guessing tempting; that's when this matters most)
- "Just one quick fix" seems obvious
- You've already tried 1-2 fixes and they didn't work
- You don't fully understand the issue

**Don't skip when:**

- Issue seems simple — simple bugs still have root causes
- You're in a hurry — systematic is faster than thrashing

## The four debugging stages

Complete each stage before proceeding to the next.

### Debugging stage 1: Root cause investigation

**Before attempting any fix:**

1. **Read the error message carefully.** Don't skim. Stack traces, line numbers, error codes — they often contain the exact answer.
2. **Reproduce consistently.** Can you trigger the bug reliably? What are the exact steps? If you can't reproduce, you can't verify a fix — gather more data instead of guessing.
3. **Check recent changes.** `git log`, `git diff`. New dependencies, config edits, environment differences. The cause is usually a recent change.
4. **For multi-component systems, gather evidence at each boundary.** When the bug spans CI → build → signing, or API → service → DB:
    ```
    For each boundary:
      - Log what data enters this layer
      - Log what data exits
      - Verify env / config propagation
      - Note state at each layer
    ```
    Run once. Read the evidence to identify the failing layer. Then investigate **that** layer.
5. **Trace data flow backward.** Where does the bad value originate? What called this with the bad value? Keep tracing up until you find the source. Fix at the source, not the symptom.

You leave debugging stage 1 with a clear, evidence-backed hypothesis about what is broken and where.

### Debugging stage 2: Pattern analysis

Find the pattern before fixing:

1. **Find a working example.** Locate similar code elsewhere in this repo that works.
2. **Read it completely.** Don't skim. Don't "adapt the pattern" — understand it.
3. **Identify differences.** What's different between the working example and the broken code? List every difference, however small. Don't assume "that can't matter".
4. **Understand dependencies.** What other components, settings, or environment does the working code rely on?

You leave debugging stage 2 knowing what differs between working and broken.

### Debugging stage 3: Hypothesis and minimal test

1. **State the hypothesis clearly.** "I think X is the root cause because Y." Be specific.
2. **Test minimally.** Make the smallest possible change to test the hypothesis. **One variable at a time.**
3. **Verify.** Did the change confirm the hypothesis? Yes → debugging stage 4. No → form a new hypothesis. Do not pile fixes on top.
4. **When you don't know:** say "I don't understand X yet". Don't pretend. Ask, research, or trace further.

### Debugging stage 4: Implementation

1. **Write a failing test.** The simplest possible reproduction of the bug. Use the `implementing-a-proposal` skill.
2. **Verify the test fails for the right reason.** Same red-green discipline as TDD.
3. **Implement a single fix.** One change. No "while I'm here" improvements. No bundled refactors.
4. **Verify the fix.** Test passes? Other tests still pass? Issue actually resolved? Use `.agents/rules/verification.md`.

### When 3+ fixes have failed: question the architecture

Pattern indicating an architectural problem:

- Each fix reveals a new shared-state / coupling problem in a different place
- Fixes require "massive refactoring" to implement
- Each fix creates a new symptom elsewhere

**Stop attempting fixes.** This is not a failed hypothesis — it's a wrong architecture.

Surface to the user:

- What you've tried
- What each fix revealed
- The pattern you're seeing
- Your hypothesis about what's structurally wrong

Discuss with the user before attempting another fix.

## Red flags — stop and follow the process

If you catch yourself thinking:

- "Quick fix for now, investigate later"
- "Just try changing X and see"
- "Add multiple changes, run tests"
- "Skip the test, I'll manually verify"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "The pattern says X but I'll adapt it differently"
- "One more fix attempt" (after 2+ failures)

All of these mean: **stop, return to debugging stage 1**.

## User signals you're doing it wrong

Watch for these redirections from the user:

- "Is that not happening?" — you assumed without verifying
- "Will it show us…?" — you should have added evidence-gathering
- "Stop guessing" — you're proposing fixes without understanding
- "Question the fundamentals" — you're fixing symptoms, not causes
- "We're stuck?" (frustrated) — your approach isn't working

When you see these: **return to debugging stage 1**.

## Common rationalizations

| Excuse                                    | Reality                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| "Issue is simple, don't need the process" | Simple issues have root causes too. Process is fast for simple bugs.    |
| "Emergency, no time"                      | Systematic is faster than guess-and-check thrashing.                    |
| "Just try this first, then investigate"   | First fix sets the pattern. Do it right from the start.                 |
| "Multiple fixes at once saves time"       | Can't isolate what worked. Causes new bugs.                             |
| "Reference too long, I'll adapt"          | Partial understanding guarantees bugs. Read it completely.              |
| "I see the problem, let me fix it"        | Seeing symptoms ≠ understanding root cause.                             |
| "One more fix" (after 2+ failures)        | 3+ failures = architectural problem. Discuss before attempting another. |

## Quick reference

| Debugging stage   | Activities                                                                      | Success criteria                     |
| ----------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| 1. Root cause     | Read errors, reproduce, check changes, gather boundary evidence, trace backward | Understand WHAT is broken and WHERE  |
| 2. Pattern        | Find working example, read fully, identify differences                          | Know how working differs from broken |
| 3. Hypothesis     | State theory, test minimally, verify                                            | Confirmed or new hypothesis          |
| 4. Implementation | Write failing test, fix root cause, verify                                      | Bug resolved, tests pass             |

## Commit

Once the failing test passes, the fix is verified, and the broader suite is green, commit. See [`.agents/rules/commit-discipline.md`](../../rules/commit-discipline.md) for message style.

Natural boundaries for a debugging session:

- **Regression test + fix:** one commit. For a tooling bug, subject: `tools: fix <user-observable bug description>`. The body explains the root cause uncovered in debugging stage 1, not the symptom.
- **Split into two commits** when the failing test is independently valuable, such as pinning previously untested behavior: `tools: add regression test for <bug>` then `tools: fix <bug>`.

Do **not** bundle a "while I'm here" cleanup, an unrelated refactor, or a fix for a second bug into the same commit. One root cause, one commit. Other findings get their own commits or their own debugging sessions.

## Related skills

- `implementing-a-proposal` — for the failing-test step in debugging stage 4
- `.agents/rules/verification.md` — the gate before claiming the bug is fixed
- `writing-a-proposal` — when a fix changes intended behavior, revise the proposal before implementation.

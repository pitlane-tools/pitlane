# Code Quality

> **This file is part of the agent contract.** Keep it tight — every line costs context.

The code an agent writes in this repo should feel like code a careful human wrote. Not a clever human, not a fast human — a careful one. The goal is readability for the next person (which is usually a future agent reading cold).

## The rules

### Small, focused files

- **One responsibility per file.** A file that handles routing + state + rendering + validation has four files in it. Split them.
- **A file over ~250 lines is a smell.** Not a hard limit — but stop and ask "what is this file actually about?". Multi-purpose files reliably get worse over time; focused files reliably get better.
- **Group by behavior, not by technical layer.** A cohesive module directory containing its behavior, tests, and presentation is easier to reason about than parallel `models/` / `views/` / `tests/` trees.

### Functions and methods

- **A function over ~40 lines is a smell.** Same caveats — not a hard cap, but a prompt to reconsider.
- **Three-or-more-deep nesting is a smell.** Early returns, guard clauses, extracting helpers — all preferable to nested `if`/`for`/`try` pyramids.
- **One thing per function.** Side effects and pure logic in the same function makes both harder to test.

### Names

- **Name for the reader, not the writer.** `cart` not `c`; `archiveItem` not `handleClick`; `pendingExports` not `pe`.
- **Avoid acronym-only names** unless the acronym is genuinely industry standard (`URL`, `HTTP`, `DB` are fine; `cnctmgr` is not).
- **Reserve `data`, `info`, `value`, `result`, `temp` for truly generic contexts.** They're rarely the right name and almost always signal you haven't thought hard enough about what the thing is.
- **Consistent vocabulary.** If a domain says "item", don't drift to "thing", "record", "entry" elsewhere. Pick one term and use it. If the proposal says it differently, surface that — don't paper over the divergence.

### Separation of concerns

- **Pure logic and I/O don't share a function.** I/O at the edges; pure logic in the middle.
- **Presentation components stay dumb.** Components render what they're given; orchestration lives outside them. A component that makes transport calls directly is doing too much.
- **The domain layer doesn't import the framework.** Domain types and invariants should be plain — testable without spinning up the runtime.

### Comments

- **Default to no comments.** Well-named code doesn't need them.
- **Write a comment when the WHY is non-obvious** — a hidden constraint, a workaround for a specific bug, a behavior that would surprise a reader.
- **Don't comment the WHAT.** `// loop over the items` next to a `for` loop is noise.
- **Don't reference the current task in comments.** "Added for the export flow" rots fast; it belongs in the commit message.

### Abstraction

- **YAGNI.** Don't build flexibility you don't have a use for. Two similar functions don't need a generic third one; three similar lines don't need a helper. Wait for the third call site, _then_ abstract.
- **No future-proofing.** Don't add an options object "in case we want to configure it later". Add the parameter when you have a real second caller.
- **No half-finished features.** Don't ship a function that "almost works but doesn't handle X". Either handle X or don't add the function yet.

### Error handling

- **Validate at boundaries.** External input gets validated and either accepted or rejected with a clear user-observable error. Internal code trusts internal contracts.
- **No defensive `try`/`catch` everywhere.** Catch where you can do something meaningful (recover, transform, log with context). Don't catch and rethrow.
- **No silent fallbacks.** If a fallback hides a real bug, you'll find out about it weeks later in production. Surface the failure.

## When the rules conflict

The rules conflict with each other regularly. "Small files" and "behavior-scoped grouping" can pull opposite ways. Use judgment: **optimize for the next person to read this code, not for the rule that sounds most universal**.

When you're unsure, ask the user.

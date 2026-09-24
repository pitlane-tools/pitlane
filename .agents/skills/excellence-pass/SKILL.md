---
name: excellence-pass
description: Use when an implementation works but its domain fidelity, architecture, interface, or maintainability still needs scrutiny before cross-artifact review.
---

# Excellence Pass

Perform this after the intended behavior works.

Do not ask only whether the implementation is correct. Ask whether this is the implementation that should remain in the repository.

Review in this order:

## Domain fidelity

Does the implementation express the actual domain model?

Are important invariants explicit rather than accidental?

Did implementation convenience distort the model?

## Architecture

Are responsibilities in the right layer?

Does this reuse the appropriate existing abstractions?

Did the change introduce a special case where a generalization is now simpler?

Did it generalize something that should remain concrete?

## Simplicity

Remove:

- unnecessary indirection
- speculative abstractions
- duplicated state
- redundant conversion layers
- compatibility machinery that is no longer required
- temporary scaffolding

Prefer fewer concepts with clearer boundaries.

## Idiomatic implementation

Use the language and framework as they are intended to be used.

Prefer existing repository conventions unless there is a concrete reason to improve them.

## Interface quality

Review:

- names
- signatures
- types
- defaults
- failure semantics
- discoverability
- consistency

For user-facing work also review interaction quality, accessibility, copy, states, transitions, and error recovery.

## Completeness

Check:

- important edge cases
- tests
- documentation
- dead code
- stale comments
- abandoned branches of the previous implementation

The result should feel native to the repository rather than appended to it.

## Outcome and handoff

The strategist records concrete findings with evidence from the grounding, proposal, and implementation. Classify each as an implementation improvement, an intent conflict, or no change needed.

- An implementation improvement goes to the implementer with a bounded correction. Rerun affected tests and validation, then repeat this pass before inline reviews.
- An intent conflict returns to the strategist and human for a proposal decision. Do not let an implementer settle it through code.
- With no material findings, proceed to the proposal-compliance and code-quality reviews in `implementing-a-proposal`. Then `reviewing-an-implementation` owns cross-artifact review, adversarial review, preview, and readiness.

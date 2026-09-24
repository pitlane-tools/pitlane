---
name: reframing-a-problem
description: Use when repeated fixes produce contradictions, an implementation cannot satisfy grounded domain constraints, or an implementer returns NEEDS_STRATEGY because the problem formulation may be wrong.
---

# Reframing a Problem

Use when continued local work is no longer increasing confidence in the solution.

Typical signals:

- repeated fixes expose new contradictions;
- the implementation seems to require violating grounded domain constraints;
- several locally reasonable approaches fail for apparently unrelated reasons;
- the current abstraction makes a simple domain concept unusually difficult;
- the strategist or implementer can describe symptoms but no coherent causal model;
- a `NEEDS_STRATEGY` result indicates the proposal's conceptual model may be wrong.

Approach the problem independently.

Do not assume:

- the current decomposition is correct;
- the proposed architecture is correct;
- the current explanation of the failure is correct;
- an existing abstraction deserves to survive.

Receive:

- the domain grounding;
- proposal;
- relevant evidence;
- attempted approaches;
- concrete observed failures.

Return:

1. The strongest diagnosis you can justify.
2. Which premises survive scrutiny.
3. Which premises should be reconsidered.
4. A better formulation of the problem, if one exists.
5. Evidence supporting the reframe.
6. What would falsify your diagnosis.
7. A recommended strategic direction.

Do not silently modify product intent. Do not default to writing code.

The strategist checks the diagnosis against its evidence and determines whether to revisit grounding, ontology, architecture, or the proposal. A change to product intent requires human review of the revised proposal before implementation resumes.

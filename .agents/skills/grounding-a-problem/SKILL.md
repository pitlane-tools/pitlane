---
name: grounding-a-problem
description: >
    Use before proposing a substantial change when solving it requires knowledge of a conceptual, technical, scientific, professional, protocol, product, or other domain that cannot safely be inferred from the request alone.
---

# Grounding a Problem

Your first task is not to design a solution.

Your first task is to understand the problem on its own terms well enough that you can later judge solutions using domain-specific knowledge rather than generic software patterns.

Do not produce an implementation plan during this stage.

## Establish the domain

Identify the bodies of knowledge the problem depends on.

Learn:

- the important concepts and vocabulary;
- foundational principles and established results;
- relevant specifications, standards, literature, documentation, or other authoritative sources;
- conventional approaches and techniques;
- important distinctions novices commonly miss;
- known constraints and impossibility results;
- common failure modes and naive approaches;
- what practitioners in the domain consider correct, robust, elegant, or poor.

Prefer primary and authoritative sources.

## Maintain epistemic provenance

Keep these categories separate:

### Established

Claims supported by authoritative external evidence or direct observation.

### Repository evidence

Facts established by the actual behavior, tests, history, or interfaces of the project.

### Inference

Conclusions drawn from the evidence but not directly established by it.

### Hypothesis

Ideas that remain to be tested.

Never allow an earlier agent-generated analysis to silently move from inference or hypothesis into established knowledge merely because another agent repeated it.

## Locate the actual problem

Be able to explain:

1. What is the problem in the vocabulary of its domain?
2. Why is it difficult or non-obvious?
3. What established knowledge constrains possible solutions?
4. What nearby solved problems or existing approaches illuminate it?
5. Where does established knowledge end and new judgement begin?
6. What important uncertainty remains?

## Grounding gate

You are ready to propose a solution only when you can:

- explain the problem from first principles;
- relate it to its surrounding concepts;
- identify plausible but naive approaches and explain why they fail;
- critique a candidate solution for domain-specific reasons;
- state what an excellent solution would optimize for;
- distinguish what you know from what you merely suspect.

If you cannot do those things, continue investigating rather than planning.

---
name: ontology-review
description: >
    Use when a proposal, design, or existing implementation introduces or changes important domain concepts, identities, relationships, states, classifications, ownership, or vocabulary. Reviews whether the system's conceptual model matches the grounded problem domain before those assumptions harden into code.
---

# Ontology Review

An ontology review asks:

> What kinds of things does this system believe exist?

Then it tests whether those distinctions, identities, relationships, and names actually correspond to the problem domain.

The goal is not to produce a class diagram, normalize a database, or impose domain-driven design terminology.

The goal is to catch conceptual mistakes before they become structural ones.

A poor ontology makes every downstream layer harder:

- APIs expose awkward distinctions;
- data models encode false assumptions;
- UI forces users to think in implementation terms;
- state machines acquire exceptions;
- names drift because one concept is doing several jobs;
- code repeatedly converts between representations that should not be distinct;
- supposedly simple features become difficult because the model is wrong.

## When to use

Use this review when work introduces or substantially changes:

- durable domain concepts;
- identity or equality semantics;
- ownership or containment;
- relationships or cardinality;
- classifications, variants, or hierarchies;
- lifecycle or state;
- events and transitions;
- user-visible vocabulary;
- persistent data structures;
- public interfaces whose types imply a conceptual model;
- multiple concepts that appear similar enough to be confused.

Also use it when implementation repeatedly feels more complicated than the underlying problem should be. That is often evidence that the ontology deserves reconsideration.

Do not require an ontology review for a change that merely alters behavior without changing how the system conceptualizes its domain.

## Inputs

Read the smallest set that establishes the conceptual problem:

- the proposal or design under review;
- its domain grounding;
- authoritative domain sources when relevant;
- existing vocabulary and conceptual models;
- relevant schemas, types, interfaces, UI, and behavior;
- prior decisions that constrain the model.

Treat the implementation as evidence of the current ontology, not as proof that the ontology is correct.

## Review stance

Do not begin with:

> "How should these classes be structured?"

Begin with:

> "What actually exists in this problem domain?"

Reason from the domain toward the software representation, not from existing software abstractions toward the domain.

Separate:

1. things that exist in the problem domain;
2. concepts introduced by the product;
3. representations introduced only for implementation convenience.

Do not silently promote the third category into the first.

## 1. Inventory the concepts

Identify the important nouns and concepts implied by the design.

For each, establish:

- what it represents;
- what makes one instance distinct from another;
- whether it has persistent identity;
- whether it can change while remaining the same thing;
- when it comes into and ceases to exist;
- whether it exists independently or only in relation to something else;
- whether users or practitioners in the domain recognize this concept.

Do not assume every noun deserves its own first-class type.

Likewise, do not assume two things are the same merely because the current implementation stores them together.

## 2. Test the distinctions

For every pair of closely related concepts, ask:

- Are these genuinely different things?
- Can one exist without the other?
- Can they change independently?
- Do they have different identity or lifecycle?
- Can something be one without being the other?
- Does the domain itself distinguish them?
- Does treating them separately enable a real behavior, or merely mirror an implementation detail?

Look specifically for:

### Conflation

Two domain concepts have been collapsed into one.

Typical symptoms:

- one type has mutually exclusive fields;
- state determines which fields "really" apply;
- the same identifier means different things in different contexts;
- vocabulary changes depending on which behavior is being discussed.

### False distinction

One domain concept has been represented as several independent concepts.

Typical symptoms:

- values must remain synchronized;
- conversions occur constantly between two representations;
- one thing cannot meaningfully exist without the other;
- callers repeatedly need both objects together;
- distinctions exist only because different subsystems created their own model.

### Missing concept

Important behavior exists but has no name or representation of its own.

Typical symptoms:

- repeated groups of parameters;
- the same conditional logic appears in unrelated places;
- important rules are described only as combinations of other fields;
- people discussing the feature repeatedly need a phrase like "the thing where X has Y but only while Z."

A concept that cannot be named clearly is often a concept that has not yet been modeled clearly.

## 3. Review identity

Identity errors are especially expensive because they infect persistence, synchronization, caching, equality, UI, and lifecycle.

For each entity-like concept ask:

- What makes this the same thing over time?
- What changes without changing its identity?
- What change would make it a different thing?
- Is identity intrinsic, assigned, or contextual?
- Is identity global or scoped by a parent?
- Can two representations refer to the same underlying thing?
- Can one representation refer to different things at different times?

Distinguish identity from:

- display name;
- database primary key;
- URL;
- array position;
- current attributes;
- object instance identity.

An implementation identifier may represent identity, but it does not define the domain merely by existing.

## 4. Review relationships

For each relationship ask:

- What does the relationship mean in domain terms?
- Which side, if either, owns the relationship?
- Is membership intrinsic or contextual?
- What are the real cardinalities?
- Can the relationship change independently?
- Does deletion of one participant imply deletion of the other?
- Does ordering matter?
- Can the same pair participate more than once under different meanings?

Be suspicious of words such as:

- parent / child;
- owner;
- contains;
- belongs to;
- member;
- associated with;
- linked;
- attached.

They often hide several materially different relationships behind familiar software vocabulary.

## 5. Review classifications and hierarchies

Whenever the design says something "is a type of" something else, test the claim.

Ask:

- Is this really an essential kind of thing, or merely a current state?
- Is it a role something can enter and leave?
- Is it a capability?
- Is it a tag or classification?
- Is it a combination of independent dimensions?
- Can something belong to several categories simultaneously?
- Does the hierarchy remain true throughout the object's lifetime?

Common mistakes include encoding:

- state as type;
- role as identity;
- capability as inheritance;
- presentation variants as domain kinds;
- several orthogonal properties as one enum.

Prefer the conceptual structure actually present in the domain rather than the structure easiest to encode with the first available language feature.

## 6. Review states and events

Distinguish:

- **thing** — what exists;
- **state** — a condition that thing is currently in;
- **event** — something that happened;
- **transition** — the rule connecting states;
- **history** — evidence of previous events or states.

Ask:

- Is a proposed entity actually an event?
- Is a proposed type actually a state?
- Is a stored state derivable from events or other facts?
- Are two supposedly independent states actually one state machine?
- Are impossible combinations representable?
- Does the model distinguish "has never happened" from "happened and was undone"?

Avoid storing several representations of the same conceptual fact unless there is a deliberate reason.

## 7. Review primitives and derived concepts

For every important piece of information, ask whether it is:

- fundamental to the domain;
- assigned by the system;
- observed externally;
- derived from other facts;
- cached for convenience.

Do not accidentally give derived information independent authority.

If `status` can be derived completely from other authoritative facts, storing and mutating all of them independently creates several competing realities.

Likewise, do not force genuinely independent concepts to be derived merely because they happen to correlate today.

## 8. Review vocabulary

Vocabulary is part of the ontology.

For every important term ask:

- Is this the term practitioners use?
- Does it mean the same thing everywhere?
- Does another term refer to the same concept?
- Is one term being used for several concepts?
- Is the software exposing implementation vocabulary where domain vocabulary would be clearer?
- Does the name imply stronger semantics than the concept actually has?

Create distinctions in language when distinctions matter.

Remove distinctions in language when they do not.

Do not resolve inconsistent vocabulary by merely selecting whichever name is already most common in the code.

## 9. Try counterexamples

Attempt to break the ontology with concrete cases.

Construct examples where:

- one supposed concept changes while another does not;
- something fits two supposedly exclusive categories;
- something fits none of the available categories;
- a child outlives its supposed parent;
- an object changes attributes while clearly remaining the same thing;
- two records represent one real-world thing;
- one record represents something whose identity has actually changed;
- the same relationship occurs under two meanings;
- a supposedly required relationship is absent;
- a supposedly optional relationship turns out to define identity.

Counterexamples are more valuable than aesthetic objections.

## 10. Compare the ontology with the domain

Return to the grounding.

Ask:

- Does the proposed model preserve the important distinctions established there?
- Has implementation convenience introduced concepts the domain does not have?
- Has the design erased distinctions practitioners care about?
- Does the quality bar established during grounding imply a different model?
- Would someone knowledgeable in the domain recognize the system's vocabulary and relationships?
- Does the model make the common case natural?
- Do exceptions correspond to genuine domain exceptions, or are they patches around a bad abstraction?

The implementation need not resemble how practitioners describe the domain literally, but departures should be deliberate and justified.

## Output

Report only conceptual findings that materially affect the design.

Use:

```text
ONTOLOGY REVIEW

CONCEPT INVENTORY
- <concept> — <what it represents and what establishes its identity>
- ...

CONFLATIONS
- <two or more concepts currently treated as one>
  Evidence:
  Consequence:
  Suggested distinction:

FALSE DISTINCTIONS
- <one concept unnecessarily represented as several>
  Evidence:
  Consequence:
  Suggested collapse:

MISSING CONCEPTS
- <unnamed concept>
  Evidence:
  Why it deserves first-class representation:

IDENTITY / LIFECYCLE ISSUES
- ...

RELATIONSHIP / CARDINALITY ISSUES
- ...

CLASSIFICATION / STATE ISSUES
- ...

VOCABULARY ISSUES
- ...

IMPLEMENTATION LEAKAGE
- <concept that appears to exist only because of the current implementation>

OPEN ONTOLOGICAL QUESTIONS
- <question whose answer materially changes the conceptual model>

ASSESSMENT:
COHERENT | REVISE
```

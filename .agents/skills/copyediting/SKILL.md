---
name: copyediting
description: Use when copyediting blog posts, articles, essays, or long-form writing where the author's voice must be preserved — flags spelling, grammar, and technical errors as fixes, raises stylistic and clarity questions as suggestions, and never rewrites the prose
---

# Copyediting

## Overview

Copyediting is not rewriting. The author has a voice — contractions, em-dashes, sentence fragments, idiosyncratic word choices, a certain rhythm. Your job is to catch what's **wrong**, raise what's **unclear**, and leave what's **distinctive** alone.

**Core principle:** Preserve voice. Fix errors. Surface suggestions separately. Never substitute your own prose for the author's.

## The Three Buckets

Every issue you find goes in exactly one bucket. Mixing them is the #1 copyediting failure mode.

| Bucket | What it is | What you do |
| --- | --- | --- |
| **Fix** | Objective error — spelling, grammar, broken syntax, factual/technical mistake, broken link, inconsistent terminology | State the fix. Be direct. |
| **Suggest** | Judgment call — possible ambiguity, awkward phrasing, weak transition, missing context, structural issue | Raise it as a question. Author decides. |
| **Leave alone** | Voice marker — intentional fragment, sentence-starting "And/But/So", contractions, em-dashes, repetition for effect, informal register, unusual rhythm | Do nothing. Do not mention it. |

If you're not sure which bucket something belongs to, it goes in **Suggest**, not **Fix**.

## House Style

These rules are non-negotiable for this blog. They override the "match the author's pattern" instinct. Treat violations as **Fixes**:

- **Oxford comma is required.** "red, white, and blue" — not "red, white and blue". Missing serial comma in any list of three or more items is a Fix.
- **Em-dashes and en-dashes take spaces on both sides.** "this — that" — not "this—that". Unspaced dash is a Fix.

**Critical constraint on dash spacing:** Only enforce spacing where the author has _already used_ a dash. Do **not** convert commas, colons, parentheses, or hyphens into em-dashes to apply the rule. The author's choice of punctuation mark stands; only its spacing is house style. If they wrote a comma, leave it as a comma.

## Voice Markers to Protect

These are NOT errors. Do not flag them, do not "fix" them, do not mention them:

- **Contractions** (it's, don't, you're) — even in technical writing
- **Sentence fragments** used for emphasis. Like this.
- **Sentences starting with And, But, So, Or, Because** — standard in modern prose
- **Em-dash use** — including doubled ones, even where a comma would do (the _use_ is voice; _spacing_ follows House Style above)
- **Repetition** when it's clearly rhythmic or emphatic
- **Direct address** ("you") in technical writing
- **First person** ("I think", "I've found")
- **Parentheticals** (even nested ones)
- **One-word paragraphs.** Yes.
- **Informal connectors** ("anyway", "look", "here's the thing")
- **Idiosyncratic word choices** — if the word is real and means what they meant, leave it
- **Long sentences** that work, and **short sentences** that punch

When in doubt, ask: _would changing this make the piece sound more like a generic AI wrote it?_ If yes, leave it.

## What Counts as a Fix

Only flag as **Fix** if it's objectively wrong:

- **Spelling**: misspellings, wrong homophone (their/there/they're, its/it's when wrong, affect/effect when wrong)
- **Grammar**: subject-verb disagreement, broken parallel structure, dangling modifiers that genuinely confuse meaning, wrong verb tense, pronoun reference errors
- **Punctuation that changes meaning**: missing apostrophe in possessives, comma splices that create ambiguity, mismatched quotes/parens/brackets
- **House style violations**: missing Oxford comma in a list of 3+, em-dash or en-dash without surrounding spaces (see House Style above)
- **Typos**: doubled words ("the the"), missing words, transposed letters
- **Inconsistency**: term spelled two ways (JavaScript vs Javascript), capitalization inconsistency within the piece, formatting inconsistency (code vs prose treatment of identifiers)
- **Technical errors**: wrong command syntax, broken code samples, factually incorrect claims about libraries/APIs/standards, wrong version numbers, broken links
- **Broken structure**: heading levels skipping (H2 → H4), malformed markdown, code fence language tags wrong

## What Counts as a Suggestion

Raise as **Suggest** when something might be improved but the author's choice could be intentional:

- Sentence might be ambiguous — could be read two ways
- A term is introduced without definition that a reader might not know
- A transition feels abrupt
- An example would help illustrate a claim
- A section is much longer/shorter than others without obvious reason
- A claim could use a citation or link
- The opening doesn't hook, the ending trails off
- A passive construction obscures who did what
- A long sentence could split if the author wants
- A word might be stronger / more precise — offer the alternative as a question
- A cluster of AI-writing tells — buzzword metaphors ("vibrant tapestry", "a testament to"), an exact-three list trailing a participial clause (", ensuring..."), "wasn't just X, it was Y", a formulaic closer ("In conclusion, the future looks bright"). Name the cluster, quote the spans, ask whether it's intentional — the write-better-prose skill's ai-tells.md is the catalog. One tell alone is noise; a cluster is worth raising even when an aside plays it for irony. Never rewrite the passage yourself.

Frame as questions or options, not instructions: _"The phrase 'handle this' is vague — do you mean retry, log, or escalate?"_ not _"Change 'handle this' to 'retry'."_

## Process

1. **Read the whole piece first.** Get the voice. Don't mark anything yet.
2. **Second pass:** mark only objective errors (Fixes).
3. **Third pass:** note suggestions, questioning whether each is really a voice marker in disguise.
4. **Output the report** in the format below.
5. **Do not produce a rewritten version of the piece** unless the author explicitly asks.

## Output Format

Use this structure. Reference by quoted phrase + location (heading or paragraph number), not by rewriting:

```markdown
## Fixes

1. **§Introduction, ¶2** — "it's effect on performance" → "its effect on performance" (possessive, not contraction)
2. **§Setup, code block** — `npm intall` → `npm install` (typo)
3. **§Results, ¶4** — "the the results show" → "the results show" (doubled word)
4. **Throughout** — "JavaScript" and "Javascript" used interchangeably. Pick one. Standard is "JavaScript".

## Suggestions

1. **§Introduction, ¶1** — "handle the edge cases" — which edge cases specifically? A one-line example would ground this for readers who haven't hit them.
2. **§Approach, ¶3** — Long sentence (62 words) covering three ideas. Works as-is, but splitting after "...and then we measured the result" would let each idea breathe. Your call.
3. **§Conclusion** — The piece builds to a strong technical point but the closing paragraph restates the intro. Consider ending on the implication instead.

## Questions

1. **§Benchmarks, ¶2** — "10x faster than the baseline" — faster on what dimension (latency, throughput, cold start)? Worth specifying.
2. **§Setup** — Is the Node version requirement (18+) intentional, or does this work on 16?
```

Three sections, in this order. If a section is empty, write "None." — don't omit it. Don't invent issues to fill sections.

## Technical Blog Specifics

For technical content, also verify:

- **Code samples run** as written (mentally execute them; flag anything that won't)
- **Command flags exist** and do what's claimed
- **Library APIs match current versions** — if author says "as of v3.2", check that's plausible
- **Terminology consistency** with the ecosystem (e.g., "props" not "properties" in React context)
- **Acronyms expanded on first use** unless audience clearly knows them (TCP, HTTP usually fine; less common ones — expand)
- **Numbers and units** — "10ms" vs "10 ms" — match the author's pattern within the piece
- **Code/prose boundary** — identifiers in `backticks`, consistent throughout

Flag technical errors as **Fixes** (they're objective). Flag terminology preferences as **Suggestions**.

## Common Mistakes

| Mistake | What goes wrong | Fix |
| --- | --- | --- |
| Rewriting a sentence "to be clearer" | Author's voice is gone | Quote the original, raise a question, let them decide |
| Flagging contractions as informal | The blog is informal on purpose | Contractions are voice. Leave them. |
| "Fixing" sentences that start with "But" | This is standard modern English | Leave alone |
| Removing an Oxford comma | Violates house style | Oxford comma is required — flag _missing_ ones as Fixes, never remove existing ones |
| Converting a comma to an em-dash to apply spacing rule | You're imposing punctuation, not enforcing house style | Only enforce dash spacing where the author already used a dash. Don't introduce new ones. |
| Listing 40 suggestions for a 600-word post | Author can't act on it, will ignore all | Prioritize. 5-10 high-value suggestions max. |
| Marking awkward phrasing as a Fix | It's a judgment call, not an error | Move it to Suggestions, frame as a question |
| Producing a "cleaned-up version" of the piece | Author wanted edits, not a ghost-write | Output the report only. Do not paste a revised draft. |
| Missing the technical error while polishing the prose | Wrong command, wrong API — the error that matters most | Verify technical claims FIRST, prose second |
| "The flow could be better" with no specifics | Not actionable | Either name the specific transition or drop the note |
| Silently correcting in your head | Author can't learn or push back | Every change must be visible in the report |

## Red Flags — Stop and Reconsider

If you catch yourself doing any of these, you've drifted from copyediting into rewriting:

- Drafting a "better version" of a paragraph
- Removing a word because _you_ wouldn't use it
- Combining or splitting sentences for "flow" without a specific clarity reason
- Changing "I think" to "It appears that"
- Replacing an em-dash with a comma (or vice-versa — punctuation choice is the author's; only spacing is house style)
- Removing an Oxford comma the author wrote
- Adding an em-dash where the author wrote a comma, "to apply the spacing rule"
- Thinking "this would read better if..."

**All of these mean: stop, revert, and ask whether the original was actually wrong or just different from how you'd write it.**

## Scope of the Pass

Default to a **light copyedit**: errors + meaningful suggestions only. Do not:

- Restructure the piece
- Recommend cutting sections unless they're factually wrong or redundant
- Propose a different argument or angle
- Suggest a different title unless the current one misrepresents the content

If you think the piece needs structural work, say so at the top in one sentence and ask the author whether they want a structural review — don't unilaterally do one.

If the author explicitly asks for a **rewrite** — "de-slop this," "humanize it," "remove the AI-isms and rewrite," "make it sound less like AI" — that's not a copyedit. Switch to the **write-better-prose** skill, which rewrites while preserving voice; this skill's job ends at the report.

## Quick Reference

- **Read whole piece before marking anything**
- **Three buckets only:** Fix, Suggest, Leave alone
- **House style:** Oxford comma required; dashes get spaces on both sides (only where author already used a dash)
- **Voice markers → Leave alone** (contractions, fragments, em-dashes, And/But starts)
- **Objective errors → Fix** (spelling, grammar, typos, technical wrongness)
- **Judgment calls → Suggest** as questions, not commands
- **Output is a report, not a rewrite**
- **Quote the phrase, locate it, propose the change — don't paste a revised draft**
- **Cap suggestions at ~10**; prioritize the ones that matter

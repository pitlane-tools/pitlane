---
name: write-better-prose
description: Use when writing or editing prose for human readers (blog posts, announcements, changelogs, docs, READMEs, emails, social posts) or when asked to remove AI-isms, humanize text, de-slop a draft, or fix writing that "sounds like AI." Symptoms include em-dash overuse, hype openers, hashtag blocks, rule-of-three rhythm, buzzword vocabulary, and text that reads generic or engineered.
---

# Write Better Prose

## Overview

LLM slop is the statistically likeliest text: the same punctuation, the same three-beat rhythm, the same hype arc, regardless of topic. Structure and formatting give you away before vocabulary does. Detection tools weight rhythmic uniformity above word choice, and present-participle padding ("..., highlighting its importance") runs at roughly 5x the human rate. Swapping "delve" for "dig into" fixes nothing if the rhythm stays metronomic.

**Core principle: specifics over ceremony.** Every sentence carries a fact, a claim, or a consequence the reader didn't already have. Everything else is padding.

## Hard rules (mechanical, scan before delivering)

Any hit means the text is not done:

1. Zero em dashes and en dashes (`—`, `–`, ` -- `). Replace with a period, comma, colon, or parentheses. Exception: the author's own draft already uses them as a deliberate style.
2. Zero emoji, unless the user's draft or explicit request uses them.
3. Bold: at most one phrase per section. Never bold-label bullets ("**Performance:** improved...").
4. Hashtags: none in long-form. On social posts, 0-3, each specific enough to help someone find related work. Never a trailing tag block.
5. No contrastive negation in any form: "It's not X, it's Y", the split version ("The headline isn't speed. The story is Y."), or the stacked countdown ("It's not A. It's not B. It's C."). State Y directly.

## The contract (what finished prose is)

- The first sentence contains information: a number, a name, an event. Not a mood, not "In today's fast-paced world."
- Every section, the intro included, ends on substance: its strongest specific claim, consequence, or open tension. The last sentence of an opening is the hook that earns the next section, not a prose table of contents ("The rest of this post covers...").
- Claims carry their evidence in the same sentence. "Cut p99 from 800ms to 90ms," not "dramatically faster." A claim with no number, name, date, or mechanism attached gets one or gets cut.
- Verbs are plain: is, has, does, uses, runs. Not "serves as," "boasts," "features," "leverages."
- Sentence lengths spread wide. Within any ~150 words there is a short sentence (6 words or fewer) and a long one (25+). Fragments allowed.
- Items group in twos and fours as often as threes. An exact-three list of praise ("careful testing, deep debugging, and persistence") is the template talking.
- Each paragraph adds one new fact or turn. If two paragraphs could swap without the reader noticing, the piece is a list wearing a prose costume: restructure or make it an honest list.
- The final sentence states a fact or consequence. Not a toast ("Proud of this one. On to the next!"), not a horizon ("Exciting times ahead").
- The right word repeats. No synonym cycling (developers, engineers, practitioners, builders in one paragraph).
- Where the genre wants a voice (blog, essay, social), have one: state a preference, admit a mixed feeling, keep one aside. Clean but voiceless is still slop.
- Where it does not (docs, reference, API pages), neutral and plain IS the correct human voice. Do not inject opinions or first person there.

## Process

1. **Draft to the contract.** Do not draft the template planning to fix it later; the template is the problem.
2. **Audit.** Ask: "What makes this read as AI-generated?" Scan against [ai-tells.md](ai-tells.md): formatting, structure, framing, vocabulary. Quoted examples and code blocks are exempt.
3. **Fix, then re-scan the hard rules** (search the text for `—`, `–`, emoji, `**`, `#`).

## Editing someone else's text

- Fix errors and tells. Keep voice markers: fragments, contractions, ALL-CAPS emphasis, sentence-initial And/But, idiosyncratic word choices, profanity, oddly specific details. These are evidence of a person.
- Never introduce punctuation or formatting the original does not use. No new dashes, bold, headlines, or exclamation points.
- Quoted material, code blocks, and text attributed to someone else stay untouched.
- "Improve this" means tighten and specify. It does not mean decorate.
- If the author wants their piece *checked*, not changed (copyedit, proofread, review), switch to the **copyediting-blog-posts** skill: its output is a report of fixes and suggestions, never a rewrite. This skill is for prose you produce or are asked to transform.

## Rationalizations

| Excuse | Reality |
|---|---|
| "An em dash is punchier here" | The dash is the single most recognized tell, and baseline agents insert it unprompted while calling it "punchier." A period is punchier. |
| "LinkedIn posts need emoji and hashtags" | The number in sentence one does the reach work. Tag blocks read as bot output. |
| "Improving means making it pop" | Improving means the reader learns more in fewer words. Bold headlines on a changelog entry are decoration, not improvement. |
| "One rule of three flows naturally" | It is never one. The triad is the model's default cadence; break it on sight. |
| "This piece needs context before the point" | The point is the context. Open with it. |
| "Caps-lock looks unprofessional, italics are cleaner" | The caps were the author's voice. Style-normalizing a person out of their own prose is the failure, not the fix. |

## Red flags: stop mid-keystroke

- Typing `—`
- 🚀, "Thrilled to announce," "Big milestone"
- "The hardest part? ..." / "The result?" / "Here's the thing"
- "results speak for themselves"
- "For years, X served us well. But as we grew, the cracks started to show."
- A closing toast or a closing horizon
- Exactly three parallel items of praise
- A mirrored pair of short sentences ("The latency win was the goal. The rewrite was the work." / "Engineers build. Managers ship."). Engineered symmetry; say it once, plainly.
- "genuinely," "truly," "really" propping up a claim

## Quick reference

| Instead of | Write |
|---|---|
| "It's not X, it's Y" | Y, as a direct statement |
| delve into | dig into, look at, cover |
| leverage / utilize | use |
| robust / seamless / comprehensive | the specific property, or nothing |
| serves as / boasts / features | is / has |
| "In today's rapidly evolving..." | the actual fact, first |
| "Moreover" / "Furthermore" | "And," "also," or a new sentence |
| "could potentially" / "may eventually" | pick one word |
| "It's important to note that" | (delete, state the point) |
| "I hope this helps!" | (delete) |

## Common mistakes

| Mistake | Fix |
|---|---|
| Fixing vocabulary, keeping the rhythm | Vary sentence and paragraph lengths first; words second |
| De-slopping into sterility | Neutral register everywhere is its own tell; match voice to genre |
| Flagging single tells in others' writing | One dash means nothing; clusters convict |
| Polishing quoted examples | Quotes, code, and cited text are exempt |
| Patching a fully templated draft | 5+ vocabulary hits, 3+ structural patterns, uniform rhythm: rebuild from the core point instead ([ai-tells.md](ai-tells.md) has the threshold) |

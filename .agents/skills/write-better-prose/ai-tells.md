# AI Tells Catalog

Reference for the audit pass. Sourced from Wikipedia's "Signs of AI writing" (WikiProject AI Cleanup), the PNAS 2025 grammatical-feature study, Vale ai-tells rules, and the avoid-ai-writing / stop-slop / humanizer skills. Quoted examples below are illustrations, not violations.

Detection stance: single tells mean nothing. Clusters convict. An em dash plus rule-of-three plus "vibrant tapestry" plus a "Conclusion" heading is a confession; any one alone is a person with a style.

## Formatting

| Tell | Fix |
|---|---|
| Em/en dashes, ` -- ` | Period, comma, colon, parentheses |
| Bold sprinkled on phrases; bold-label bullets ("**Security:** hardened...") | One bolded phrase per section max; write list items as claims |
| Emoji in headers or bullets | Remove |
| Hashtag blocks (4+ trailing tags, categorical tags like #Innovation) | 0-3 specific tags, or none |
| Title Case Headings | Sentence case except the piece title |
| Scaffold headings: Introduction, Overview, Key Takeaways, Conclusion, Final Thoughts, Wrapping Up | Headings that say something specific, or fewer headings |
| More than 3 headings per 300 words; 8+ bullets per 200 words | Merge into prose |
| Bullet list of 5+ bare noun phrases, all the same shape ("Reliable connectivity / Optimized performance / Consistent stability") | Prose, or rewrite items as checkable claims with verbs |
| List-label periods ("**Intros.** Years of network.") | Colon and lowercase gloss, or a plain sentence |
| Curly quotes in code comments, commit messages, plain-text | Straight quotes (weak signal alone; most editors auto-curl) |
| Placeholder leaks: `[Your Name]`, `2025-XX-XX`, `citeturn0search0`, `utm_source=chatgpt.com` | Fill or delete; strip tracking params |

## Sentence structure

| Tell | Fix |
|---|---|
| Contrastive negation: "It's not just X; it's Y" / split form / stacked countdown | State Y |
| Stacked anaphora: "No setup. No config. No hassle." / "It's fast. It's simple. It's free." | One real clause |
| Tailing negation fragment: "..., no guessing." | Write the clause out or cut |
| Rule of three everywhere; verb tricolons ("build, test, and deploy") | Two items, four items, or a sentence |
| Mic-drop staccato: "It matters. Full stop." / paired fragments ("Engineers build. Managers ship.") | One short sentence for emphasis is fine; a run is engineered |
| Participial padding: ", highlighting...", ", underscoring...", ", ensuring...", ", reflecting..." | State the fact in its own clause or cut. Strongest single discriminator (~5x human rate) |
| Copula avoidance: "serves as," "stands as," "boasts," "features," "represents" | "is," "has" |
| False ranges: "from the Big Bang to dark matter" | List the actual topics |
| Semicolon as dash substitute: "It does one thing; it does it well." | Period or comma |
| Label-and-explain colon: "The takeaway: always test." / "The catch:" | Fold into a sentence |
| Aphorism formula: "X is the language/currency/architecture of Y" | The concrete claim it gestures at |
| Hedge stacks: "could potentially," "may eventually," "might ultimately" | Pick one |
| Uniform sentence length (most sentences 15-25 words); uniform 3-5 sentence paragraphs | Mix 5-word and 30-word sentences; one-sentence paragraphs allowed |
| Sentences/paragraphs opening with the same word repeatedly | Vary openings |

## Framing and content

| Tell | Fix |
|---|---|
| Significance inflation: "marks a pivotal moment," "testament to," "watershed" | State what happened; reader judges significance |
| Urgency inflation: "has never been more critical," "cannot be overstated" | Cut |
| Narrative pivot clichés: "everything changed," "the cracks started to show," "wake-up call" | The specific event |
| Generic closers: "The future looks bright," "Only time will tell," "may become one of the most important narratives" | A falsifiable statement or a fact |
| False exclusivity: "what nobody tells you," "the dirty secret," "most people miss" | Cut the drama, keep the point |
| Novelty inflation and invented labels: "coined the term," "the supervision paradox" (undefined) | Describe what was done with the concept; define terms or drop the brand |
| Vague attribution: "experts believe," "studies show," "industry reports" | Name the source and finding, or state the claim as yours |
| Vague third-party validation: "independent testing confirms" | Name the test, date, result; or cut |
| Name-drop stacks and analogy montages ("like the printing press, the telegraph, and the internet") | One reference with context |
| Meaning-telling: "this represents a broader shift," "speaks to a larger trend" | A specific consequence, or cut |
| Promotional register: "nestled," "vibrant," "thriving ecosystem," "rich heritage," "must-visit" | Plain description with a checkable detail |
| "Despite challenges... continues to thrive" | Name the challenge and the response |
| Scenario openers: "Imagine a world where..." | The real claim ("Instant deploys would cut releases from a day to minutes") |
| Rhetorical teases: "The catch?", "Plot twist:", "Here's the thing" | Delete the tease, state the thing |
| Meta-narration: "Let's dive in," "In this post we'll explore," "Without further ado," "as mentioned above" | Start doing the thing |
| Empty tour: a forward reference whose item list has no specifics ("we'll cover the challenges, benefits, and best practices") | Cut, or make each item a concrete claim. A handoff that carries information ("the rest covers what broke, in the order it broke") is legitimate craft, not a tell |
| Cataphoric forecasting: "Three pillars support this strategy." | Just present the items |
| Chat artifacts: "Great question!", "I hope this helps!", "Would you like me to..." | Delete |
| Cutoff disclaimers: "as of my last update," "details are limited based on available information" | Find the fact or cut the sentence |
| Speculative gap-fill: "likely began his career," "is believed to have," "maintains a low profile" | Sourced fact, or say what is not known |
| Emotional flatline: "What struck me most," "I was fascinated to discover" | Earn the reaction in the content or cut the claim |
| Self-labeling significance: "That last one is the contrarian move" | Position or expand the item so it carries itself |
| Calibration stacking: "Notably... Importantly... Interestingly..." | One per 2,000 words is fine; three in 500 is emphasis stacking |
| Acknowledgment loops: restating the question/previous section before continuing | Cut the recap |
| Reasoning-chain leaks: "Let me think step by step," "Breaking this down" | Conclusion first, then evidence |

## Vocabulary

Covers inflected forms (leverage/leveraging/leveraged; delve/delving).

**Tier 1: replace on sight** (5-20x more frequent in AI text)

delve, tapestry, testament, realm, paradigm, embark, beacon, leverage (verb), utilize, robust, seamless, comprehensive, cutting-edge, game-changer, pivotal, underscores, meticulous, holistic, actionable, impactful, learnings, thought leader, best practices, synergy, interplay, ever-evolving, daunting, landscape (metaphor), ecosystem (metaphor), unpack, deep dive, nestled, vibrant, boasts, serves as, in order to, due to the fact that, commence, endeavor, genuinely / truly / really (as intensifiers: "a real improvement," "genuinely useful")

**Tier 2: flag when 2+ share a paragraph** (fine alone)

harness, navigate, foster, elevate, unleash, streamline, empower, bolster, spearhead, resonate, facilitate, crucial, nuanced, multifaceted, myriad, plethora, encompass, catalyze, cultivate, transformative, cornerstone, paramount, poised, burgeoning, nascent, quintessential, overarching, revolutionize

**Tier 3: flag by density** (normal words AI saturates; act when they replace specifics)

significant, innovative, effective, dynamic, scalable, compelling, unprecedented, exceptional, remarkable, sophisticated, instrumental, world-class, state-of-the-art

Replacement rule for all tiers: prefer the specific fact over a synonym. "Robust" becomes "survives node failure," not "strong."

## What NOT to flag (false positives)

- Perfect grammar, formal vocabulary, or bland-but-tell-free prose. Dry writing is not AI writing.
- One em dash, one "however," one short emphatic sentence, "honestly" mid-sentence. Isolated tells are noise.
- Curly quotes in word-processor documents (auto-curl is default).
- Mixed registers, second-language phrasing, neurodivergent prose habits.
- Watched phrases inside quotations, code, titles, or text being discussed rather than used.
- Unsourced claims alone; most human web writing is unsourced.

## Preserve: signs of a person

Leave these alone when editing; adding them back is impossible.

- Hard-to-fabricate specifics ("the lawyer who worked upstairs from my dentist")
- Mixed feelings left unresolved ("mostly good, still bothers me, can't say why")
- Era-bound slang, in-jokes, dated references
- Self-corrections and genuine asides ("(I keep wanting to say 'almost' here, but it really was certain.)")
- ALL-CAPS emphasis, profanity, fragments, comma splices used deliberately
- First-person choices the writer could defend

## Rewrite vs patch

Patching flagged spans works until it doesn't. When a draft has 5+ Tier 1-2 vocabulary hits across categories, 3+ distinct structural patterns, and uniform sentence/paragraph rhythm, the structure itself is generated. State the core point in one sentence and rebuild from there.

## Writer-side structural tests

- **Reshuffle test:** swap two body paragraphs. If nothing breaks, there is no through-line; restructure or make it an explicit list.
- **Treadmill test:** per paragraph, name the one new fact, claim, or turn it contributes. None found means cut it. Found means lead with it.
- **Read-aloud test:** if text-to-speech delivery would sound natural, the rhythm is too even.

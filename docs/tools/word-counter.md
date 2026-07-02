# Word & Character Counter

- **Slug:** `/tools/word-counter` · **Category:** Text · **Priority:** Tier 2
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** none (`Intl.Segmenter` for robust word/grapheme counts)

## Why
High-traffic writer tool. Trivial to build; `Intl.Segmenter` gives correct
counts for Arabic and emoji where naïve `split(' ')` fails.

## User stories
- As a writer, I want live word, character (with/without spaces), sentence and
  paragraph counts, plus an estimated reading time.
- As a writer, I want it to count Arabic text correctly.

## Inputs → Outputs
Text → live stats (words, chars, sentences, paragraphs, reading time).

## Requirements (v1)
- [ ] Live counts as the user types.
- [ ] Characters with and without spaces; graphemes (emoji-safe).
- [ ] Words via `Intl.Segmenter('…', {granularity:'word'})` (Arabic-correct).
- [ ] Reading time (~200 wpm, configurable) and speaking time (~130 wpm).

## Acceptance criteria
- "مرحبا بالعالم" counts as 2 words.
- "👍🏽" counts as 1 character (grapheme), not 2–4.

## Out of scope (v1)
- Keyword density, readability scores (fast follow).

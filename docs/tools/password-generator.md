# Password Generator

- **Slug:** `/tools/password-generator` · **Category:** Generators · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** none (`crypto.getRandomValues`)

## Why
Everyone needs strong passwords; most online generators are ad-laden and, worse,
generate on a server (so your "random" password touched someone else's machine).
Ours is provably local — a real trust win.

## User stories
- As a user, I want a strong random password with adjustable length/character
  sets so I can paste it into a signup form.
- As a user, I want a memorable passphrase (word-based) as an alternative.
- As a user, I want to copy it in one click and see a strength estimate.

## Inputs → Outputs
Length (4–128), toggles (lowercase/UPPERCASE/digits/symbols), "avoid ambiguous
chars", exclude-similar → generated password + strength meter.

## Requirements (v1)
- [ ] Cryptographically secure randomness (`crypto.getRandomValues`, never `Math.random`).
- [ ] Character-set toggles; guarantee ≥1 char from each enabled set.
- [ ] Passphrase mode: N words from a bundled wordlist + separator + optional number.
- [ ] Strength estimate (entropy bits → Weak/Fair/Strong/Excellent).
- [ ] Copy button with transient "Copied!" feedback; regenerate button.
- [ ] Nothing logged, stored, or sent.

## Acceptance criteria
- Disabling all character sets is prevented (at least one stays on).
- Length slider reflects instantly; entropy updates live.
- Generated output uses only the enabled sets and respects exclusions.

## Out of scope (v1)
- Saving/vaulting passwords; breach-check API lookups.

# Password Generator

- **Slug:** `/apps/password-generator` · **Category:** Generators · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Live
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
Length (6–64), toggles (lowercase/UPPERCASE/digits/symbols), "avoid ambiguous
chars", exclude-similar, **how many (1–10,000)** → one password + strength
meter, or a batch with a capped preview, Copy all and a newline-separated
`.txt`.

## Requirements (v1)
- [ ] Cryptographically secure randomness (`crypto.getRandomValues`, never `Math.random`).
- [ ] Character-set toggles; guarantee ≥1 char from each enabled set.
- [ ] Passphrase mode: N words from a bundled wordlist + separator + optional number.
- [ ] Strength estimate (entropy bits → Weak/Fair/Strong/Excellent).
- [ ] Copy button with transient "Copied!" feedback; regenerate button.
- [ ] Nothing logged, stored, or sent.
- [x] **Up to 10,000 at once**, as a newline-separated download and a Copy all.
      The preview is capped at 100 lines; the file carries the batch.
- [x] **A batch is CLEARED when a setting changes**, never rebuilt — a stale
      list of passwords cannot be told from a fresh one by looking.
- [x] **Repeats in a batch are reported.** Digits at length 6 is 10^6 possible
      passwords, so 10,000 draws collide about fifty times by the birthday
      bound; handing that out as though every row were distinct is the defect.

## Acceptance criteria
- Disabling all character sets is prevented (at least one stays on).
- Length slider reflects instantly; entropy updates live.
- Generated output uses only the enabled sets and respects exclusions.
- The batch is read off the DOWNLOAD, not the preview: the preview is capped,
  so it is the only place the whole thing can be checked.
- The repeats note has a CONTROL case asserting it is absent at a real length,
  without which it would be permanent decoration.

## Out of scope (v1)
- Saving/vaulting passwords; breach-check API lookups.

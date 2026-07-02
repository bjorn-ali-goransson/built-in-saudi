# UUID Generator

- **Slug:** `/tools/uuid-generator` · **Category:** Generators · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** none (`crypto.randomUUID`)

## Why
A dead-simple, high-traffic developer utility. Trivial to build; good SEO entry
point for the developer audience.

## User stories
- As a developer, I want to generate one or many v4 UUIDs and copy them.
- As a developer, I want optional formatting (uppercase, no-dashes, braces).

## Inputs → Outputs
Count (1–1000), format toggles → list of UUIDs.

## Requirements (v1)
- [ ] Generate v4 UUIDs via `crypto.randomUUID()`.
- [ ] Bulk count with a sane cap (e.g. 1000) and a "copy all" button.
- [ ] Format options: uppercase, strip dashes, wrap in braces.
- [ ] Per-line copy on click.

## Acceptance criteria
- 1000 UUIDs generate instantly and are all unique/valid v4.
- Copy-all places newline-separated UUIDs on the clipboard.

## Out of scope (v1)
- v1/v5/v7 UUIDs (fast follow), namespace hashing.

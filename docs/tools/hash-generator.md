# Hash Generator

- **Slug:** `/tools/hash-generator` · **Category:** Generators · **Priority:** Tier 2
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** `SubtleCrypto` (SHA family); small MD5 lib if MD5 needed

## Why
Developers constantly need a quick SHA-256 of a string or file. Doing it locally
matters because the input is often sensitive (tokens, files).

## User stories
- As a developer, I want the SHA-1/256/384/512 of some text.
- As a developer, I want to hash a file without uploading it.

## Inputs → Outputs
Text or dropped file + algorithm selection → hex (and optional Base64) digest.

## Requirements (v1)
- [ ] SHA-1, SHA-256, SHA-384, SHA-512 via `crypto.subtle.digest`.
- [ ] Text input and file input (read via `FileReader`/`arrayBuffer`).
- [ ] Hex output + copy; optional Base64 output.
- [ ] Live recompute on input/algorithm change.

## Acceptance criteria
- Known test vectors match (e.g. SHA-256 of "abc").
- Large files (tens of MB) hash without freezing the UI (chunk/async).

## Out of scope (v1)
- MD5 (add via lib if demand), HMAC, bcrypt/argon2.

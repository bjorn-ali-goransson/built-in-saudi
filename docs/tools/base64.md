# Base64 Encoder / Decoder

- **Slug:** `/tools/base64` · **Category:** Converters · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** none (`btoa`/`atob` with UTF-8 handling; `FileReader` for files)

## Why
Common developer task; also used for data-URIs. Local execution avoids leaking
tokens/keys that people often Base64.

## User stories
- As a developer, I want to encode/decode Base64 text (UTF-8 safe).
- As a developer, I want to Base64 a small file to a data-URI.

## Inputs → Outputs
Mode (encode/decode) + text, or a dropped file → encoded/decoded output.

## Requirements (v1)
- [ ] UTF-8-safe encode/decode (handle non-Latin1; e.g. Arabic text correctly).
- [ ] URL-safe Base64 toggle (`-_` instead of `+/`, optional padding strip).
- [ ] File → Base64 / data-URI (with size guard, e.g. warn > a few MB).
- [ ] Clear error on invalid Base64 during decode.

## Acceptance criteria
- Round-trips Arabic + emoji text without corruption.
- Invalid input on decode shows a friendly error, not a crash.

## Out of scope (v1)
- Base32/Base58, decoding data-URIs back to downloadable files (fast follow).

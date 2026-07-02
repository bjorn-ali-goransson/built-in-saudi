# JSON Formatter & Validator

- **Slug:** `/tools/json-formatter` · **Category:** Developer · **Priority:** Tier 1
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** none (native `JSON`); optional tiny error-locator

## Why
Core developer utility with big search volume. Local execution matters because
devs paste API responses that contain tokens/PII.

## User stories
- As a developer, I want to prettify, minify and validate JSON.
- As a developer, I want a clear error with line/column when it's invalid.
- As a developer, I want to copy or download the result.

## Inputs → Outputs
Raw JSON + action (format/minify) → formatted/minified JSON or a precise error.

## Requirements (v1)
- [ ] Format (2/4-space toggle) and minify.
- [ ] Validation with human error message + line/column pointer.
- [ ] Copy + download; character/size readout.
- [ ] Optional: sort keys, collapse/expand tree view (fast follow).

## Acceptance criteria
- Valid JSON pretty-prints with chosen indent; minify strips whitespace.
- A trailing comma reports the correct line/column, not a generic failure.

## Out of scope (v1)
- JSON5/JSONC, JSONPath queries, schema validation.

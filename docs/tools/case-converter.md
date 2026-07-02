# Case Converter

- **Slug:** `/tools/case-converter` · **Category:** Text · **Priority:** Tier 2
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** none

## Why
Writers and developers constantly reformat text case. Cheap to build, useful,
and a natural neighbour to the word counter.

## User stories
- As a user, I want to transform text to UPPER, lower, Title, Sentence,
  camelCase, snake_case, kebab-case, CONSTANT_CASE.
- As a user, I want live output and one-click copy.

## Inputs → Outputs
Text + chosen case → transformed text.

## Requirements (v1)
- [ ] Cases: upper, lower, title, sentence, camel, pascal, snake, kebab, constant.
- [ ] Live transform; preserve reasonable word boundaries.
- [ ] Copy button; character/word count shown.
- [ ] Handle Arabic text gracefully (case ops are no-ops; don't mangle).

## Acceptance criteria
- "hello world" → "Hello World" (title), "helloWorld" (camel), "hello_world" (snake).
- Arabic passes through unchanged for casing operations.

## Out of scope (v1)
- Find/replace, regex transforms (belongs in a text-tools bundle later).

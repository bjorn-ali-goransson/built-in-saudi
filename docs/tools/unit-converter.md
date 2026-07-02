# Unit Converter

- **Slug:** `/tools/unit-converter` · **Category:** Converters · **Priority:** Tier 2
- **Runs:** 100% client-side · **Status:** Coming soon
- **Libraries:** none (static conversion tables)

## Why
Evergreen, high-volume search intent ("cm to inches", "kg to lb"). Pure math,
no dependencies, great SEO surface (one indexable page per category).

## User stories
- As a user, I want to convert between units in a category (length, weight,
  temperature, data, area, volume, speed, time).
- As a user, I want the result live as I type, both directions.

## Inputs → Outputs
Category + from-unit + to-unit + value → converted value (live).

## Requirements (v1)
- [ ] Categories: length, mass, temperature, data, area, volume, speed, time.
- [ ] Live bi-directional conversion; sensible precision/rounding.
- [ ] Temperature handled with offsets (not just ratios).
- [ ] Swap-units button; copy result.

## Acceptance criteria
- 100°C → 212°F; 1 KiB → 1024 B; 1 mile → 1.609344 km.
- Switching category resets to valid unit pair.

## Out of scope (v1)
- Live currency conversion (needs rates API — separate tool), fuel economy.

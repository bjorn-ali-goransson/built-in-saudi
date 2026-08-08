// "Related tools" for a tool page, derived where that works and curated where
// it does not.
//
// Every tool page already links to EVERY other tool, in a crawlable block that
// exists to kill orphan pages. That is right for a search engine and useless
// for a person: a list of 197 is the same as no list at all.
//
// Deriving the relations from the existing scorer was measured before it was
// built, and the result splits cleanly by score:
//
//   csv-to-xlsx -> xlsx-convert (385), csv-vcard (266), csv-split (261)   good
//   qr-code     -> qr-reader (273), zatca-qr (212), barcode (149)         good
//   gosi-salary -> ip-subnet (75), calorie-needs (63), water-intake (56)  noise
//   early-settlement -> data-anonymize (12), dice-roller (5)              noise
//
// The reason is not a bug in the scorer. **Lexical similarity finds format
// families and is blind to life-domains**: PDF tools share the word "PDF",
// while GOSI, rent and vehicle registration share no vocabulary at all even
// though anyone dealing with one is plausibly dealing with another. So the
// automatic half is thresholded, and the handful of domain clusters are named
// by hand — eight groups rather than 197 rows of curation.

import type { Tool } from '../tools/types'
import { liveTools } from '../tools'
import { pickRelated } from './relatedPick'

/**
 * Up to `limit` tools worth showing beside this one.
 *
 * The selection itself lives in `relatedPick.ts`, which takes the tool list as
 * an argument so a node harness can exercise the REAL function — see the note
 * at the top of that file for why a copy was not good enough.
 */
export function relatedTools(tool: Tool, limit = 4): Tool[] {
  return pickRelated(tool, liveTools, limit)
}

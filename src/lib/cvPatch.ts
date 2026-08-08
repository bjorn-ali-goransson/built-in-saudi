// The client's half of the improve-patch merge, alone in a file with no runtime
// imports — so `npx tsc src/lib/cvPatch.ts` compiles it standalone and
// `evals/patchcheck.mjs` can check the REAL function rather than a copy of it.
// Same arrangement as `src/lib/fuzzy.ts` and the search bench.
//
// Why this exists at all: the improve pass returns only the CHANGED sections as
// a `patch`, and the merge is section-level, so whatever the patch says about a
// section replaces it wholesale. In this wire format "unchanged" is expressed by
// OMITTING the key — which means an empty value carries no information, and
// treating it as "delete" wiped the candidate's entire work history from the
// improved CV (measured; see functions/cvShape.js `normalizePatch`).
//
// Duplicated from the server deliberately, against the usual single-source
// preference: the client ships via Pages and the functions via their own
// workflow, so a rollback of one can pair a new client with an old server. The
// failure it prevents is a person sending an employer a CV with a section
// missing, which is worth two copies and a test each.

/** Is this section value empty, and therefore carrying no instruction? */
export function isEmptySection(v: unknown): boolean {
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'string') return v.trim().length === 0
  return v == null
}

/**
 * Merge a patch onto a CV, section by section, dropping empty sections.
 *
 * Generic over the CV shape: this module is about the protocol, not the schema,
 * and keeping the real `Cv` type out of it is what lets it compile alone.
 */
export function mergePatch<T extends object>(cv: T, patch: Partial<T> | null | undefined): T {
  if (!patch || typeof patch !== 'object') return cv
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (!isEmptySection(v)) safe[k] = v
  }
  return { ...cv, ...safe }
}

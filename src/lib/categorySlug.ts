// URL slugs for the tool categories.
//
// This is a PURE module with no imports at all, because three very different
// things need the same answer: the router, the build-time prerender plugin in
// vite.config.ts (which cannot import anything that pulls in React), and the
// sitemap check. The repo's standing rule — extract the pure part rather than
// keep a mirror — applies exactly here.
//
// The mapping is written out rather than derived, because the derivation is
// lossy in a way that would bite silently: "Saudi / Local" contains a slash,
// which is a path separator, and slugifying it produces `saudi-local` — from
// which the original cannot be recovered by any rule. A table can be read.

export const CATEGORY_SLUGS: Record<string, string> = {
  'Saudi / Local': 'saudi',
  Islamic: 'islamic',
  Arabic: 'arabic',
  Text: 'text',
  Converters: 'converters',
  Calculators: 'calculators',
  Health: 'health',
  'Time & Date': 'time',
  Images: 'images',
  PDF: 'pdf',
  Files: 'files',
  Developer: 'developer',
  Web: 'web',
  Generators: 'generators',
  Design: 'design',
  Business: 'business',
  Communication: 'communication',
  Utilities: 'utilities',
}

const BY_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_SLUGS).map(([cat, slug]) => [slug, cat]),
)

export const categorySlug = (category: string): string | undefined => CATEGORY_SLUGS[category]

export const categoryFromSlug = (slug: string): string | undefined => BY_SLUG[slug.toLowerCase()]

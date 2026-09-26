// The header and footer bands.
//
// Raster, generated once by `scripts/gen-schedule-art.mjs` and COMMITTED — the
// site never calls an image API, and the script exists only to redo the art.
// They replaced a pair of hand-written SVGs which were legible and looked like
// what they were.
//
// One source for both renderers. The grid on screen is HTML and the grid in
// the PDF is drawn on a canvas — two renderers by necessity, because pdf-lib
// cannot shape Arabic and a canvas has no reading direction to inherit — but
// the ARTWORK is one file each, so the printed sheet cannot slowly stop
// looking like the one that was edited.
//
// **There is deliberately no Saudi flag**, which the reference sheet has and
// which would be the obvious thing to ask for. The flag carries the shahāda,
// and a schedule is a disposable sheet that gets pinned up, torn down and
// thrown away at the end of term. Bunting says the same thing and asks nothing
// of whoever clears the wall.

export const HEADER_URL = '/illustrations/schedule-header.webp'
export const FOOTER_URL = '/illustrations/schedule-footer.webp'

/**
 * How tall each band is, as a percentage of the sheet's WIDTH.
 *
 * Not a fixed height in either renderer, and not the image's own aspect
 * ratio. The bands are about 5:1 and 3.7:1, so drawn across the full width of
 * A4 landscape the footer alone would be 80mm of a 210mm page — the
 * illustration eating the schedule. Sizing from the width instead means the
 * artwork is the same size relative to the sheet on screen and on paper,
 * which is the whole reason there is one file rather than two.
 *
 * The art is CONTAINED in that band, never cropped to fill it: cropping is
 * what cost the books their spines and the children their heads when the
 * generator's own margin was trimmed by a fixed fraction.
 */
export const HEADER_BAND = 7.5
export const FOOTER_BAND = 9

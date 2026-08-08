// Pixel comparison of two images.
//
// Two things separate a useful image diff from a red mess, and both are about
// refusing to pretend:
//
// 1. **Different dimensions are not a pixel comparison at all.** Most tools
//    scale one image to fit the other and report a difference on every pixel,
//    which is true and useless. This compares the OVERLAPPING region and says
//    what it left out, so the number means something.
//
// 2. **Anti-aliasing is not a change.** Two screenshots of the same page taken
//    on different machines disagree on thousands of pixels by one or two
//    levels — different font rasterisers, different GPU. With a zero tolerance
//    the whole of every glyph lights up and the real change is invisible in the
//    noise. The threshold is a percentage of the maximum possible distance, and
//    it defaults to something that ignores rasteriser noise and keeps a genuine
//    one-shade fill change.

export interface DiffResult {
  /** Pixels that differ beyond the tolerance. */
  changed: number
  /** Pixels compared — the overlap, not either image's total. */
  compared: number
  /** changed / compared, 0–1. */
  ratio: number
  width: number
  height: number
  /** True when the two images are not the same size. */
  mismatched: boolean
  /** The pixels each image has that the other does not. */
  outsideA: number
  outsideB: number
  /** A mask: differing pixels opaque, the rest transparent. */
  mask: ImageData
}

/** 0–1. The default ignores rasteriser noise and keeps a real one-shade change. */
export const DEFAULT_TOLERANCE = 0.04

// The per-pixel distance is INLINED in the loop below rather than factored into
// a helper. At 1920x1080 that is two million calls, and the two images are
// indexed differently (their rows have different strides once the sizes differ),
// so a shared helper would have to take both arrays and both offsets anyway.
//
// It is plain Euclidean distance across RGBA, normalised by the largest
// possible. Not perceptual: a perceptual metric needs a colour-space conversion
// per pixel and would make "5% different" a number no reader could check. Alpha
// counts — a transparent pixel becoming white is a change.

export function diffImages(a: ImageData, b: ImageData, tolerance = DEFAULT_TOLERANCE): DiffResult {
  const width = Math.min(a.width, b.width)
  const height = Math.min(a.height, b.height)
  const mask = new ImageData(Math.max(1, width), Math.max(1, height))
  let changed = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ia = (y * a.width + x) * 4
      const ib = (y * b.width + x) * 4
      const im = (y * width + x) * 4
      const d = Math.sqrt(
        (a.data[ia] - b.data[ib]) ** 2 +
        (a.data[ia + 1] - b.data[ib + 1]) ** 2 +
        (a.data[ia + 2] - b.data[ib + 2]) ** 2 +
        (a.data[ia + 3] - b.data[ib + 3]) ** 2,
      ) / (255 * 2)
      if (d > tolerance) {
        changed++
        // Magenta, because it appears in almost no real screenshot and so is
        // never mistaken for content.
        mask.data[im] = 255
        mask.data[im + 1] = 0
        mask.data[im + 2] = 255
        mask.data[im + 3] = 255
      }
    }
  }

  const compared = width * height
  return {
    changed,
    compared,
    ratio: compared ? changed / compared : 0,
    width,
    height,
    mismatched: a.width !== b.width || a.height !== b.height,
    outsideA: a.width * a.height - compared,
    outsideB: b.width * b.height - compared,
    mask,
  }
}

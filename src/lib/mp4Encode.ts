// The three things every tool that RE-ENCODES video has to get right, in one
// place.
//
// `video-edit` had all of them inline, and a second tool needing the same three
// is exactly the moment this repo has recorded going wrong five times in the
// other direction — a copy, then a drift, then a harness or a tool reporting on
// a version nobody runs. None of these is long; what makes them worth sharing
// is that each one encodes a measured lesson, and a copy loses the comment
// along with the code.

import type { WriterSample } from './mp4Writer'

/**
 * The codec string to encode with.
 *
 * BASELINE, on purpose. A baseline stream has no B-frames, so a frame is never
 * presented before it is decoded — decode order and presentation order are the
 * same, and the sample table cannot acquire the composition offsets that are
 * the fiddliest thing in an MP4 to get right. The level comes from the frame
 * size because an encoder is entitled to refuse a stream that exceeds the level
 * it was asked for, and "export failed" is a poor way to learn that 1080p needs
 * level 4.
 */
export function codecFor(width: number, height: number): string {
  const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16)
  if (macroblocks <= 3600) return 'avc1.42001f'   // level 3.1 — up to 1280×720
  if (macroblocks <= 8192) return 'avc1.420028'   // level 4.0 — up to 1920×1080
  return 'avc1.420033'                            // level 5.1 — beyond that
}

/**
 * Wrap the encoder's raw AVCDecoderConfigurationRecord in its box.
 *
 * `VideoEncoder` hands back the record; `stsd` wants the `avcC` box around it.
 * `mp4Demux` slices whole boxes out of a source file for exactly the same
 * reason — one shape reaches the writer, whichever end it came from.
 */
export function avcCBox(record: Uint8Array): Uint8Array {
  const out = new Uint8Array(record.length + 8)
  new DataView(out.buffer).setUint32(0, record.length + 8)
  out.set([0x61, 0x76, 0x63, 0x43], 4) // 'avcC'
  out.set(record, 8)
  return out
}

/**
 * The smallest of a field across samples, WITHOUT a spread.
 *
 * `Math.min(...samples.map(…))` reads better and throws `RangeError: Maximum
 * call stack size exceeded` somewhere north of sixty thousand arguments — which
 * is a ten-minute clip at 30fps hitting a limit that a six-second fixture never
 * will. The bug would only ever appear on the long recordings these tools are
 * most useful for.
 */
export function smallest(samples: WriterSample[], pick: (s: WriterSample) => number): number {
  let out = Infinity
  for (const s of samples) { const v = pick(s); if (v < out) out = v }
  return Number.isFinite(out) ? out : 0
}

/**
 * H.264 stores colour at half resolution in each direction, so a frame with an
 * odd width or height has no whole chroma sample to put in the last row or
 * column. Encoders answer that by refusing the configuration outright — which
 * surfaces as "export failed" for the entirely fixable reason that a crop came
 * out 607 pixels wide.
 */
export function even(n: number): number {
  // Rounded BEFORE snapping. An aspect derived by division lands on 319.9999
  // for a frame that is plainly 320 wide, and flooring that gives 318 — a
  // two-pixel squeeze applied to a crop the reader asked not to be cropped.
  const r = Math.round(n)
  return Math.max(2, r - (r % 2))
}

// Writing a PROGRESSIVE MP4 — ftyp, one moov with a real sample table, one mdat.
//
// WHY THIS EXISTS. `video-trim` muxes with mp4box's `addSample`, which writes a
// moof+mdat pair PER SAMPLE: a *fragmented* MP4, 1604 fragments for a 22-second
// clip, about 2% overhead and **no sample table at all**. That plays, and the
// roadmap has recorded since the trimmer shipped that "a compressor is the point
// at which a progressive muxer stops being optional" — because a fragmented file
// with no index is a file you cannot seek in, and a video somebody is going to
// scrub, upload or open in another editor is exactly the case that needs one.
//
// It takes samples that are ALREADY ENCODED — from a `VideoEncoder`, or copied
// out of a source file — so it is the same writer either way and there is no
// second opinion about how a track is described.
//
// THE ONE HARD PART is that `stco` stores the absolute file offset of every
// chunk, and those offsets depend on how big `moov` is, which depends on `stco`.
// Every field here is fixed-width, so the size does not change when the values
// do: the table is built once with zeros to measure it, then again with the real
// numbers. Guessing the size instead is how a muxer ends up off by four bytes on
// files with an odd number of tracks.
//
// **Every sample is its own chunk.** That is the simplest correct `stsc` (one
// entry, one sample per chunk) and it costs 4 bytes per sample — 18KB on a
// ten-minute 30fps track, against a file measured in megabytes. It also makes
// the interleaving exact rather than approximate: samples are laid down in
// decode-time order across all tracks, so a player reading forward always has
// the audio it needs for the video it just read.
//
// Verified by re-parsing the output with **mp4box** — a separate implementation,
// not ours — and by playing it in a real browser. Two hand-written
// implementations agreeing would be weaker evidence than one being right.

export interface WriterSample {
  data: Uint8Array
  /** Decode time, in the track's own timescale. */
  dts: number
  /** Presentation time, in the track's own timescale. */
  cts: number
  duration: number
  sync: boolean
}

export interface WriterTrack {
  kind: 'video' | 'audio'
  /** The sample entry four-cc: 'avc1', 'hvc1', 'mp4a'. */
  entryType: string
  timescale: number
  /**
   * The codec configuration box, VERBATIM and complete with its own 8-byte
   * header — `avcC`, `hvcC` or `esds`.
   *
   * Verbatim matters: it is either sliced straight out of the source file or
   * handed over by `VideoEncoder` as `decoderConfig.description`, so nothing
   * here has to understand SPS/PPS or an ES descriptor. Reconstructing one from
   * a codec string and a sample rate is how a file comes out parsing perfectly
   * and playing in nothing.
   */
  config: Uint8Array
  width?: number
  height?: number
  sampleRate?: number
  channels?: number
  /** Three letters, ISO-639-2/T. Defaults to `und`, which is the honest answer. */
  language?: string
  /**
   * Degrees clockwise a player must turn this track to show it.
   *
   * Set it when the samples are COPIED from a source that carried a rotation —
   * a trim keeps the stored frames, so dropping the matrix turns a phone
   * recording on its side. Leave it out when the frames were re-encoded upright,
   * which is what the editor and the stabiliser do.
   */
  rotation?: 0 | 90 | 180 | 270
  samples: WriterSample[]
}

const MOVIE_TIMESCALE = 1000

function u8(...n: number[]): Uint8Array { return new Uint8Array(n) }

function u16(n: number): Uint8Array {
  return new Uint8Array([(n >> 8) & 0xff, n & 0xff])
}

function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff])
}

function u64(n: number): Uint8Array {
  const hi = Math.floor(n / 2 ** 32)
  return concat([u32(hi), u32(n >>> 0)])
}

function i32(n: number): Uint8Array {
  return u32(n < 0 ? n + 2 ** 32 : n)
}

function fourcc(s: string): Uint8Array {
  return new Uint8Array([s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)])
}

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0
  for (const p of parts) n += p.length
  const out = new Uint8Array(n)
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

function box(type: string, ...body: Uint8Array[]): Uint8Array {
  const payload = concat(body)
  return concat([u32(payload.length + 8), fourcc(type), payload])
}

/** A full box — the same thing with a version byte and three flag bytes. */
function fullBox(type: string, version: number, flags: number, ...body: Uint8Array[]): Uint8Array {
  return box(type, u8(version, (flags >> 16) & 0xff, (flags >> 8) & 0xff, flags & 0xff), ...body)
}

/** The unity transformation matrix every file carries whether it means it or not. */
const MATRIX = concat([
  u32(0x00010000), u32(0), u32(0),
  u32(0), u32(0x00010000), u32(0),
  u32(0), u32(0), u32(0x40000000),
])

/**
 * The display matrix for a quarter turn.
 *
 * The translation term is the load-bearing half: a rotation about the origin
 * puts the picture in a negative quadrant, and a player that honours the matrix
 * literally then shows nothing at all. Written in 16.16 fixed point, with the
 * bottom-right corner in 2.30 as the format requires.
 */
function matrixFor(rotation: 0 | 90 | 180 | 270, w: number, h: number): Uint8Array {
  if (rotation === 90) {
    return concat([u32(0), u32(0x00010000), u32(0), i32(-0x00010000), u32(0), u32(0),
      u32(h << 16), u32(0), u32(0x40000000)])
  }
  if (rotation === 180) {
    return concat([i32(-0x00010000), u32(0), u32(0), u32(0), i32(-0x00010000), u32(0),
      u32(w << 16), u32(h << 16), u32(0x40000000)])
  }
  if (rotation === 270) {
    return concat([u32(0), i32(-0x00010000), u32(0), u32(0x00010000), u32(0), u32(0),
      u32(0), u32(w << 16), u32(0x40000000)])
  }
  return MATRIX
}

/** Three lowercase letters packed five bits each, as `mdhd` wants them. */
function packLanguage(lang?: string): Uint8Array {
  const s = (lang && /^[a-z]{3}$/i.test(lang) ? lang.toLowerCase() : 'und')
  return u16(((s.charCodeAt(0) - 0x60) << 10) | ((s.charCodeAt(1) - 0x60) << 5) | (s.charCodeAt(2) - 0x60))
}

/** Runs of equal values, which is the shape `stts` and `stsc` are stored in. */
function runLengths(values: number[]): { count: number; value: number }[] {
  const out: { count: number; value: number }[] = []
  for (const v of values) {
    const last = out[out.length - 1]
    if (last && last.value === v) last.count++
    else out.push({ count: 1, value: v })
  }
  return out
}

function visualSampleEntry(t: WriterTrack): Uint8Array {
  const name = new Uint8Array(32) // compressorname: a length-prefixed pascal string, left empty
  return box(
    t.entryType,
    new Uint8Array(6), u16(1),               // reserved, data_reference_index
    u16(0), u16(0), new Uint8Array(12),      // pre_defined, reserved, pre_defined[3]
    u16(t.width ?? 0), u16(t.height ?? 0),
    u32(0x00480000), u32(0x00480000),        // 72 dpi horizontal and vertical
    u32(0), u16(1),                          // reserved, frame_count
    name,
    u16(0x0018), u16(0xffff),                // depth, pre_defined = -1
    t.config,
  )
}

function audioSampleEntry(t: WriterTrack): Uint8Array {
  return box(
    t.entryType,
    new Uint8Array(6), u16(1),               // reserved, data_reference_index
    u32(0), u32(0),                          // reserved
    u16(t.channels ?? 2), u16(16),           // channelcount, samplesize
    u16(0), u16(0),                          // pre_defined, reserved
    // The sample rate is 16.16 fixed point, so a rate above 65535 cannot be
    // expressed here. Every AAC rate fits; the real rate also lives in `mdhd`.
    u32(((t.sampleRate ?? 44100) & 0xffff) << 16),
    t.config,
  )
}

interface Placed {
  track: WriterTrack
  /** File offsets of this track's samples, in the order they appear in `mdat`. */
  offsets: number[]
  durationTicks: number
}

function sampleTable(t: WriterTrack, offsets: number[], wide: boolean): Uint8Array {
  const samples = t.samples
  const stts = runLengths(samples.map((s) => s.duration))
  const ctsOffsets = samples.map((s) => s.cts - s.dts)
  const anyOffset = ctsOffsets.some((o) => o !== 0)
  const negative = ctsOffsets.some((o) => o < 0)
  const syncs: number[] = []
  samples.forEach((s, i) => { if (s.sync) syncs.push(i + 1) })

  const parts: Uint8Array[] = [
    fullBox('stsd', 0, 0, u32(1), t.kind === 'video' ? visualSampleEntry(t) : audioSampleEntry(t)),
    fullBox('stts', 0, 0, u32(stts.length), ...stts.flatMap((r) => [u32(r.count), u32(r.value)])),
  ]

  // `stss` lists the samples a player may seek to. It is omitted when every
  // sample is a sync sample, which is what "all of them" means — writing it out
  // in full for an all-keyframe audio track is 4 bytes per sample of nothing.
  if (syncs.length && syncs.length !== samples.length) {
    parts.push(fullBox('stss', 0, 0, u32(syncs.length), ...syncs.map(u32)))
  }
  if (anyOffset) {
    // `ctts` is run-length encoded in (count, offset) PAIRS, exactly like
    // `stts` — not one offset per sample. Writing a bare offset per sample
    // produces a box whose declared entry count says twice the bytes that are
    // there, which every parser then reads straight off the end of.
    const runs = runLengths(ctsOffsets)
    // Version 0 offsets are unsigned, so a stream that presents a frame BEFORE
    // its decode time — which B-frames do — needs version 1's signed ones.
    parts.push(negative
      ? fullBox('ctts', 1, 0, u32(runs.length), ...runs.flatMap((r) => [u32(r.count), i32(r.value)]))
      : fullBox('ctts', 0, 0, u32(runs.length), ...runs.flatMap((r) => [u32(r.count), u32(r.value)])))
  }
  parts.push(
    // One sample per chunk: first_chunk 1, samples_per_chunk 1, description 1.
    fullBox('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)),
    fullBox('stsz', 0, 0, u32(0), u32(samples.length), ...samples.map((s) => u32(s.data.length))),
    wide
      ? fullBox('co64', 0, 0, u32(offsets.length), ...offsets.map(u64))
      : fullBox('stco', 0, 0, u32(offsets.length), ...offsets.map(u32)),
  )
  return box('stbl', ...parts)
}

function trak(p: Placed, id: number, wide: boolean): Uint8Array {
  const t = p.track
  const movieDuration = Math.round((p.durationTicks / t.timescale) * MOVIE_TIMESCALE)
  const isVideo = t.kind === 'video'

  const tkhd = fullBox('tkhd', 0, 0x000007, // enabled | in movie | in preview
    u32(0), u32(0), u32(id), u32(0), u32(movieDuration),
    u32(0), u32(0),
    u16(0), u16(0),                       // layer, alternate_group
    u16(isVideo ? 0 : 0x0100), u16(0),    // volume — zero for a picture
    isVideo ? matrixFor(t.rotation ?? 0, t.width ?? 0, t.height ?? 0) : MATRIX,
    u32((t.width ?? 0) << 16), u32((t.height ?? 0) << 16),
  )

  const mdhd = fullBox('mdhd', 0, 0,
    u32(0), u32(0), u32(t.timescale), u32(p.durationTicks), packLanguage(t.language), u16(0))

  const hdlr = fullBox('hdlr', 0, 0,
    u32(0), fourcc(isVideo ? 'vide' : 'soun'), u32(0), u32(0), u32(0),
    new TextEncoder().encode(isVideo ? 'VideoHandler\0' : 'SoundHandler\0'))

  const minf = box('minf',
    isVideo
      ? fullBox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0))
      : fullBox('smhd', 0, 0, u16(0), u16(0)),
    // A self-contained file still has to say so: one data reference, flagged
    // "the media is in this very file".
    box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))),
    sampleTable(t, p.offsets, wide),
  )

  return box('trak', tkhd, box('mdia', mdhd, hdlr, minf))
}

function buildMoov(placed: Placed[], wide: boolean): Uint8Array {
  const durations = placed.map((p) => Math.round((p.durationTicks / p.track.timescale) * MOVIE_TIMESCALE))
  const mvhd = fullBox('mvhd', 0, 0,
    u32(0), u32(0), u32(MOVIE_TIMESCALE), u32(Math.max(0, ...durations)),
    u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0),
    MATRIX,
    u32(0), u32(0), u32(0), u32(0), u32(0), u32(0),  // pre_defined
    u32(placed.length + 1),
  )
  return box('moov', mvhd, ...placed.map((p, i) => trak(p, i + 1, wide)))
}

/**
 * Lay the samples down in decode order across every track.
 *
 * Interleaving is not cosmetic: a player reading the file forward must reach a
 * track's samples at roughly the time it needs them, or it has to seek
 * backwards and forwards through the file for every second of playback. Sorting
 * by real TIME rather than by raw `dts` is what makes that true when two tracks
 * have different timescales — a video at 15360 and audio at 44100 do not
 * interleave at all if their tick counts are compared directly.
 */
function order(tracks: WriterTrack[]): { track: number; sample: number }[] {
  const cursor = tracks.map(() => 0)
  const out: { track: number; sample: number }[] = []
  const total = tracks.reduce((n, t) => n + t.samples.length, 0)
  for (let n = 0; n < total; n++) {
    let pick = -1
    let at = Infinity
    for (let i = 0; i < tracks.length; i++) {
      const s = tracks[i].samples[cursor[i]]
      if (!s) continue
      const t = s.dts / tracks[i].timescale
      if (t < at) { at = t; pick = i }
    }
    if (pick < 0) break
    out.push({ track: pick, sample: cursor[pick]++ })
  }
  return out
}

export function writeMp4(tracks: WriterTrack[]): Uint8Array {
  const usable = tracks.filter((t) => t.samples.length)
  if (!usable.length) throw new Error('no-samples')

  const ftyp = box('ftyp', fourcc('isom'), u32(0x200), fourcc('isom'), fourcc('iso2'), fourcc('avc1'), fourcc('mp41'))
  const layout = order(usable)
  const mediaSize = usable.reduce((n, t) => n + t.samples.reduce((m, s) => m + s.data.length, 0), 0)

  const placed: Placed[] = usable.map((t) => ({
    track: t,
    offsets: new Array<number>(t.samples.length).fill(0),
    // The track ends when its last sample ends, which is not the same as the
    // last sample's timestamp.
    durationTicks: t.samples.reduce((n, s) => Math.max(n, s.dts + s.duration), 0),
  }))

  // Pass one measures `moov` with the offsets still zero. Every field is
  // fixed-width, so the size it comes out at is the size it will be.
  const write = (wide: boolean) => {
    const probe = buildMoov(placed, wide)
    let at = ftyp.length + probe.length + 8 // + the mdat header
    for (const { track, sample } of layout) {
      placed[track].offsets[sample] = at
      at += usable[track].samples[sample].data.length
    }
    return buildMoov(placed, wide)
  }

  // 32-bit offsets are what every player reads best; `co64` is the fallback for
  // a file that genuinely cannot be addressed in four bytes.
  const rough = ftyp.length + buildMoov(placed, false).length + 8 + mediaSize
  const wide = rough > 0xffffffff
  const moov = write(wide)

  const mdatHeader = concat([u32(mediaSize + 8), fourcc('mdat')])
  const out = new Uint8Array(ftyp.length + moov.length + mdatHeader.length + mediaSize)
  out.set(ftyp, 0)
  out.set(moov, ftyp.length)
  out.set(mdatHeader, ftyp.length + moov.length)
  let at = ftyp.length + moov.length + mdatHeader.length
  for (const { track, sample } of layout) {
    out.set(usable[track].samples[sample].data, at)
    at += usable[track].samples[sample].data.length
  }
  return out
}

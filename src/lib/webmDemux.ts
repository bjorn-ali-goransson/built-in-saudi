// Reading a WebM or Matroska file into the same tracks and samples `mp4Demux`
// produces, so everything that decodes a video can take either.
//
// No dependency: Matroska is EBML, a binary tree of (id, size, payload) whose
// two variable-length integers are the whole format, and a reader that only
// needs the tracks and the blocks is a couple of hundred lines. mp4box costs a
// megabyte because ISO-BMFF is a hundred box types; this is six element kinds.
//
// THREE THINGS THE COMMONEST WEBM GETS "WRONG", all of them in what Chrome's
// own MediaRecorder writes — which is where most WebM files people have come
// from (screen recordings, browser call recordings):
//
// - **The Segment and every Cluster have UNKNOWN size** (all ones), because a
//   recorder streams and cannot go back to fill a length in. So a Segment or a
//   Cluster is never skipped by its size: the reader steps INTO both, and the
//   next Cluster id is simply the next thing it meets.
// - **There is no Duration**, for the same reason. It is computed from the
//   blocks, which is also why the page takes the length from here rather than
//   from the `<video>` element — Chrome reports `Infinity` for such a file.
// - **Block timestamps are presentation times, in decode order.** For VP8/VP9
//   and AV1 those are the same order; for H.264 with B-frames they are not, so
//   a decode time is reconstructed as the sorted presentation times assigned in
//   decode order — what a muxer would have written.
//
// The sound: Opus is copied into the MP4 as an `Opus` sample entry with a
// `dOps` box built from the OpusHead in CodecPrivate — lossless and needing no
// encoder, the same stance as copying AAC. Vorbis has no place in an MP4 at
// all, so a Vorbis track is NOT returned as a track; it is named in
// `uncopyableAudio` so the page can say why the export is silent rather than
// claiming there was never any sound.

import type { Demuxed, DemuxTrack } from './mp4Demux'
import type { WriterSample } from './mp4Writer'

const ID = {
  EBML: 0x1a45dfa3,
  DocType: 0x4282,
  Segment: 0x18538067,
  Info: 0x1549a966,
  TimestampScale: 0x2ad7b1,
  Duration: 0x4489,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackNumber: 0xd7,
  TrackType: 0x83,
  CodecID: 0x86,
  CodecPrivate: 0x63a2,
  DefaultDuration: 0x23e383,
  Language: 0x22b59c,
  Video: 0xe0,
  PixelWidth: 0xb0,
  PixelHeight: 0xba,
  Audio: 0xe1,
  SamplingFrequency: 0xb5,
  Channels: 0x9f,
  ContentEncodings: 0x6d80,
  ContentEncoding: 0x6240,
  ContentCompression: 0x5034,
  ContentCompAlgo: 0x4254,
  ContentCompSettings: 0x4255,
  ContentEncryption: 0x5035,
  Cluster: 0x1f43b675,
  Timestamp: 0xe7,
  SimpleBlock: 0xa3,
  BlockGroup: 0xa0,
  Block: 0xa1,
  BlockDuration: 0x9b,
  ReferenceBlock: 0xfb,
} as const

/** Masters the reader steps INTO rather than over, because their size may be unknown. */
const DESCEND = new Set<number>([ID.Segment, ID.Cluster])

/** Does this claim to be EBML at all — the first four bytes of every WebM and MKV. */
export function looksLikeWebm(data: ArrayBuffer): boolean {
  if (data.byteLength < 4) return false
  const b = new Uint8Array(data, 0, 4)
  return b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3
}

interface Vint { value: number; length: number; unknown: boolean }

/** An element ID: the length marker is KEPT, which is how ids are written in the spec. */
function readId(b: Uint8Array, at: number): Vint | null {
  const first = b[at]
  if (first === undefined || first === 0) return null
  const length = Math.clz32(first) - 23
  if (length > 4 || at + length > b.length) return null
  let value = 0
  for (let i = 0; i < length; i++) value = value * 256 + b[at + i]
  return { value, length, unknown: false }
}

/** A size: the marker is REMOVED, and all-ones means "unknown". */
function readSize(b: Uint8Array, at: number): Vint | null {
  const first = b[at]
  if (first === undefined || first === 0) return null
  const length = Math.clz32(first) - 23
  if (length > 8 || at + length > b.length) return null
  let value = first & (0xff >> length)
  let ones = value === 0xff >> length
  for (let i = 1; i < length; i++) {
    value = value * 256 + b[at + i]
    if (b[at + i] !== 0xff) ones = false
  }
  return { value, length, unknown: ones }
}

interface El { id: number; start: number; end: number; unknown: boolean }

/** The children of a known-size master, as (id, data range). */
function* children(b: Uint8Array, start: number, end: number): Generator<El> {
  let at = start
  while (at < end) {
    const id = readId(b, at)
    if (!id) return
    const size = readSize(b, at + id.length)
    if (!size) return
    const data = at + id.length + size.length
    const stop = size.unknown ? end : Math.min(end, data + size.value)
    yield { id: id.value, start: data, end: stop, unknown: size.unknown }
    at = stop
  }
}

function uint(b: Uint8Array, s: number, e: number): number {
  let v = 0
  for (let i = s; i < e; i++) v = v * 256 + b[i]
  return v
}
function float(b: Uint8Array, s: number, e: number): number {
  const view = new DataView(b.buffer, b.byteOffset + s, e - s)
  return e - s === 4 ? view.getFloat32(0) : e - s === 8 ? view.getFloat64(0) : 0
}
function text(b: Uint8Array, s: number, e: number): string {
  return new TextDecoder().decode(b.subarray(s, e)).replace(/\0+$/, '')
}

/** An MP4 box: 8-byte header and the bytes, which is the shape `config` carries. */
function box(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + body.length)
  new DataView(out.buffer).setUint32(0, out.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(body, 8)
  return out
}

interface TrackHead {
  number: number
  type: number
  codecId: string
  priv: Uint8Array | null
  defaultDuration: number
  language?: string
  width?: number
  height?: number
  rate?: number
  channels?: number
  /** Header-stripping compression: bytes removed from the front of every frame. */
  strip: Uint8Array | null
  /** Any other content encoding, which this reader refuses rather than guesses at. */
  refused: boolean
}

function readTrack(b: Uint8Array, s: number, e: number): TrackHead {
  const t: TrackHead = { number: 0, type: 0, codecId: '', priv: null, defaultDuration: 0, strip: null, refused: false }
  for (const c of children(b, s, e)) {
    switch (c.id) {
      case ID.TrackNumber: t.number = uint(b, c.start, c.end); break
      case ID.TrackType: t.type = uint(b, c.start, c.end); break
      case ID.CodecID: t.codecId = text(b, c.start, c.end); break
      case ID.CodecPrivate: t.priv = b.slice(c.start, c.end); break
      case ID.DefaultDuration: t.defaultDuration = uint(b, c.start, c.end); break
      case ID.Language: t.language = text(b, c.start, c.end); break
      case ID.Video:
        for (const v of children(b, c.start, c.end)) {
          if (v.id === ID.PixelWidth) t.width = uint(b, v.start, v.end)
          if (v.id === ID.PixelHeight) t.height = uint(b, v.start, v.end)
        }
        break
      case ID.Audio:
        for (const a of children(b, c.start, c.end)) {
          if (a.id === ID.SamplingFrequency) t.rate = float(b, a.start, a.end)
          if (a.id === ID.Channels) t.channels = uint(b, a.start, a.end)
        }
        break
      case ID.ContentEncodings:
        for (const enc of children(b, c.start, c.end)) {
          if (enc.id !== ID.ContentEncoding) continue
          for (const part of children(b, enc.start, enc.end)) {
            if (part.id === ID.ContentEncryption) t.refused = true
            if (part.id !== ID.ContentCompression) continue
            let algo = 0
            let settings: Uint8Array | null = null
            for (const k of children(b, part.start, part.end)) {
              if (k.id === ID.ContentCompAlgo) algo = uint(b, k.start, k.end)
              if (k.id === ID.ContentCompSettings) settings = b.slice(k.start, k.end)
            }
            // 3 is header stripping, which older mkvmerge used by default and
            // which is undone by putting the bytes back. zlib, bzlib and lzo
            // are refused: decoding garbage is worse than naming the file.
            if (algo === 3 && settings) t.strip = settings
            else t.refused = true
          }
        }
        break
    }
  }
  return t
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0')

/** The WebCodecs codec string for a Matroska video track, or null for a codec we do not map. */
function videoCodec(t: TrackHead, firstKey: Uint8Array | undefined): string | null {
  switch (t.codecId) {
    case 'V_VP8': return 'vp8'
    case 'V_VP9': {
      // The profile is in the first two bits after the frame marker of any
      // keyframe; 10-bit is assumed for profiles 2 and 3. The level is not
      // read by any decoder this matters to, so a generous one is named.
      const b0 = firstKey?.[0] ?? 0
      const profile = ((b0 >> 4) & 1) << 1 | ((b0 >> 5) & 1)
      return `vp09.0${profile}.41.${profile >= 2 ? '10' : '08'}`
    }
    case 'V_AV1': {
      const p = t.priv
      if (!p || p.length < 4) return 'av01.0.08M.08'
      const profile = p[1] >> 5
      const level = p[1] & 0x1f
      const tier = (p[2] >> 7) & 1
      const high = (p[2] >> 6) & 1
      const twelve = (p[2] >> 5) & 1
      const depth = high ? (twelve ? 12 : 10) : 8
      return `av01.${profile}.${String(level).padStart(2, '0')}${tier ? 'H' : 'M'}.${String(depth).padStart(2, '0')}`
    }
    case 'V_MPEG4/ISO/AVC': {
      const p = t.priv
      if (!p || p.length < 4) return null
      return `avc1.${hex2(p[1])}${hex2(p[2])}${hex2(p[3])}`
    }
    default: return null
  }
}

/** The configuration box a decoder (or the MP4 writer) needs, in the shape `mp4Demux` hands over. */
function videoConfig(t: TrackHead): Uint8Array {
  const body = t.priv ?? new Uint8Array(0)
  if (t.codecId === 'V_MPEG4/ISO/AVC') return box('avcC', body)
  if (t.codecId === 'V_AV1') return box('av1C', body)
  // VP8 and VP9 carry no configuration at all; the decoder reads it from the
  // keyframe. An empty box keeps `config.subarray(8)` meaning "the description".
  return box(t.codecId === 'V_VP8' ? 'vp08' : 'vpcC', new Uint8Array(0))
}

/**
 * The `dOps` box an MP4 needs for Opus, from the OpusHead a WebM stores.
 *
 * Same fields, different byte order: OpusHead is little-endian and `dOps` is
 * big-endian, and the version byte is 0 rather than OpusHead's 1. Getting the
 * order wrong gives a file that parses and plays at the wrong speed, or not at
 * all — the pre-skip and the input rate are both 16 and 32 bits wide.
 */
export function opusHeadToDops(head: Uint8Array): Uint8Array | null {
  if (head.length < 19 || text(head, 0, 8) !== 'OpusHead') return null
  const v = new DataView(head.buffer, head.byteOffset, head.byteLength)
  const channels = head[9]
  const family = head[18]
  const body: number[] = [0, channels]
  const preSkip = v.getUint16(10, true)
  const rate = v.getUint32(12, true)
  const gain = v.getInt16(16, true)
  body.push(preSkip >> 8, preSkip & 0xff)
  body.push((rate >>> 24) & 0xff, (rate >>> 16) & 0xff, (rate >>> 8) & 0xff, rate & 0xff)
  body.push((gain >> 8) & 0xff, gain & 0xff)
  body.push(family)
  if (family !== 0) {
    if (head.length < 21 + channels) return null
    for (let i = 19; i < 21 + channels; i++) body.push(head[i])
  }
  return box('dOps', new Uint8Array(body))
}

/**
 * How many 48kHz samples an Opus packet holds, from its TOC byte.
 *
 * Read off the packet rather than inferred from the gap to the next block,
 * because block timestamps are in milliseconds and a 2.5ms frame does not land
 * on one — the sample table would drift by the rounding on every packet.
 */
export function opusSamples(pkt: Uint8Array): number {
  if (!pkt.length) return 0
  const toc = pkt[0]
  const config = toc >> 3
  const frameMs = config < 12 ? [10, 20, 40, 60][config & 3]
    : config < 16 ? [10, 20][config & 1]
      : [2.5, 5, 10, 20][config & 3]
  const code = toc & 3
  const frames = code === 0 ? 1 : code < 3 ? 2 : (pkt[1] ?? 0) & 0x3f
  return Math.round(frameMs * 48) * frames
}

interface Frame { track: number; ts: number; data: Uint8Array; key: boolean; dur: number | null }

/** Split a (Simple)Block's payload into its frames, honouring the three lacing kinds. */
function readBlock(b: Uint8Array, s: number, e: number, clusterTs: number, simple: boolean, dur: number | null, out: Frame[]): void {
  const num = readSize(b, s)
  if (!num) return
  let at = s + num.length
  if (at + 3 > e) return
  const rel = new DataView(b.buffer, b.byteOffset + at, 2).getInt16(0)
  const flags = b[at + 2]
  at += 3
  const key = simple ? (flags & 0x80) !== 0 : false
  const lacing = (flags >> 1) & 3
  const ts = clusterTs + rel
  if (lacing === 0) {
    out.push({ track: num.value, ts, data: b.subarray(at, e), key, dur })
    return
  }
  const count = b[at] + 1
  at++
  const sizes: number[] = []
  if (lacing === 1) { // Xiph
    for (let i = 0; i < count - 1; i++) {
      let n = 0
      while (b[at] === 0xff) { n += 255; at++ }
      n += b[at++]
      sizes.push(n)
    }
  } else if (lacing === 3) { // EBML
    const first = readSize(b, at)
    if (!first) return
    at += first.length
    sizes.push(first.value)
    for (let i = 1; i < count - 1; i++) {
      const d = readSize(b, at)
      if (!d) return
      at += d.length
      // A signed difference: the vint's range is centred on zero.
      const bias = 2 ** (7 * d.length - 1) - 1
      sizes.push(sizes[i - 1] + d.value - bias)
    }
  } else { // fixed
    const each = Math.floor((e - at) / count)
    for (let i = 0; i < count - 1; i++) sizes.push(each)
  }
  const used = sizes.reduce((n, x) => n + x, 0)
  sizes.push(e - at - used)
  for (const n of sizes) {
    if (n < 0 || at + n > e) return
    // Laced frames share the block's timestamp; the caller spreads them by
    // their own durations, which only it knows (Opus reads its TOC).
    out.push({ track: num.value, ts, data: b.subarray(at, at + n), key, dur: null })
    at += n
  }
}

export async function demuxWebm(data: ArrayBuffer): Promise<Demuxed & { uncopyableAudio?: string }> {
  if (!looksLikeWebm(data)) throw new Error('not-mp4')
  const b = new Uint8Array(data)

  let docType = ''
  let scale = 1_000_000 // ns per timestamp unit: the default makes it milliseconds
  let durationUnits = 0
  const heads: TrackHead[] = []
  const frames: Frame[] = []
  let clusterTs = 0

  // A FLAT walk over the file: the two masters whose size may be unknown are
  // stepped into rather than over, and everything else is read or skipped by
  // its size. That is what makes a MediaRecorder file — Segment and Clusters
  // all of unknown size — read the same as one mkvmerge wrote.
  let at = 0
  while (at < b.length) {
    const id = readId(b, at)
    if (!id) break
    const size = readSize(b, at + id.length)
    if (!size) break
    const start = at + id.length + size.length
    const end = size.unknown ? b.length : Math.min(b.length, start + size.value)
    switch (id.value) {
      case ID.EBML:
        for (const c of children(b, start, end)) if (c.id === ID.DocType) docType = text(b, c.start, c.end)
        break
      case ID.Info:
        for (const c of children(b, start, end)) {
          if (c.id === ID.TimestampScale) scale = uint(b, c.start, c.end) || scale
          if (c.id === ID.Duration) durationUnits = float(b, c.start, c.end)
        }
        break
      case ID.Tracks:
        for (const c of children(b, start, end)) if (c.id === ID.TrackEntry) heads.push(readTrack(b, c.start, c.end))
        break
      case ID.Timestamp:
        clusterTs = uint(b, start, end)
        break
      case ID.SimpleBlock:
        readBlock(b, start, end, clusterTs, true, null, frames)
        break
      case ID.BlockGroup: {
        let blk: El | null = null
        let dur: number | null = null
        let referenced = false
        for (const c of children(b, start, end)) {
          if (c.id === ID.Block) blk = c
          if (c.id === ID.BlockDuration) dur = uint(b, c.start, c.end)
          if (c.id === ID.ReferenceBlock) referenced = true
        }
        if (blk) {
          const before = frames.length
          readBlock(b, blk.start, blk.end, clusterTs, false, dur, frames)
          // In a BlockGroup a keyframe is a block that references nothing.
          for (let i = before; i < frames.length; i++) frames[i].key = !referenced
        }
        break
      }
    }
    at = DESCEND.has(id.value) ? start : end
    if (id.value === ID.Cluster) clusterTs = 0
  }

  if (docType && docType !== 'webm' && docType !== 'matroska') throw new Error('not-mp4')
  if (!heads.length) throw new Error('no-tracks')

  const nsPerUnit = scale
  const toSec = (units: number) => (units * nsPerUnit) / 1e9
  const unitsPerSec = 1e9 / nsPerUnit
  const tracks: DemuxTrack[] = []
  let uncopyableAudio: string | undefined

  const video = heads.find((h) => h.type === 1)
  const audio = heads.find((h) => h.type === 2)
  if (video?.refused || audio?.refused) throw new Error('mkv-encoded')

  const framesOf = (h: TrackHead) => frames.filter((f) => f.track === h.number).map((f) => {
    if (!h.strip) return f
    const full = new Uint8Array(h.strip.length + f.data.length)
    full.set(h.strip)
    full.set(f.data, h.strip.length)
    return { ...f, data: full }
  })

  if (video) {
    const list = framesOf(video)
    const codec = videoCodec(video, list.find((f) => f.key)?.data)
    if (list.length && codec) {
      // Durations in PRESENTATION order — the gap to the next frame shown —
      // while the samples stay in DECODE order, which is the order a decoder
      // must be fed them in.
      const byPts = list.map((_, i) => i).sort((x, y) => list[x].ts - list[y].ts || x - y)
      const fallback = video.defaultDuration ? video.defaultDuration / nsPerUnit : 0
      const dur = new Array<number>(list.length)
      byPts.forEach((idx, k) => {
        const next = byPts[k + 1]
        dur[idx] = next !== undefined ? list[next].ts - list[idx].ts
          : list[idx].dur ?? (fallback || (k > 0 ? list[idx].ts - list[byPts[k - 1]].ts : unitsPerSec / 30))
      })
      // The sorted presentation times, taken in decode order, are the decode
      // times — shifted back by the reorder depth, because a decode time may
      // never be later than the presentation time it belongs to.
      const sortedPts = byPts.map((i) => list[i].ts)
      // A loop rather than a spread: an hour of video is a hundred thousand
      // frames, past what a spread into Math.max will take as arguments.
      let delay = 0
      list.forEach((f, i) => { delay = Math.max(delay, sortedPts[i] - f.ts) })
      const samples: WriterSample[] = list.map((f, i) => ({
        data: f.data,
        cts: f.ts,
        dts: sortedPts[i] - delay,
        duration: Math.max(1, Math.round(dur[i])),
        sync: f.key,
      }))
      tracks.push({
        id: video.number,
        kind: 'video',
        entryType: codec.slice(0, 4),
        codec,
        timescale: unitsPerSec,
        language: video.language,
        width: video.width,
        height: video.height,
        rotation: 0,
        config: videoConfig(video),
        samples,
      })
    }
  }

  if (audio) {
    const list = framesOf(audio)
    const dops = audio.codecId === 'A_OPUS' && audio.priv ? opusHeadToDops(audio.priv) : null
    if (list.length && dops) {
      // Re-timed into 48kHz ticks, the rate Opus always runs at. Laced frames
      // share a block timestamp, so each frame starts where the previous one
      // ended unless its block says otherwise.
      const samples: WriterSample[] = []
      let cursor = 0
      let lastBlockTs = NaN
      for (const f of list) {
        const n = opusSamples(f.data)
        const blockAt = Math.round(toSec(f.ts) * 48_000)
        // Block timestamps are whole milliseconds and a packet is not, so a
        // block that lands within a millisecond-and-a-bit of where the last
        // packet ended IS that place — taking its rounded time instead would
        // put a sliver of overlap or gap at every packet. A real gap (a
        // recorder that dropped audio) is far larger and is kept.
        const near = samples.length > 0 && Math.abs(blockAt - cursor) <= Math.max(96, Math.ceil(48_000 / unitsPerSec) * 2)
        const t = f.ts === lastBlockTs || near ? cursor : blockAt
        lastBlockTs = f.ts
        samples.push({ data: f.data, dts: t, cts: t, duration: Math.max(1, n), sync: true })
        cursor = t + n
      }
      tracks.push({
        id: audio.number,
        kind: 'audio',
        entryType: 'Opus',
        codec: 'opus',
        timescale: 48_000,
        language: audio.language,
        rotation: 0,
        sampleRate: 48_000,
        channels: audio.channels ?? audio.priv?.[9] ?? 2,
        config: dops,
        samples,
      })
    } else if (list.length) {
      uncopyableAudio = audio.codecId.replace(/^A_/, '').toLowerCase()
    }
  }

  const v = tracks.find((t) => t.kind === 'video')
  // Computed from the blocks when the file does not say — which a recording
  // never does — as the end of the last thing presented on any track.
  let end = 0
  let start = Infinity
  for (const t of tracks) for (const s of t.samples) {
    end = Math.max(end, (s.cts + s.duration) / t.timescale)
    start = Math.min(start, s.cts / t.timescale)
  }
  return {
    durationSec: durationUnits > 0 ? toSec(durationUnits) : Math.max(0, end - (Number.isFinite(start) ? start : 0)),
    tracks,
    keyframes: (v?.samples ?? []).filter((s) => s.sync).map((s) => s.cts / (v as DemuxTrack).timescale),
    hasVideo: !!v,
    hasAudio: tracks.some((t) => t.kind === 'audio'),
    uncopyableAudio,
  }
}

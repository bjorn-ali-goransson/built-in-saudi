// Trimming an MP4 by copying its samples, not by re-encoding it.
//
// This is the thing the roadmap called "worse than nothing" to fake: capturing a
// clip through MediaRecorder takes as long as the clip and silently re-encodes
// it to WebM. Here the compressed samples are copied across untouched — the
// output is bit-for-bit the same video and audio, just fewer samples, so a
// half-hour recording trims in seconds and loses nothing.
//
// The price is where a cut can land. A frame in the middle of a GOP is stored as
// a difference from earlier frames, so a copy that starts there opens on grey
// mush. The start therefore snaps BACK to the last keyframe — visible in the UI
// as ticks, so the constraint is something you can see and aim at rather than a
// surprise after the fact. The end needs no snapping: a decoder simply stops.
//
// Verified against real files before any of this reached the app: a 6s clip and
// a 60s 720p one, both decoding clean under ffmpeg and playing in Chromium with
// audio in sync.
//
// KNOWN LIMIT of the muxing step: mp4box v2's `addSample` writes a moof+mdat
// pair PER SAMPLE, so the output is a fragmented MP4 rather than a progressive
// one — 1604 fragments for a 22-second 720p clip, about 2% size overhead, and
// no sample-table index to seek by. It decodes cleanly in ffmpeg and plays in
// Chrome, which covers the common cases, but a hand-written progressive muxer
// would produce a friendlier file for other editors. Worth doing; not worth
// blocking the tool on.

export interface TrackInfo {
  id: number
  type: string
  codec: string
  width?: number
  height?: number
  language?: string
}

export interface Parsed {
  durationSec: number
  tracks: TrackInfo[]
  /** Presentation time of every video keyframe, in seconds. */
  keyframes: number[]
  hasVideo: boolean
  hasAudio: boolean
}

export interface TrimResult {
  bytes: Uint8Array
  /** Where the output actually starts — the snapped keyframe, in source seconds. */
  originSec: number
  endSec: number
}

// The bits of mp4box we touch, typed locally: its own types are sprawling and
// we only ever use this corner of them.
interface Box { type: string; boxes?: Box[] }
interface SampleEntry extends Box { channel_count?: number; samplesize?: number; samplerate?: number }
interface Sample {
  data: Uint8Array
  size: number
  duration: number
  cts: number
  dts: number
  timescale: number
  is_sync: boolean
  description: SampleEntry
}
interface MovieTrack {
  id: number
  type: string
  codec: string
  timescale: number
  language?: string
  nb_samples: number
  video?: { width: number; height: number }
  audio?: { sample_rate: number; channel_count: number; sample_size: number }
}
interface Movie { duration: number; timescale: number; tracks: MovieTrack[] }
interface Mp4File {
  onReady?: (info: Movie) => void
  onSamples?: (id: number, user: unknown, samples: Sample[]) => void
  onError?: (e: unknown) => void
  appendBuffer(b: ArrayBuffer): number
  flush(): void
  start(): void
  setExtractionOptions(id: number, user?: unknown, o?: { nbSamples?: number }): void
  init(o: Record<string, unknown>): unknown
  addTrack(o: Record<string, unknown>): number
  addSample(id: number, data: Uint8Array, o: Record<string, unknown>): unknown
  getBuffer(): { buffer: ArrayBuffer; position?: number }
}
interface Mp4Box {
  createFile(): Mp4File
  MP4BoxBuffer: { fromArrayBuffer(b: ArrayBuffer, fileStart: number): ArrayBuffer }
}

let lib: Promise<Mp4Box> | null = null
// ~1MB of parser, in its own chunk, fetched only when a video is actually
// picked — the catalogue page must not pay for it.
const mp4box = () => (lib ??= import('mp4box') as unknown as Promise<Mp4Box>)

/** Everything held between a parse and the trims that follow it. */
export interface Session {
  info: Movie
  samples: Map<number, Sample[]>
}

/**
 * Does this even claim to be an ISO-BMFF file?
 *
 * mp4box does not reject a file it cannot understand — it simply never calls
 * onReady, so a text file renamed .mp4 leaves the tool spinning for ever. The
 * box header at offset 4 is the cheap, honest check, and it covers the older
 * QuickTime layouts that lead with something other than `ftyp`.
 */
export function looksLikeMp4(data: ArrayBuffer): boolean {
  if (data.byteLength < 12) return false
  const head = new Uint8Array(data, 4, 4)
  const tag = String.fromCharCode(...head)
  return ['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide', 'pnot'].includes(tag)
}

export async function parseMp4(data: ArrayBuffer): Promise<{ session: Session; parsed: Parsed }> {
  if (!looksLikeMp4(data)) throw new Error('not-mp4')
  const { createFile, MP4BoxBuffer } = await mp4box()
  const file = createFile()
  const samples = new Map<number, Sample[]>()

  let ready = false
  const info = await new Promise<Movie>((resolve, reject) => {
    file.onError = (e) => reject(new Error(String(e)))
    file.onReady = (movie) => {
      ready = true
      for (const t of movie.tracks) {
        samples.set(t.id, [])
        // One extraction pass over everything; the samples are needed for the
        // keyframe list anyway, so there is nothing to gain by streaming twice.
        file.setExtractionOptions(t.id, null, { nbSamples: 1_000_000 })
      }
      file.start()
      file.flush()
      resolve(movie)
    }
    file.onSamples = (id, _user, list) => { samples.get(id)?.push(...list) }
    try {
      file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(data, 0))
      file.flush()
      // appendBuffer/flush run the whole parse synchronously, so if onReady has
      // not fired by now it never will — a truncated or malformed file would
      // otherwise leave this promise pending for the life of the page.
      if (!ready) reject(new Error('not-mp4'))
    } catch (e) { reject(e instanceof Error ? e : new Error(String(e))) }
  })

  if (!info.tracks?.length) throw new Error('no-tracks')

  const video = info.tracks.find((t) => t.type === 'video')
  const vs = video ? samples.get(video.id) ?? [] : []
  const keyframes = vs.filter((s) => s.is_sync).map((s) => s.cts / s.timescale)

  return {
    session: { info, samples },
    parsed: {
      durationSec: info.duration / info.timescale,
      tracks: info.tracks.map((t) => ({
        id: t.id, type: t.type, codec: t.codec, language: t.language,
        width: t.video?.width, height: t.video?.height,
      })),
      keyframes,
      hasVideo: !!video,
      hasAudio: info.tracks.some((t) => t.type === 'audio'),
    },
  }
}

/** The keyframe a cut at `sec` would actually start from. */
export function snapStart(keyframes: number[], sec: number): number {
  if (!keyframes.length) return sec
  let best = keyframes[0]
  for (const k of keyframes) {
    if (k <= sec + 1e-9) best = k
    else break
  }
  return best
}

export async function trimMp4(session: Session, startSec: number, endSec: number): Promise<TrimResult> {
  const { createFile } = await mp4box()
  const { info, samples } = session

  const video = info.tracks.find((t) => t.type === 'video')
  const vs = video ? samples.get(video.id) ?? [] : []
  // One origin for every track. Resetting each to its own first sample is the
  // obvious thing to write and it desynchronises the audio by however far the
  // video snapped back — ~0.95s on the first version of this.
  const origin = vs.length
    ? snapStart(vs.filter((s) => s.is_sync).map((s) => s.cts / s.timescale), startSec)
    : startSec

  const out = createFile()
  out.init({ brands: ['isom', 'iso2', 'avc1', 'mp41'], timescale: info.timescale })

  let wrote = 0
  for (const t of info.tracks) {
    const list = samples.get(t.id)
    if (!list?.length) continue
    const entry = list[0].description
    const isVideo = t.type === 'video'

    const kept = list.filter((s) => {
      const at = s.cts / s.timescale
      return at >= origin - 1e-9 && at <= endSec
    })
    if (!kept.length) continue

    const trackId = out.addTrack({
      // Without the source's own entry type this defaults to avc1 and an audio
      // track comes out claiming to be video.
      type: entry.type,
      timescale: t.timescale,
      language: t.language,
      hdlr: isVideo ? 'vide' : 'soun',
      name: isVideo ? 'VideoHandler' : 'SoundHandler',
      width: isVideo ? t.video?.width : undefined,
      height: isVideo ? t.video?.height : undefined,
      channel_count: isVideo ? undefined : entry.channel_count,
      samplesize: isVideo ? undefined : entry.samplesize,
      samplerate: isVideo ? undefined : entry.samplerate,
      // The codec configuration, copied verbatim — avcC/hvcC for video, esds for
      // AAC. Leave it out and the file parses fine and no decoder can play it.
      description_boxes: (entry.boxes ?? []).filter((b) => b.type !== 'sinf'),
    })
    if (!trackId) continue

    const offset = Math.round(origin * t.timescale)
    for (const s of kept) {
      out.addSample(trackId, s.data, {
        duration: s.duration,
        dts: s.dts - offset,
        cts: s.cts - offset,
        is_sync: s.is_sync,
      })
    }
    wrote += kept.length
  }

  if (!wrote) throw new Error('empty-selection')

  const ds = out.getBuffer()
  const bytes = new Uint8Array(ds.buffer, 0, ds.position ?? ds.buffer.byteLength)
  // Copy out of mp4box's buffer so the result can be transferred to the page
  // without dragging the whole parse along with it.
  return { bytes: new Uint8Array(bytes), originSec: origin, endSec }
}

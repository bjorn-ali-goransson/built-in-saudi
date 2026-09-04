// Reading an MP4 into tracks and samples, with mp4box.
//
// This was `video-trim/mp4.ts`, used by the one tool that trimmed. A second
// tool needs the same thing — and this repo has now recorded four separate
// occasions where a second loader was written instead of the first being
// shared, each time reporting a defect that did not exist. So the reader moved
// here before anything else was built on it.
//
// THE PART WORTH KNOWING is how a codec configuration comes out. A track's
// `avcC`/`esds` is the handful of bytes without which a file parses perfectly
// and plays in nothing, and it is NOT something to reconstruct from the codec
// string: mp4box reports each sample-entry child box's offset and length in the
// source, so the bytes are SLICED verbatim and never interpreted. That is the
// same discipline as copying compressed samples rather than re-encoding them —
// pass through what you do not need to understand.

import type { WriterSample, WriterTrack } from './mp4Writer'

/** The child of a sample entry that carries the decoder configuration. */
const CONFIG_BOXES = new Set(['avcC', 'hvcC', 'vpcC', 'av1C', 'esds'])

interface Box { type: string; start: number; size: number; boxes?: Box[] }
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
interface RawSample {
  data: Uint8Array
  duration: number
  cts: number
  dts: number
  timescale: number
  is_sync: boolean
}
interface Mp4File {
  onReady?: (info: Movie) => void
  onSamples?: (id: number, user: unknown, samples: RawSample[]) => void
  onError?: (e: unknown) => void
  appendBuffer(b: ArrayBuffer): number
  flush(): void
  start(): void
  setExtractionOptions(id: number, user?: unknown, o?: { nbSamples?: number }): void
  getTrackById(id: number): { mdia: { minf: { stbl: { stsd: { entries: Box[] } } } } } | undefined
}
interface Mp4Box {
  createFile(): Mp4File
  MP4BoxBuffer: { fromArrayBuffer(b: ArrayBuffer, fileStart: number): ArrayBuffer }
}

let lib: Promise<Mp4Box> | null = null
// ~1MB of parser, in its own chunk, fetched only when a video is actually
// picked — the catalogue page must not pay for it.
const mp4box = () => (lib ??= import('mp4box') as unknown as Promise<Mp4Box>)

export interface DemuxTrack extends WriterTrack {
  id: number
  /** The codec string as the file reports it, e.g. `avc1.64000d`. */
  codec: string
}

export interface Demuxed {
  durationSec: number
  tracks: DemuxTrack[]
  /** Presentation time of every video keyframe, in seconds. */
  keyframes: number[]
  hasVideo: boolean
  hasAudio: boolean
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

export async function demuxMp4(data: ArrayBuffer): Promise<Demuxed> {
  if (!looksLikeMp4(data)) throw new Error('not-mp4')
  const { createFile, MP4BoxBuffer } = await mp4box()
  const file = createFile()
  const samples = new Map<number, RawSample[]>()

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

  const tracks: DemuxTrack[] = []
  for (const t of info.tracks) {
    const list = samples.get(t.id)
    if (!list?.length) continue
    if (t.type !== 'video' && t.type !== 'audio') continue

    const entry = file.getTrackById(t.id)?.mdia.minf.stbl.stsd.entries?.[0]
    const configBox = entry?.boxes?.find((b) => CONFIG_BOXES.has(b.type))
    // A track whose configuration we cannot find is a track nothing downstream
    // can describe, so it is dropped rather than written out unplayable.
    if (!entry || !configBox) continue

    tracks.push({
      id: t.id,
      kind: t.type,
      entryType: entry.type,
      codec: t.codec,
      timescale: t.timescale,
      language: t.language,
      width: t.video?.width,
      height: t.video?.height,
      sampleRate: t.audio?.sample_rate,
      channels: t.audio?.channel_count,
      config: new Uint8Array(data.slice(configBox.start, configBox.start + configBox.size)),
      samples: list.map((s): WriterSample => ({
        data: s.data, dts: s.dts, cts: s.cts, duration: s.duration, sync: s.is_sync,
      })),
    })
  }

  const video = tracks.find((t) => t.kind === 'video')
  return {
    durationSec: info.duration / info.timescale,
    tracks,
    keyframes: (video?.samples ?? []).filter((s) => s.sync).map((s) => s.cts / (video as DemuxTrack).timescale),
    hasVideo: !!video,
    hasAudio: tracks.some((t) => t.kind === 'audio'),
  }
}

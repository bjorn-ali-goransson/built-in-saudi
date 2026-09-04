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
// THE READING AND THE WRITING BOTH MOVED TO `lib/`, and the fragmented-output
// limit recorded here for the life of this tool is gone with them. It used to
// mux through mp4box's `addSample`, which writes a moof+mdat pair PER SAMPLE —
// 1604 fragments for a 22-second clip and no seek index at all. `lib/mp4Writer`
// writes one real sample table, so the trimmed file is a progressive MP4 that
// other editors and uploaders can index. Nothing about the copying changed:
// `evals/mp4guard.mjs` asserts every sample comes back byte for byte.

import { demuxMp4, type Demuxed } from '../../lib/mp4Demux'
import { writeMp4 } from '../../lib/mp4Writer'

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

/** Everything held between a parse and the trims that follow it. */
export type Session = Demuxed

export async function parseMp4(data: ArrayBuffer): Promise<{ session: Session; parsed: Parsed }> {
  const session = await demuxMp4(data)
  return {
    session,
    parsed: {
      durationSec: session.durationSec,
      tracks: session.tracks.map((t) => ({
        id: t.id, type: t.kind, codec: t.codec, language: t.language,
        width: t.width, height: t.height,
      })),
      keyframes: session.keyframes,
      hasVideo: session.hasVideo,
      hasAudio: session.hasAudio,
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
  // One origin for every track. Resetting each to its own first sample is the
  // obvious thing to write and it desynchronises the audio by however far the
  // video snapped back — ~0.95s on the first version of this.
  const origin = session.keyframes.length ? snapStart(session.keyframes, startSec) : startSec

  const tracks = session.tracks.map((t) => {
    const offset = Math.round(origin * t.timescale)
    return {
      ...t,
      samples: t.samples
        .filter((s) => {
          const at = s.cts / t.timescale
          return at >= origin - 1e-9 && at <= endSec
        })
        .map((s) => ({ ...s, dts: s.dts - offset, cts: s.cts - offset })),
    }
  }).filter((t) => t.samples.length)

  if (!tracks.length) throw new Error('empty-selection')
  return { bytes: writeMp4(tracks), originSec: origin, endSec }
}

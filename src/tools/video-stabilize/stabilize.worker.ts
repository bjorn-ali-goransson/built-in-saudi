// Two passes over the same clip: measure, then redraw.
//
// It has to be two, and that is not an implementation detail. The correction
// for frame 0 depends on where the camera was heading over the SECOND that
// follows it, so nothing can be drawn until the whole path is known. A causal
// filter would need no second pass and would lag by exactly the window it
// smooths over, which on a wobble is the wobble.
//
// The first pass is cheap because it does not need the picture: each frame is
// drawn once into a ~320px grey buffer and thrown away. Only the per-frame
// transform is kept — three numbers a frame, so a ten-minute clip costs
// kilobytes rather than the gigabytes its decoded frames would.
//
// Everything about decoding, muxing and the audio is the arrangement
// `video-edit` established and `lib/mp4Encode.ts` now holds the shared half of:
// backpressure is not optional (a decoder asked for a thousand frames hands
// back a thousand 3MB images), and the SOUND IS COPIED, never re-encoded,
// because AAC encoding is simply absent in Chrome on Linux.

import { demuxMp4, type Demuxed, type DemuxTrack } from '../../lib/mp4Demux'
import { writeMp4, type WriterSample, type WriterTrack } from '../../lib/mp4Writer'
import { avcCBox, codecFor, smallest } from '../../lib/mp4Encode'
import {
  drawStabilised, estimateMotion, pyramid, scaleMotion, startTrack, trackNext,
  type Box, type Estimate, type Gray, type Motion, type TrackPoint, type Tracker,
} from './motion'

export interface ProbeInfo {
  durationSec: number
  width: number
  height: number
  fps: number
  frames: number
  decodable: boolean
  hasAudio: boolean
}

export interface RenderPlan {
  /** One per decoded frame, in presentation order, in SOURCE pixels. */
  corrections: Motion[]
  zoom: number
  out: { width: number; height: number }
  bitrate: number
  keepAudio: boolean
}

export type Req =
  | { id: number; kind: 'probe'; file: File }
  | { id: number; kind: 'analyse' }
  /** `box` is in fractions of the frame, and `steps` is what `analyse` returned
   *  — the camera motion is most of the prediction the tracker needs. */
  | { id: number; kind: 'track'; box: Box; steps: Estimate[] }
  | { id: number; kind: 'render'; plan: RenderPlan }
  | { id: number; kind: 'cancel' }
  | { id: number; kind: 'drop' }

export type Res =
  | { id: number; kind: 'done' }
  | { id: number; kind: 'probed'; info: ProbeInfo }
  | { id: number; kind: 'analysed'; steps: Estimate[] }
  | { id: number; kind: 'tracked'; points: TrackPoint[] }
  | { id: number; kind: 'progress'; done: number; total: number }
  | { id: number; kind: 'rendered'; blob: Blob; audio: 'copied' | 'dropped' | 'none' }
  | { id: number; kind: 'error'; message: string }

const TIMESCALE = 90_000
const KEY_EVERY = 2

/**
 * How wide the frames are looked at.
 *
 * A pixel here is (source width / 320) source pixels, so the sub-pixel refit is
 * what keeps the estimate usable on 1080p — a whole analysis pixel there is six
 * real ones, and a path quantised that coarsely is a wobble of its own. Bigger
 * would be more accurate and the cost is quadratic; `evals/shakeprobe.mjs`
 * measures what this actually recovers rather than leaving it to taste.
 */
const ANALYSIS_WIDTH = 320

let session: Demuxed | null = null
let cancelled = false

const idle = () => new Promise((r) => setTimeout(r, 4))

function videoTrack(s: Demuxed): DemuxTrack | undefined {
  return s.tracks.find((t) => t.kind === 'video')
}
function audioTrack(s: Demuxed): DemuxTrack | undefined {
  return s.tracks.find((t) => t.kind === 'audio')
}

function need(): { s: Demuxed; v: DemuxTrack } {
  if (!session) throw new Error('no-file')
  const v = videoTrack(session)
  if (!v) throw new Error('no-video')
  return { s: session, v }
}

async function probe(file: File): Promise<ProbeInfo> {
  const data = await file.arrayBuffer()
  session = await demuxMp4(data)
  const v = videoTrack(session)
  if (!v) throw new Error('no-video')

  // Asked rather than assumed: a clip this browser has no decoder for is a
  // nameable state, not an export that fails later for no stated reason.
  let decodable = false
  try {
    const s = await VideoDecoder.isConfigSupported({
      codec: v.codec,
      description: v.config.subarray(8),
      codedWidth: v.width,
      codedHeight: v.height,
    })
    decodable = !!s.supported
  } catch { decodable = false }

  return {
    durationSec: session.durationSec,
    width: v.width ?? 0,
    height: v.height ?? 0,
    fps: session.durationSec > 0 ? v.samples.length / session.durationSec : 30,
    frames: v.samples.length,
    decodable,
    hasAudio: session.hasAudio,
  }
}

/**
 * Decode every frame once, hand each one over as a grey pyramid, and forget it.
 *
 * ONE loop for both measuring passes, and that is the point rather than tidiness:
 * the camera estimate and the subject track need exactly the same decode,
 * backpressure, luma conversion and failure handling, and this repo has recorded
 * five separate times what a second copy of a thing costs. The frames are NOT
 * retained — only what the callback keeps — which is what makes either pass safe
 * on a phone where holding decoded frames is not.
 */
async function scanFrames(
  id: number,
  onFrame: (pyr: Gray[], index: number, prev: Gray[] | null) => void,
): Promise<{ width: number; height: number; back: number; count: number }> {
  cancelled = false
  const { v } = need()
  const sw = v.width ?? 0
  const sh = v.height ?? 0
  if (!sw || !sh) throw new Error('no-video')

  const aw = Math.max(64, Math.min(sw, ANALYSIS_WIDTH))
  const ah = Math.max(36, Math.round((aw * sh) / sw))
  const canvas = new OffscreenCanvas(aw, ah)
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!ctx) throw new Error('no-canvas')

  // Everything is measured in analysis pixels and reported in SOURCE pixels, so
  // nothing downstream has to remember which space it is in.
  const back = sw / aw

  let prev: Gray[] | null = null
  let failure: Error | null = null
  let done = 0

  const decoder = new VideoDecoder({
    output: (frame) => {
      try {
        if (cancelled) return
        ctx.drawImage(frame, 0, 0, aw, ah)
        const rgba = ctx.getImageData(0, 0, aw, ah).data
        const g = new Uint8Array(aw * ah)
        for (let i = 0, p = 0; i < g.length; i++, p += 4) {
          // Integer luma. Both passes compare a plane against another plane made
          // the same way, so the exact weights matter far less than being cheap.
          g[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8
        }
        const next = pyramid({ data: g, width: aw, height: ah }, 3)
        onFrame(next, done, prev)
        prev = next
        done++
      } catch (e) {
        // A throw here would otherwise be silent AND fatal: the decoder stops
        // draining, so the feed loop below waits for ever and the page sits on
        // "measuring" with nothing to report and nothing to retry.
        failure = e instanceof Error ? e : new Error(String(e))
      } finally { frame.close() }
    },
    error: (e) => { failure = e instanceof Error ? e : new Error(String(e)) },
  })

  decoder.configure({
    codec: v.codec,
    description: v.config.subarray(8),
    codedWidth: v.width,
    codedHeight: v.height,
  })

  const total = v.samples.length
  for (const smp of v.samples) {
    if (cancelled || failure) break
    decoder.decode(new EncodedVideoChunk({
      type: smp.sync ? 'key' : 'delta',
      timestamp: Math.round((smp.cts / v.timescale) * 1e6),
      duration: Math.round((smp.duration / v.timescale) * 1e6),
      data: smp.data,
    }))
    while (!cancelled && !failure && decoder.decodeQueueSize > 8) await idle()
    if (done % 15 === 0) postMessage({ id, kind: 'progress', done, total } satisfies Res)
  }
  await decoder.flush().catch(() => {})
  try { decoder.close() } catch { /* already closed by its own error */ }
  if (cancelled) throw new Error('cancelled')
  if (failure) throw failure
  return { width: aw, height: ah, back, count: done }
}

/** What moved between each pair of frames. */
async function analyse(id: number): Promise<Estimate[]> {
  const raw: Estimate[] = []
  const info = await scanFrames(id, (next, _i, prev) => {
    if (prev) raw.push(estimateMotion(prev, next))
  })
  if (!raw.length) throw new Error('no-frames')
  // Scaled to source pixels ONCE, here, where the factor is known — but the
  // tile COUNT is not a length and must survive it, because it is what says a
  // frame was measured at all rather than assumed still.
  return raw.map((e) => ({ ...scaleMotion(e, info.back), tiles: e.tiles }))
}

/**
 * Follow one subject across the whole clip.
 *
 * A SECOND decode rather than a second thing retained from the first, and that
 * is deliberate: the box cannot be drawn until somebody has SEEN the clip, so
 * the alternative is holding every frame's pyramid through the whole analysis
 * on the chance that a box arrives — which on a phone recording is the memory
 * this pass is arranged to avoid.
 */
async function track(id: number, box: Box, steps: Estimate[]): Promise<TrackPoint[]> {
  const points: TrackPoint[] = []
  let tracker: Tracker | null = null
  let refused = false
  let centre = { x: 0, y: 0 }

  const info = await scanFrames(id, (pyr, i) => {
    if (i === 0) {
      centre = { x: pyr[0].width / 2, y: pyr[0].height / 2 }
      // The box arrives in FRACTIONS of the frame, because the stage it was
      // drawn on is a different size from the plane it is matched in.
      tracker = startTrack(pyr, {
        x: box.x * pyr[0].width,
        y: box.y * pyr[0].height,
        w: box.w * pyr[0].width,
        h: box.h * pyr[0].height,
      })
      if (!tracker) { refused = true; return }
      points.push({
        x: (box.x + box.w / 2 - 0.5) * pyr[0].width,
        y: (box.y + box.h / 2 - 0.5) * pyr[0].height,
        score: 1,
      })
      return
    }
    if (!tracker) return
    // The camera step for this pair, back in ANALYSIS pixels — it is stored in
    // source pixels, and the tracker matches in the analysis plane.
    const hint = steps[i - 1]
      ? scaleMotion(steps[i - 1], pyr[0].width / (need().v.width ?? pyr[0].width))
      : { rot: 0, dx: 0, dy: 0 }
    points.push(trackNext(tracker, pyr, hint, centre))
  })

  if (refused) throw new Error('no-subject')
  if (!points.length) throw new Error('no-frames')
  // Reported in source pixels, like everything else that leaves this file.
  return points.map((p) => ({ x: p.x * info.back, y: p.y * info.back, score: p.score }))
}

async function render(id: number, plan: RenderPlan): Promise<{ blob: Blob; audio: 'copied' | 'dropped' | 'none' }> {
  cancelled = false
  const { s: sess, v } = need()
  const src = { width: v.width ?? plan.out.width, height: v.height ?? plan.out.height }

  const canvas = new OffscreenCanvas(plan.out.width, plan.out.height)
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('no-canvas')

  const chunks: { data: Uint8Array; ts: number; dur: number; key: boolean }[] = []
  let description: Uint8Array | null = null
  let failure: Error | null = null

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const desc = meta?.decoderConfig?.description
      if (desc && !description) {
        description = ArrayBuffer.isView(desc)
          ? new Uint8Array(desc.buffer as ArrayBuffer, desc.byteOffset, desc.byteLength).slice()
          : new Uint8Array(desc as ArrayBuffer).slice()
      }
      const data = new Uint8Array(chunk.byteLength)
      chunk.copyTo(data)
      chunks.push({ data, ts: chunk.timestamp, dur: chunk.duration ?? 0, key: chunk.type === 'key' })
    },
    error: (e) => { failure = e instanceof Error ? e : new Error(String(e)) },
  })

  const codec = codecFor(plan.out.width, plan.out.height)
  const support = await VideoEncoder.isConfigSupported({
    codec, width: plan.out.width, height: plan.out.height, bitrate: plan.bitrate, avc: { format: 'avc' },
  }).catch(() => ({ supported: false }))
  if (!support.supported) {
    try { encoder.close() } catch { /* nothing to close */ }
    throw new Error('no-encoder')
  }
  encoder.configure({
    codec,
    width: plan.out.width,
    height: plan.out.height,
    bitrate: plan.bitrate,
    avc: { format: 'avc' },
    latencyMode: 'quality',
  })

  const base = smallest(v.samples, (x) => x.cts) / v.timescale
  const total = v.samples.length
  let done = 0
  let lastKeyAt = -Infinity
  let lastTs = -1
  let index = 0

  const decoder = new VideoDecoder({
    output: (frame) => {
      try {
        if (cancelled) return
        const t = frame.timestamp / 1e6 - base
        // Indexed by ARRIVAL, which is presentation order and is the order the
        // analysis pass saw them in — the same decoder over the same samples.
        // Clamped rather than trusted: a stream that hands back one more frame
        // than it did last time should lose its correction, not throw.
        const c = plan.corrections[Math.min(index, plan.corrections.length - 1)]
        index++
        drawStabilised(ctx, frame, src, c, plan.zoom, plan.out)
        const ts = Math.max(lastTs + 1, Math.round(t * 1e6))
        lastTs = ts
        const key = t - lastKeyAt >= KEY_EVERY || done === 0
        if (key) lastKeyAt = t
        const out = new VideoFrame(canvas, { timestamp: ts, duration: frame.duration ?? undefined, alpha: 'discard' })
        encoder.encode(out, { keyFrame: key })
        out.close()
        done++
      } finally { frame.close() }
    },
    error: (e) => { failure = e instanceof Error ? e : new Error(String(e)) },
  })

  decoder.configure({
    codec: v.codec,
    description: v.config.subarray(8),
    codedWidth: v.width,
    codedHeight: v.height,
  })

  for (const s of v.samples) {
    if (cancelled || failure) break
    decoder.decode(new EncodedVideoChunk({
      type: s.sync ? 'key' : 'delta',
      timestamp: Math.round((s.cts / v.timescale) * 1e6),
      duration: Math.round((s.duration / v.timescale) * 1e6),
      data: s.data,
    }))
    while (!cancelled && !failure && (decoder.decodeQueueSize > 8 || encoder.encodeQueueSize > 8)) await idle()
    if (done % 30 === 0) postMessage({ id, kind: 'progress', done, total } satisfies Res)
  }
  await decoder.flush().catch(() => {})
  try { decoder.close() } catch { /* already closed by its own error */ }
  await encoder.flush().catch(() => {})
  try { encoder.close() } catch { /* already closed by its own error */ }
  if (cancelled) throw new Error('cancelled')
  if (failure) throw failure
  if (!chunks.length) throw new Error('no-frames')
  if (!description) throw new Error('no-config')

  const ticks = (micros: number) => Math.round((micros / 1e6) * TIMESCALE)
  const videoSamples: WriterSample[] = chunks.map((c, i) => {
    const dts = ticks(c.ts)
    const next = chunks[i + 1] ? ticks(chunks[i + 1].ts) : null
    const duration = next !== null
      ? Math.max(1, next - dts)
      : Math.max(1, c.dur ? ticks(c.dur) : (i > 0 ? dts - ticks(chunks[i - 1].ts) : TIMESCALE / 30))
    return { data: c.data, dts, cts: dts, duration, sync: c.key }
  })

  const tracks: WriterTrack[] = [{
    kind: 'video',
    entryType: 'avc1',
    timescale: TIMESCALE,
    config: avcCBox(description),
    width: plan.out.width,
    height: plan.out.height,
    samples: videoSamples,
  }]

  // ONE clip, so the sound needs no re-timing at all: the compressed frames go
  // across exactly as they came, which is why this cannot lose anything. That
  // is the whole difference from `video-edit`, where a JOIN puts the sound on
  // its own clock and every boundary has to be trimmed back onto the picture.
  let audio: 'copied' | 'dropped' | 'none' = 'none'
  const a = audioTrack(sess)
  if (a) {
    if (plan.keepAudio) {
      tracks.push({
        kind: 'audio',
        entryType: a.entryType,
        timescale: a.timescale,
        config: a.config,
        sampleRate: a.sampleRate,
        channels: a.channels,
        language: a.language,
        samples: a.samples,
      })
      audio = 'copied'
    } else {
      audio = 'dropped'
    }
  }

  const bytes = writeMp4(tracks)
  return { blob: new Blob([bytes as unknown as BlobPart], { type: 'video/mp4' }), audio }
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const req = e.data
  try {
    if (req.kind === 'cancel') { cancelled = true; postMessage({ id: req.id, kind: 'done' } satisfies Res); return }
    if (req.kind === 'drop') { session = null; postMessage({ id: req.id, kind: 'done' } satisfies Res); return }
    if (req.kind === 'probe') {
      postMessage({ id: req.id, kind: 'probed', info: await probe(req.file) } satisfies Res)
      return
    }
    if (req.kind === 'analyse') {
      postMessage({ id: req.id, kind: 'analysed', steps: await analyse(req.id) } satisfies Res)
      return
    }
    if (req.kind === 'track') {
      postMessage({ id: req.id, kind: 'tracked', points: await track(req.id, req.box, req.steps) } satisfies Res)
      return
    }
    if (req.kind === 'render') {
      const { blob, audio } = await render(req.id, req.plan)
      postMessage({ id: req.id, kind: 'rendered', blob, audio } satisfies Res)
      return
    }
  } catch (err) {
    postMessage({ id: req.id, kind: 'error', message: err instanceof Error ? err.message : String(err) } satisfies Res)
  }
}

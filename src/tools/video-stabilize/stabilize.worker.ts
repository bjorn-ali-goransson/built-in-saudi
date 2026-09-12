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

import { demuxMp4, displaySize, type Demuxed, type DemuxTrack } from '../../lib/mp4Demux'
import { writeMp4, type WriterSample, type WriterTrack } from '../../lib/mp4Writer'
import { avcCBox, codecFor, smallest, uprightFrame } from '../../lib/mp4Encode'
import { drawStabilised, type Box, type Estimate, type Motion, type TrackPoint } from '../../lib/motion'
import { estimateSteps, followBox, type ScanOptions } from '../../lib/frameScan'

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

  // THE SIZE THE PICTURE IS, not the size it is stored at. A clip a phone
  // recorded upright is landscape with a 90° matrix beside it, and the preview
  // draws a `<video>` element, which has already turned it — so reporting the
  // coded size here is what stretched the stage into the wrong shape.
  const shown = displaySize({ width: v.width ?? 0, height: v.height ?? 0 }, v.rotation)
  return {
    durationSec: session.durationSec,
    width: shown.width,
    height: shown.height,
    fps: session.durationSec > 0 ? v.samples.length / session.durationSec : 30,
    frames: v.samples.length,
    decodable,
    hasAudio: session.hasAudio,
  }
}

/**
 * The two measuring passes, over ONE shared decode loop.
 *
 * `scanGrayFrames`, the camera estimate and the subject track all live in
 * `lib/frameScan.ts` now, because `video-edit` needs exactly the same three
 * things to make a censor box follow a face. Everything that was here is there,
 * unchanged; what stays is the session this worker holds and the progress it
 * reports, since those are the worker's own business rather than the scan's.
 */
function scanOpts(id: number): ScanOptions {
  return {
    cancelled: () => cancelled,
    onProgress: (done, total) => postMessage({ id, kind: 'progress', done, total } satisfies Res),
  }
}

async function analyse(id: number): Promise<Estimate[]> {
  cancelled = false
  return (await estimateSteps(need().v, scanOpts(id))).steps
}

async function track(id: number, box: Box, steps: Estimate[]): Promise<TrackPoint[]> {
  cancelled = false
  return (await followBox(need().v, box, steps, scanOpts(id))).points
}

async function render(id: number, plan: RenderPlan): Promise<{ blob: Blob; audio: 'copied' | 'dropped' | 'none' }> {
  cancelled = false
  const { s: sess, v } = need()
  const coded = { width: v.width ?? plan.out.width, height: v.height ?? plan.out.height }
  const src = displaySize(coded, v.rotation)
  // A rotated recording is turned ONCE, here, into a buffer the shape of the
  // picture — so `drawStabilised` goes on receiving the frame the preview
  // showed rather than the frame the file stores.
  const upright = v.rotation === 0 ? null : new OffscreenCanvas(src.width, src.height)

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
        drawStabilised(ctx, upright ? uprightFrame(frame, v.rotation, upright) : frame, src, c, plan.zoom, plan.out)
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

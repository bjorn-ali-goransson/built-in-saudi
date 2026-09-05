// Decode → draw → encode → mux, off the main thread (#154).
//
// Everything else in the video family deliberately avoids re-encoding:
// `video-trim` copies compressed samples, `video-frames` grabs one picture.
// Cropping, joining and captioning cannot: all three change what is IN the
// picture, so the frames have to be decoded, redrawn and encoded again. That is
// the line this tool crosses and the reason it is the only one here that costs
// real CPU.
//
// WHY THE AUDIO IS COPIED AND NOT RE-ENCODED. Measured, not assumed: AAC
// *encoding* is unavailable in **Chrome on Linux** — `AudioEncoder`
// `isConfigSupported({codec:'mp4a.40.2'})` answers false on a browser whose
// video encoder works perfectly — because Chrome leans on a platform encoder
// that is not there. A tool that re-encoded sound would therefore lose it for a
// whole platform. Copying the compressed AAC frames across costs nothing, is
// lossless, and works wherever the file could be read at all. The price is that
// clips whose sound is stored differently cannot simply be concatenated, which
// the tool checks for and says out loud BEFORE the export rather than after.
//
// Backpressure is not optional here. A decoder asked for a thousand frames at
// once hands back a thousand full uncompressed images — a 1080p frame is 3MB,
// so an unthrottled loop is several gigabytes. Each frame is drawn, encoded and
// closed inside the output callback, and the feed loop waits whenever either
// queue runs ahead.

import { demuxMp4, type Demuxed, type DemuxTrack } from '../../lib/mp4Demux'
import { writeMp4, type WriterSample, type WriterTrack } from '../../lib/mp4Writer'
import { avcCBox, codecFor, smallest } from '../../lib/mp4Encode'
import { activeAt, applyCensors, captionRect, drawFrame, type Censor, type Crop } from './compose'

export interface AudioInfo {
  codec: string
  sampleRate: number
  channels: number
  /**
   * Everything that has to match for two clips' sound to be joined without
   * re-encoding: the codec configuration bytes, the rate and the channel count.
   */
  fingerprint: string
}

export interface ProbeInfo {
  durationSec: number
  width: number
  height: number
  videoCodec: string
  /** Frames per second, measured from the sample table rather than assumed. */
  fps: number
  /** False when this browser has no decoder for the clip — a fixable, nameable state. */
  decodable: boolean
  /**
   * How many samples the session is holding, and how many bytes of payload.
   *
   * Reported because the one untested explanation for the intermittent Android
   * preview failure is memory: probing keeps every demuxed sample per clip, for
   * as long as the clip is in the list. This is that quantity, measured rather
   * than estimated, so a field report can settle it.
   */
  sampleCount: number
  retainedBytes: number
  audio: AudioInfo | null
}

/**
 * A caption as the worker sees it: already DRAWN, on the page, with the page's
 * own fonts.
 *
 * That is the decision that makes the preview trustworthy and Arabic correct at
 * the same time. The bitmap composited into every frame is the very one the
 * preview shows, so there is no second text renderer to drift — and the
 * shaping, the joining of the letters and the right-to-left run order are done
 * by the browser's own text engine rather than by anything here. A worker would
 * otherwise be drawing with whatever fonts the worker happens to have, which on
 * a machine with no Arabic face is a row of empty boxes.
 */
export interface PlanCaption {
  /** The box, in fractions of the output frame — the rectangle that was drawn. */
  x: number
  y: number
  w: number
  h: number
  from: number
  to: number
  bitmap: ImageBitmap
}

export interface RenderPlan {
  slots: number[]
  crop: Crop
  out: { width: number; height: number }
  bitrate: number
  keepAudio: boolean
  captions: PlanCaption[]
  censors: Censor[]
}

export type Req =
  | { id: number; kind: 'probe'; slot: number; file: File }
  | { id: number; kind: 'drop'; slot: number }
  | { id: number; kind: 'render'; plan: RenderPlan }
  | { id: number; kind: 'cancel' }

export type Res =
  | { id: number; kind: 'done' }
  | { id: number; kind: 'probed'; info: ProbeInfo }
  | { id: number; kind: 'progress'; done: number; total: number }
  | { id: number; kind: 'rendered'; blob: Blob; audio: 'copied' | 'dropped' | 'none' }
  | { id: number; kind: 'error'; message: string }

/** The muxed video track's ticks per second. 90000 is the usual choice and
 *  divides every common frame rate without drift. */
const TIMESCALE = 90_000
/** A keyframe at least this often, so the result can be scrubbed and cut again. */
const KEY_EVERY = 2

const sessions = new Map<number, Demuxed>()
let cancelled = false

function videoTrack(s: Demuxed): DemuxTrack | undefined {
  return s.tracks.find((t) => t.kind === 'video')
}
function audioTrack(s: Demuxed): DemuxTrack | undefined {
  return s.tracks.find((t) => t.kind === 'audio')
}

function fingerprint(t: DemuxTrack): string {
  return `${t.entryType}/${t.sampleRate}/${t.channels}/${Array.from(t.config).join(',')}`
}

const idle = () => new Promise((r) => setTimeout(r, 4))

async function probe(slot: number, file: File): Promise<ProbeInfo> {
  const data = await file.arrayBuffer()
  const session = await demuxMp4(data)
  const v = videoTrack(session)
  if (!v) throw new Error('no-video')
  sessions.set(slot, session)

  // Asking the browser rather than assuming: a clip this browser cannot decode
  // is a fact worth naming next to the clip, not a failure at export time.
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

  const a = audioTrack(session)
  return {
    durationSec: session.durationSec,
    width: v.width ?? 0,
    height: v.height ?? 0,
    videoCodec: v.codec,
    fps: session.durationSec > 0 ? v.samples.length / session.durationSec : 30,
    decodable,
    sampleCount: session.tracks.reduce((n, t) => n + t.samples.length, 0),
    retainedBytes: session.tracks.reduce((n, t) => n + t.samples.reduce((m, x) => m + x.data.length, 0), 0),
    audio: a ? { codec: a.codec, sampleRate: a.sampleRate ?? 0, channels: a.channels ?? 0, fingerprint: fingerprint(a) } : null,
  }
}

function drawCaptions(
  ctx: OffscreenCanvasRenderingContext2D,
  captions: PlanCaption[],
  t: number,
  out: { width: number; height: number },
): void {
  for (const c of activeAt(captions, t)) {
    const r = captionRect(c, out)
    // Drawn INTO the rectangle rather than at its corner: the bitmap is
    // rendered at the box's size on the page, but a rounding difference of a
    // pixel between the two would otherwise shift the caption.
    ctx.drawImage(c.bitmap, r.x, r.y, r.w, r.h)
  }
}

async function render(id: number, plan: RenderPlan): Promise<{ blob: Blob; audio: 'copied' | 'dropped' | 'none' }> {
  cancelled = false
  const clips = plan.slots.map((slot) => {
    const s = sessions.get(slot)
    if (!s) throw new Error('no-file')
    const v = videoTrack(s)
    if (!v) throw new Error('no-video')
    return { session: s, video: v, audio: audioTrack(s) }
  })
  if (!clips.length) throw new Error('no-file')

  const canvas = new OffscreenCanvas(plan.out.width, plan.out.height)
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('no-canvas')

  const chunks: { data: Uint8Array; ts: number; dur: number; key: boolean }[] = []
  let description: Uint8Array | null = null
  let failure: Error | null = null

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const desc = meta?.decoderConfig?.description
      // The avcC record arrives once, with the first chunk. Without it the file
      // parses and no decoder can play it — the same bytes `mp4Demux` slices
      // out of a source file.
      if (desc && !description) {
        // `description` is typed as a buffer OR a view over one; copying rather
        // than aliasing also detaches it from whatever the encoder does next.
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
    // `avc` rather than `annexb`: the muxer wants length-prefixed NAL units and
    // an avcC record, which is what an MP4 stores.
    avc: { format: 'avc' },
    latencyMode: 'quality',
  })

  const total = clips.reduce((n, c) => n + c.video.samples.length, 0)
  let done = 0
  let offsetSec = 0
  let lastKeyAt = -Infinity
  let lastTs = -1

  for (const clip of clips) {
    const v = clip.video
    const base = smallest(v.samples, (s) => s.cts) / v.timescale
    const source = { width: v.width ?? plan.out.width, height: v.height ?? plan.out.height }
    let first = true

    const decoder = new VideoDecoder({
      output: (frame) => {
        try {
          if (cancelled) return
          const tOut = offsetSec + frame.timestamp / 1e6 - base
          drawFrame(ctx, frame, source, plan.crop, plan.out)
          // Censors go on the PICTURE, before the captions — a caption is
          // something you chose to show, and hiding it under a black box that
          // was aimed at a face behind it would be the wrong way round.
          applyCensors(ctx, plan.censors, tOut, plan.out)
          drawCaptions(ctx, plan.captions, tOut, plan.out)
          // Monotonic by construction. A decoder is entitled to hand back two
          // frames a microsecond apart after rounding, and an encoder given a
          // timestamp that does not advance produces a sample table with a
          // zero-length frame in it.
          const ts = Math.max(lastTs + 1, Math.round(tOut * 1e6))
          lastTs = ts
          // A keyframe at every clip boundary as well as on the clock: a join
          // IS a cut, and a cut that is not a keyframe is where the next
          // person's trim lands on grey mush.
          const key = first || tOut - lastKeyAt >= KEY_EVERY
          if (key) { lastKeyAt = tOut; first = false }
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
      if (cancelled) break
      if (failure) break
      decoder.decode(new EncodedVideoChunk({
        type: s.sync ? 'key' : 'delta',
        // The PRESENTATION time, fed in DECODE order — which is the order the
        // sample table gives them in. The decoder reorders and hands frames
        // back in presentation order.
        timestamp: Math.round((s.cts / v.timescale) * 1e6),
        duration: Math.round((s.duration / v.timescale) * 1e6),
        data: s.data,
      }))
      while (!cancelled && (decoder.decodeQueueSize > 8 || encoder.encodeQueueSize > 8)) await idle()
      if (done % 30 === 0) postMessage({ id, kind: 'progress', done, total } satisfies Res)
    }
    await decoder.flush().catch(() => {})
    // A decoder that has already errored is in a closed state, and closing it
    // again throws — which would replace the real failure with a misleading one.
    try { decoder.close() } catch { /* already closed by its own error */ }
    offsetSec += clip.session.durationSec
    if (cancelled || failure) break
  }

  await encoder.flush().catch(() => {})
  try { encoder.close() } catch { /* already closed by its own error */ }
  if (cancelled) throw new Error('cancelled')
  if (failure) throw failure
  if (!chunks.length) throw new Error('no-frames')
  if (!description) throw new Error('no-config')

  // Chunks arrive in decode order, which for a baseline stream is presentation
  // order — so a sample's duration is simply the gap to the next one. The last
  // frame has no next, so it borrows the one before it rather than being given
  // a zero length that makes players report a video one frame short.
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

  // The audio is copied verbatim, which is only possible when every clip stores
  // it the same way. `plan.keepAudio` is the answer to a question the page
  // already asked, so nothing is decided silently here.
  let audio: 'copied' | 'dropped' | 'none' = 'none'
  const audios = clips.map((c) => c.audio)
  if (audios.every((a) => a)) {
    const prints = new Set(audios.map((a) => fingerprint(a as DemuxTrack)))
    if (prints.size === 1 && plan.keepAudio) {
      const first = audios[0] as DemuxTrack
      const samples: WriterSample[] = []
      let at = 0
      let wrote = 0
      clips.forEach((clip, i) => {
        const a = audios[i] as DemuxTrack
        const from = smallest(a.samples, (s) => s.dts)
        const offset = Math.round(at * a.timescale) - from
        const last = i === clips.length - 1
        // A TRACK'S TIMELINE IS THE SUM OF ITS SAMPLE DURATIONS, not the `dts`
        // values — `stts` stores durations and a player adds them up, so
        // offsets written into the samples decide nothing for the sound. Audio
        // laid end to end therefore runs on its own clock: an AAC frame is 1024
        // samples and does not divide a clip's length, so the fixture's sound
        // covers 6.037s against a 6.000s clip and EVERY JOIN pushes it 37ms
        // further ahead of the picture. One join is imperceptible; five is a
        // fifth of a second and plainly out.
        //
        // At a join, the sound that runs past the cut is dropped and the last
        // surviving frame is stretched to land exactly on it. The FINAL clip is
        // left alone: there is nothing after it to drift against, and trimming
        // it would break the promise that the sound is copied untouched.
        const limit = Math.round((at + clip.session.durationSec) * a.timescale)
        for (const s of a.samples) {
          if (!last && s.dts + offset >= limit && samples.length) break
          samples.push({ ...s, dts: s.dts + offset, cts: s.cts + offset })
          wrote += s.duration
        }
        at += clip.session.durationSec
        if (!last) {
          const tail = samples[samples.length - 1]
          const target = Math.round(at * a.timescale)
          if (tail) { tail.duration = Math.max(1, tail.duration + (target - wrote)); wrote = target }
        }
      })
      tracks.push({
        kind: 'audio',
        entryType: first.entryType,
        timescale: first.timescale,
        config: first.config,
        sampleRate: first.sampleRate,
        channels: first.channels,
        language: first.language,
        samples,
      })
      audio = 'copied'
    } else {
      // Either the clips disagree about how the sound is stored, or the page
      // asked for it to be left out. Both end the same way and the page has
      // already said which it is.
      audio = 'dropped'
    }
  } else if (audios.some((a) => a)) {
    audio = 'dropped'
  }

  const bytes = writeMp4(tracks)
  return { blob: new Blob([bytes as unknown as BlobPart], { type: 'video/mp4' }), audio }
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const req = e.data
  try {
    // Both are acknowledged rather than silently absorbed: the page holds a
    // resolver per request, and one that is never called is a leak that grows
    // with every clip removed.
    if (req.kind === 'cancel') { cancelled = true; postMessage({ id: req.id, kind: 'done' } satisfies Res); return }
    if (req.kind === 'drop') { sessions.delete(req.slot); postMessage({ id: req.id, kind: 'done' } satisfies Res); return }
    if (req.kind === 'probe') {
      const info = await probe(req.slot, req.file)
      postMessage({ id: req.id, kind: 'probed', info } satisfies Res)
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

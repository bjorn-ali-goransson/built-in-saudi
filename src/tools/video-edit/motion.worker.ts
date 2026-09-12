// Measuring where things MOVE in a clip — a second worker, on purpose.
//
// `render.worker.ts` holds a demuxed session per clip and one global cancel
// flag, and an export is the longest, heaviest thing this tool does. Putting
// the motion passes in there would have meant one of two bad things: an
// analysis queued behind an export (so "follow this face" waits for a job that
// has nothing to do with it), or the two running interleaved on one thread and
// sharing that flag. Neither is a preview that stays responsive.
//
// So this is its own thread, and the editor goes on being an editor while it
// runs — crop, draw boxes, type captions, scrub, export. The only thing that
// waits for it is the one thing that genuinely cannot be done without it.
//
// IT DOES NOT RETAIN THE DEMUX. `render.worker.ts` keeps every sample per clip
// for as long as the clip is open, which is already the untested hypothesis
// behind the intermittent Android preview failure recorded in CLAUDE.md; a
// second permanent copy of a phone recording is the last thing this tool
// should be holding. Each job demuxes, measures and lets go, so the cost is
// transient rather than doubled. The price is one extra parse per job, which is
// a fraction of a pass that decodes every frame anyway.

import { demuxMp4, type DemuxTrack } from '../../lib/mp4Demux'
import { estimateSteps, followBox } from '../../lib/frameScan'
import type { Box, Estimate, TrackPoint } from '../../lib/motion'

export type Req =
  | { id: number; kind: 'analyse'; slot: number; file: File }
  /** `steps` is what `analyse` returned — the camera motion is most of the
   *  prediction the tracker needs, and it is already paid for. */
  | { id: number; kind: 'track'; slot: number; file: File; box: Box; steps: Estimate[] }
  | { id: number; kind: 'cancel' }

export type Res =
  | { id: number; kind: 'done' }
  | { id: number; kind: 'analysed'; slot: number; steps: Estimate[]; times: number[] }
  | { id: number; kind: 'tracked'; slot: number; points: TrackPoint[]; times: number[] }
  | { id: number; kind: 'progress'; done: number; total: number }
  | { id: number; kind: 'error'; message: string }

let cancelled = false

async function videoOf(file: File): Promise<DemuxTrack> {
  const session = await demuxMp4(await file.arrayBuffer())
  const v = session.tracks.find((t) => t.kind === 'video')
  if (!v) throw new Error('no-video')
  return v
}

function opts(id: number) {
  return {
    cancelled: () => cancelled,
    onProgress: (done: number, total: number) =>
      postMessage({ id, kind: 'progress', done, total } satisfies Res),
  }
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const req = e.data
  try {
    if (req.kind === 'cancel') {
      cancelled = true
      postMessage({ id: req.id, kind: 'done' } satisfies Res)
      return
    }
    // Cleared per job rather than never: a cancelled job leaves the flag set,
    // and the next one would abort on its first frame having decoded nothing —
    // which reads exactly like a clip that cannot be measured.
    cancelled = false
    if (req.kind === 'analyse') {
      const { steps, times } = await estimateSteps(await videoOf(req.file), opts(req.id))
      postMessage({ id: req.id, kind: 'analysed', slot: req.slot, steps, times } satisfies Res)
      return
    }
    if (req.kind === 'track') {
      const { points, times } = await followBox(await videoOf(req.file), req.box, req.steps, opts(req.id))
      postMessage({ id: req.id, kind: 'tracked', slot: req.slot, points, times } satisfies Res)
    }
  } catch (err) {
    postMessage({
      id: req.id,
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    } satisfies Res)
  }
}

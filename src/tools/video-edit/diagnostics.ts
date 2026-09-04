// What was happening when the preview died.
//
// An Android report had a clip demux perfectly — right size, right duration —
// while `<video>` showed a broken thumbnail, and then play fine on a second
// attempt with no change. Intermittent rules out every deterministic cause, and
// two guesses at the transient were already wrong. So this collects the facts
// that would tell the difference, instead of another hypothesis.
//
// WHAT EACH FIELD IS FOR, because a diagnostic nobody can read is a log:
//
//   heap before/after the probe   The one untested theory is memory: the probe
//                                 reads the whole file AND the worker retains
//                                 every demuxed sample. `retainedBytes` says
//                                 exactly how much that is, and the heap says
//                                 whether it mattered. If the limit is close,
//                                 the theory is right and the fix is known.
//   readyState / networkState     Separates "never started" (0/3) from "started
//                                 and stalled" — the media error code alone
//                                 does not.
//   the timeline                  Ordering. If the error lands right after the
//                                 probe completes, the read is implicated; if
//                                 it lands before, the read is not.
//   visibility                    Chrome on Android drops media resources when
//                                 a tab goes to the background, and a long
//                                 upload is exactly when somebody switches away.
//
// **NO FILENAME, EVER.** The report that prompted this was called
// `Screen_Recording_…_WhatsApp.mp4`, which names an app, a date and a time — and
// this block exists to be copied and pasted to somebody else. The extension is
// kept because the container matters; nothing else about the name does. Nor is
// any of it sent anywhere: the page has no telemetry and this is text on screen
// with a copy button, which is the only honest shape for it on this site.

export interface DiagMark {
  /** Milliseconds since the pick. */
  at: number
  what: string
  /**
   * Heap in use at this moment, where the browser reports it.
   *
   * On every mark rather than only at the ends, because the memory hypothesis
   * is about GROWTH — a single figure says nothing, and a column of them next
   * to the steps that caused them says everything. Chrome only; `undefined`
   * elsewhere and the formatter simply omits the column.
   */
  usedMb?: number
}

export interface Recorder {
  mark(what: string): void
  reset(): void
  marks(): DiagMark[]
}

export function createRecorder(): Recorder {
  let t0 = 0
  let list: DiagMark[] = []
  return {
    mark(what: string) {
      if (!t0) t0 = performance.now()
      list.push({ at: Math.round(performance.now() - t0), what, usedMb: heap()?.usedMb })
    },
    reset() { t0 = 0; list = [] },
    marks() { return list },
  }
}

interface HeapLike { usedJSHeapSize: number; jsHeapSizeLimit: number }

/**
 * Chrome's non-standard heap counters. Absent on Firefox and Safari, which is
 * why every reader of this has to tolerate `null` rather than assume a number.
 */
export function heap(): { usedMb: number; limitMb: number } | null {
  const m = (performance as unknown as { memory?: HeapLike }).memory
  if (!m || typeof m.usedJSHeapSize !== 'number') return null
  return {
    usedMb: Math.round(m.usedJSHeapSize / 1048576),
    limitMb: Math.round(m.jsHeapSizeLimit / 1048576),
  }
}

const MEDIA_ERRORS: Record<number, string> = {
  1: 'ABORTED',
  2: 'NETWORK',
  3: 'DECODE — it started and then failed',
  4: 'SRC_NOT_SUPPORTED — it could not be played at all',
}

export interface ReportInput {
  marks: DiagMark[]
  /** The extension only — see the note above about names. */
  extension: string
  fileBytes: number
  clipCount: number
  width: number
  height: number
  durationSec: number
  codec: string
  decodable: boolean
  sampleCount: number
  retainedBytes: number
  errorCode: number
  errorMessage: string
  readyState: number
  networkState: number
  wasHidden: boolean
  heapAtPick: { usedMb: number; limitMb: number } | null
  heapNow: { usedMb: number; limitMb: number } | null
}

const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`

/** The whole report as one block of text, for copying into a bug report. */
export function formatReport(d: ReportInput): string {
  const lines = [
    'built-in-saudi · video-edit diagnostics',
    `user agent: ${navigator.userAgent}`,
    `device memory: ${(navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 'unknown'} GB` +
      ` · cores: ${navigator.hardwareConcurrency ?? 'unknown'}`,
    `heap at pick: ${d.heapAtPick ? `${d.heapAtPick.usedMb} of ${d.heapAtPick.limitMb} MB` : 'not reported'}`,
    `heap now:     ${d.heapNow ? `${d.heapNow.usedMb} of ${d.heapNow.limitMb} MB` : 'not reported'}`,
    `file: .${d.extension} · ${mb(d.fileBytes)} · clip ${d.clipCount} of this session`,
    `track: ${d.width}×${d.height} · ${d.durationSec.toFixed(2)}s · ${d.codec} · decodable: ${d.decodable}`,
    `retained by the worker: ${d.sampleCount} samples · ${mb(d.retainedBytes)}`,
    // "error 0 (unknown)" on a clip that is playing perfectly is a diagnostic
    // that invents a fault, which is worse than one that reports nothing.
    d.errorCode === 0
      ? 'preview: playing, no error'
      : `preview: error ${d.errorCode} (${MEDIA_ERRORS[d.errorCode] ?? 'unknown'})`
        + `${d.errorMessage ? ` — ${d.errorMessage}` : ''}`,
    `         readyState ${d.readyState} · networkState ${d.networkState}` +
      `${d.wasHidden ? ' · the tab was backgrounded while loading' : ''}`,
    'timeline:',
    ...d.marks.map((m) => `  +${String(m.at).padStart(6)}ms  `
      + `${m.usedMb === undefined ? '' : `${String(m.usedMb).padStart(5)} MB  `}${m.what}`),
  ]
  return lines.join('\n')
}

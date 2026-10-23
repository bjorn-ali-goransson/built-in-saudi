// Adaptive video quality for a MESH call. #214 built the RECEIVER-driven half of
// this — encode for the box the other side is actually painting us into. This is
// the PERFORMANCE-driven half: encode for what this device and this link can
// actually carry, and stop sending video altogether when they cannot carry any.
//
// THE BROWSER ALREADY ADAPTS, AND IN A MESH IT ADAPTS IN THE WRONG UNIT. Every
// RTCPeerConnection runs its own send-side bandwidth estimator, and each one
// measures the path to ITS peer as though it had the whole uplink to itself.
// Four peers on one 2 Mbps uplink means four estimators each probing toward
// 2 Mbps, so they converge by SATURATING the link and reading back the loss
// that causes — which is exactly the stuttering, lossy call this file exists to
// prevent. Per-connection congestion control cannot divide a shared uplink;
// something above the connections has to, and that is the only reason this
// module is here.
//
// What the browser does well is kept rather than replaced: inside the ceiling
// we set, its own `degradationPreference` picks resolution against frame rate
// frame by frame, which nothing here could do better.
//
// FRAME RATE IS GIVEN UP FIRST, and that is the one choice in the ladder worth
// arguing about. At a fixed bitrate, halving the frame rate nearly doubles the
// bits available per frame — so a talking head at 15fps is SHARPER than the
// same head at 30, and a face you can read matters more in a call than motion
// that is smooth. Resolution only starts going at rung 2.
//
// It is pure and imports nothing, so `evals/videoquality.mjs` compiles it with
// tsc and drives the REAL ladder over synthetic stat traces rather than a copy
// of it — the `relatedPick.ts` / `motion.ts` arrangement, and the fix for the
// drift `relatedcheck` once spent weeks inside.

/** The encoder's own verdict on what is limiting it (`qualityLimitationReason`).
 *  Worth more than any guess we could make: it is the encoder reporting that it
 *  is ALREADY degrading, and why. */
export type QualityLimit = 'none' | 'cpu' | 'bandwidth' | 'other'

/** One poll of one peer's send-side stats. */
export interface PeerStats {
  /** Monotonic ms at which these counters were read. */
  at: number
  /** CUMULATIVE frames the encoder has produced for this peer. The DELTA is the
   *  measurement; reading this as a rate is the classic way to get 0 or noise. */
  framesEncoded: number
  limit: QualityLimit
  /** Fraction of our packets the RECEIVER never got, 0..1 — their report, not
   *  our hope. Taken from the video stream, or from audio when video is off. */
  loss: number
  /** Round trip time, SECONDS. */
  rtt: number
  /** What we actually fed the encoder, so the achieved rate can be judged
   *  against it. 0 means "do not judge frame rate" — nothing is being sent, or
   *  the picture is a mostly-static screen share that legitimately emits few
   *  frames. */
  wantFps: number
}

export type Verdict = 'severe' | 'bad' | 'ok' | 'good'

/** What a rung costs. `width` is a ceiling composed with what the receiver asked
 *  for; `bitrate` multiplies what that width is worth. */
export interface Rung { fps: number; bitrate: number; width: number }

export const LADDER: readonly Rung[] = [
  { fps: 24, bitrate: 1.0, width: 960 }, // 0 — full
  { fps: 18, bitrate: 0.8, width: 960 }, // 1 — motion only, picture untouched
  { fps: 15, bitrate: 0.65, width: 640 }, // 2
  { fps: 12, bitrate: 0.5, width: 480 }, // 3
  { fps: 10, bitrate: 0.4, width: 320 }, // 4
  { fps: 7, bitrate: 0.3, width: 160 }, // 5 — the last rung that still sends
]

/** One past the bottom rung: video off. */
export const OFF = LADDER.length

/** Below this, video is mush — and a mush of somebody's face is worth less than
 *  the bandwidth it costs the audio. Hitting the floor is itself the argument
 *  for the OFF rung existing. */
export const MIN_KBPS = 40

/** The widths a receiver may ask for. The sender scales onto this ladder, so a
 *  few pixels of layout drift neither spams the data channel nor churns the
 *  encoder. */
export const SIZE_BUCKETS: readonly number[] = [160, 240, 320, 480, 640, 960]

/** Snap a measured device-pixel width onto the ladder. 0 stays 0 and means "you
 *  are not on my screen at all" — the sender then stops sending entirely. */
export function bucketFor(px: number): number {
  if (px <= 0) return 0
  for (const b of SIZE_BUCKETS) if (px <= b) return b
  return SIZE_BUCKETS[SIZE_BUCKETS.length - 1]
}

/** Roughly what an encoded width is worth, kbps. A 160px thumbnail is ~36x fewer
 *  pixels than 960px, so it has no business carrying a 700 kbps stream. */
export function bitrateFor(w: number): number {
  return w <= 160 ? 60 : w <= 240 ? 100 : w <= 320 ? 160 : w <= 480 ? 300 : w <= 640 ? 450 : 700
}

// Thresholds. Loss above ~5% is visibly damaging and 2% is the usual
// "acceptable" line; a 400ms round trip is queueing badly (ITU puts the
// interactive limit near 200ms one way). The frame-rate ratios are against what
// the encoder was FED, not against a constant — a 15fps webcam in poor light is
// not a bad link.
const LOSS_BAD = 0.05, LOSS_SEVERE = 0.2, LOSS_GOOD = 0.02
const RTT_BAD = 0.4, RTT_GOOD = 0.2
const FPS_BAD = 0.6, FPS_SEVERE = 0.25, FPS_GOOD = 0.85

// A POLL GAP OUTSIDE THIS WINDOW MAKES THE FRAME COUNT EVIDENCE ABOUT THE TAB,
// NOT THE LINK. A backgrounded tab is throttled and its encoder can all but
// stop, which reads as a catastrophic link and would turn somebody's video off
// for minimising their window. Loss and round trip stay valid throughout — they
// are the receiver's report — so only the frame-rate test is withheld.
const GAP_MIN_MS = 500, GAP_MAX_MS = 6000

/** How many consecutive troubled polls give up a rung, against how many clean
 *  ones take one back. Deliberately asymmetric: drop fast, recover slowly, or a
 *  marginal link oscillates — degrade, link frees up, re-raise, congest again.
 *  Two polls rather than one is what keeps a single hiccup from costing
 *  anything. */
export const DOWN_SAMPLES = 2
export const UP_SAMPLES = 5

/** Judge one sample. `fps` is the MEASURED rate between this sample and the
 *  previous one, or null when there is no usable previous sample. */
export function verdictOf(s: PeerStats, fps: number | null): Verdict {
  const ratio = s.wantFps > 0 && fps !== null ? fps / s.wantFps : null
  if (s.loss >= LOSS_SEVERE) return 'severe'
  if (ratio !== null && ratio < FPS_SEVERE) return 'severe'
  if (s.limit === 'cpu' || s.limit === 'bandwidth') return 'bad'
  if (s.loss >= LOSS_BAD || s.rtt >= RTT_BAD) return 'bad'
  if (ratio !== null && ratio < FPS_BAD) return 'bad'
  if (s.limit === 'none' && s.loss < LOSS_GOOD && s.rtt < RTT_GOOD && (ratio === null || ratio >= FPS_GOOD)) return 'good'
  // Neither evidence of trouble nor of health — 'other' limits, a middling
  // loss, a frame rate between the two ratios.
  return 'ok'
}

/** What to tell the encoder. `null` means send nothing at all. */
export interface Encode { fps: number; kbps: number; scale: number }

/**
 * Resolve a level into encoder settings for one peer.
 *
 * `wantW` is what the receiver asked for and `rung.width` is what we can
 * afford; the MIN of the two is right, because they answer different questions
 * — what that peer can show, and what this link can carry.
 *
 * SCREEN SHARE IS NEVER TURNED OFF, and never gives up resolution. Sharing a
 * screen is something a person is actively doing, where a camera is ambient; and
 * text that has gone soft is not a worse version of the content, it is none of
 * it. So a bad link costs a screen share frame rate and bitrate, and that is
 * all.
 */
export function encodeFor(level: number, capW: number, wantW: number, screen: boolean): Encode | null {
  const rung = LADDER[Math.min(Math.max(level, 0), LADDER.length - 1)]
  if (screen) {
    return { fps: Math.min(15, rung.fps), kbps: Math.max(MIN_KBPS, Math.round(1200 * rung.bitrate)), scale: 1 }
  }
  if (level >= OFF) return null
  const target = Math.min(capW, Math.max(160, Math.min(wantW, rung.width)))
  return {
    fps: rung.fps,
    kbps: Math.max(MIN_KBPS, Math.round(bitrateFor(target) * rung.bitrate)),
    scale: Math.min(16, Math.max(1, capW / target)),
  }
}

export interface PeerQuality { id: string; level: number; verdict: Verdict; fps: number | null }
export interface QualitySummary {
  level: number
  videoOff: boolean
  pinned: boolean
  /** Why the global level last moved — for the debug panel, not for the UI. */
  reason: 'cpu' | 'uplink' | 'clear' | 'none'
  peers: PeerQuality[]
}

/**
 * The coordinator the mesh needs above its connections.
 *
 * TWO LEVELS, BECAUSE A BAD PEER AND A BAD UPLINK ARE DIFFERENT FACTS. If one
 * peer of four is losing packets, that is their path, and degrading everybody
 * for it punishes three people for one person's hotel wifi. If most peers are,
 * it is our own uplink, and degrading only the peer who happened to complain
 * fixes nothing because every other connection keeps its ceiling. So a global
 * level moves on evidence shared across peers, and a per-peer penalty adds to
 * it for one peer alone.
 *
 * CPU is always global — there is one encoder budget however many connections
 * spend it.
 *
 * ONLY THE GLOBAL LEVEL MAY REACH `OFF`. A per-peer penalty stops at the bottom
 * rung that still sends, because "your video is off" is something a person can
 * be told and act on, where "your video is off for Omar only" is a sentence
 * nobody can do anything with.
 */
export class QualityController {
  private global = 0
  private extra = new Map<string, number>()
  private prev = new Map<string, { at: number; framesEncoded: number }>()
  private badRun = 0
  private goodRun = 0
  private peerBad = new Map<string, number>()
  private peerGood = new Map<string, number>()
  private pinned = false
  private last: PeerQuality[] = []
  private why: QualitySummary['reason'] = 'none'

  /** The level that applies to one peer: the shared level plus whatever that
   *  peer's own path has cost on top of it. */
  levelFor(id: string): number {
    if (this.global >= OFF) return OFF
    return Math.min(LADDER.length - 1, this.global + (this.extra.get(id) || 0))
  }

  /** The best level anyone is getting — what the CAPTURE has to be good enough
   *  for, since the per-peer penalty only ever subtracts from it. */
  get captureLevel(): number { return Math.min(this.global, LADDER.length - 1) }

  get videoOff(): boolean { return this.global >= OFF }
  get isPinned(): boolean { return this.pinned }

  /**
   * The person overruled us and asked for their camera back.
   *
   * It returns at the BOTTOM rung rather than at full quality — the link is
   * still the link — and we never take it away again. Turning somebody's video
   * off twice after they have said they want it is the app arguing with them,
   * and quality degradation below that point is invisible and helpful, so it
   * keeps running.
   */
  pin(): void {
    this.pinned = true
    if (this.global >= OFF) { this.global = LADDER.length - 1; this.badRun = 0; this.goodRun = 0 }
  }

  /** Forget a peer that has left, so its penalty cannot outlive it. */
  forget(id: string): void { this.extra.delete(id); this.prev.delete(id); this.peerBad.delete(id); this.peerGood.delete(id) }

  /** One poll. Feed it every in-call peer's current send stats. */
  step(stats: Map<string, PeerStats>): void {
    for (const id of [...this.prev.keys()]) if (!stats.has(id)) this.forget(id)

    const verdicts = new Map<string, Verdict>()
    const rates = new Map<string, number | null>()
    for (const [id, s] of stats) {
      const p = this.prev.get(id)
      const gap = p ? s.at - p.at : 0
      const fps = p && gap >= GAP_MIN_MS && gap <= GAP_MAX_MS
        ? Math.max(0, s.framesEncoded - p.framesEncoded) / (gap / 1000)
        : null
      this.prev.set(id, { at: s.at, framesEncoded: s.framesEncoded })
      verdicts.set(id, verdictOf(s, fps))
      rates.set(id, fps)
    }

    const n = stats.size
    const troubled = [...verdicts.values()].filter((v) => v === 'bad' || v === 'severe').length
    const cpu = [...stats.values()].some((s) => s.limit === 'cpu')
    // Shared evidence: our own encoder, or a majority of paths. With a single
    // peer there is no way to tell our uplink from their path and the action is
    // the same either way, so one troubled peer IS the majority.
    const shared = n > 0 && (cpu || troubled * 2 > n)
    const severe = shared && [...verdicts.values()].some((v) => v === 'severe')
    const allGood = n > 0 && [...verdicts.values()].every((v) => v === 'good')

    if (shared) {
      this.goodRun = 0
      if (++this.badRun >= DOWN_SAMPLES) {
        this.badRun = 0
        // Severe trouble descends two rungs: "very bad" should reach off in
        // about a dozen seconds, where merely bad takes its time.
        const ceiling = this.pinned ? LADDER.length - 1 : OFF
        this.global = Math.min(ceiling, this.global + (severe ? 2 : 1))
        this.why = cpu ? 'cpu' : 'uplink'
      }
    } else if (allGood) {
      this.badRun = 0
      if (++this.goodRun >= UP_SAMPLES) {
        this.goodRun = 0
        if (this.global > 0) { this.global--; this.why = 'clear' }
      }
    } else {
      // 'ok' is evidence of neither. It clears the GOOD run, because raising
      // needs clean evidence — but deliberately NOT the bad run, so a link that
      // is troubled every other poll still descends. Asymmetric in the safe
      // direction: quick to believe trouble, slow to believe recovery.
      this.goodRun = 0
    }

    for (const [id, v] of verdicts) {
      if (!shared && (v === 'bad' || v === 'severe')) {
        this.peerGood.set(id, 0)
        const run = (this.peerBad.get(id) || 0) + 1
        if (run >= DOWN_SAMPLES) {
          this.peerBad.set(id, 0)
          this.extra.set(id, Math.min(LADDER.length - 1, (this.extra.get(id) || 0) + 1))
        } else this.peerBad.set(id, run)
      } else if (v === 'good') {
        this.peerBad.set(id, 0)
        const run = (this.peerGood.get(id) || 0) + 1
        if (run >= UP_SAMPLES) {
          this.peerGood.set(id, 0)
          this.extra.set(id, Math.max(0, (this.extra.get(id) || 0) - 1))
        } else this.peerGood.set(id, run)
      } else this.peerGood.set(id, 0)
    }

    this.last = [...verdicts].map(([id, verdict]) => ({ id, verdict, level: this.levelFor(id), fps: rates.get(id) ?? null }))
  }

  summary(): QualitySummary {
    return { level: this.global, videoOff: this.videoOff, pinned: this.pinned, reason: this.why, peers: this.last }
  }
}

// Recording a meeting, kept as the separate things it is made of rather than
// as pixels painted off the screen. The calls are peer to peer, so no server
// ever has the media: the recording is made in the recorder's own browser.
//
// - Each person's SOUND and VIDEO are recorded apart (one MediaRecorder per
//   track), so the meeting can be laid out and mixed afterwards — who was
//   speaking is in the sound, and a screen share is a person's video while
//   their `sharing` flag is up (the call sends camera and screen down one
//   track, so the video file does not know which it is; the events do).
// - A track that changes (a camera turned off and on, a screen share started
//   here) ends one SEGMENT and starts another, each with its start time.
// - Everything else — the whiteboard, chat, who came and went, mute, camera,
//   sharing — is an EVENT on the same clock, in events.jsonl. A whiteboard is
//   redrawn from its strokes at whatever size the final video needs.
// - Media goes to the device's own storage (OPFS) as it arrives, so an hour
//   does not sit in memory and a crash loses seconds, not the meeting. Where
//   OPFS cannot write (older Safari), it is kept in memory.
//
// The package is a plain ZIP: manifest.json, events.jsonl and the segments.
// Merging it into one video is a later step, on the device, after the call.

export type RecKind = 'audio' | 'video'
export interface RecSegment { file: string; who: string; kind: RecKind; mime: string; start: number; end: number; bytes: number }
export interface RecEvent { t: number; kind: string; who?: string; data?: unknown }
export interface RecManifest {
  version: 1
  /** Wall-clock start (ISO) and the clock every `t`/`start`/`end` is measured on: ms since it. */
  started: string
  room: string
  recorder: string
  people: Record<string, { name: string }>
  segments: RecSegment[]
  duration: number
}
/** What the recorder is told, once a second, about the tracks of each person. */
export interface RecSource { who: string; name: string; audio: MediaStreamTrack | null; video: MediaStreamTrack | null }

const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4']
const VIDEO_TYPES = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4']
function pick(types: string[]): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}
const extOf = (mime: string) => (mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm')
/** Whether this browser can record at all. */
export function canRecord(): boolean { return !!pick(AUDIO_TYPES) }

// Where the bytes go: a file in the origin's private storage, or memory.
interface Sink { write(b: Blob): Promise<void>; close(): Promise<Blob> }
async function opfsDir(name: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage?.getDirectory?.()
    if (!root) return null
    const dir = await root.getDirectoryHandle(name, { create: true })
    // Some engines expose OPFS but not createWritable outside a worker: ask once.
    const probe = await dir.getFileHandle('.probe', { create: true }) as FileSystemFileHandle & { createWritable?: () => Promise<FileSystemWritableFileStream> }
    if (typeof probe.createWritable !== 'function') return null
    await dir.removeEntry('.probe')
    return dir
  } catch { return null }
}
async function sinkFor(dir: FileSystemDirectoryHandle | null, file: string): Promise<Sink> {
  if (dir) {
    try {
      const h = await dir.getFileHandle(file, { create: true })
      const w = await h.createWritable()
      return { write: (b) => w.write(b), close: async () => { await w.close(); return h.getFile() } }
    } catch { /* fall through to memory */ }
  }
  const parts: Blob[] = []
  return { write: async (b) => { parts.push(b) }, close: async () => new Blob(parts) }
}

interface Live { seg: RecSegment; track: MediaStreamTrack; rec: MediaRecorder; sink: Sink; chain: Promise<void>; done: Promise<Blob> }

export class MeetingRecorder {
  private t0 = 0
  private dir: FileSystemDirectoryHandle | null = null
  private dirName = ''
  private live = new Map<string, Live>() // `${who}|${kind}`
  private closed: { seg: RecSegment; blob: Blob }[] = []
  private finishing: Promise<void>[] = [] // every closed segment's file, being finished
  private events: RecEvent[] = []
  private people: Record<string, { name: string }> = {}
  private n = 0
  private started = ''
  running = false

  constructor(private room: string, private recorder: string, private opts: { audioBps?: number; videoBps?: number; slice?: number } = {}) {}

  now() { return Math.round(performance.now() - this.t0) }

  async start(): Promise<void> {
    this.t0 = performance.now()
    this.started = new Date().toISOString()
    // An earlier recording's files are gone with it: one kept at a time.
    try {
      const root = await navigator.storage.getDirectory() as FileSystemDirectoryHandle & { keys(): AsyncIterable<string> }
      for await (const name of root.keys()) if (name.startsWith('bis-rec-')) await root.removeEntry(name, { recursive: true }).catch(() => {})
    } catch { /* no private storage: memory it is */ }
    this.dirName = `bis-rec-${Date.now().toString(36)}`
    this.dir = await opfsDir(this.dirName)
    this.running = true
  }

  /** Something that happened, on the recording's clock. */
  event(kind: string, who?: string, data?: unknown) { if (this.running) this.events.push({ t: this.now(), kind, who, data }) }

  /** The current tracks of everyone in the call. Called once a second: a new
   *  track (or one that ended) closes its segment and opens another. */
  sync(sources: RecSource[]) {
    if (!this.running) return
    const seen = new Set<string>()
    for (const s of sources) {
      if (!this.people[s.who] || this.people[s.who].name !== s.name) this.people[s.who] = { name: s.name }
      for (const kind of ['audio', 'video'] as const) {
        const key = `${s.who}|${kind}`
        const track = kind === 'audio' ? s.audio : s.video
        const cur = this.live.get(key)
        if (track && track.readyState === 'live') {
          seen.add(key)
          if (cur?.track === track) continue
          if (cur) this.close(key)
          this.open(s.who, kind, track)
        }
      }
    }
    for (const key of [...this.live.keys()]) if (!seen.has(key)) this.close(key)
  }

  private open(who: string, kind: RecKind, track: MediaStreamTrack) {
    const mime = pick(kind === 'audio' ? AUDIO_TYPES : VIDEO_TYPES)
    if (!mime) return
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(new MediaStream([track]), kind === 'audio'
        ? { mimeType: mime, audioBitsPerSecond: this.opts.audioBps ?? 48_000 }
        : { mimeType: mime, videoBitsPerSecond: this.opts.videoBps ?? 800_000 })
    } catch { return }
    const file = `${String(++this.n).padStart(3, '0')}-${who.replace(/[^\w-]/g, '').slice(0, 16)}-${kind}.${extOf(mime)}`
    const seg: RecSegment = { file, who, kind, mime, start: this.now(), end: -1, bytes: 0 }
    const sinkP = sinkFor(this.dir, file)
    let chain: Promise<void> = Promise.resolve()
    const live: Live = { seg, track, rec, sink: null as unknown as Sink, chain, done: null as unknown as Promise<Blob> }
    // Chunks are written in the order they come, one at a time.
    rec.ondataavailable = (e) => {
      if (!e.data.size) return
      seg.bytes += e.data.size
      live.chain = chain = chain.then(async () => { const s = await sinkP; await s.write(e.data) }).catch(() => {})
    }
    live.done = new Promise<Blob>((resolve) => {
      rec.onstop = () => { void chain.then(async () => resolve(await (await sinkP).close())) }
    })
    rec.start(this.opts.slice ?? 2000)
    this.live.set(`${who}|${kind}`, live)
  }

  private close(key: string) {
    const l = this.live.get(key); if (!l) return
    this.live.delete(key)
    l.seg.end = this.now()
    try { if (l.rec.state !== 'inactive') l.rec.stop() } catch { /* already stopped */ }
    this.finishing.push(l.done.then((blob) => { this.closed.push({ seg: l.seg, blob }) }))
  }

  /** Stop everything and hand back the package. */
  async stop(): Promise<{ blob: Blob; manifest: RecManifest }> {
    for (const key of [...this.live.keys()]) this.close(key)
    this.running = false
    const duration = this.now()
    // Including segments that ended a moment ago and are still being written.
    await Promise.all(this.finishing)
    const segments = this.closed.map((c) => ({ ...c.seg, bytes: c.blob.size })).sort((a, b) => a.start - b.start)
    const manifest: RecManifest = { version: 1, started: this.started, room: this.room, recorder: this.recorder, people: this.people, segments, duration }
    const enc = new TextEncoder()
    const files: { name: string; blob: Blob }[] = [
      { name: 'manifest.json', blob: new Blob([enc.encode(JSON.stringify(manifest, null, 2))]) },
      { name: 'events.jsonl', blob: new Blob([enc.encode(this.events.map((e) => JSON.stringify(e)).join('\n') + '\n')]) },
      ...this.closed.sort((a, b) => a.seg.start - b.seg.start).map((c) => ({ name: c.seg.file, blob: c.blob })),
    ]
    return { blob: await zipBlobs(files), manifest }
  }

  /** Forget the stored media once the package has been handed over. */
  async discard() {
    if (!this.dirName) return
    try { await (await navigator.storage.getDirectory()).removeEntry(this.dirName, { recursive: true }) } catch { /* nothing kept */ }
  }
}

// ---- a ZIP that never holds the media in memory --------------------------------
// Stored (not deflated: the media is already compressed). Each entry's CRC is
// read through its stream in pieces, and the archive is a Blob made of the
// headers and the original Blobs, so a file in OPFS stays a file in OPFS.

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
async function crcOf(blob: Blob): Promise<number> {
  let c = 0xffffffff
  const reader = blob.stream().getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    for (let i = 0; i < value.length; i++) c = CRC[(c ^ value[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}
const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff]
const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]

export async function zipBlobs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const enc = new TextEncoder()
  const parts: BlobPart[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name), size = f.blob.size, crc = await crcOf(f.blob)
    const head = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0)])
    parts.push(head, name, f.blob)
    central.push(new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name)
    offset += head.length + name.length + size
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0)
  const end = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)])
  return new Blob([...parts, ...central as BlobPart[], end], { type: 'application/zip' })
}

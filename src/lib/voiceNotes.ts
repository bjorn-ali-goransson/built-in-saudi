// Voice notes in DMs (#232) — peer-to-peer, nothing on any server.
//
// A voice note is recorded with MediaRecorder and kept in the sender's LOCAL outbox
// (IndexedDB). The recipient is nudged with the ordinary call-dm push carrying only
// metadata ("Voice note") — the audio never rides the push. When both parties have
// the DM thread open, their clients meet in a data-only WebRTC rendezvous room (keyed
// by the two link codes) and the audio transfers over the data channel, reusing the
// same chunked path as the in-call file drop. The recipient stores it locally and
// acks; the sender then drops it from the outbox.
//
// The honest cost of storing nothing: "both online at once" is a narrow window. Until
// it happens the note sits pending — the UI says so rather than pretending it arrived.
import { useEffect, useRef, useState } from 'react'
import { CallRoom } from '../tools/calls/rtc'
import { addDms, setVoicePending, sendVoiceNotice, type Dm } from './dms'
import { getMyCallLink } from './callLink'

// ---- blob store (separate DB from the sw-shared bis-calls, so the sw contract in
// localQueue.ts is untouched) ------------------------------------------------------
const DB = 'bis-voicenotes'
const VERSION = 1
const STORE = 'blobs'

function withStore<T>(mode: IDBTransactionMode, fn: (os: IDBObjectStore) => IDBRequest, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false
    const done = (v: T) => { if (!settled) { settled = true; resolve(v) } }
    try {
      if (typeof indexedDB === 'undefined') return done(fallback)
      const open = indexedDB.open(DB, VERSION)
      open.onupgradeneeded = () => { const db = open.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }) }
      open.onerror = () => done(fallback)
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction(STORE, mode)
          const req = fn(tx.objectStore(STORE))
          req.onsuccess = () => done((req.result as T) ?? fallback)
          req.onerror = () => done(fallback)
        } catch { done(fallback) }
      }
    } catch { done(fallback) }
  })
}

export const putVoiceBlob = (id: string, blob: Blob) => withStore('readwrite', (os) => os.put({ id, blob }), undefined)
export async function getVoiceBlob(id: string): Promise<Blob | null> {
  const rec = await withStore<{ id: string; blob: Blob } | undefined>('readonly', (os) => os.get(id), undefined)
  return rec?.blob || null
}
export const delVoiceBlob = (id: string) => withStore('readwrite', (os) => os.delete(id), undefined)

// ---- outbox (pending outgoing notes; the audio is in the blob store above) --------
export interface OutItem { id: string; contact: string; dur: number; mime: string; at: number }
const OUT_KEY = 'bis-vn-outbox'
const QUEUED = 'bis-vn-queued'

export function listOutbox(): OutItem[] {
  try { const v = JSON.parse(localStorage.getItem(OUT_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function writeOutbox(list: OutItem[]) { try { localStorage.setItem(OUT_KEY, JSON.stringify(list.slice(-50))) } catch { /* */ } }
function addOutbox(item: OutItem) { writeOutbox([...listOutbox().filter((o) => o.id !== item.id), item]) }
function removeOutbox(id: string) { writeOutbox(listOutbox().filter((o) => o.id !== id)) }

/** Record an outgoing voice note: store the audio, drop a pending bubble in the
 *  thread, queue it for P2P delivery, and nudge the recipient with a metadata push. */
export async function queueVoiceNote(contact: { code: string; name: string }, blob: Blob, mime: string, dur: number, myName: string): Promise<void> {
  const id = `v${Date.now()}${Math.random().toString(36).slice(2, 7)}`
  await putVoiceBlob(id, blob)
  const dm: Dm = { id, from: contact.code, name: contact.name, text: '', at: Date.now(), mine: true, voice: { dur, mime, pending: true } }
  addDms([dm])
  addOutbox({ id, contact: contact.code, dur, mime, at: dm.at })
  // Nudge them to open the app; the audio itself goes P2P, not in this push.
  sendVoiceNotice(contact.code, myName, { id, dur, mime }).catch(() => {})
  try { window.dispatchEvent(new Event(QUEUED)) } catch { /* */ }
}

// ---- recorder ---------------------------------------------------------------------
function pickMime(): string {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  if (typeof MediaRecorder === 'undefined') return ''
  for (const m of cands) { try { if (MediaRecorder.isTypeSupported(m)) return m } catch { /* */ } }
  return ''
}

export interface Recording { blob: Blob; mime: string; dur: number }

/** A minimal push-to-record hook: start() opens the mic, stop() resolves with the
 *  recorded clip, cancel() discards it. Releases the mic either way. */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const stream = useRef<MediaStream | null>(null)
  const startedAt = useRef(0)
  const tick = useRef<number | undefined>(undefined)
  const stopTracks = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null }
  useEffect(() => () => { window.clearInterval(tick.current); try { rec.current?.stop() } catch { /* */ } stopTracks() }, [])

  async function start(): Promise<boolean> {
    if (recording) return false
    setError('')
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof MediaRecorder === 'undefined') { setError('unsupported'); return false }
    try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { setError('denied'); return false }
    const mime = pickMime()
    chunks.current = []
    try { rec.current = mime ? new MediaRecorder(stream.current, { mimeType: mime }) : new MediaRecorder(stream.current) } catch { stopTracks(); setError('unsupported'); return false }
    rec.current.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data) }
    rec.current.start()
    startedAt.current = Date.now(); setSeconds(0); setRecording(true)
    tick.current = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 250)
    return true
  }
  function finish(keep: boolean): Promise<Recording | null> {
    return new Promise((resolve) => {
      const r = rec.current
      window.clearInterval(tick.current)
      if (!r) { setRecording(false); stopTracks(); return resolve(null) }
      r.onstop = () => {
        const mime = r.mimeType || 'audio/webm'
        const blob = new Blob(chunks.current, { type: mime })
        const dur = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))
        rec.current = null; chunks.current = []; stopTracks(); setRecording(false)
        resolve(keep && blob.size > 0 ? { blob, mime, dur } : null)
      }
      try { r.stop() } catch { setRecording(false); stopTracks(); resolve(null) }
    })
  }
  return { recording, seconds, error, start, stop: () => finish(true), cancel: () => finish(false) }
}

// ---- P2P rendezvous ---------------------------------------------------------------
/** While a DM thread with `contact` is open, meet them in a data-only rendezvous room
 *  and exchange any pending voice notes both ways. Nothing happens until they open the
 *  thread too — that's the "both online" window, made honest rather than hidden. */
export function useVoiceDrop({ contactCode, contactName, myName, active }: { contactCode: string; contactName: string; myName: string; active: boolean }) {
  const roomRef = useRef<CallRoom | null>(null)
  const incoming = useRef<{ id: string; mime: string; dur: number; parts: ArrayBuffer[] } | null>(null)
  useEffect(() => {
    let myCode = ''
    try { myCode = getMyCallLink()?.code || '' } catch { /* */ }
    if (!active || !contactCode || !myCode || myCode === contactCode) return
    const room = `vn_${[myCode, contactCode].sort().join('_')}`
    const host = myCode < contactCode // deterministic: the smaller code hosts

    async function flush() {
      const r = roomRef.current
      if (!r || !r.hasOpenData()) return
      for (const o of listOutbox().filter((x) => x.contact === contactCode)) {
        const blob = await getVoiceBlob(o.id)
        if (!blob) { removeOutbox(o.id); continue } // audio gone — nothing to send
        await r.sendVoiceNote(o.id, blob, o.mime, o.dur) // stays queued until vn-ack
      }
    }

    const cr = new CallRoom(room, {
      onPeerInfo: () => { flush() }, // a data channel just opened
      onData: (_id, m) => {
        if (m.t === 'vn-start') incoming.current = { id: m.id, mime: m.mime, dur: m.dur, parts: [] }
        else if (m.t === 'vn-end') {
          const inc = incoming.current; incoming.current = null
          if (!inc || inc.id !== m.id) return
          const blob = new Blob(inc.parts, { type: inc.mime || 'audio/webm' })
          putVoiceBlob(inc.id, blob).then(() => {
            addDms([{ id: inc.id, from: contactCode, name: contactName, text: '', at: Date.now(), mine: false, voice: { dur: inc.dur, mime: inc.mime, pending: false } }])
            setVoicePending(inc.id, false)
            roomRef.current?.sendData({ t: 'vn-ack', id: inc.id })
          })
        }
        else if (m.t === 'vn-ack') { removeOutbox(m.id); setVoicePending(m.id, false) }
      },
      onFileChunk: (_id, chunk) => { if (incoming.current) incoming.current.parts.push(chunk) },
    })
    roomRef.current = cr
    cr.enterLobby(myName || 'Me', host)
    const onQueued = () => flush()
    window.addEventListener(QUEUED, onQueued)
    // Retry periodically in case the peer connects a beat after we do.
    const retry = window.setInterval(flush, 4000)
    return () => {
      window.removeEventListener(QUEUED, onQueued)
      window.clearInterval(retry)
      try { cr.leave() } catch { /* */ }
      roomRef.current = null
      incoming.current = null
    }
  }, [active, contactCode, contactName, myName])
}

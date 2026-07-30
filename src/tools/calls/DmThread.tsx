// A message thread with one contact. Messages travel as Web Push payloads and live
// only on the two devices involved (see src/lib/dms.ts) — there is no mailbox, so a
// thread cleared here is gone from this device for good.
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Sheet, SheetTitle, SheetActions } from '../../components/ui'
import { TrashIcon, MicIcon } from '../../components/icons'
import { sendDm, sendDmReaction, type Dm } from '../../lib/dms'
import { useVoiceRecorder, useVoiceDrop, queueVoiceNote, getVoiceBlob } from '../../lib/voiceNotes'
import { EMOJI } from './helpers'
import type { Contact } from '../../lib/contacts'
import type { Str } from './strings'

/** Loads a voice note's audio from IndexedDB (by message id) and plays it inline.
 *  While the audio hasn't transferred yet, shows a pending caption instead. */
function VoiceBubble({ id, mine, voice, s }: { id: string; mine: boolean; voice: NonNullable<Dm['voice']>; s: Str }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let alive = true; let made = ''
    getVoiceBlob(id).then((b) => { if (b && alive) { made = URL.createObjectURL(b); setUrl(made) } })
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [id, voice.pending])
  const mm = `${Math.floor(voice.dur / 60)}:${(voice.dur % 60).toString().padStart(2, '0')}`
  return (
    <div className={`flex flex-col gap-1 max-w-[80%] rounded-md px-2.5 py-1.5 ${mine ? 'bg-green-600 text-sand-100' : 'bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] text-ink'}`} data-testid="dm-voice">
      {url
        ? <audio controls src={url} className="h-8 max-w-full" data-testid="dm-voice-audio" />
        : <span className="inline-flex items-center gap-1.5 text-[0.85rem]"><MicIcon className="w-4 h-4 shrink-0" /> {s.voiceNote} · {mm}</span>}
      {voice.pending && <span className="text-[0.66rem] opacity-75" data-testid="dm-voice-pending">{s.voicePending}</span>}
    </div>
  )
}

export function DmThread({ s, contact, messages, myName, onClose, onClear }: {
  s: Str
  contact: Contact
  messages: Dm[]
  myName: string
  onClose: () => void
  onClear: (code: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [picking, setPicking] = useState('') // message id whose emoji picker is open
  const end = useRef<HTMLDivElement>(null)
  // Voice notes (#232): record locally, transfer P2P while both have the thread open.
  const rec = useVoiceRecorder()
  useVoiceDrop({ contactCode: contact.code, contactName: contact.name, myName, active: true })
  async function sendVoice() {
    const clip = await rec.stop()
    if (!clip) return
    await queueVoiceNote({ code: contact.code, name: contact.name }, clip.blob, clip.mime, clip.dur, myName)
    setNote(s.voiceQueued)
  }

  // Keep the newest message in view as the thread grows.
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length])

  async function send() {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true); setNote('')
    const r = await sendDm(contact.code, contact.name, text, myName)
    setBusy(false)
    setDraft('')
    // Be honest about delivery: with no mailbox, "sent" only means their device
    // accepted the push. Zero deliveries means it did not arrive.
    if (!r.ok) setNote(s.dmFailed)
    else if (r.delivered === 0) setNote(s.dmNoDevice)
  }

  return (
    <Sheet onClose={onClose} data-testid="dm-thread">
      <SheetTitle>{contact.name || contact.code}</SheetTitle>

      {messages.length === 0 ? (
        <p className="text-[0.88rem] text-ink-faint" data-testid="dm-empty">{s.dmEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5 list-none p-0 m-0 max-h-[45vh] overflow-y-auto" data-testid="dm-list">
          {messages.map((m) => (
            <li key={m.id} className={`relative flex flex-col ${m.mine ? 'items-end' : 'items-start'}`} data-testid={m.mine ? 'dm-mine' : 'dm-theirs'}>
              {m.voice ? (
                <VoiceBubble id={m.id} mine={!!m.mine} voice={m.voice} s={s} />
              ) : (
              <button
                type="button" onClick={() => setPicking((p) => (p === m.id ? '' : m.id))}
                title={s.dmReact} aria-label={s.dmReact} data-testid="dm-react"
                className={`max-w-[80%] text-start rounded-md px-2.5 py-1.5 text-[0.9rem] leading-snug [overflow-wrap:anywhere] border-0 cursor-pointer ${
                  m.mine ? 'bg-green-600 text-sand-100' : 'bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] text-ink'
                }`}
              >{m.text}</button>
              )}

              {/* Reactions sit under the bubble, same toggle semantics as in-call chat. */}
              {m.reactions && Object.keys(m.reactions).length > 0 && (
                <span className="flex gap-1 flex-wrap mt-0.5" data-testid="dm-reactions">
                  {Object.entries(m.reactions).map(([emoji, who]) => (
                    <button
                      key={emoji} type="button" title={who.join(', ')} data-testid="dm-reaction"
                      onClick={() => sendDmReaction(contact.code, m.id, emoji, myName)}
                      className="inline-flex items-center gap-0.5 h-6 px-1.5 rounded-full border border-[color:var(--line)] bg-[var(--surface)] text-[0.75rem] cursor-pointer hover:border-green-500"
                    >{emoji}{who.length > 1 ? <span className="text-ink-faint">{who.length}</span> : null}</button>
                  ))}
                </span>
              )}

              {picking === m.id && (
                <span className="flex gap-0.5 flex-wrap mt-1 p-1.5 rounded-md border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-md)] max-w-full" data-testid="dm-react-picker">
                  {EMOJI.slice(0, 12).map((e) => (
                    <button
                      key={e} type="button" data-testid="dm-react-pick"
                      onClick={() => { sendDmReaction(contact.code, m.id, e, myName); setPicking('') }}
                      className="grid place-items-center w-7 h-7 rounded bg-transparent border-0 cursor-pointer text-[1rem] hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
                    >{e}</button>
                  ))}
                </span>
              )}
            </li>
          ))}
          <div ref={end} />
        </ul>
      )}

      {note && <p className="text-[0.8rem] text-gold-500" data-testid="dm-note">{note}</p>}

      {rec.recording ? (
        <div className="flex items-center gap-2" data-testid="dm-recording">
          <span className="flex-1 inline-flex items-center gap-2 text-[0.85rem] text-ink">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--danger)] animate-pulse" />
            {s.recording} <span className="font-mono tabular-nums">{Math.floor(rec.seconds / 60)}:{(rec.seconds % 60).toString().padStart(2, '0')}</span>
          </span>
          <button type="button" onClick={rec.cancel} data-testid="dm-rec-cancel"
            className="h-9 px-3 rounded-md bg-transparent border border-[color:var(--line)] text-ink-soft text-[0.85rem] cursor-pointer hover:bg-black/5">{s.cancel}</button>
          <Button variant="primary" onClick={sendVoice} data-testid="dm-rec-send">{s.dmSend}</Button>
        </div>
      ) : (
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); send() }}>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={s.dmPlaceholder}
            aria-label={s.dmPlaceholder} data-testid="dm-input" maxLength={500} className="flex-1" />
          {!draft.trim() && (
            <button type="button" onClick={() => rec.start()} title={s.recordVoice} aria-label={s.recordVoice} data-testid="dm-rec"
              className="grid place-items-center w-10 h-10 shrink-0 rounded-md bg-transparent border border-[color:var(--line)] text-ink-soft hover:text-green-700 hover:border-green-500 cursor-pointer [&_svg]:w-[18px] [&_svg]:h-[18px]"><MicIcon /></button>
          )}
          <Button variant="primary" type="submit" disabled={busy || !draft.trim()} data-testid="dm-send">
            {busy ? s.dmSending : s.dmSend}
          </Button>
        </form>
      )}
      {rec.error && <p className="text-[0.8rem] text-gold-500" data-testid="dm-rec-error">{s.recError}</p>}

      <SheetActions>
        <button type="button" onClick={() => onClear(contact.code)} data-testid="dm-clear"
          className="inline-flex items-center gap-1.5 bg-transparent border-0 cursor-pointer text-[0.82rem] text-ink-faint hover:text-[var(--danger)] [&_svg]:w-3.5 [&_svg]:h-3.5">
          <TrashIcon /> {s.dmClear}
        </button>
      </SheetActions>
    </Sheet>
  )
}

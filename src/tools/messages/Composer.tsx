// The message box: text, files (pick, drop, paste), voice notes, emoji, polls,
// location, scheduled send, and the reply/edit bars above it.
import { useEffect, useRef, useState } from 'react'
import type { Conversation, Message, Reply } from './model'
import type { MessageStore } from './store'
import type { Str } from './strings'
import { useVoiceRecorder } from '../../lib/voiceNotes'
import { MicIcon, CloseIcon, AddressPinIcon, FileIcon, ImageIcon, ClockIcon, UsersIcon, ListIcon } from '../../components/icons'
import { plain } from './format'

const EMOJI = ['😀', '😂', '🥹', '😍', '😘', '😎', '🤔', '😅', '😭', '😡', '👍', '👎', '👏', '🙏', '💪', '🤝', '❤️', '🔥', '✨', '🎉', '✅', '❌', '👀', '🌙', '☕', '🕋', '🇸🇦', '🌴', '🐪', '💯']

export function replyOf(m: Message, you: string, store: MessageStore): Reply {
  const snippet = m.kind === 'text' ? plain(m.text).slice(0, 120) : (m.file?.name || m.poll?.q || m.kind)
  return { id: m.id, from: m.from, name: m.from === store.me ? you : m.name, snippet }
}

export function Composer({ conv, store, s, reply, editing, onClearReply, onClearEdit, onPoll, onContact, onEdit, readOnly }: {
  conv: Conversation; store: MessageStore; s: Str; reply: Message | null; editing: Message | null
  onClearReply(): void; onClearEdit(): void; onPoll(): void; onContact(): void; onEdit(m: Message): void; readOnly: boolean
}) {
  const [text, setText] = useState(conv.draft || '')
  const [menu, setMenu] = useState<'' | 'attach' | 'emoji' | 'schedule'>('')
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')
  const ta = useRef<HTMLTextAreaElement>(null)
  const fileIn = useRef<HTMLInputElement>(null)
  const photoIn = useRef<HTMLInputElement>(null)
  const rec = useVoiceRecorder()
  const typingSent = useRef(0)

  // Switching conversations: load that conversation's draft.
  useEffect(() => { setText(conv.draft || ''); setMenu(''); setNote('') }, [conv.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (editing) { setText(editing.text); ta.current?.focus() } }, [editing])
  useEffect(() => { if (reply) ta.current?.focus() }, [reply])
  // Grow with content up to a cap.
  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [text])

  function change(v: string) {
    setText(v)
    if (!editing) store.setConvFlag(conv.id, { draft: v })
    const now = Date.now()
    if (v && now - typingSent.current > 3000) { typingSent.current = now; store.typingPing(conv.id, true) }
    if (!v && typingSent.current) { typingSent.current = 0; store.typingPing(conv.id, false) }
  }

  function send(at?: number) {
    const v = text
    if (!v.trim()) return
    if (editing) {
      store.edit(conv.id, editing.id, v)
      onClearEdit()
    } else {
      store.sendText(conv.id, v, { reply: reply ? replyOf(reply, s.you, store) : undefined, sendAt: at })
      onClearReply()
    }
    setText('')
    store.setConvFlag(conv.id, { draft: '' })
    if (typingSent.current) { typingSent.current = 0; store.typingPing(conv.id, false) }
    setMenu('')
    ta.current?.focus()
  }

  async function files(list: FileList | File[] | null) {
    if (!list) return
    for (const f of Array.from(list)) {
      const m = await store.sendFile(conv.id, f, { reply: reply ? replyOf(reply, s.you, store) : undefined })
      if (!m) setNote(s.tooBig)
    }
    onClearReply()
    setMenu('')
  }

  async function voice() {
    if (!rec.recording) { await rec.start(); return }
    const clip = await rec.stop()
    if (!clip) return
    const file = new File([clip.blob], `voice-${Date.now()}.webm`, { type: clip.mime })
    await store.sendFile(conv.id, file, { voice: clip.dur })
  }

  function location() {
    setMenu('')
    if (!navigator.geolocation) { setNote(s.locationFailed); return }
    setNote(s.locating)
    navigator.geolocation.getCurrentPosition(
      (p) => { setNote(''); store.sendLocation(conv.id, { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }) },
      () => setNote(s.locationFailed),
      { enableHighAccuracy: true, timeout: 12_000 },
    )
  }

  // Pasting a screenshot sends it, as every messenger does.
  function paste(e: React.ClipboardEvent) {
    const fs = [...e.clipboardData.files]
    if (fs.length) { e.preventDefault(); void files(fs) }
  }

  if (readOnly) return <div className="px-4 py-3 text-[0.85rem] text-ink-faint border-t border-[color:var(--line-soft)]" data-testid="composer-readonly">{conv.left ? s.youLeft : s.blockedNote}</div>

  const minWhen = new Date(Date.now() + 60_000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  return (
    <div className="flex-none border-t border-[color:var(--line-soft)] bg-[var(--surface)]" data-testid="composer">
      {(reply || editing) && (
        <div className="flex items-center gap-2 px-3 pt-2" data-testid={editing ? 'composer-editing' : 'composer-reply'}>
          <div className="flex-1 min-w-0 border-s-[3px] border-green-500 ps-2">
            <div className="text-[0.75rem] font-semibold text-green-600">{editing ? s.editing : s.replyingTo(reply!.from === store.me ? s.you : reply!.name)}</div>
            <div className="text-[0.8rem] text-ink-soft truncate" dir="auto">{plain((editing || reply)!.text) || (editing || reply)!.file?.name || ''}</div>
          </div>
          <button type="button" onClick={editing ? () => { onClearEdit(); setText('') } : onClearReply} aria-label={s.cancel} className="grid place-items-center w-7 h-7 rounded-full bg-transparent border-0 cursor-pointer text-ink-soft [&_svg]:w-4 [&_svg]:h-4"><CloseIcon /></button>
        </div>
      )}
      {note && <div className="px-3 pt-1.5 text-[0.78rem] text-ink-soft" data-testid="composer-note">{note}</div>}
      {menu === 'emoji' && (
        <div className="grid grid-cols-10 max-[480px]:grid-cols-8 gap-1 px-3 pt-2" data-testid="emoji-panel">
          {EMOJI.map((e) => <button key={e} type="button" onClick={() => { change(text + e); ta.current?.focus() }} className="h-8 rounded-md bg-transparent border-0 cursor-pointer text-[1.2rem] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]">{e}</button>)}
        </div>
      )}
      {menu === 'attach' && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2" data-testid="attach-menu">
          {[
            { k: 'photo', icon: <ImageIcon />, label: s.photo, run: () => photoIn.current?.click() },
            { k: 'file', icon: <FileIcon />, label: s.file, run: () => fileIn.current?.click() },
            { k: 'poll', icon: <ListIcon />, label: s.poll, run: () => { setMenu(''); onPoll() } },
            { k: 'location', icon: <AddressPinIcon />, label: s.location, run: location },
            { k: 'contact', icon: <UsersIcon />, label: s.contactCard, run: () => { setMenu(''); onContact() } },
          ].map((a) => (
            <button key={a.k} type="button" onClick={a.run} data-testid={`attach-${a.k}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink text-[0.82rem] cursor-pointer [&_svg]:w-4 [&_svg]:h-4">{a.icon}{a.label}</button>
          ))}
        </div>
      )}
      {menu === 'schedule' && (
        <div className="flex flex-wrap items-center gap-2 px-3 pt-2" data-testid="schedule-panel">
          <ClockIcon className="w-4 h-4 text-ink-soft" />
          <input type="datetime-local" min={minWhen} value={when} onChange={(e) => setWhen(e.target.value)} data-testid="schedule-at"
            className="h-9 px-2 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink" />
          <button type="button" disabled={!when || !text.trim()} onClick={() => { const at = new Date(when).getTime(); if (at > Date.now()) send(at) }} data-testid="schedule-send"
            className="h-9 px-3 rounded-md border-0 bg-green-600 text-sand-100 font-semibold cursor-pointer disabled:opacity-40">{s.sendLater}</button>
        </div>
      )}
      <input ref={fileIn} type="file" multiple hidden data-testid="msg-file-input" onChange={(e) => { void files(e.target.files); e.target.value = '' }} />
      {/* No `accept` on purpose: Android's gallery picker hides files in Downloads (#225). */}
      <input ref={photoIn} type="file" multiple hidden data-testid="msg-photo-input" onChange={(e) => { void files(e.target.files); e.target.value = '' }} />
      <div className="flex items-end gap-1.5 p-2">
        <button type="button" onClick={() => setMenu(menu === 'attach' ? '' : 'attach')} aria-label={s.attach} data-testid="composer-attach"
          className={`grid place-items-center w-10 h-10 rounded-full border-0 cursor-pointer text-[1.3rem] ${menu === 'attach' ? 'bg-[color-mix(in_srgb,var(--ink)_10%,transparent)]' : 'bg-transparent'} text-ink-soft`}>＋</button>
        <button type="button" onClick={() => setMenu(menu === 'emoji' ? '' : 'emoji')} aria-label="Emoji" data-testid="composer-emoji"
          className="grid place-items-center w-10 h-10 rounded-full bg-transparent border-0 cursor-pointer text-[1.2rem] max-[420px]:hidden">🙂</button>
        {rec.recording ? (
          <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-lg bg-[color-mix(in_srgb,#d6336c_10%,var(--surface))] text-[0.88rem]" data-testid="composer-recording">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d6336c] animate-pulse" />{s.recording} {Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, '0')}
            <button type="button" onClick={() => void rec.cancel()} className="ms-auto text-[0.8rem] underline bg-transparent border-0 cursor-pointer text-ink-soft">{s.discard}</button>
          </div>
        ) : (
          <textarea
            ref={ta}
            rows={1}
            value={text}
            dir="auto"
            placeholder={s.message}
            data-testid="composer-input"
            onChange={(e) => change(e.target.value)}
            onPaste={paste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && store.settings.enterSends) { e.preventDefault(); send() }
              if (e.key === 'Escape') { if (editing) { onClearEdit(); setText('') } else if (reply) onClearReply() }
              if (e.key === 'ArrowUp' && !text) {
                const mine = store.messages(conv.id).filter((m) => m.from === store.me && m.kind === 'text' && !m.deleted).pop()
                if (mine) { e.preventDefault(); onClearReply(); onEdit(mine) }
              }
            }}
            className="flex-1 min-h-10 max-h-[180px] resize-none rounded-lg border border-[color:var(--line)] bg-[var(--bg)] text-ink px-3 py-2 text-[0.95rem] leading-[1.35] outline-none focus:border-green-500"
          />
        )}
        {text.trim() && !rec.recording ? (
          <>
            <button type="button" onClick={() => setMenu(menu === 'schedule' ? '' : 'schedule')} aria-label={s.sendLater} title={s.sendLater} data-testid="composer-schedule"
              className="grid place-items-center w-9 h-10 rounded-full bg-transparent border-0 cursor-pointer text-ink-soft [&_svg]:w-4 [&_svg]:h-4 max-[420px]:hidden"><ClockIcon /></button>
            <button type="button" onClick={() => send()} aria-label={s.send} data-testid="composer-send"
              className="grid place-items-center w-10 h-10 rounded-full border-0 cursor-pointer bg-green-600 text-sand-100 text-[1.05rem] rtl:-scale-x-100">➤</button>
          </>
        ) : (
          <button type="button" onClick={() => void voice()} aria-label={rec.recording ? s.stopSend : s.voice} data-testid="composer-voice"
            className={`grid place-items-center w-10 h-10 rounded-full border-0 cursor-pointer [&_svg]:w-5 [&_svg]:h-5 ${rec.recording ? 'bg-[#d6336c] text-white' : 'bg-green-600 text-sand-100'}`}>
            {rec.recording ? '➤' : <MicIcon />}
          </button>
        )}
      </div>
      {rec.error && <div className="px-3 pb-2 text-[0.78rem] text-[var(--danger)]">{rec.error}</div>}
    </div>
  )
}

// Start a live session, hand out the link, see who is here, set what they may do,
// and talk. Everything travels browser to browser; the relay only introduces the
// peers to each other.
import { useEffect, useRef, useState } from 'react'
import { Sheet, SheetTitle, Button, Input, Seg, SegButton } from '../ui'
import { OFFICE_STR } from './strings'
import { inviteUrl, type Collab } from './hooks'
import { initials } from './EditorShell'
import type { Role } from '../../lib/collab/session'
import { sendToMessages } from '../../lib/shareIntent'

export function CollabPanel({ locale, collab, tool, title, onClose }: { locale: 'en' | 'ar'; collab: Collab; tool: string; title: string; onClose: () => void }) {
  const s = OFFICE_STR[locale]
  const [role, setRole] = useState<Role>('edit')
  const [copied, setCopied] = useState(false)
  const [text, setText] = useState('')
  const chatEnd = useRef<HTMLDivElement>(null)
  const on = collab.state !== 'off'
  const owner = on && !collab.isGuest
  const link = collab.room && owner ? inviteUrl(tool, collab.room) : ''

  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }) }, [collab.chat.length])
  useEffect(() => { collab.clearUnread() }, [collab.chat.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ }
  }

  return (
    <Sheet onClose={onClose} data-testid="collab-panel">
      <SheetTitle>{s.shareTitle}</SheetTitle>
      {!on && (
        <div className="space-y-3">
          <p className="text-[0.92rem] text-ink-soft">{s.shareIntro}</p>
          <NameField s={s} collab={collab} />
          <div className="flex items-center gap-2 text-[0.88rem]">
            <span>{s.defaultRole}</span>
            <Seg>
              <SegButton active={role === 'edit'} onClick={() => setRole('edit')} data-testid="collab-role-edit">{s.canEdit}</SegButton>
              <SegButton active={role === 'view'} onClick={() => setRole('view')} data-testid="collab-role-view">{s.canView}</SegButton>
            </Seg>
          </div>
          <Button variant="primary" data-testid="collab-start" onClick={() => collab.host(role)}>{s.startShare}</Button>
        </div>
      )}
      {owner && (
        <div className="space-y-2 mb-4">
          <label className="block text-[0.8rem] text-ink-soft">{s.inviteLink}</label>
          <div className="flex gap-2">
            <Input readOnly value={link} data-testid="collab-link" dir="ltr" onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 text-[0.8rem]" />
            <Button onClick={copy} data-testid="collab-copy">{copied ? s.copied : s.copyLink}</Button>
          </div>
          {/* The link as a card in a conversation, opening straight into the session. A
              path, not the full URL: Messages only offers to open links to this site. */}
          <Button data-testid="collab-send-messages" onClick={() => {
            const url = new URL(link)
            if (!sendToMessages(locale, async () => ({ kind: 'doc', doc: { kind: tool, title: title || s.untitled, url: url.pathname + url.search } }))) alert(s.popupBlocked)
          }}>{s.sendLinkMessages}</Button>
        </div>
      )}
      {on && (
        <>
          <h4 className="text-[0.82rem] font-semibold text-ink-soft mt-2 mb-1">{s.people}</h4>
          <ul className="divide-y divide-[color:var(--line-soft)] mb-4" data-testid="collab-roster">
            {collab.roster.map((m) => (
              <li key={m.client} className="flex items-center gap-2 py-2" data-testid="collab-member" data-role={m.role}>
                <span className="grid place-items-center size-7 rounded-full text-[0.7rem] font-bold text-white flex-none" style={{ background: m.color }}>{initials(m.name)}</span>
                <span className="flex-1 min-w-0 truncate text-[0.9rem]" dir="auto">{m.name}{m.client === collab.me && <span className="text-ink-faint"> ({s.you})</span>}</span>
                {m.role === 'owner' ? <span className="text-[0.78rem] text-ink-faint">{s.owner}</span> : owner ? (
                  <>
                    <select aria-label={m.name} data-testid="collab-member-role" value={m.role} onChange={(e) => collab.setRole(m.client, e.target.value as Role)} className="h-8 text-[0.82rem] rounded-sm border border-[color:var(--line)] bg-[var(--surface)]">
                      <option value="edit">{s.canEdit}</option>
                      <option value="view">{s.canView}</option>
                    </select>
                    <button type="button" data-testid="collab-kick" onClick={() => collab.kick(m.client)} className="text-[0.8rem] border-0 bg-transparent text-[color:var(--danger)] cursor-pointer">{s.remove}</button>
                  </>
                ) : <span className="text-[0.78rem] text-ink-faint">{m.role === 'edit' ? s.canEdit : s.canView}</span>}
              </li>
            ))}
          </ul>
          <h4 className="text-[0.82rem] font-semibold text-ink-soft mb-1">{s.chat}</h4>
          <div className="max-h-[220px] overflow-auto rounded-md bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] p-2 space-y-1.5" data-testid="collab-chat">
            {collab.chat.length === 0 && <p className="text-[0.82rem] text-ink-faint">{s.noChat}</p>}
            {collab.chat.map((c, i) => (
              <div key={i} className="text-[0.86rem]" data-testid="collab-chat-line"><b dir="auto">{c.name}</b>: <span dir="auto">{c.text}</span></div>
            ))}
            <div ref={chatEnd} />
          </div>
          <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { collab.sendChat(text.trim()); setText('') } }}>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={s.chatPh} data-testid="collab-chat-input" className="flex-1 min-w-0" dir="auto" />
            <Button type="submit" data-testid="collab-chat-send">↵</Button>
          </form>
          <div className="mt-4">
            <Button data-testid="collab-stop" onClick={() => { collab.end(); onClose() }}>{owner ? s.stopShare : s.close}</Button>
          </div>
        </>
      )}
    </Sheet>
  )
}

export function NameField({ s, collab }: { s: (typeof OFFICE_STR)['en']; collab: Collab }) {
  return (
    <label className="block">
      <span className="block text-[0.8rem] text-ink-soft mb-1">{s.yourName}</span>
      <Input value={collab.name} onChange={(e) => collab.setName(e.target.value.slice(0, 40))} data-testid="collab-name" dir="auto" />
    </label>
  )
}

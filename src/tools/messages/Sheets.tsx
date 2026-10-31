// The dialogs Messages opens: new chat, groups, chat info, settings, polls,
// forwarding, message info.
import { callsHost } from '../calls/host'
import { useEffect, useMemo, useState } from 'react'
import { Sheet, SheetTitle, SheetActions, Button, Input, Check } from '../../components/ui'
import type { ChangeEvent, ReactNode } from 'react'
import type { MessageStore } from './store'
import type { Str } from './strings'
import { deliverySummary, type Conversation, type Member, type Message } from './model'
import { Avatar } from './Bubble'
import { linkThisDevice, getMyCallLink } from '../../lib/callLink'
import { storageEstimate, download } from '../../lib/docStore'
import { CopyIcon, ShareIcon, ShieldIcon, LockIcon, TrashIcon, UserPlusIcon } from '../../components/icons'
import { fmtSize } from './Bubble'

function Toggle({ checked, onChange, children, ...rest }: { checked: boolean; onChange(e: ChangeEvent<HTMLInputElement>): void; children: ReactNode; 'data-testid'?: string }) {
  return <Check><input type="checkbox" checked={checked} onChange={onChange} data-testid={rest['data-testid']} />{children}</Check>
}

export function inviteUrl(store: MessageStore, locale: string): string {
  const p = new URLSearchParams({ add: store.me, n: store.name || '', k: store.pub })
  return `${location.origin}/${locale}${callsHost().messagesBase}?${p}`
}

function Row({ children, onClick, testid, active }: { children: React.ReactNode; onClick?: () => void; testid?: string; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      className={`w-full flex items-center gap-3 px-2 py-2 rounded-md border-0 text-start cursor-pointer text-ink ${active ? 'bg-[color-mix(in_srgb,var(--green-500)_14%,transparent)]' : 'bg-transparent hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]'}`}>
      {children}
    </button>
  )
}

export function NewChatSheet({ store, s, onClose, onOpen, onGroup, onInvite }: { store: MessageStore; s: Str; onClose(): void; onOpen(convId: string): void; onGroup(): void; onInvite(): void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const contacts = store.contacts()
  function addByCode() {
    const c = code.trim().replace(/^.*[?&]add=([a-z0-9]+).*$/i, '$1').toLowerCase()
    if (!/^[a-z0-9]{6,40}$/.test(c) || c === store.me) return
    store.addContact(c, name.trim())
    onOpen(store.ensureDm(c, name.trim()).id)
  }
  return (
    <Sheet onClose={onClose} data-testid="new-chat-sheet">
      <SheetTitle>{s.newChat}</SheetTitle>
      <div className="flex flex-col gap-1">
        <Row onClick={onGroup} testid="new-group"><span className="grid place-items-center w-9 h-9 rounded-full bg-green-600 text-sand-100 [&_svg]:w-4 [&_svg]:h-4"><UserPlusIcon /></span><span className="font-semibold">{s.newGroup}</span></Row>
        <Row onClick={() => onOpen(store.ensureDm(store.me).id)} testid="new-self"><Avatar name="✎" code={store.me} size={36} emoji="📝" /><span className="flex flex-col"><span className="font-semibold">{s.noteToSelf}</span><span className="text-[0.75rem] text-ink-faint">{s.noteToSelfHint}</span></span></Row>
        <Row onClick={onInvite} testid="new-invite"><span className="grid place-items-center w-9 h-9 rounded-full bg-[var(--gold-500)] text-white [&_svg]:w-4 [&_svg]:h-4"><ShareIcon /></span><span className="flex flex-col"><span className="font-semibold">{s.invite}</span><span className="text-[0.75rem] text-ink-faint">{s.inviteLead}</span></span></Row>
      </div>
      <h4 className="text-[0.8rem] font-semibold text-ink-soft uppercase tracking-wide rtl:tracking-normal mt-2">{s.contacts}</h4>
      {contacts.length === 0 ? <p className="text-[0.85rem] text-ink-faint">{s.noContacts}</p> : (
        <div className="flex flex-col gap-0.5" data-testid="contact-list">
          {contacts.map((c) => (
            <Row key={c.code} onClick={() => onOpen(store.ensureDm(c.code, c.name).id)} testid="contact-row">
              <Avatar name={c.name} code={c.code} size={36} online={store.online.has(c.code)} />
              <span className="flex flex-col min-w-0"><span className="font-semibold truncate"><bdi>{c.name || c.code}</bdi></span><span className="text-[0.72rem] text-ink-faint font-mono" dir="ltr">{c.code}</span></span>
            </Row>
          ))}
        </div>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-[0.85rem] font-semibold text-ink-soft" data-testid="add-by-code">{s.addByCode}</summary>
        <div className="flex flex-col gap-2 mt-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={s.code} data-testid="add-code" dir="ltr" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={s.name} data-testid="add-name" />
          <Button variant="primary" onClick={addByCode} data-testid="add-go">{s.messageContact}</Button>
        </div>
      </details>
    </Sheet>
  )
}

export function GroupSheet({ store, s, conv, onClose, onDone }: { store: MessageStore; s: Str; conv?: Conversation; onClose(): void; onDone(id: string): void }) {
  const [title, setTitle] = useState(conv?.title || '')
  const [emoji, setEmoji] = useState(conv?.emoji || '')
  const existing = new Set((conv?.members || []).map((m) => m.code))
  const [picked, setPicked] = useState<Set<string>>(() => new Set([...existing].filter((c) => c !== store.me)))
  const contacts = store.contacts()
  const extra = (conv?.members || []).filter((m) => m.code !== store.me && !contacts.some((c) => c.code === m.code))
  const isOwner = !conv || !conv.owner || conv.owner === store.me
  function toggle(code: string) { const n = new Set(picked); if (n.has(code)) n.delete(code); else n.add(code); setPicked(n) }
  function save() {
    const members: Member[] = [...picked].map((code) => ({ code, name: store.contactName(code) || conv?.members.find((m) => m.code === code)?.name || '' }))
    if (!conv) {
      if (!members.length) return
      const c = store.createGroup(title, members, emoji)
      onDone(c.id)
      return
    }
    if (title !== conv.title || emoji !== (conv.emoji || '')) store.renameGroup(conv.id, title, emoji)
    if (isOwner && (members.length !== conv.members.length - 1 || members.some((m) => !existing.has(m.code)))) store.setMembers(conv.id, members)
    onDone(conv.id)
  }
  return (
    <Sheet onClose={onClose} data-testid="group-sheet">
      <SheetTitle>{conv ? s.convInfo : s.newGroup}</SheetTitle>
      <div className="flex gap-2">
        <Input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 8))} placeholder="🙂" className="w-16 text-center" data-testid="group-emoji" />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={s.groupName} className="flex-1" data-testid="group-name" />
      </div>
      <h4 className="text-[0.8rem] font-semibold text-ink-soft">{s.pickMembers}</h4>
      {contacts.length + extra.length === 0 && <p className="text-[0.85rem] text-ink-faint">{s.noContacts}</p>}
      <div className="flex flex-col gap-1" data-testid="group-members">
        {[...contacts.map((c) => ({ code: c.code, name: c.name })), ...extra].map((c) => (
          <label key={c.code} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] cursor-pointer">
            <input type="checkbox" checked={picked.has(c.code)} disabled={!isOwner} onChange={() => toggle(c.code)} data-testid="group-member-check" data-code={c.code} />
            <Avatar name={c.name} code={c.code} size={32} />
            <span className="flex-1 truncate"><bdi>{c.name || c.code}</bdi></span>
            {conv?.owner === c.code && <span className="text-[0.7rem] text-[var(--gold-500)]">{s.owner}</span>}
          </label>
        ))}
      </div>
      <SheetActions>
        <Button onClick={onClose}>{s.cancel}</Button>
        <Button variant="primary" onClick={save} data-testid="group-save" disabled={!conv && picked.size === 0}>{conv ? s.save : s.createGroup}</Button>
      </SheetActions>
    </Sheet>
  )
}

export function ConvInfoSheet({ store, s, conv, onClose, onEditGroup, onDeleted }: { store: MessageStore; s: Str; conv: Conversation; onClose(): void; onEditGroup(): void; onDeleted(): void }) {
  const peer = conv.kind === 'dm' ? store.peerOf(conv) : ''
  const [safety, setSafety] = useState<string | null>(null)
  useEffect(() => { if (peer) void store.safety(peer).then(setSafety) }, [store, peer])
  const verified = peer && store.verified.has(peer)
  const blocked = peer && store.blocked.has(peer)
  async function exportChat() {
    const t = await store.exportText(conv.id)
    download(new Blob([t], { type: 'text/plain;charset=utf-8' }), `${(store.titleOf(conv) || 'chat').replace(/[\\/:*?"<>|]+/g, ' ')}.txt`)
  }
  return (
    <Sheet onClose={onClose} data-testid="conv-info">
      <SheetTitle>{s.convInfo}</SheetTitle>
      <div className="flex items-center gap-3">
        <Avatar name={store.titleOf(conv) || s.noteToSelf} code={conv.kind === 'dm' ? peer : conv.id} size={56} emoji={conv.kind === 'self' ? '📝' : conv.emoji} />
        <div className="flex flex-col min-w-0">
          <span className="font-display rtl:font-ar text-[1.15rem] font-semibold truncate"><bdi>{store.titleOf(conv) || s.noteToSelf}</bdi></span>
          {peer && <span className="text-[0.75rem] text-ink-faint font-mono" dir="ltr">{peer}</span>}
          {conv.kind === 'group' && <span className="text-[0.8rem] text-ink-soft">{conv.members.length} · {s.members}</span>}
        </div>
      </div>
      {conv.kind === 'dm' && (
        <div className="rounded-md border border-[color:var(--line)] p-3 flex flex-col gap-2" data-testid="security-panel">
          <div className="flex items-center gap-2 font-semibold text-[0.9rem]">{safety ? <LockIcon className="w-4 h-4 text-green-600" /> : <ShieldIcon className="w-4 h-4 text-ink-faint" />}{safety ? s.e2e : s.notE2e}{verified && <span className="text-[0.72rem] text-green-600" data-testid="verified-badge">· {s.verified}</span>}</div>
          <p className="text-[0.8rem] text-ink-soft">{safety ? s.e2eLead : s.notE2eLead}</p>
          {safety && (
            <>
              <div className="text-[0.75rem] text-ink-faint">{s.safetyNumber}</div>
              <div className="font-mono text-[1.05rem] tracking-wider" dir="ltr" data-testid="safety-number">{safety}</div>
              <p className="text-[0.75rem] text-ink-faint">{s.safetyLead}</p>
              <Button onClick={() => void store.setVerified(peer, !verified)} data-testid="verify-toggle">{verified ? s.unverify : s.verify}</Button>
            </>
          )}
        </div>
      )}
      {conv.kind === 'group' && (
        <div className="flex flex-col gap-1" data-testid="group-member-list">
          {conv.members.map((m) => (
            <div key={m.code} className="flex items-center gap-2 py-1">
              <Avatar name={m.name} code={m.code} size={30} online={store.online.has(m.code)} />
              <span className="flex-1 truncate text-[0.9rem]"><bdi>{m.code === store.me ? s.you : store.contactName(m.code) || m.name || m.code}</bdi></span>
              {conv.owner === m.code && <span className="text-[0.7rem] text-[var(--gold-500)]">{s.owner}</span>}
            </div>
          ))}
          {!conv.left && <Button onClick={onEditGroup} data-testid="edit-group">{s.addMembers}</Button>}
        </div>
      )}
      <label className="flex flex-col gap-1 text-[0.85rem]">
        <span className="font-semibold">{s.disappearing}</span>
        <select value={String(conv.disappearMs || 0)} onChange={(e) => store.setDisappear(conv.id, Number(e.target.value))} data-testid="disappear-select"
          className="h-9 px-2 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink">
          {s.disappearOpts.map(([l, v]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <div className="flex flex-col gap-1.5">
        <Toggle checked={!!conv.muted} onChange={(e) => store.setConvFlag(conv.id, { muted: e.target.checked })} data-testid="mute-toggle">{s.mute}</Toggle>
        <Toggle checked={!!conv.pinned} onChange={(e) => store.setConvFlag(conv.id, { pinned: e.target.checked })} data-testid="pin-toggle">{s.pinChat}</Toggle>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void exportChat()} data-testid="export-chat">{s.exportChat}</Button>
        <Button onClick={() => store.setConvFlag(conv.id, { archived: !conv.archived })} data-testid="archive-toggle">{conv.archived ? s.unarchive : s.archive}</Button>
        {peer && <Button onClick={() => void store.block(peer, !blocked)} data-testid="block-toggle">{blocked ? s.unblock : s.block}</Button>}
        {conv.kind === 'group' && !conv.left && <Button onClick={() => { store.leaveGroup(conv.id); onClose() }} data-testid="leave-group">{s.leaveGroup}</Button>}
        <Button onClick={() => { if (confirm(s.confirmClear)) void store.clearConv(conv.id) }} data-testid="clear-chat">{s.clearChat}</Button>
        <Button onClick={() => { if (confirm(s.confirmDelete)) { void store.deleteConv(conv.id); onDeleted() } }} data-testid="delete-chat"><TrashIcon /> {s.deleteChat}</Button>
      </div>
    </Sheet>
  )
}

export function SettingsSheet({ store, s, locale, onClose, onRelisten }: { store: MessageStore; s: Str; locale: string; onClose(): void; onRelisten(): void }) {
  const [name, setName] = useState(store.name)
  const [qr, setQr] = useState('')
  const [note, setNote] = useState('')
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null)
  const [hasLink, setHasLink] = useState(() => !!getMyCallLink())
  const url = inviteUrl(store, locale)
  useEffect(() => { void import('qrcode').then((Q) => Q.toDataURL(url, { margin: 1, width: 220, color: { dark: '#0b3d2e', light: '#ffffff' } })).then(setQr).catch(() => {}) }, [url])
  useEffect(() => { void storageEstimate().then(setEst) }, [])
  async function enableOffline() {
    const code = await linkThisDevice(store.me, store.name || name)
    if (code) { setHasLink(true); await store.adoptCode(code); onRelisten() }
    else setNote(typeof Notification !== 'undefined' && Notification.permission === 'denied' ? s.offlineDenied : s.offlineOff)
  }
  async function backup() { download(await store.exportAll(), `messages-backup-${new Date().toISOString().slice(0, 10)}.json`) }
  async function restore(f: File | undefined) {
    if (!f) return
    const r = await store.importAll(await f.text())
    setNote(r ? s.restored(r.convs, r.msgs) : s.badBackup)
  }
  return (
    <Sheet onClose={onClose} data-testid="msg-settings-sheet">
      <SheetTitle>{s.settings}</SheetTitle>
      <label className="flex flex-col gap-1 text-[0.85rem]">
        <span className="font-semibold">{s.yourName}</span>
        <div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" data-testid="settings-name" />
          <Button onClick={() => void store.setName(name)} data-testid="settings-name-save">{s.save}</Button></div>
      </label>
      <div className="rounded-md border border-[color:var(--line)] p-3 flex flex-col gap-2" data-testid="invite-panel">
        <span className="font-semibold text-[0.9rem]">{s.invite}</span>
        <p className="text-[0.8rem] text-ink-soft">{s.inviteLead}</p>
        {qr && <img src={qr} alt="" width={180} height={180} className="self-center rounded-md" data-testid="invite-qr" />}
        <div className="text-[0.75rem] text-ink-faint">{s.yourAddress}: <span className="font-mono" dir="ltr" data-testid="my-code">{store.me}</span></div>
        <div className="flex gap-2">
          <Button onClick={() => { void navigator.clipboard?.writeText(url); setNote(s.copied) }} data-testid="invite-copy"><CopyIcon /> {s.copyLink}</Button>
          {'share' in navigator && <Button onClick={() => void navigator.share({ url, title: s.title }).catch(() => {})}><ShareIcon /> {s.shareLink}</Button>}
        </div>
        <input readOnly value={url} className="text-[0.7rem] font-mono w-full bg-transparent border-0 text-ink-faint" dir="ltr" data-testid="invite-url" onFocus={(e) => e.currentTarget.select()} />
      </div>
      {callsHost().callMe && <div className="rounded-md border border-[color:var(--line)] p-3 flex flex-col gap-2">
        <span className="font-semibold text-[0.9rem]">{s.offline}</span>
        <p className="text-[0.8rem] text-ink-soft" data-testid="offline-state">{hasLink ? s.offlineOn : s.offlineOff}</p>
        {!hasLink && <Button variant="primary" onClick={() => void enableOffline()} data-testid="offline-enable">{s.offlineEnable}</Button>}
      </div>}
      <div className="flex flex-col gap-1.5">
        <Toggle checked={store.settings.readReceipts} onChange={(e) => void store.setSettings({ readReceipts: e.target.checked })} data-testid="set-read">{s.readReceipts}</Toggle>
        <Toggle checked={store.settings.typing} onChange={(e) => void store.setSettings({ typing: e.target.checked })} data-testid="set-typing">{s.typingIndicators}</Toggle>
        <Toggle checked={store.settings.enterSends} onChange={(e) => void store.setSettings({ enterSends: e.target.checked })} data-testid="set-enter">{s.enterSends}</Toggle>
        <label className="flex items-center gap-2 text-[0.88rem]">{s.autoDownload}
          <select value={store.settings.autoDownloadMb} onChange={(e) => void store.setSettings({ autoDownloadMb: Number(e.target.value) })} className="h-8 px-1 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-ink">
            {[0, 5, 25, 100].map((n) => <option key={n} value={n}>{n} MB</option>)}
          </select></label>
      </div>
      <div className="rounded-md border border-[color:var(--line)] p-3 flex flex-col gap-2">
        <span className="font-semibold text-[0.9rem]">{s.storage}</span>
        {est && <p className="text-[0.8rem] text-ink-soft">{s.storageUsed(fmtSize(est.usage), fmtSize(est.quota))}</p>}
        <p className="text-[0.8rem] text-ink-soft">{s.privacy}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void backup()} data-testid="backup">{s.backup}</Button>
          <label className="inline-flex items-center gap-2 px-[1.15rem] py-[0.7rem] rounded-md border border-[color:var(--line)] bg-[var(--surface)] font-semibold text-[0.95rem] cursor-pointer">
            {s.restore}<input type="file" hidden data-testid="restore-input" onChange={(e) => void restore(e.target.files?.[0])} />
          </label>
        </div>
      </div>
      {note && <p className="text-[0.85rem] text-green-600" data-testid="settings-note">{note}</p>}
    </Sheet>
  )
}

export function PollSheet({ s, onClose, onCreate }: { s: Str; onClose(): void; onCreate(q: string, opts: string[], multi: boolean): void }) {
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState(['', ''])
  const [multi, setMulti] = useState(false)
  const ok = q.trim() && opts.filter((o) => o.trim()).length >= 2
  return (
    <Sheet onClose={onClose} data-testid="poll-sheet">
      <SheetTitle>{s.poll}</SheetTitle>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.pollQuestion} data-testid="poll-q" />
      {opts.map((o, i) => (
        <Input key={i} value={o} placeholder={s.pollOption(i + 1)} data-testid="poll-opt"
          onChange={(e) => { const n = [...opts]; n[i] = e.target.value; if (i === n.length - 1 && e.target.value && n.length < 12) n.push(''); setOpts(n) }} />
      ))}
      <Toggle checked={multi} onChange={(e) => setMulti(e.target.checked)} data-testid="poll-multi">{s.pollMulti}</Toggle>
      <SheetActions>
        <Button onClick={onClose}>{s.cancel}</Button>
        <Button variant="primary" disabled={!ok} onClick={() => onCreate(q.trim(), opts.map((o) => o.trim()).filter(Boolean), multi)} data-testid="poll-create">{s.pollCreate}</Button>
      </SheetActions>
    </Sheet>
  )
}

export function PickConvSheet({ store, s, title, onClose, onPick, exclude }: { store: MessageStore; s: Str; title: string; onClose(): void; onPick(id: string): void; exclude?: string }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => store.list().filter((c) => c.id !== exclude && !c.left && (store.titleOf(c) || s.noteToSelf).toLowerCase().includes(q.toLowerCase())), [store, q, exclude, s])
  return (
    <Sheet onClose={onClose} data-testid="pick-conv-sheet">
      <SheetTitle>{title}</SheetTitle>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.search} />
      <div className="flex flex-col gap-0.5">
        {list.map((c) => (
          <Row key={c.id} onClick={() => onPick(c.id)} testid="pick-conv">
            <Avatar name={store.titleOf(c) || s.noteToSelf} code={c.kind === 'dm' ? store.peerOf(c) : c.id} size={32} emoji={c.kind === 'self' ? '📝' : c.emoji} />
            <span className="truncate"><bdi>{store.titleOf(c) || s.noteToSelf}</bdi></span>
          </Row>
        ))}
      </div>
    </Sheet>
  )
}

export function PickContactSheet({ store, s, onClose, onPick }: { store: MessageStore; s: Str; onClose(): void; onPick(m: Member): void }) {
  const contacts = [{ code: store.me, name: store.name }, ...store.contacts()]
  return (
    <Sheet onClose={onClose} data-testid="pick-contact-sheet">
      <SheetTitle>{s.contactCard}</SheetTitle>
      {contacts.map((c) => (
        <Row key={c.code} onClick={() => onPick({ code: c.code, name: c.name })} testid="pick-contact">
          <Avatar name={c.name} code={c.code} size={32} /><span className="truncate"><bdi>{c.code === store.me ? `${c.name || s.you} (${s.you})` : c.name || c.code}</bdi></span>
        </Row>
      ))}
    </Sheet>
  )
}

export function MsgInfoSheet({ store, s, m, conv, locale, onClose }: { store: MessageStore; s: Str; m: Message; conv: Conversation; locale: string; onClose(): void }) {
  const fmt = (t: number) => new Date(t).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  const rows = Object.entries(m.delivery || {})
  return (
    <Sheet onClose={onClose} data-testid="msg-info-sheet">
      <SheetTitle>{s.info}</SheetTitle>
      <p className="text-[0.85rem] text-ink-soft">{fmt(m.at)}{m.edited ? ` · ${s.edited} ${fmt(m.edited)}` : ''}</p>
      {rows.length > 0 && (
        <div className="flex flex-col gap-1" data-testid="msg-info-rows">
          {rows.map(([code, st]) => (
            <div key={code} className="flex items-center gap-2 py-1" data-testid="msg-info-row" data-state={st}>
              <Avatar name={store.contactName(code)} code={code} size={28} />
              <span className="flex-1 truncate"><bdi>{store.contactName(code) || conv.members.find((x) => x.code === code)?.name || code}</bdi></span>
              <span className="text-[0.78rem] text-ink-soft">{s.ticks[st]}</span>
            </div>
          ))}
        </div>
      )}
      {deliverySummary(m) === 'pushed' && <p className="text-[0.78rem] text-ink-faint">{s.deliveryPushed}</p>}
      {deliverySummary(m) === 'queued' && <p className="text-[0.78rem] text-ink-faint">{s.deliveryWaiting}</p>}
    </Sheet>
  )
}


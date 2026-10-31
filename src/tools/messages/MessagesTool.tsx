// Messages — the companion to Calls. Teams-style conversations, one-to-one and in
// groups, that live in THIS browser and travel device to device.
//
// The shell: a conversation list and a thread side by side on a wide screen, one
// at a time on a phone. All state lives in the MessageStore (IndexedDB) and every
// change re-renders through one subscription, so a message arriving by push in a
// background tab, peer-to-peer in this one, or typed here all show up the same way.
import { callsHost } from '../calls/host'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useLocale } from '../../i18n'
import { STR, type Str } from './strings'
import { getStore, type MessageStore } from './store'
import { MessageTransport } from './transport'
import { Bubble, Avatar, type BubbleActions } from './Bubble'
import { Composer } from './Composer'
import { NewChatSheet, GroupSheet, ConvInfoSheet, SettingsSheet, PollSheet, PickConvSheet, PickContactSheet, MsgInfoSheet } from './Sheets'
import { dayKey, matchesSearch, newId, preview, QUICK_REACTIONS, type Conversation, type Message } from './model'
import { plain } from './format'
import { Button, Input } from '../../components/ui'
import { SearchIcon, CogIcon, EditIcon, PhoneIcon, VideoCallIcon, BackIcon, InfoIcon, ArchiveIcon, BookmarkIcon, LockIcon, CloseIcon } from '../../components/icons'
import { newCallCode } from '../../lib/callLink'
import { takeIntent, type ShareIntent } from '../../lib/shareIntent'

let transport: MessageTransport | null = null
function useMessages(): { store: MessageStore; transport: MessageTransport; v: number } {
  const store = getStore()
  if (!transport) transport = new MessageTransport(store)
  const v = useSyncExternalStore(useCallback((f) => store.subscribe(f), [store]), () => store.version)
  return { store, transport, v }
}

/** Re-render on a timer: typing indicators and "last seen" age without an event. */
function useTick(ms: number) {
  const [, set] = useState(0)
  useEffect(() => { const t = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(t) }, [ms])
}

function ago(t: number, locale: string): string {
  const s = Math.round((Date.now() - t) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' })
  if (s < 60) return rtf.format(-s, 'second')
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute')
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour')
  return rtf.format(-Math.round(s / 86400), 'day')
}

export default function MessagesTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const { store, transport: tx } = useMessages()
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState('')
  const [q, setQ] = useState('')
  const [archived, setArchived] = useState(false)
  const [starredView, setStarredView] = useState(false)
  const [sheet, setSheet] = useState<'' | 'new' | 'group' | 'editGroup' | 'info' | 'settings' | 'poll' | 'forward' | 'contact' | 'msgInfo' | 'invite'>('')
  const [toast, setToast] = useState('')
  const [shareIntent, setShareIntent] = useState<ShareIntent | null>(null)
  const [needName, setNeedName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  useEffect(() => {
    let alive = true
    void store.ready.then(async () => {
      if (!alive) return
      setNeedName(!store.name)
      setNameDraft(store.name)
      await tx.start()
      // Deep links: an invite (?add=), a conversation (?c=), a person (?to=).
      const p = new URLSearchParams(location.search)
      const add = (p.get('add') || '').toLowerCase()
      if (add && /^[a-z0-9]{6,40}$/.test(add) && add !== store.me) {
        const n = (p.get('n') || '').slice(0, 40)
        store.addContact(add, n)
        if (p.get('k')) await store.learnPub(add, p.get('k')!)
        const c = store.ensureDm(add, n)
        setOpen(c.id)
        setToast(s.addedFromLink(n))
        history.replaceState(null, '', location.pathname)
      }
      // Something handed over by another tool (a document, or a live session's link).
      const share = p.get('share')
      if (share) {
        const intent = await takeIntent(share)
        history.replaceState(null, '', location.pathname)
        if (intent) { store.ensureDm(store.me); setShareIntent(intent) } else setToast(s.shareGone)
      }
      const c = p.get('c') || p.get('to')
      if (c) {
        const id = store.convs.has(c) ? c : /^[a-z0-9]{6,40}$/.test(c) && c !== store.me ? store.ensureDm(c).id : ''
        if (id) setOpen(id)
        history.replaceState(null, '', location.pathname)
      }
      setReady(true)
    })
    // The service worker tells a visible tab when a push landed.
    const onSw = (e: MessageEvent) => { if (e.data?.type === 'bis-msg') void tx.drainPushes() }
    navigator.serviceWorker?.addEventListener('message', onSw)
    const onVis = () => { if (document.visibilityState === 'visible') { void tx.drainPushes(); if (store.viewing) store.markRead(store.viewing) } }
    document.addEventListener('visibilitychange', onVis)
    const sweep = setInterval(() => { store.sweep(); store.changed() }, 30_000)
    return () => { alive = false; navigator.serviceWorker?.removeEventListener('message', onSw); document.removeEventListener('visibilitychange', onVis); clearInterval(sweep) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Notifications for messages that arrive while this tab is hidden (P2P, so no push banner).
  useEffect(() => {
    store.onIncoming = (conv, m, mentioned) => {
      if ((conv.muted && !mentioned) || !store.settings.notifications) return
      if (document.visibilityState === 'visible' && store.viewing === conv.id) return
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || document.visibilityState === 'visible') return
      try {
        const n = new Notification(conv.kind === 'group' ? `${m.name} · ${conv.title}` : m.name || store.titleOf(conv), { body: preview({ ...m, name: '' }), tag: `msg-${conv.id}`, icon: '/icon.svg' })
        n.onclick = () => { window.focus(); setOpen(conv.id) }
      } catch { /* */ }
    }
  }, [store])

  // Unread count in the tab title.
  useEffect(() => {
    const n = store.unreadTotal()
    const base = document.title.replace(/^\(\d+\) /, '')
    document.title = n ? `(${n}) ${base}` : base
  })

  useEffect(() => {
    if (!ready) return
    if (open) {
      void store.view(open)
      const c = store.convs.get(open)
      if (c) for (const m of c.members) if (m.code !== store.me) tx.wantPeer(m.code, 10 * 60_000)
    } else store.unview()
  }, [open, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t) } }, [toast])

  const conv = open ? store.convs.get(open) : undefined
  const list = store.list().filter((c) => !!c.archived === archived)
  const hits = useMemo(() => {
    if (!q.trim()) return [] as Message[]
    const out: Message[] = []
    for (const c of store.convs.values()) for (const m of store.messages(c.id)) if (!m.deleted && m.kind !== 'system' && matchesSearch(m, q)) out.push(m)
    return out.slice(-50).reverse()
  }, [q, store, store.version]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = q.trim() ? list.filter((c) => (store.titleOf(c) || s.noteToSelf).toLowerCase().includes(q.toLowerCase())) : list

  if (ready && needName) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-3 p-6 rounded-lg border border-[color:var(--line)] bg-[var(--surface)]" data-testid="messages-setup">
        <h2 className="font-display rtl:font-ar text-[1.4rem] font-semibold">{s.setupTitle}</h2>
        <p className="text-ink-soft text-[0.9rem]">{s.setupLead}</p>
        <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder={s.yourName} data-testid="msg-setup-name" autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && nameDraft.trim()) { void store.setName(nameDraft); setNeedName(false) } }} />
        <Button variant="primary" disabled={!nameDraft.trim()} onClick={() => { void store.setName(nameDraft); setNeedName(false) }} data-testid="msg-setup-start">{s.start}</Button>
        <p className="text-[0.78rem] text-ink-faint flex items-center gap-1.5"><LockIcon className="w-3.5 h-3.5" /> {s.privacy}</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-[min(82dvh,860px)] min-h-[560px] rounded-lg border border-[color:var(--line)] overflow-hidden bg-[var(--bg)] shadow-[var(--shadow-sm)]" data-testid="messages-app" data-ready={ready ? '1' : '0'} data-me={store.me}>
      <aside className={`flex flex-col w-[340px] max-[760px]:w-full border-e border-[color:var(--line-soft)] bg-[var(--surface)] ${open ? 'max-[760px]:hidden' : ''}`} data-testid="conv-pane">
        <div className="flex items-center gap-1 px-3 pt-3 pb-2">
          <h2 className="flex-1 font-display rtl:font-ar text-[1.3rem] font-semibold">{archived ? s.archived : starredView ? s.starredTitle : s.title}</h2>
          <IconBtn label={s.starredTitle} onClick={() => { setStarredView(!starredView); setArchived(false) }} testid="starred-toggle" active={starredView}><BookmarkIcon /></IconBtn>
          <IconBtn label={archived ? s.hideArchived : s.showArchived} onClick={() => { setArchived(!archived); setStarredView(false) }} testid="archived-toggle" active={archived}><ArchiveIcon /></IconBtn>
          <IconBtn label={s.settings} onClick={() => setSheet('settings')} testid="msg-settings"><CogIcon /></IconBtn>
          <IconBtn label={s.newChat} onClick={() => setSheet('new')} testid="msg-new" primary><EditIcon /></IconBtn>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 h-9 px-2.5 rounded-md bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]">
            <SearchIcon className="w-4 h-4 text-ink-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.search} className="flex-1 bg-transparent border-0 outline-none text-ink text-[0.9rem]" data-testid="msg-search" />
            {q && <button type="button" onClick={() => setQ('')} className="bg-transparent border-0 cursor-pointer text-ink-faint" aria-label={s.cancel}>✕</button>}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto" data-testid="conv-list">
          {starredView ? <StarredList store={store} s={s} onOpen={(c, id) => { setOpen(c); setTimeout(() => jumpTo(id), 120) }} /> : (
            <>
              {shown.length === 0 && !q && (
                <div className="p-5 text-center flex flex-col items-center gap-2" data-testid="conv-empty">
                  <span className="text-[2rem]">💬</span>
                  <p className="font-semibold">{s.empty}</p>
                  <p className="text-[0.83rem] text-ink-soft">{s.emptyLead}</p>
                  <Button variant="primary" onClick={() => setSheet('new')} data-testid="conv-empty-new">{s.newChat}</Button>
                </div>
              )}
              {shown.map((c) => <ConvRow key={c.id} c={c} store={store} s={s} locale={locale} active={c.id === open} onClick={() => setOpen(c.id)} />)}
              {hits.length > 0 && (
                <div className="border-t border-[color:var(--line-soft)] mt-1 pt-1" data-testid="search-hits">
                  <div className="px-3 py-1 text-[0.72rem] font-semibold text-ink-faint">{s.results(hits.length)}</div>
                  {hits.map((m) => {
                    const c = store.convs.get(m.conv)
                    return (
                      <button key={m.id} type="button" onClick={() => { setOpen(m.conv); setTimeout(() => jumpTo(m.id), 150) }} data-testid="search-hit"
                        className="w-full text-start px-3 py-2 bg-transparent border-0 cursor-pointer hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]">
                        <div className="text-[0.75rem] text-ink-faint truncate"><bdi>{c ? store.titleOf(c) || s.noteToSelf : ''}</bdi> · {m.from === store.me ? s.you : m.name}</div>
                        <div className="text-[0.85rem] truncate" dir="auto">{plain(m.text) || preview({ ...m, name: '' })}</div>
                      </button>
                    )
                  })}
                </div>
              )}
              {q && !shown.length && !hits.length && <p className="p-4 text-ink-faint text-[0.85rem]" data-testid="search-none">{s.noResults}</p>}
            </>
          )}
        </div>
      </aside>
      <main className={`flex-1 min-w-0 flex flex-col ${open ? '' : 'max-[760px]:hidden'}`}>
        {conv ? (
          <Thread key={conv.id} conv={conv} store={store} s={s} locale={locale} tx={tx}
            onBack={() => setOpen('')} onInfo={() => setSheet('info')} onToast={setToast} onOpenConv={setOpen} />
        ) : (
          <div className="flex-1 grid place-items-center text-center p-8" data-testid="thread-placeholder">
            <div className="flex flex-col items-center gap-2 max-w-sm">
              <LockIcon className="w-8 h-8 text-ink-faint" />
              <p className="text-ink-soft text-[0.9rem]">{s.e2eLead}</p>
            </div>
          </div>
        )}
      </main>

      {shareIntent && (
        <PickConvSheet store={store} s={s} title={s.sendTo} onClose={() => setShareIntent(null)} onPick={(id) => {
          const it = shareIntent
          setShareIntent(null)
          if (it.kind === 'doc') store.sendDoc(id, it.doc)
          else void store.sendFile(id, new File([it.blob], it.name, { type: it.blob.type }))
          const c = store.convs.get(id)
          setToast(s.shareSent(c ? store.titleOf(c) || s.noteToSelf : ''))
          setOpen(id)
        }} />
      )}
      {sheet === 'new' && <NewChatSheet store={store} s={s} onClose={() => setSheet('')} onOpen={(id) => { setSheet(''); setOpen(id) }} onGroup={() => setSheet('group')} onInvite={() => setSheet('settings')} />}
      {sheet === 'group' && <GroupSheet store={store} s={s} onClose={() => setSheet('')} onDone={(id) => { setSheet(''); setOpen(id) }} />}
      {sheet === 'editGroup' && conv && <GroupSheet store={store} s={s} conv={conv} onClose={() => setSheet('')} onDone={() => setSheet('info')} />}
      {sheet === 'info' && conv && <ConvInfoSheet store={store} s={s} conv={conv} onClose={() => setSheet('')} onEditGroup={() => setSheet('editGroup')} onDeleted={() => { setSheet(''); setOpen('') }} />}
      {sheet === 'settings' && <SettingsSheet store={store} s={s} locale={locale} onClose={() => setSheet('')} onRelisten={() => tx.relisten()} />}
      {toast && <div className="absolute bottom-20 inset-x-0 mx-auto w-fit max-w-[90%] px-4 py-2 rounded-md bg-ink text-sand-100 text-[0.85rem] shadow-[var(--shadow-lg)] z-30" data-testid="msg-toast" role="status">{toast}</div>}
    </div>
  )
}

function jumpTo(id: string) {
  const el = document.getElementById(`msg-${id}`)
  if (!el) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.animate?.([{ background: 'color-mix(in srgb, var(--gold-400) 35%, transparent)' }, { background: 'transparent' }], { duration: 1400 })
}

function IconBtn({ children, label, onClick, testid, primary, active }: { children: React.ReactNode; label: string; onClick(): void; testid?: string; primary?: boolean; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} data-testid={testid} aria-pressed={active}
      className={`grid place-items-center w-9 h-9 rounded-full border-0 cursor-pointer [&_svg]:w-[18px] [&_svg]:h-[18px] ${primary ? 'bg-green-600 text-sand-100' : active ? 'bg-[color-mix(in_srgb,var(--green-500)_16%,transparent)] text-green-600' : 'bg-transparent text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]'}`}>
      {children}
    </button>
  )
}

function ConvRow({ c, store, s, locale, active, onClick }: { c: Conversation; store: MessageStore; s: Str; locale: string; active: boolean; onClick(): void }) {
  const title = store.titleOf(c) || s.noteToSelf
  const peer = c.kind === 'dm' ? store.peerOf(c) : ''
  const typing = store.typingIn(c.id)
  const t = c.lastAt ? new Date(c.lastAt) : null
  const when = t ? (Date.now() - t.getTime() < 86400_000 ? t.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : t.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'short' })) : ''
  return (
    <button type="button" onClick={onClick} data-testid="conv-row" data-conv={c.id} data-unread={c.unread || 0}
      className={`w-full flex items-center gap-3 px-3 py-2.5 border-0 text-start cursor-pointer text-ink ${active ? 'bg-[color-mix(in_srgb,var(--green-500)_13%,transparent)]' : 'bg-transparent hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]'}`}>
      <Avatar name={title} code={peer || c.id} size={44} emoji={c.kind === 'self' ? '📝' : c.emoji} online={!!peer && store.online.has(peer)} />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="flex items-center gap-1.5">
          <span className="flex-1 truncate font-semibold text-[0.94rem]" data-testid="conv-title"><bdi>{title}</bdi></span>
          {c.pinned && <span className="text-[0.75rem]" aria-label={s.pinned}>📌</span>}
          {c.muted && <span className="text-[0.75rem]" aria-label={s.mute}>🔕</span>}
          <span className={`text-[0.7rem] ${c.unread ? 'text-green-600 font-semibold' : 'text-ink-faint'}`}>{when}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`flex-1 truncate text-[0.82rem] ${typing.length ? 'text-green-600 italic' : 'text-ink-soft'}`} dir="auto" data-testid="conv-preview">{typing.length ? s.typing : c.lastPreview || ''}</span>
          {c.unread > 0 && <span className={`min-w-5 h-5 px-1.5 grid place-items-center rounded-full text-[0.68rem] font-bold text-white ${c.muted ? 'bg-ink-faint' : 'bg-green-600'}`} data-testid="conv-unread">{c.unread > 99 ? '99+' : c.unread}</span>}
        </span>
      </span>
    </button>
  )
}

function StarredList({ store, s, onOpen }: { store: MessageStore; s: Str; onOpen(conv: string, id: string): void }) {
  const list = store.starred()
  if (!list.length) return <p className="p-4 text-[0.85rem] text-ink-faint" data-testid="starred-empty">{s.noStarred}</p>
  return (
    <div data-testid="starred-list">
      {list.map((m) => {
        const c = store.convs.get(m.conv)
        return (
          <button key={m.id} type="button" onClick={() => onOpen(m.conv, m.id)} data-testid="starred-row" className="w-full text-start px-3 py-2 bg-transparent border-0 cursor-pointer hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]">
            <div className="text-[0.72rem] text-ink-faint"><bdi>{c ? store.titleOf(c) || s.noteToSelf : ''}</bdi></div>
            <div className="text-[0.86rem] truncate" dir="auto">{plain(m.text) || preview({ ...m, name: '' })}</div>
          </button>
        )
      })}
    </div>
  )
}

function Thread({ conv, store, s, locale, tx, onBack, onInfo, onToast, onOpenConv }: {
  conv: Conversation; store: MessageStore; s: Str; locale: string; tx: MessageTransport
  onBack(): void; onInfo(): void; onToast(t: string): void; onOpenConv(id: string): void
}) {
  useTick(2000)
  const [reply, setReply] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const [menu, setMenu] = useState<{ m: Message; x: number; y: number } | null>(null)
  const [local, setLocal] = useState<'' | 'poll' | 'forward' | 'contact' | 'msgInfo'>('')
  const [target, setTarget] = useState<Message | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [find, setFind] = useState('')
  const [image, setImage] = useState<{ url: string; name: string } | null>(null)
  const [drag, setDrag] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const scroller = useRef<HTMLDivElement>(null)
  const msgs = store.messages(conv.id)
  const peer = conv.kind === 'dm' ? store.peerOf(conv) : ''
  const title = store.titleOf(conv) || s.noteToSelf
  const names = useMemo(() => new Map(conv.members.map((m) => [(m.code === store.me ? store.name : m.name).toLowerCase(), m.code] as [string, string]).filter(([n]) => n)), [conv.members, store.me, store.name])
  const typing = store.typingIn(conv.id)
  const blocked = !!peer && store.blocked.has(peer)
  const readOnly = !!conv.left || blocked
  const pins = (conv.pins || []).map((id) => msgs.find((m) => m.id === id)).filter(Boolean) as Message[]
  const findHits = find.trim() ? msgs.filter((m) => matchesSearch(m, find)) : []
  const unknown = conv.kind === 'dm' && !store.isContact(peer)

  // Stick to the bottom while new messages arrive, unless the reader scrolled up.
  useEffect(() => {
    const el = scroller.current
    if (el && atBottom) el.scrollTop = el.scrollHeight
  }, [msgs.length, atBottom, typing.length])
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight }, [])

  const status = (() => {
    if (conv.kind === 'self') return s.noteToSelfHint
    if (typing.length) return conv.kind === 'group' ? s.typingMany(typing.map((c) => store.contactName(c) || conv.members.find((x) => x.code === c)?.name || '').filter(Boolean).join(', ')) : s.typing
    if (conv.kind === 'group') return conv.members.map((m) => (m.code === store.me ? s.you : store.contactName(m.code) || m.name)).join(', ')
    if (store.online.has(peer)) return s.online
    const seen = store.lastSeen.get(peer)
    return seen ? s.lastSeen(ago(seen, locale)) : s.notConnected
  })()

  const actions: BubbleActions = {
    reply: (m) => { setEditing(null); setReply(m) },
    menu: (m, el) => { const r = el.getBoundingClientRect(); setMenu({ m, x: r.left, y: r.bottom }) },
    react: (m, e) => store.react(conv.id, m.id, e),
    vote: (m, o) => store.vote(conv.id, m.id, o),
    fetch: (m) => { if (m.file) tx.fetchFile(m.file.id, store.sourcesFor(conv.id, m.id)) },
    openImage: (url, name) => setImage({ url, name }),
    addContact: (code, name) => { store.addContact(code, name); onToast(s.addedFromLink(name)) },
    messageContact: (code, name) => onOpenConv(store.ensureDm(code, name).id),
    jump: jumpTo,
  }

  function call(video: boolean) {
    if (conv.kind === 'dm') {
      // A one-to-one call is the Calls "call me" link: it rings their devices.
      location.assign(`/call/?c=${encodeURIComponent(peer)}&n=${encodeURIComponent(title)}${video ? '&v=1' : ''}`)
      return
    }
    // A group call is a room: post the invitation, then host it.
    const room = 'g' + newCallCode()
    store.sendCall(conv.id, room, video)
    location.assign(`/${locale}${callsHost().base}/join?code=${room}&host=1`)
  }

  let lastDay = ''
  let lastFrom = ''
  const firstUnread = msgs.find((m) => m.from !== store.me && !m.readAt)

  return (
    <div className="relative flex-1 min-h-0 flex flex-col" data-testid="thread" data-conv={conv.id}
      onDragOver={(e) => { if (!readOnly && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true) } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false) }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (readOnly) return; for (const f of Array.from(e.dataTransfer.files)) void store.sendFile(conv.id, f) }}>
      <header className="flex-none flex items-center gap-2 px-2 py-2 border-b border-[color:var(--line-soft)] bg-[var(--surface)]">
        <button type="button" onClick={onBack} aria-label={s.close} className="hidden max-[760px]:grid place-items-center w-9 h-9 rounded-full bg-transparent border-0 cursor-pointer text-ink-soft [&_svg]:w-5 [&_svg]:h-5 rtl:-scale-x-100" data-testid="thread-back"><BackIcon /></button>
        <button type="button" onClick={onInfo} className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-0 cursor-pointer text-start p-0 text-ink" data-testid="thread-head">
          <Avatar name={title} code={peer || conv.id} size={38} emoji={conv.kind === 'self' ? '📝' : conv.emoji} online={!!peer && store.online.has(peer)} />
          <span className="min-w-0 flex flex-col">
            <span className="font-semibold truncate flex items-center gap-1.5" data-testid="thread-title"><bdi>{title}</bdi>{peer && store.verified.has(peer) && <LockIcon className="w-3.5 h-3.5 text-green-600" />}</span>
            <span className={`text-[0.75rem] truncate ${typing.length ? 'text-green-600' : 'text-ink-faint'}`} data-testid="thread-status" dir="auto">{status}</span>
          </span>
        </button>
        {conv.kind !== 'self' && !readOnly && (
          <>
            <IconBtn label={conv.kind === 'group' ? s.groupCall : s.callVideo} onClick={() => call(true)} testid="thread-video"><VideoCallIcon /></IconBtn>
            <IconBtn label={conv.kind === 'group' ? s.groupCall : s.callAudio} onClick={() => call(false)} testid="thread-call"><PhoneIcon /></IconBtn>
          </>
        )}
        <IconBtn label={s.searchInChat} onClick={() => setFindOpen(!findOpen)} testid="thread-find" active={findOpen}><SearchIcon /></IconBtn>
        <IconBtn label={s.convInfo} onClick={onInfo} testid="thread-info"><InfoIcon /></IconBtn>
      </header>
      {findOpen && (
        <div className="flex-none flex items-center gap-2 px-3 py-1.5 border-b border-[color:var(--line-soft)] bg-[var(--surface)]">
          <input autoFocus value={find} onChange={(e) => setFind(e.target.value)} placeholder={s.searchInChat} data-testid="thread-find-input" className="flex-1 h-8 px-2 rounded-md border border-[color:var(--line)] bg-[var(--bg)] text-ink" />
          <span className="text-[0.75rem] text-ink-faint" data-testid="thread-find-count">{find ? s.results(findHits.length) : ''}</span>
          {findHits.length > 0 && <button type="button" onClick={() => jumpTo(findHits[findHits.length - 1].id)} className="text-[0.78rem] bg-transparent border-0 underline cursor-pointer">↓</button>}
        </div>
      )}
      {pins.length > 0 && (
        <button type="button" onClick={() => jumpTo(pins[pins.length - 1].id)} data-testid="pinned-bar"
          className="flex-none flex items-center gap-2 px-3 py-1.5 border-0 border-b border-[color:var(--line-soft)] bg-[color-mix(in_srgb,var(--gold-400)_12%,var(--surface))] text-start cursor-pointer text-ink">
          <span>📌</span><span className="flex-1 min-w-0 truncate text-[0.82rem]" dir="auto">{plain(pins[pins.length - 1].text) || preview({ ...pins[pins.length - 1], name: '' })}</span>
          {pins.length > 1 && <span className="text-[0.7rem] text-ink-faint">{pins.length}</span>}
        </button>
      )}
      {unknown && msgs.some((m) => m.from === peer) && (
        <div className="flex-none flex flex-wrap items-center gap-2 px-3 py-2 bg-[color-mix(in_srgb,var(--gold-400)_14%,var(--surface))] text-[0.82rem]" data-testid="unknown-banner">
          <span className="flex-1">{s.unknownSender}</span>
          <Button onClick={() => store.addContact(peer, title)} data-testid="unknown-add">{s.addContact}</Button>
          <Button onClick={() => void store.block(peer, true)} data-testid="unknown-block">{s.block}</Button>
        </div>
      )}
      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-1 bg-[color-mix(in_srgb,var(--sand-100)_45%,var(--bg))]" data-testid="msg-list"
        onScroll={(e) => { const el = e.currentTarget; setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80) }}>
        {msgs.length === 0 && <div className="m-auto text-center text-[0.85rem] text-ink-faint max-w-xs flex flex-col items-center gap-2" data-testid="thread-empty"><LockIcon className="w-6 h-6" />{conv.kind === 'self' ? s.noteToSelfHint : s.e2eLead}</div>}
        {msgs.map((m) => {
          const day = dayKey(m.at, Date.now())
          const sep = day !== lastDay
          lastDay = day
          const showName = sep || lastFrom !== m.from
          lastFrom = m.from
          const label = day === 'today' ? s.today : day === 'yesterday' ? s.yesterday : new Date(m.at).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
          return (
            <div key={m.id} className="contents">
              {sep && <div className="self-center text-[0.72rem] font-semibold text-ink-soft bg-[var(--surface)] rounded-full px-3 py-0.5 my-2 shadow-[var(--shadow-sm)]" data-testid="day-sep">{label}</div>}
              {firstUnread?.id === m.id && <div className="self-stretch text-center text-[0.72rem] font-semibold text-green-600 border-t border-green-500/40 pt-1 my-1" data-testid="unread-marker">{s.unreadMarker}</div>}
              <Bubble m={m} conv={conv} store={store} s={s} mine={m.from === store.me} names={names} group={conv.kind === 'group'} showName={showName} highlight={find || undefined} actions={actions} locale={locale} />
            </div>
          )
        })}
        {typing.length > 0 && <div className="self-start rounded-lg bg-[var(--surface)] px-3 py-2 text-[0.85rem] text-ink-faint shadow-[var(--shadow-sm)]" data-testid="typing-bubble"><span className="inline-flex gap-1"><Dot /><Dot d={150} /><Dot d={300} /></span></div>}
      </div>
      {!atBottom && <button type="button" onClick={() => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) }} aria-label={s.jumpLatest} data-testid="jump-latest"
        className="absolute end-4 bottom-24 w-10 h-10 rounded-full bg-[var(--surface)] border border-[color:var(--line)] shadow-[var(--shadow-md)] cursor-pointer text-ink">↓{conv.unread ? <span className="absolute -top-1 -end-1 min-w-4 h-4 px-1 rounded-full bg-green-600 text-white text-[0.6rem] grid place-items-center">{conv.unread}</span> : null}</button>}
      <ScheduledBar store={store} conv={conv} s={s} locale={locale} />
      <Composer conv={conv} store={store} s={s} reply={reply} editing={editing} readOnly={readOnly}
        onClearReply={() => setReply(null)} onClearEdit={() => setEditing(null)} onPoll={() => setLocal('poll')} onContact={() => setLocal('contact')} onEdit={(m) => setEditing(m)} />
      {drag && <div className="absolute inset-0 z-20 grid place-items-center bg-[color-mix(in_srgb,var(--green-600)_20%,transparent)] border-4 border-dashed border-green-500 text-green-700 font-semibold text-[1.1rem] pointer-events-none" data-testid="drop-zone">{s.dropHere}</div>}
      {menu && <MsgMenu store={store} s={s} conv={conv} m={menu.m} x={menu.x} y={menu.y} onClose={() => setMenu(null)}
        onReply={() => { setEditing(null); setReply(menu.m) }} onEdit={() => { setReply(null); setEditing(menu.m) }}
        onForward={() => { setTarget(menu.m); setLocal('forward') }} onInfo={() => { setTarget(menu.m); setLocal('msgInfo') }} onToast={onToast} />}
      {local === 'poll' && <PollSheet s={s} onClose={() => setLocal('')} onCreate={(q, opts, multi) => { store.sendPoll(conv.id, { q, multi, options: opts.map((t) => ({ id: newId('o'), text: t })) }); setLocal('') }} />}
      {local === 'forward' && target && <PickConvSheet store={store} s={s} title={s.forwardTo} exclude={conv.id} onClose={() => setLocal('')} onPick={(id) => { void store.forward(conv.id, [target.id], id); setLocal(''); onOpenConv(id) }} />}
      {local === 'contact' && <PickContactSheet store={store} s={s} onClose={() => setLocal('')} onPick={(m) => { store.sendContactCard(conv.id, m); setLocal('') }} />}
      {local === 'msgInfo' && target && <MsgInfoSheet store={store} s={s} m={store.message(conv.id, target.id) || target} conv={conv} locale={locale} onClose={() => setLocal('')} />}
      {image && (
        <div className="fixed inset-0 z-[90] bg-black/85 grid place-items-center p-4" onClick={() => setImage(null)} data-testid="image-viewer" role="dialog">
          <img src={image.url} alt={image.name} className="max-w-full max-h-[85dvh] object-contain" />
          <div className="absolute top-3 end-3 flex gap-2">
            <a href={image.url} download={image.name} onClick={(e) => e.stopPropagation()} className="px-3 py-1.5 rounded-md bg-white/15 text-white no-underline text-[0.85rem]">{s.download}</a>
            <button type="button" onClick={() => setImage(null)} aria-label={s.close} className="grid place-items-center w-9 h-9 rounded-full bg-white/15 border-0 text-white cursor-pointer [&_svg]:w-5 [&_svg]:h-5"><CloseIcon /></button>
          </div>
        </div>
      )}
    </div>
  )
}

function Dot({ d = 0 }: { d?: number }) { return <span className="w-1.5 h-1.5 rounded-full bg-ink-faint animate-bounce" style={{ animationDelay: `${d}ms` }} /> }

function ScheduledBar({ store, conv, s, locale }: { store: MessageStore; conv: Conversation; s: Str; locale: string }) {
  const items = store.scheduled().filter((o) => o.env.conv === conv.id)
  const seen = new Set<string>()
  const uniq = items.filter((o) => (seen.has(o.env.eid) ? false : (seen.add(o.env.eid), true)))
  if (!uniq.length) return null
  return (
    <div className="flex-none flex flex-col gap-1 px-3 py-1.5 border-t border-[color:var(--line-soft)] bg-[var(--surface)]" data-testid="scheduled-bar">
      {uniq.map((o) => (
        <div key={o.key} className="flex items-center gap-2 text-[0.8rem]" data-testid="scheduled-item">
          <span>🕒</span>
          <span className="flex-1 min-w-0 truncate" dir="auto">{o.env.type === 'msg' ? plain(o.env.msg.text) : ''}</span>
          <span className="text-ink-faint">{s.scheduledFor(new Date(o.sendAt!).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }))}</span>
          <button type="button" onClick={() => store.cancelScheduled(o.key)} className="bg-transparent border-0 underline cursor-pointer text-ink-soft" data-testid="scheduled-cancel">{s.cancelScheduled}</button>
        </div>
      ))}
    </div>
  )
}

function MsgMenu({ store, s, conv, m, x, y, onClose, onReply, onEdit, onForward, onInfo, onToast }: {
  store: MessageStore; s: Str; conv: Conversation; m: Message; x: number; y: number
  onClose(): void; onReply(): void; onEdit(): void; onForward(): void; onInfo(): void; onToast(t: string): void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ left: Math.max(8, Math.min(x, innerWidth - r.width - 8)), top: y + r.height > innerHeight - 8 ? Math.max(8, y - r.height - 40) : y })
  }, [x, y])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  const mine = m.from === store.me
  const pinned = (conv.pins || []).includes(m.id)
  const item = (label: string, run: () => void, testid: string, danger = false) => (
    <button type="button" onClick={() => { run(); onClose() }} data-testid={testid}
      className={`w-full text-start px-3 py-2 bg-transparent border-0 cursor-pointer text-[0.88rem] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] ${danger ? 'text-[var(--danger)]' : 'text-ink'}`}>{label}</button>
  )
  return (
    <div className="fixed inset-0 z-[85]" onClick={onClose}>
      <div ref={ref} className="fixed min-w-[200px] rounded-lg bg-[var(--surface)] border border-[color:var(--line)] shadow-[var(--shadow-lg)] py-1 overflow-hidden" style={pos} onClick={(e) => e.stopPropagation()} data-testid="msg-menu" role="menu">
        <div className="flex gap-1 px-2 py-1.5 border-b border-[color:var(--line-soft)]" data-testid="menu-reactions">
          {QUICK_REACTIONS.map((e) => <button key={e} type="button" onClick={() => { store.react(conv.id, m.id, e); onClose() }} data-testid="menu-react" data-emoji={e} className="w-8 h-8 rounded-full bg-transparent border-0 cursor-pointer text-[1.15rem] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]">{e}</button>)}
        </div>
        {item(s.reply, onReply, 'menu-reply')}
        {m.kind === 'text' && item(s.copy, () => { void navigator.clipboard?.writeText(m.text); onToast(s.copied) }, 'menu-copy')}
        {mine && m.kind === 'text' && Date.now() - m.at < 24 * 3600_000 && item(s.edit, onEdit, 'menu-edit')}
        {item(s.forward, onForward, 'menu-forward')}
        {item(m.starred ? s.unstar : s.star, () => store.star(conv.id, m.id), 'menu-star')}
        {conv.kind !== 'self' && item(pinned ? s.unpin : s.pin, () => store.pin(conv.id, m.id), 'menu-pin')}
        {m.kind === 'poll' && mine && !m.poll?.closed && item(s.pollClose, () => store.closePoll(conv.id, m.id), 'menu-poll-close')}
        {mine && conv.kind !== 'self' && item(s.info, onInfo, 'menu-info')}
        {item(s.deleteForMe, () => void store.deleteForMe(conv.id, m.id), 'menu-delete-me', true)}
        {mine && conv.kind !== 'self' && item(s.deleteForEveryone, () => store.deleteForEveryone(conv.id, m.id), 'menu-delete-all', true)}
      </div>
    </div>
  )
}


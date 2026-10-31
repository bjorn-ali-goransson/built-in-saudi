// One message in a thread.
import { callsHost } from '../calls/host'
import { useEffect, useState, type ReactNode } from 'react'
import { RichText } from './RichText'
import { isJumboEmoji } from './format'
import { deliverySummary, fmtDur, tally, QUICK_REACTIONS, type Message, type Conversation } from './model'
import type { MessageStore } from './store'
import type { Str } from './strings'
import { FileIcon, MicIcon, PhoneIcon, VideoCallIcon, AddressPinIcon, CheckIcon, ClockIcon, DownloadIcon, BookmarkIcon } from '../../components/icons'

export function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`
  return `${(n / 1073741824).toFixed(2)} GB`
}

export function useBlobUrl(store: MessageStore, id: string | undefined, have: boolean | undefined): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!id || !have) { setUrl(''); return }
    let alive = true
    let made = ''
    void store.getBlob(id).then((b) => { if (b && alive) { made = URL.createObjectURL(b); setUrl(made) } })
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [store, id, have])
  return url
}

function Ticks({ m, s }: { m: Message; s: Str }) {
  const d = deliverySummary(m)
  if (!d) return null
  const label = s.ticks[d]
  if (d === 'queued') return <span title={label} aria-label={label} data-tick="queued" className="inline-flex"><ClockIcon className="w-3 h-3" /></span>
  const two = d !== 'pushed'
  return (
    <span title={label} aria-label={label} data-tick={d} className={`inline-flex items-center ${d === 'read' ? 'text-[#7fd8ff]' : ''}`}>
      <CheckIcon className="w-3.5 h-3.5" />
      {two && <CheckIcon className="w-3.5 h-3.5 -ms-2" />}
    </span>
  )
}

export interface BubbleActions {
  reply(m: Message): void
  menu(m: Message, anchor: HTMLElement): void
  react(m: Message, emoji: string): void
  vote(m: Message, opt: string): void
  fetch(m: Message): void
  openImage(url: string, name: string): void
  addContact(code: string, name: string): void
  messageContact(code: string, name: string): void
  jump(id: string): void
}

export function Bubble({ m, store, s, mine, names, group, showName, highlight, actions, locale }: {
  m: Message; conv?: Conversation; store: MessageStore; s: Str; mine: boolean; names: Map<string, string>
  group: boolean; showName: boolean; highlight?: string; actions: BubbleActions; locale: string
}) {
  const [hover, setHover] = useState(false)
  if (m.kind === 'system') {
    return <div className="self-center text-[0.74rem] text-ink-faint bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] rounded-md px-2.5 py-1 my-1" data-testid="msg-system">{s.sys[m.text] || m.text}</div>
  }
  const time = new Date(m.at).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
  const jumbo = m.kind === 'text' && !m.reply && isJumboEmoji(m.text)
  const tone = mine ? 'bg-green-600 text-sand-100' : 'bg-[var(--surface)] text-ink border border-[color:var(--line-soft)]'
  const reactions = Object.entries(m.reactions || {}).filter(([, who]) => who.length)
  const scheduled = mine && m.at > Date.now() + 5000
  let body: ReactNode
  if (m.deleted) body = <em className="opacity-75" data-testid="msg-deleted">{s.deletedMsg}</em>
  else if (m.kind === 'file' || m.kind === 'voice') body = <FileBody m={m} store={store} s={s} actions={actions} />
  else if (m.kind === 'poll') body = <PollBody m={m} store={store} s={s} actions={actions} />
  else if (m.kind === 'location' && m.loc) body = (
    <a href={`https://www.openstreetmap.org/?mlat=${m.loc.lat}&mlon=${m.loc.lng}#map=16/${m.loc.lat}/${m.loc.lng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-inherit no-underline" data-testid="msg-location">
      <span className="grid place-items-center w-10 h-10 rounded-md bg-[color-mix(in_srgb,currentColor_14%,transparent)] [&_svg]:w-5 [&_svg]:h-5"><AddressPinIcon /></span>
      <span className="flex flex-col"><span className="font-semibold">{s.location}</span><span className="text-[0.78rem] opacity-80" dir="ltr">{m.loc.lat.toFixed(5)}, {m.loc.lng.toFixed(5)}{m.loc.acc ? ` ±${m.loc.acc}m` : ''}</span><span className="text-[0.78rem] underline">{s.openMap}</span></span>
    </a>
  )
  else if (m.kind === 'call' && m.call) body = (
    <div className="flex items-center gap-2" data-testid="msg-call">
      <span className="grid place-items-center w-10 h-10 rounded-full bg-[color-mix(in_srgb,currentColor_14%,transparent)] [&_svg]:w-5 [&_svg]:h-5">{m.call.video ? <VideoCallIcon /> : <PhoneIcon />}</span>
      <span className="flex flex-col gap-1"><span className="font-semibold">{s.callInvite(m.call.video)}</span>
        <a data-testid="msg-call-join" className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-[0.8rem] font-semibold no-underline ${mine ? 'bg-sand-100 text-green-900' : 'bg-green-600 text-sand-100'}`}
          href={`/${locale}${callsHost().base}/join?code=${encodeURIComponent(m.call.room)}${mine ? '&host=1' : ''}`}>{s.joinCall}</a></span>
    </div>
  )
  else if (m.kind === 'doc' && m.doc) body = (
    <div className="flex items-center gap-2" data-testid="msg-doc">
      <span className="grid place-items-center w-10 h-10 rounded-md bg-[color-mix(in_srgb,currentColor_14%,transparent)] [&_svg]:w-5 [&_svg]:h-5"><FileIcon /></span>
      <span className="flex flex-col min-w-0"><span className="text-[0.72rem] opacity-80">{s.docShared}</span><span className="font-semibold truncate"><bdi>{m.doc.title}</bdi></span>
        {/^\/(en|ar)\/apps\//.test(m.doc.url) || /^https:\/\/built-in-saudi\.com\//.test(m.doc.url)
          ? <a href={m.doc.url} className="underline text-[0.8rem] text-inherit" data-testid="msg-doc-open">{s.openDoc}</a> : null}</span>
    </div>
  )
  else if (m.kind === 'contact' && m.contact) body = (
    <div className="flex items-center gap-2" data-testid="msg-contact">
      <Avatar name={m.contact.name} code={m.contact.code} size={40} />
      <span className="flex flex-col gap-1"><span className="font-semibold"><bdi>{m.contact.name || m.contact.code}</bdi></span>
        <span className="flex gap-1.5">
          {m.contact.code !== store.me && !store.isContact(m.contact.code) && <button type="button" onClick={() => actions.addContact(m.contact!.code, m.contact!.name)} className="text-[0.75rem] underline bg-transparent border-0 p-0 cursor-pointer text-inherit">{s.addContact}</button>}
          {m.contact.code !== store.me && <button type="button" onClick={() => actions.messageContact(m.contact!.code, m.contact!.name)} className="text-[0.75rem] underline bg-transparent border-0 p-0 cursor-pointer text-inherit">{s.messageContact}</button>}
        </span></span>
    </div>
  )
  else body = <span className={jumbo ? 'text-[2.4rem] leading-tight' : ''}><RichText text={m.text} names={names} highlight={highlight} /></span>

  return (
    <div
      className={`group/msg relative flex flex-col max-w-[min(78%,560px)] ${mine ? 'self-end items-end' : 'self-start items-start'}`}
      data-testid="bubble" data-mid={m.id} data-mine={mine ? '1' : '0'} data-kind={m.kind} id={`msg-${m.id}`}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onContextMenu={(e) => { e.preventDefault(); actions.menu(m, e.currentTarget) }}
    >
      {group && showName && !mine && <span className="text-[0.72rem] font-semibold text-[var(--gold-500)] px-1"><bdi>{m.name || m.from}</bdi></span>}
      <div className={`relative rounded-lg ${jumbo ? 'bg-transparent px-1' : `${tone} px-3 py-1.5 shadow-[var(--shadow-sm)]`} ${mine ? 'rounded-ee-sm' : 'rounded-es-sm'}`}>
        {m.forwarded && <span className="block text-[0.7rem] italic opacity-75">↪ {s.forwarded}</span>}
        {m.reply && !m.deleted && (
          <button type="button" onClick={() => actions.jump(m.reply!.id)} data-testid="bubble-reply"
            className={`block w-full text-start mb-1 rounded-sm border-0 border-s-[3px] px-2 py-1 text-[0.78rem] cursor-pointer ${mine ? 'bg-black/15 border-sand-100/70 text-sand-100' : 'bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] border-green-500 text-ink'}`}>
            <span className="block font-semibold"><bdi>{m.reply.from === store.me ? s.you : m.reply.name}</bdi></span>
            <span className="block truncate opacity-80" dir="auto">{m.reply.snippet}</span>
          </button>
        )}
        <div className="text-[0.93rem] leading-[1.42] break-words [overflow-wrap:anywhere]" dir="auto" data-testid="bubble-text">{body}</div>
        <div className={`flex items-center gap-1 justify-end text-[0.66rem] ${mine ? 'text-sand-100/75' : 'text-ink-faint'} mt-0.5`}>
          {m.starred && <BookmarkIcon className="w-3 h-3" />}
          {m.edited && !m.deleted && <span data-testid="bubble-edited">{s.edited}</span>}
          {scheduled && <span>{s.scheduled}</span>}
          <span>{time}</span>
          {mine && !m.deleted && <Ticks m={m} s={s} />}
        </div>
      </div>
      {reactions.length > 0 && (
        <div className={`flex flex-wrap gap-1 -mt-1.5 z-[1] ${mine ? 'me-2' : 'ms-2'}`} data-testid="bubble-reactions">
          {reactions.map(([emoji, who]) => (
            <button key={emoji} type="button" onClick={() => actions.react(m, emoji)} data-testid="reaction-chip" data-emoji={emoji}
              title={who.map((c) => (c === store.me ? s.you : store.contactName(c) || c)).join(', ')}
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.78rem] border cursor-pointer shadow-[var(--shadow-sm)] ${who.includes(store.me) ? 'bg-[color-mix(in_srgb,var(--green-500)_18%,var(--surface))] border-green-500' : 'bg-[var(--surface)] border-[color:var(--line)]'}`}>
              <span>{emoji}</span>{who.length > 1 && <span className="text-[0.7rem] text-ink-soft">{who.length}</span>}
            </button>
          ))}
        </div>
      )}
      {!m.deleted && (
        <div className={`absolute top-0 ${mine ? 'end-full me-1' : 'start-full ms-1'} flex items-center gap-0.5 transition-opacity ${hover ? 'opacity-100' : 'opacity-0 pointer-events-none'} max-[700px]:hidden`}>
          {QUICK_REACTIONS.slice(0, 3).map((e) => (
            <button key={e} type="button" onClick={() => actions.react(m, e)} className="w-7 h-7 rounded-full grid place-items-center bg-[var(--surface)] border border-[color:var(--line-soft)] cursor-pointer text-[0.9rem]" aria-label={`${s.react} ${e}`}>{e}</button>
          ))}
          <button type="button" onClick={() => actions.reply(m)} className="h-7 px-2 rounded-full bg-[var(--surface)] border border-[color:var(--line-soft)] cursor-pointer text-[0.72rem] text-ink-soft" data-testid="bubble-reply-btn">{s.reply}</button>
          <button type="button" onClick={(e) => actions.menu(m, e.currentTarget)} className="w-7 h-7 rounded-full bg-[var(--surface)] border border-[color:var(--line-soft)] cursor-pointer text-ink-soft" aria-label={s.more} data-testid="bubble-more">⋯</button>
        </div>
      )}
      {/* Touch has no hover: the ⋯ is always there, small. */}
      {!m.deleted && (
        <button type="button" onClick={(e) => actions.menu(m, e.currentTarget)} aria-label={s.more} data-testid="bubble-more-touch"
          className={`hidden max-[700px]:grid place-items-center absolute top-1 ${mine ? '-start-7' : '-end-7'} w-6 h-6 rounded-full bg-transparent border-0 text-ink-faint cursor-pointer`}>⋯</button>
      )}
    </div>
  )
}

function FileBody({ m, store, s, actions }: { m: Message; store: MessageStore; s: Str; actions: BubbleActions }) {
  const f = m.file!
  const url = useBlobUrl(store, f.id, f.have)
  const prog = store.progress.get(f.id)
  const isImg = f.mime.startsWith('image/')
  const isVid = f.mime.startsWith('video/')
  const isAudio = m.kind === 'voice' || f.mime.startsWith('audio/')
  if (isImg) {
    const ratio = f.w && f.h ? f.h / f.w : 0.75
    return (
      <div className="flex flex-col gap-1" data-testid="msg-file" data-have={f.have ? '1' : '0'}>
        <button type="button" onClick={() => (url ? actions.openImage(url, f.name) : actions.fetch(m))}
          className="relative block p-0 border-0 bg-transparent cursor-pointer overflow-hidden rounded-md" style={{ width: 'min(260px, 60vw)', aspectRatio: `${1 / Math.min(Math.max(ratio, 0.4), 2.2)}` }}>
          {url ? <img src={url} alt={f.name} className="w-full h-full object-cover" data-testid="msg-image" />
            : f.thumb ? <img src={f.thumb} alt="" className="w-full h-full object-cover blur-md scale-110" />
              : <span className="w-full h-full grid place-items-center bg-black/10" />}
          {!url && <span className="absolute inset-0 grid place-items-center text-[0.75rem] text-white bg-black/30">{prog !== undefined ? s.fetching(prog) : `${s.fetch} · ${fmtSize(f.size)}`}</span>}
        </button>
        {m.text && <RichText text={m.text} />}
      </div>
    )
  }
  if (isAudio) {
    return (
      <div className="flex items-center gap-2 min-w-[200px]" data-testid="msg-voice" data-have={f.have ? '1' : '0'}>
        <MicIcon className="w-4 h-4 shrink-0" />
        {url ? <audio controls src={url} className="h-8 max-w-[240px]" data-testid="msg-audio" />
          : <span className="text-[0.82rem]">{s.voice} · {fmtDur(f.dur || 0)} — {prog !== undefined ? s.fetching(prog) : s.waitingFile}</span>}
      </div>
    )
  }
  if (isVid && url) return <video controls src={url} className="max-w-[min(300px,62vw)] rounded-md" data-testid="msg-video" />
  return (
    <div className="flex items-center gap-2.5 min-w-[220px]" data-testid="msg-file" data-have={f.have ? '1' : '0'}>
      <span className="grid place-items-center w-10 h-10 rounded-md bg-[color-mix(in_srgb,currentColor_14%,transparent)] [&_svg]:w-5 [&_svg]:h-5"><FileIcon /></span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="font-semibold truncate text-[0.88rem]"><bdi>{f.name}</bdi></span>
        <span className="text-[0.74rem] opacity-80">{fmtSize(f.size)}{prog !== undefined ? ` · ${s.fetching(prog)}` : ''}</span>
      </span>
      {url ? <a href={url} download={f.name} data-testid="msg-file-download" className="grid place-items-center w-8 h-8 rounded-full bg-[color-mix(in_srgb,currentColor_14%,transparent)] text-inherit [&_svg]:w-4 [&_svg]:h-4" aria-label={s.download}><DownloadIcon /></a>
        : <button type="button" onClick={() => actions.fetch(m)} data-testid="msg-file-fetch" className="text-[0.75rem] underline bg-transparent border-0 cursor-pointer text-inherit" title={s.waitingFile}>{s.fetch}</button>}
    </div>
  )
}

function PollBody({ m, store, s, actions }: { m: Message; store: MessageStore; s: Str; actions: BubbleActions }) {
  const p = m.poll!
  const rows = tally(m)
  const total = new Set(Object.values(m.votes || {}).flat()).size
  return (
    <div className="flex flex-col gap-1.5 min-w-[230px]" data-testid="msg-poll">
      <span className="font-semibold">📊 <bdi>{p.q}</bdi></span>
      {rows.map((r) => {
        const mineVote = (m.votes?.[r.id] || []).includes(store.me)
        return (
          <button key={r.id} type="button" disabled={p.closed} onClick={() => actions.vote(m, r.id)} data-testid="poll-option" data-voted={mineVote ? '1' : '0'}
            className="relative text-start rounded-md border border-[color-mix(in_srgb,currentColor_30%,transparent)] bg-transparent text-inherit px-2 py-1.5 cursor-pointer overflow-hidden disabled:cursor-default">
            <span className="absolute inset-y-0 start-0 bg-[color-mix(in_srgb,currentColor_16%,transparent)]" style={{ width: `${Math.round(r.share * 100)}%` }} />
            <span className="relative flex items-center justify-between gap-2 text-[0.85rem]">
              <span>{mineVote ? '● ' : '○ '}<bdi>{r.text}</bdi></span><span className="text-[0.75rem] opacity-80" data-testid="poll-count">{r.n}</span>
            </span>
          </button>
        )
      })}
      <span className="text-[0.72rem] opacity-80">{s.votes(total)}{p.multi ? ` · ${s.pollMulti}` : ''}{p.closed ? ` · ${s.pollClosed}` : ''}</span>
    </div>
  )
}

const AV_COLORS = ['#0e5a3f', '#b5543c', '#3b5bdb', '#9c36b5', '#c08a2d', '#0c8599', '#c2255c', '#5f3dc4']
export function Avatar({ name, code, size = 38, emoji, online }: { name: string; code: string; size?: number; emoji?: string; online?: boolean }) {
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0
  const initials = (name || code || '?').trim().split(/\s+/).slice(0, 2).map((w) => [...w][0]).join('').toUpperCase()
  return (
    <span className="relative inline-grid place-items-center shrink-0 rounded-full text-white font-semibold" style={{ width: size, height: size, background: AV_COLORS[h % AV_COLORS.length], fontSize: size * 0.38 }} aria-hidden>
      {emoji || initials}
      {online && <span className="absolute bottom-0 end-0 w-[30%] h-[30%] min-w-2.5 min-h-2.5 rounded-full bg-[#2fbf71] border-2 border-[var(--surface)]" data-testid="online-dot" />}
    </span>
  )
}


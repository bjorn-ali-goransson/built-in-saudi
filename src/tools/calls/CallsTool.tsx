import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Stack, Button, Input } from '../../components/ui'
import { DownloadIcon, UploadIcon, ShareIcon, TrashIcon, RefreshIcon } from '../../components/icons'
import { CallRoom, type DataMsg, type PeerInfo } from './rtc'

const SITE = 'https://built-in-saudi.com'
const NAME_KEY = 'bis-call-name'
const code6 = () => { const A = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const b = crypto.getRandomValues(new Uint8Array(7)); for (let i = 0; i < 7; i++) s += A[b[i] % A.length]; return s }

// Playful anonymous default: a kunya ("Abu <name>") from 30 classic Arabic names.
const KUNYA: [string, string][] = [
  ['Khalid', 'خالد'], ['Faisal', 'فيصل'], ['Salman', 'سلمان'], ['Turki', 'تركي'], ['Nawaf', 'نواف'],
  ['Majid', 'ماجد'], ['Saud', 'سعود'], ['Bandar', 'بندر'], ['Fahad', 'فهد'], ['Nasser', 'ناصر'],
  ['Abdullah', 'عبدالله'], ['Omar', 'عمر'], ['Yousef', 'يوسف'], ['Ibrahim', 'إبراهيم'], ['Hamad', 'حمد'],
  ['Rakan', 'راكان'], ['Ziyad', 'زياد'], ['Talal', 'طلال'], ['Waleed', 'وليد'], ['Sultan', 'سلطان'],
  ['Mishal', 'مشعل'], ['Badr', 'بدر'], ['Tariq', 'طارق'], ['Ayman', 'أيمن'], ['Sami', 'سامي'],
  ['Marwan', 'مروان'], ['Rayan', 'ريان'], ['Anas', 'أنس'], ['Layth', 'ليث'], ['Zaid', 'زيد'],
]
const randName = (ar: boolean) => { const b = crypto.getRandomValues(new Uint8Array(1)); const p = KUNYA[b[0] % KUNYA.length]; return ar ? `أبو ${p[1]}` : `Abu ${p[0]}` }

const STR = {
  en: {
    title: 'Private call', lead: 'Secure meetings — video, whiteboard, chat and files go straight between browsers. Only the initial handshake, never any data, touches our server.',
    yourName: 'Your name', start: 'Start a call', askJoin: 'Ask to join', shuffle: 'Random name', joining: 'Connecting…', shareInvite: 'Share invite',
    mic: 'Mic', cam: 'Camera', screen: 'Share screen', stopScreen: 'Stop sharing', board: 'Whiteboard', chat: 'Chat', invite: 'Invite', leave: 'Leave',
    you: 'You', waiting: 'Waiting for others to join — share the invite.', clear: 'Clear', typeMsg: 'Message…', send: 'Send', dropFiles: 'Drop files to send, or tap',
    copied: 'Invite link copied', shareHint: 'Share the link — people who open it appear here for you to let in.',
    lobbyList: 'Waiting in the lobby', admit: 'Let in', waitingHost: 'Waiting for the host to let you in…', cancel: 'Cancel',
    privacy: 'All data is peer-to-peer, only the handshake uses the server.',
  },
  ar: {
    title: 'مكالمة خاصة', lead: 'اجتماعات آمنة — الفيديو والسبورة والدردشة والملفات تنتقل مباشرةً بين المتصفحات. فقط المصافحة الأولى، ولا أي بيانات، تمر بخادمنا.',
    yourName: 'اسمك', start: 'ابدأ مكالمة', askJoin: 'اطلب الانضمام', shuffle: 'اسم عشوائي', joining: 'جارٍ الاتصال…', shareInvite: 'مشاركة الدعوة',
    mic: 'المايك', cam: 'الكاميرا', screen: 'مشاركة الشاشة', stopScreen: 'إيقاف المشاركة', board: 'السبورة', chat: 'الدردشة', invite: 'دعوة', leave: 'مغادرة',
    you: 'أنت', waiting: 'بانتظار انضمام آخرين — شارك الدعوة.', clear: 'مسح', typeMsg: 'رسالة…', send: 'إرسال', dropFiles: 'أفلت ملفات للإرسال أو اضغط',
    copied: 'تم نسخ رابط الدعوة', shareHint: 'شارك الرابط — يظهر من يفتحه هنا لتسمح له بالدخول.',
    lobbyList: 'في غرفة الانتظار', admit: 'اسمح بالدخول', waitingHost: 'بانتظار أن يسمح لك المضيف بالدخول…', cancel: 'إلغاء',
    privacy: 'كل البيانات مباشرة بين الأجهزة، فقط المصافحة تستخدم الخادم.',
  },
}

function Video({ stream, muted, mirror, label }: { stream: MediaStream; muted?: boolean; mirror?: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream }, [stream])
  return (
    <div className="relative rounded-md overflow-hidden bg-black aspect-video">
      <video ref={ref} autoPlay playsInline muted={muted} className={`w-full h-full object-cover ${mirror ? '-scale-x-100' : ''}`} />
      <span className="absolute left-1.5 bottom-1.5 text-[0.7rem] bg-black/55 text-white px-1.5 py-0.5 rounded">{label}</span>
    </div>
  )
}

const initials = (nm: string) => nm.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '•'

// The host's "Waiting in the lobby" list — a card of guests with a Let-in button.
function LobbyList({ waiting, admit, hint, title, admitLabel, live }: { waiting: [string, PeerInfo][]; admit: (id: string) => void; hint: string; title: string; admitLabel: string; live?: boolean }) {
  if (waiting.length === 0) return live ? null : <p className="max-w-[30rem] text-[0.85rem] text-ink-faint">{hint}</p>
  return (
    <div className="max-w-[30rem] rounded-lg border border-[color:var(--line)] bg-[var(--surface)] p-4 flex flex-col gap-2.5" data-testid={live ? 'call-lobby-live' : 'call-lobby'}>
      <p className="text-[0.82rem] font-semibold text-ink-soft flex items-center justify-between">{title} <span className="font-mono text-ink-faint">{waiting.length}</span></p>
      {waiting.map(([id, info]) => (
        <div key={id} className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--color-green-400)_22%,transparent)] text-green-700 grid place-items-center text-[0.78rem] font-semibold shrink-0" aria-hidden="true">{initials(info.name)}</span>
          <span className="flex-1 text-[0.92rem] text-ink truncate">{info.name || '•'}</span>
          <Button variant="primary" onClick={() => admit(id)} data-testid="call-admit" className="!py-1 !px-3 text-[0.8rem] shrink-0">{admitLabel}</Button>
        </div>
      ))}
    </div>
  )
}

type ChatItem = { from: string; name: string; text?: string; fileName?: string; url?: string }

export default function CallsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  // Captured once at mount — we later rewrite the URL to ?room=…, which must not
  // flip this (it determines host vs guest).
  const [initialRoom] = useState(() => new URLSearchParams(window.location.search).get('room') || '')
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) || randName(locale === 'ar') } catch { return randName(locale === 'ar') } })
  const [phase, setPhase] = useState<'lobby' | 'hosting' | 'waiting' | 'live'>('lobby')
  const [room, setRoom] = useState(initialRoom)
  const [busy, setBusy] = useState(false)
  const isGuest = !!initialRoom
  // Everyone we've connected to (data channel), with the name/role/lobby state
  // they told us peer-to-peer. The host's waiting list is derived from this.
  const [roster, setRoster] = useState<Map<string, PeerInfo>>(new Map())

  const rtc = useRef<CallRoom | null>(null)
  const [local, setLocal] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Map<string, MediaStream>>(new Map())
  const [mic, setMic] = useState(false), [cam, setCam] = useState(false), [sharing, setSharing] = useState(false)
  const [panel, setPanel] = useState<'none' | 'board' | 'chat'>('none')
  const [chat, setChat] = useState<ChatItem[]>([])
  const [msg, setMsg] = useState('')
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // whiteboard
  const wbRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ x: number; y: number } | null>(null)
  const incoming = useRef<Map<string, { name: string; mime: string; parts: ArrayBuffer[] }>>(new Map())
  const seen = useRef<Map<string, number>>(new Map()) // id → last heartbeat (ms)

  // Expire peers who go quiet (e.g. closed their tab) so they don't linger in
  // the lobby — the data-channel heartbeat refreshes `seen` every 5s.
  useEffect(() => {
    const iv = window.setInterval(() => {
      const cutoff = Date.now() - 15_000
      setRoster((r) => {
        let changed = false; const m = new Map(r)
        for (const id of [...m.keys()]) if ((seen.current.get(id) || 0) < cutoff) { m.delete(id); seen.current.delete(id); changed = true }
        return changed ? m : r
      })
    }, 5000)
    return () => window.clearInterval(iv)
  }, [])

  const nameOf = useCallback((id: string) => roster.get(id)?.name || '•', [roster])
  // The people the host still needs to let in (guests who haven't joined yet).
  const waiting = [...roster].filter(([, i]) => i.role === 'guest' && !i.inCall)

  function onData(id: string, m: DataMsg) {
    if (m.t === 'chat') setChat((c) => [...c, { from: id, name: m.name, text: m.text }])
    else if (m.t === 'wb') { if (m.op === 'clear') clearBoard(false); else if (m.stroke) drawSeg(m.stroke, m.color || '#e11', m.width || 3) }
    else if (m.t === 'file-start') incoming.current.set(m.id, { name: m.name, mime: m.mime, parts: [] })
    else if (m.t === 'file-end') {
      const f = incoming.current.get(m.id); if (!f) return
      const url = URL.createObjectURL(new Blob(f.parts, { type: f.mime || 'application/octet-stream' }))
      setChat((c) => [...c, { from: id, name: nameOf(id), fileName: f.name, url }])
      incoming.current.delete(m.id)
    }
  }
  // most recent file-start id per peer receives the chunks (channels are ordered)
  function onFileChunk(id: string, chunk: ArrayBuffer) { const last = [...incoming.current.values()].pop(); void id; if (last) last.parts.push(chunk) }

  function ensureRoom(code: string): CallRoom {
    if (rtc.current) return rtc.current
    const r = new CallRoom(code, {
      onLocal: (st) => setLocal(st),
      onPeerStream: (pid, st) => setPeers((p) => new Map(p).set(pid, st)),
      onLeave: (pid) => { setPeers((p) => { const n = new Map(p); n.delete(pid); return n }); setRoster((n) => { const m = new Map(n); m.delete(pid); return m }) },
      onData, onFileChunk,
      onPeerInfo: (id, info) => { seen.current.set(id, Date.now()); setRoster((r2) => new Map(r2).set(id, info)) },
      onAdmitted: () => setPhase('live'), // rtc enables our media itself
    })
    rtc.current = r
    return r
  }
  function mediaError() { setToast('Camera/mic permission needed'); setTimeout(() => setToast(''), 3000) }
  // Put the room code in the URL so it's shareable and rooms are distinguishable.
  function reflectRoom(code: string) { history.replaceState(null, '', `${localePath(locale, '/apps/calls')}?room=${code}`) }

  // Host: start the call right away (others still need to be let in).
  async function startHost() {
    try { localStorage.setItem(NAME_KEY, name) } catch { /* */ }
    setBusy(true)
    const code = room || code6(); setRoom(code); reflectRoom(code)
    const r = ensureRoom(code); r.enterLobby(name || s.you, true)
    try { await r.enableMedia(); setPhase('live') } catch { mediaError() } finally { setBusy(false) }
  }
  // Host: create + share the link without joining yet; wait to let people in.
  async function shareHost() {
    try { localStorage.setItem(NAME_KEY, name) } catch { /* */ }
    const code = room || code6(); setRoom(code); reflectRoom(code)
    const r = ensureRoom(code); r.enterLobby(name || s.you, true)
    setPhase('hosting')
    await shareInvite(code)
  }
  // Guest: knock and wait for the host to admit.
  function askToJoin() {
    try { localStorage.setItem(NAME_KEY, name) } catch { /* */ }
    const code = room.trim(); if (!code) return
    const r = ensureRoom(code); r.enterLobby(name || s.you, false)
    setPhase('waiting')
  }
  // Host: let a specific waiting guest into the call (going live if needed).
  async function admit(id: string) {
    try { await rtc.current?.admit(id); setPhase('live') } catch { mediaError() }
  }

  useEffect(() => () => { rtc.current?.leave() }, [])

  function hangup() { rtc.current?.leave(); rtc.current = null; setPhase('lobby'); setPeers(new Map()); setLocal(null); setChat([]); setRoster(new Map()); history.replaceState(null, '', localePath(locale, '/apps/calls')) }

  function toggleMic() { const v = !mic; setMic(v); rtc.current?.toggleMic(v) }
  function toggleCam() { const v = !cam; setCam(v); rtc.current?.toggleCam(v) }
  async function toggleScreen() {
    if (sharing) { rtc.current?.stopScreen(); setSharing(false); if (local) setLocal(local) }
    else { const st = await rtc.current?.shareScreen(); if (st) { setSharing(true) } }
  }
  function sendChat() { const t = msg.trim(); if (!t) return; rtc.current?.broadcast({ t: 'chat', name: name || s.you, text: t }); setChat((c) => [...c, { from: 'me', name: s.you, text: t }]); setMsg('') }
  function pickFiles(fl: FileList | null) { if (!fl) return; for (const f of fl) { rtc.current?.sendFile(f); setChat((c) => [...c, { from: 'me', name: s.you, fileName: f.name }]) } }

  // ---- whiteboard ----
  function wbPt(e: React.PointerEvent) { const r = wbRef.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } }
  function drawSeg(seg: number[], color: string, width: number) {
    const c = wbRef.current; if (!c) return; const x = c.getContext('2d'); if (!x) return
    x.strokeStyle = color; x.lineWidth = width; x.lineCap = 'round'
    x.beginPath(); x.moveTo(seg[0] * c.width, seg[1] * c.height); x.lineTo(seg[2] * c.width, seg[3] * c.height); x.stroke()
  }
  function wbDown(e: React.PointerEvent) { (e.target as HTMLElement).setPointerCapture(e.pointerId); drawing.current = wbPt(e) }
  function wbMove(e: React.PointerEvent) { if (!drawing.current) return; const p = wbPt(e); const seg = [drawing.current.x, drawing.current.y, p.x, p.y]; drawSeg(seg, '#e11', 3); rtc.current?.broadcast({ t: 'wb', op: 'stroke', stroke: seg, color: '#e11', width: 3 }); drawing.current = p }
  function wbUp() { drawing.current = null }
  function clearBoard(broadcast = true) { const c = wbRef.current; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); if (broadcast) rtc.current?.broadcast({ t: 'wb', op: 'clear' }) }
  useEffect(() => { if (panel !== 'board') return; const c = wbRef.current; if (c) { c.width = c.clientWidth; c.height = c.clientHeight } }, [panel])

  async function shareInvite(code = room) {
    const url = `${SITE}${localePath(locale, '/apps/calls')}?room=${code}`
    try { await navigator.clipboard.writeText(url); setToast(s.copied); setTimeout(() => setToast(''), 2500) } catch { /* */ }
    try {
      const { makeInvite } = await import('./invite')
      const blob = await makeInvite(url, code, locale === 'ar')
      const file = new File([blob], `call-${code}.png`, { type: 'image/png' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any
      if (nav.canShare && nav.canShare({ files: [file] })) await nav.share({ files: [file], text: url })
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click() }
    } catch { /* share cancelled */ }
  }
  const invite = () => shareInvite()

  if (phase !== 'live') {
    return (
      <Stack data-testid="calls">
        <div className="max-w-[30rem] rounded-lg border border-green-900/40 bg-green-950 text-sand-100 p-5 sm:p-6 flex flex-col gap-4">
          {phase === 'waiting' ? (
            <>
              <p className="text-[0.95rem] leading-relaxed text-sand-100/90 flex items-center gap-2" data-testid="call-waiting">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--gold-500)] animate-pulse" /> {s.waitingHost}
              </p>
              <p className="font-mono text-[0.8rem] text-sand-100/60">{room}</p>
              <Button onClick={hangup} data-testid="call-cancel">{s.cancel}</Button>
            </>
          ) : (
            <>
              <p className="text-[0.95rem] leading-relaxed text-sand-100/90">{s.lead}</p>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.82rem] font-medium text-sand-100/70">{s.yourName}</span>
                <div className="relative">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="—" data-testid="call-name" className="pe-10" />
                  <button type="button" onClick={() => setName(randName(locale === 'ar'))} title={s.shuffle} aria-label={s.shuffle} data-testid="call-shuffle"
                    className="absolute inset-y-0 end-1.5 my-auto h-8 w-8 grid place-items-center rounded-md bg-transparent border-0 text-ink-faint hover:text-ink hover:bg-black/5 cursor-pointer">
                    <RefreshIcon className="w-4 h-4" />
                  </button>
                </div>
              </label>
              <div className="flex gap-2">
                <Button variant="primary" disabled={busy} className="flex-1"
                  onClick={isGuest ? askToJoin : startHost}
                  data-testid={isGuest ? 'call-join' : 'call-start'}>
                  {busy ? s.joining : isGuest ? `${s.askJoin} · ${room}` : s.start}
                </Button>
                {!isGuest && (
                  <Button onClick={shareHost} title={s.shareInvite} aria-label={s.shareInvite} className="!px-3" data-testid="call-share">
                    <ShareIcon className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-[0.78rem] text-sand-100/70 flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
            </>
          )}
        </div>

        {/* The lobby list lives below the whole box (host only). */}
        {!isGuest && phase === 'hosting' && <LobbyList waiting={waiting} admit={admit} hint={s.shareHint} title={s.lobbyList} admitLabel={s.admit} />}

        {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-sand-100 px-4 py-2 rounded-md shadow-[var(--shadow-md)] text-[0.9rem]">{toast}</div>}
      </Stack>
    )
  }

  const tiles = [local && { id: 'me', stream: local, me: true }, ...[...peers].map(([id, stream]) => ({ id, stream, me: false }))].filter(Boolean) as { id: string; stream: MediaStream; me: boolean }[]

  return (
    <div className="flex flex-col gap-3" data-testid="calls-live">
      {/* video grid */}
      <div className={`grid gap-2 ${tiles.length <= 1 ? 'grid-cols-1' : 'grid-cols-2'} ${panel !== 'none' ? 'max-h-[42vh] overflow-hidden' : ''}`}>
        {tiles.map((t) => <Video key={t.id} stream={t.stream} muted={t.me} mirror={t.me && !sharing} label={t.me ? (name ? `${name} · ${s.you}` : s.you) : nameOf(t.id)} />)}
      </div>
      {tiles.length <= 1 && <p className="text-[0.85rem] text-ink-faint text-center">{s.waiting}</p>}

      {/* Host: people knocking while the call is live (only the host gets these). */}
      {!isGuest && <LobbyList waiting={waiting} admit={admit} hint={s.shareHint} title={s.lobbyList} admitLabel={s.admit} live />}

      {/* controls */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Button onClick={toggleMic} className={mic ? '' : '!bg-[var(--danger)] !text-white'}>{s.mic}{mic ? '' : ' ✕'}</Button>
        <Button onClick={toggleCam} className={cam ? '' : '!bg-[var(--danger)] !text-white'}>{s.cam}{cam ? '' : ' ✕'}</Button>
        <Button onClick={toggleScreen} className={sharing ? '!bg-green-600 !text-sand-100' : ''}>{sharing ? s.stopScreen : s.screen}</Button>
        <Button onClick={() => setPanel(panel === 'board' ? 'none' : 'board')} className={panel === 'board' ? '!bg-green-600 !text-sand-100' : ''}>{s.board}</Button>
        <Button onClick={() => setPanel(panel === 'chat' ? 'none' : 'chat')} className={panel === 'chat' ? '!bg-green-600 !text-sand-100' : ''}>{s.chat}{chat.length ? ` · ${chat.length}` : ''}</Button>
        <Button onClick={invite} data-testid="call-invite"><ShareIcon className="w-4 h-4" /> {s.invite}</Button>
        <Button variant="primary" onClick={hangup} className="!bg-[var(--danger)]">{s.leave}</Button>
      </div>
      <p className="text-[0.75rem] text-ink-faint text-center font-mono">{room}</p>

      {/* whiteboard */}
      {panel === 'board' && (
        <div className="flex flex-col gap-2">
          <div className="relative border border-[color:var(--line)] rounded-md bg-white h-[46vh] touch-none">
            <canvas ref={wbRef} className="absolute inset-0 w-full h-full cursor-crosshair" onPointerDown={wbDown} onPointerMove={wbMove} onPointerUp={wbUp} onPointerLeave={wbUp} />
          </div>
          <Button className="self-start" onClick={() => clearBoard()}><TrashIcon className="w-4 h-4" /> {s.clear}</Button>
        </div>
      )}

      {/* chat + files */}
      {panel === 'chat' && (
        <div className="flex flex-col gap-2 border border-[color:var(--line)] rounded-md bg-[var(--surface)] p-3">
          <div className="flex flex-col gap-1.5 max-h-[32vh] overflow-y-auto text-[0.9rem]">
            {chat.map((m, i) => (
              <div key={i} className={m.from === 'me' ? 'text-right' : ''}>
                <span className="text-[0.72rem] text-ink-faint">{m.name}</span>{' '}
                {m.url ? <a href={m.url} download={m.fileName} className="text-green-700 underline inline-flex items-center gap-1"><DownloadIcon className="w-3.5 h-3.5" />{m.fileName}</a>
                  : m.fileName ? <span className="text-ink-faint">↑ {m.fileName}</span>
                    : <span className="text-ink">{m.text}</span>}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFiles(e.dataTransfer.files) }}
            className="flex items-center justify-center gap-2 py-2 border-2 border-dashed border-[color:var(--line)] rounded-md text-[0.82rem] text-ink-faint cursor-pointer hover:border-green-500">
            <UploadIcon className="w-4 h-4" /> {s.dropFiles}
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { pickFiles(e.target.files); e.target.value = '' }} />
          </button>
          <div className="flex gap-2">
            <Input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendChat() }} placeholder={s.typeMsg} />
            <Button variant="primary" onClick={sendChat}>{s.send}</Button>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-sand-100 px-4 py-2 rounded-md shadow-[var(--shadow-md)] text-[0.9rem]">{toast}</div>}
    </div>
  )
}

import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Stack, Button, Input } from '../../components/ui'
import { DownloadIcon, UploadIcon, ShareIcon, TrashIcon } from '../../components/icons'
import { CallRoom, type DataMsg } from './rtc'

const SITE = 'https://built-in-saudi.com'
const NAME_KEY = 'bis-call-name'
const code6 = () => { const A = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const b = crypto.getRandomValues(new Uint8Array(7)); for (let i = 0; i < 7; i++) s += A[b[i] % A.length]; return s }

const STR = {
  en: {
    title: 'Private call', lead: 'A peer-to-peer meeting — video, whiteboard, chat and files go straight between browsers. Only the initial handshake touches a tiny relay; the call itself never touches a server.',
    yourName: 'Your name', start: 'Start a call', joinCode: 'Join call', withCam: 'Camera on', joining: 'Connecting…',
    mic: 'Mic', cam: 'Camera', screen: 'Share screen', stopScreen: 'Stop sharing', board: 'Whiteboard', chat: 'Chat', invite: 'Invite', leave: 'Leave',
    you: 'You', waiting: 'Waiting for others to join — share the invite.', clear: 'Clear', typeMsg: 'Message…', send: 'Send', dropFiles: 'Drop files to send, or tap',
    copied: 'Invite link copied', copyLink: 'Copy link', shareImg: 'Share invite image', inviteHint: 'Share the image (QR + link) or copy the link.',
    noConnect: 'Some networks (strict firewalls) can’t make a direct link and won’t connect — that’s the no-relay trade-off.',
    privacy: 'Media & data are peer-to-peer — never uploaded. Small groups only.',
  },
  ar: {
    title: 'مكالمة خاصة', lead: 'اجتماع مباشر بين الأجهزة — الفيديو والسبورة والدردشة والملفات تنتقل مباشرة بين المتصفحات. فقط المصافحة الأولى تمر بمُرحِّل صغير؛ أما المكالمة فلا تمر بأي خادم.',
    yourName: 'اسمك', start: 'ابدأ مكالمة', joinCode: 'انضم للمكالمة', withCam: 'الكاميرا', joining: 'جارٍ الاتصال…',
    mic: 'المايك', cam: 'الكاميرا', screen: 'مشاركة الشاشة', stopScreen: 'إيقاف المشاركة', board: 'السبورة', chat: 'الدردشة', invite: 'دعوة', leave: 'مغادرة',
    you: 'أنت', waiting: 'بانتظار انضمام آخرين — شارك الدعوة.', clear: 'مسح', typeMsg: 'رسالة…', send: 'إرسال', dropFiles: 'أفلت ملفات للإرسال أو اضغط',
    copied: 'تم نسخ رابط الدعوة', copyLink: 'نسخ الرابط', shareImg: 'مشاركة صورة الدعوة', inviteHint: 'شارك الصورة (رمز + رابط) أو انسخ الرابط.',
    noConnect: 'بعض الشبكات (جدران حماية صارمة) لا تستطيع إنشاء اتصال مباشر ولن تتصل — هذه مقايضة عدم استخدام مُرحِّل.',
    privacy: 'الوسائط والبيانات مباشرة بين الأجهزة — لا تُرفع أبدًا. مجموعات صغيرة فقط.',
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

type ChatItem = { from: string; name: string; text?: string; fileName?: string; url?: string }

export default function CallsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const initialRoom = new URLSearchParams(window.location.search).get('room') || ''
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) || '' } catch { return '' } })
  const [phase, setPhase] = useState<'lobby' | 'live'>('lobby')
  const [room, setRoom] = useState(initialRoom)
  const [busy, setBusy] = useState(false)
  const [wantCam, setWantCam] = useState(true)

  const rtc = useRef<CallRoom | null>(null)
  const [local, setLocal] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Map<string, MediaStream>>(new Map())
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [mic, setMic] = useState(true), [cam, setCam] = useState(true), [sharing, setSharing] = useState(false)
  const [panel, setPanel] = useState<'none' | 'board' | 'chat'>('none')
  const [chat, setChat] = useState<ChatItem[]>([])
  const [msg, setMsg] = useState('')
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // whiteboard
  const wbRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ x: number; y: number } | null>(null)
  const incoming = useRef<Map<string, { name: string; mime: string; parts: ArrayBuffer[] }>>(new Map())

  const nameOf = useCallback((id: string) => names.get(id) || '•', [names])

  function onData(id: string, m: DataMsg) {
    if (m.t === 'name') setNames((n) => new Map(n).set(id, m.name))
    else if (m.t === 'chat') setChat((c) => [...c, { from: id, name: m.name, text: m.text }])
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

  async function go(join: boolean) {
    try { localStorage.setItem(NAME_KEY, name) } catch { /* */ }
    setBusy(true)
    const code = join ? room.trim() : code6()
    setRoom(code)
    const r = new CallRoom(code, {
      onLocal: (st) => setLocal(st),
      onPeerStream: (pid, st) => setPeers((p) => new Map(p).set(pid, st)),
      onPeer: (_pid, state) => { if (state === 'connected') r.broadcast({ t: 'name', name: name || s.you }) },
      onLeave: (pid) => { setPeers((p) => { const n = new Map(p); n.delete(pid); return n }); setNames((n) => { const m = new Map(n); m.delete(pid); return m }) },
      onData, onFileChunk,
    })
    rtc.current = r
    try { await r.start(wantCam); setPhase('live') }
    catch { setToast('Camera/mic permission needed'); setTimeout(() => setToast(''), 3000) }
    finally { setBusy(false) }
  }

  useEffect(() => () => { rtc.current?.leave() }, [])

  function hangup() { rtc.current?.leave(); rtc.current = null; setPhase('lobby'); setPeers(new Map()); setLocal(null); setChat([]); history.replaceState(null, '', localePath(locale, '/apps/calls')) }

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

  async function invite() {
    const url = `${SITE}${localePath(locale, '/apps/calls')}?room=${room}`
    try { await navigator.clipboard.writeText(url); setToast(s.copied); setTimeout(() => setToast(''), 2500) } catch { /* */ }
    try {
      const { makeInvite } = await import('./invite')
      const blob = await makeInvite(url, room, locale === 'ar')
      const file = new File([blob], `call-${room}.png`, { type: 'image/png' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any
      if (nav.canShare && nav.canShare({ files: [file] })) await nav.share({ files: [file], text: url })
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click() }
    } catch { /* share cancelled */ }
  }

  if (phase === 'lobby') {
    return (
      <Stack data-testid="calls">
        <p className="text-[0.95rem] text-ink-soft leading-relaxed">{s.lead}</p>
        <div className="flex flex-col gap-3 max-w-[24rem]">
          <label className="flex flex-col gap-1"><span className="text-[0.85rem] font-medium text-ink-soft">{s.yourName}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="—" data-testid="call-name" /></label>
          <label className="inline-flex items-center gap-2 text-[0.9rem] text-ink-soft cursor-pointer"><input type="checkbox" checked={wantCam} onChange={(e) => setWantCam(e.target.checked)} className="accent-green-600" /> {s.withCam}</label>
          {initialRoom
            ? <Button variant="primary" disabled={busy} onClick={() => go(true)} data-testid="call-join">{busy ? s.joining : `${s.joinCode} · ${initialRoom}`}</Button>
            : <Button variant="primary" disabled={busy} onClick={() => go(false)} data-testid="call-start">{busy ? s.joining : s.start}</Button>}
        </div>
        <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
        <p className="text-[0.78rem] text-ink-faint">{s.noConnect}</p>
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

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, localePath } from '../../i18n'
import { Stack, Button, Input } from '../../components/ui'
import { DownloadIcon, UploadIcon, ShareIcon, TrashIcon, RefreshIcon, PhoneIcon, EndCallIcon, UsersIcon, ChatIcon, MicIcon, MicOffIcon, CameraIcon, CamOffIcon, PenIcon, ScreenShareIcon, FileIcon } from '../../components/icons'
import type { ReactNode } from 'react'
import { CallRoom, type DataMsg, type PeerInfo } from './rtc'

const SITE = 'https://built-in-saudi.com'
const NAME_KEY = 'bis-call-name'
const HOST_KEY = 'bis-call-host' // the room code this browser is hosting (for reconnect)
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
    participants: 'Participants', endMeeting: 'End meeting', hangUp: 'Leave', sendFiles: 'Send files', muteMe: 'Mute me', unmuteMe: 'Unmute',
    camOn: 'Turn camera on', camOff: 'Turn camera off', mutedBy: 'muted', muteThem: 'Mute for everyone', filesTitle: 'Files', noPreview: 'No preview — download to open', download: 'Download',
    hostGone: 'The host disconnected', endsIn: 'meeting ends in', ended: 'This meeting has ended or can’t be found.', newCall: 'Start a new call',
    joined: 'joined', left: 'left', editName: 'Edit your name',
    privacy: 'All data is peer-to-peer, only the handshake uses the server.',
  },
  ar: {
    title: 'مكالمة خاصة', lead: 'اجتماعات آمنة — الفيديو والسبورة والدردشة والملفات تنتقل مباشرةً بين المتصفحات. فقط المصافحة الأولى، ولا أي بيانات، تمر بخادمنا.',
    yourName: 'اسمك', start: 'ابدأ مكالمة', askJoin: 'اطلب الانضمام', shuffle: 'اسم عشوائي', joining: 'جارٍ الاتصال…', shareInvite: 'مشاركة الدعوة',
    mic: 'المايك', cam: 'الكاميرا', screen: 'مشاركة الشاشة', stopScreen: 'إيقاف المشاركة', board: 'السبورة', chat: 'الدردشة', invite: 'دعوة', leave: 'مغادرة',
    you: 'أنت', waiting: 'بانتظار انضمام آخرين — شارك الدعوة.', clear: 'مسح', typeMsg: 'رسالة…', send: 'إرسال', dropFiles: 'أفلت ملفات للإرسال أو اضغط',
    copied: 'تم نسخ رابط الدعوة', shareHint: 'شارك الرابط — يظهر من يفتحه هنا لتسمح له بالدخول.',
    lobbyList: 'في غرفة الانتظار', admit: 'اسمح بالدخول', waitingHost: 'بانتظار أن يسمح لك المضيف بالدخول…', cancel: 'إلغاء',
    participants: 'المشاركون', endMeeting: 'إنهاء الاجتماع', hangUp: 'مغادرة', sendFiles: 'إرسال ملفات', muteMe: 'اكتم صوتي', unmuteMe: 'ألغِ الكتم',
    camOn: 'تشغيل الكاميرا', camOff: 'إيقاف الكاميرا', mutedBy: 'كتم', muteThem: 'اكتم للجميع', filesTitle: 'الملفات', noPreview: 'لا معاينة — نزّل للفتح', download: 'تنزيل',
    hostGone: 'انقطع اتصال المضيف', endsIn: 'ينتهي الاجتماع خلال', ended: 'انتهى هذا الاجتماع أو تعذّر العثور عليه.', newCall: 'ابدأ مكالمة جديدة',
    joined: 'انضمّ', left: 'غادر', editName: 'عدّل اسمك',
    privacy: 'كل البيانات مباشرة بين الأجهزة، فقط المصافحة تستخدم الخادم.',
  },
}

const initials = (nm: string) => nm.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '•'

function StreamVideo({ stream, className, muted, mirror }: { stream: MediaStream; className?: string; muted?: boolean; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${mirror ? '-scale-x-100 ' : ''}${className || ''}`} />
}

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

// A borderless toolbar icon button: shaded on hover, extra-shaded when active.
function IconBtn({ onClick, title, active, danger, children, testid, badge }: { onClick: () => void; title: string; active?: boolean; danger?: boolean; children: ReactNode; testid?: string; badge?: number }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} data-testid={testid}
      className={`relative grid place-items-center h-9 min-w-9 px-2 rounded-md border-0 cursor-pointer transition-colors [&_svg]:w-[18px] [&_svg]:h-[18px] ${
        danger ? 'bg-transparent text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_15%,transparent)]'
          : active ? 'bg-[color-mix(in_srgb,var(--ink)_15%,transparent)] text-ink'
            : 'bg-transparent text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink'}`}>
      {children}
      {badge ? <span className="absolute -top-1 -end-1 min-w-[15px] h-[15px] px-1 rounded-full bg-gold-500 text-white text-[0.6rem] font-bold grid place-items-center">{badge}</span> : null}
    </button>
  )
}

// A participant square: webcam if their camera is on, else a user icon; name + mute state.
function ParticipantTile({ name, stream, camOn, muted, self, onMute, muteLabel }: { name: string; stream?: MediaStream | null; camOn: boolean; muted: boolean; self: boolean; onMute?: () => void; muteLabel: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (ref.current && stream && ref.current.srcObject !== stream) ref.current.srcObject = stream }, [stream])
  return (
    <div className="group relative aspect-square rounded-lg overflow-hidden bg-[color-mix(in_srgb,var(--ink)_8%,var(--surface))] border border-[color:var(--line-soft)]">
      {camOn && stream
        ? <video ref={ref} autoPlay playsInline muted={self} className={`w-full h-full object-cover ${self ? '-scale-x-100' : ''}`} />
        : <div className="w-full h-full grid place-items-center text-ink-faint/60"><UsersIcon className="w-9 h-9" /></div>}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2 py-1 bg-black/45 text-white text-[0.72rem]">
        {muted ? <MicOffIcon className="w-3.5 h-3.5 text-red-300 shrink-0" /> : <MicIcon className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate flex-1">{name}{self ? ' ·' : ''}</span>
        {!self && onMute && !muted && (
          <button type="button" onClick={onMute} title={muteLabel} aria-label={muteLabel}
            className="opacity-0 group-hover:opacity-100 grid place-items-center w-5 h-5 rounded bg-white/15 hover:bg-white/30 border-0 cursor-pointer transition-opacity">
            <MicOffIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
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
  // If this browser hosted this exact room, opening its ?room link means the host
  // is reconnecting (not a guest) — they can resume within the disconnect grace.
  const [isHostReturn] = useState(() => { try { return !!initialRoom && localStorage.getItem(HOST_KEY) === initialRoom } catch { return false } })
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) || randName(locale === 'ar') } catch { return randName(locale === 'ar') } })
  const [phase, setPhase] = useState<'lobby' | 'hosting' | 'waiting' | 'live' | 'ended'>('lobby')
  const [room, setRoom] = useState(initialRoom)
  const [busy, setBusy] = useState(false)
  const isGuest = !!initialRoom && !isHostReturn
  // Everyone we've connected to (data channel), with the name/role/lobby state
  // they told us peer-to-peer. The host's waiting list is derived from this.
  const [roster, setRoster] = useState<Map<string, PeerInfo>>(new Map())
  const [graceEndsAt, setGraceEndsAt] = useState<number | null>(null) // host-disconnect deadline
  const hadHost = useRef(false)

  const rtc = useRef<CallRoom | null>(null)
  const [local, setLocal] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Map<string, MediaStream>>(new Map())
  const [mic, setMic] = useState(false), [cam, setCam] = useState(false), [sharing, setSharing] = useState(false)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [showParticipants, setShowParticipants] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 640 : true))
  const [showChat, setShowChat] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
  const [view, setView] = useState<'board' | 'file'>('board')
  const [files, setFiles] = useState<{ id: string; name: string; url: string; mime: string; from: string }[]>([])
  const [selected, setSelected] = useState<string>('')
  // Unseen-activity badges (p=participants, c=chat, f=files) — set when a panel is
  // closed; a toast also fires unless you're actively drawing.
  const [unseen, setUnseen] = useState({ p: 0, c: 0, f: 0 })
  const [chat, setChat] = useState<ChatItem[]>([])
  const [msg, setMsg] = useState('')
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const rosterRef = useRef<Map<string, PeerInfo>>(new Map())

  // whiteboard
  const wbRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ x: number; y: number } | null>(null)
  const incoming = useRef<Map<string, { name: string; mime: string; parts: ArrayBuffer[] }>>(new Map())
  const seen = useRef<Map<string, number>>(new Map()) // id → last heartbeat (ms)
  const panelRef = useRef({ p: true, c: false, f: false }) // which panels are open (for notify)
  const knownInCall = useRef<Set<string>>(new Set()) // ids currently in the call (join/leave detection)
  panelRef.current = { p: showParticipants, c: showChat, f: showFiles }

  // Fire a toast for new activity when its panel is closed, and mark a badge. The
  // toast is suppressed while you're actively drawing; the badge persists.
  function notify(panel: 'p' | 'c' | 'f', message: string) {
    if (panelRef.current[panel]) return // they're looking at it live
    setUnseen((u) => ({ ...u, [panel]: u[panel] + 1 }))
    if (drawing.current === null) { setToast(message); window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(''), 3500) }
  }
  const toastT = useRef<number | undefined>(undefined)

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

  rosterRef.current = roster
  const nameOf = useCallback((id: string) => roster.get(id)?.name || '•', [roster])
  // The people the host still needs to let in (guests who haven't joined yet).
  const waiting = [...roster].filter(([, i]) => i.role === 'guest' && !i.inCall)
  // In-call participants (excludes those still knocking in the lobby).
  const inCallPeers = [...roster].filter(([, i]) => i.inCall)

  function onData(id: string, m: DataMsg) {
    if (m.t === 'chat') { setChat((c) => [...c, { from: id, name: m.name, text: m.text }]); notify('c', `${m.name}: ${m.text}`) }
    else if (m.t === 'wb') { if (m.op === 'clear') clearBoard(false); else if (m.stroke) drawSeg(m.stroke, m.color || '#e11', m.width || 3) }
    else if (m.t === 'file-start') incoming.current.set(m.id, { name: m.name, mime: m.mime, parts: [] })
    else if (m.t === 'file-end') {
      const f = incoming.current.get(m.id); if (!f) return
      const url = URL.createObjectURL(new Blob(f.parts, { type: f.mime || 'application/octet-stream' }))
      setFiles((fs) => [...fs, { id: m.id, name: f.name, url, mime: f.mime, from: nameOf(id) }])
      setChat((c) => [...c, { from: id, name: nameOf(id), fileName: f.name, url }])
      incoming.current.delete(m.id)
      notify('f', `${nameOf(id)} · ${f.name}`)
    }
  }
  // most recent file-start id per peer receives the chunks (channels are ordered)
  function onFileChunk(id: string, chunk: ArrayBuffer) { const last = [...incoming.current.values()].pop(); void id; if (last) last.parts.push(chunk) }

  function ensureRoom(code: string): CallRoom {
    if (rtc.current) return rtc.current
    const r = new CallRoom(code, {
      onLocal: (st) => setLocal(st),
      onPeerStream: (pid, st) => setPeers((p) => new Map(p).set(pid, st)),
      onLeave: (pid) => {
        if (knownInCall.current.has(pid)) { knownInCall.current.delete(pid); notify('p', `${rosterRef.current.get(pid)?.name || '•'} ${s.left}`) }
        setPeers((p) => { const n = new Map(p); n.delete(pid); return n }); setRoster((n) => { const m = new Map(n); m.delete(pid); return m })
      },
      onData, onFileChunk,
      onPeerInfo: (id, info) => {
        seen.current.set(id, Date.now())
        if (info.inCall && !knownInCall.current.has(id)) { knownInCall.current.add(id); notify('p', `${info.name || '•'} ${s.joined}`) }
        setRoster((r2) => new Map(r2).set(id, info))
      },
      onAdmitted: () => setPhase('live'), // rtc enables our media itself
      onMuteNotice: (by, targetId, targetIsMe) => {
        if (targetIsMe) setMic(false)
        const who = targetIsMe ? s.you : (rosterRef.current.get(targetId)?.name || '•')
        setToast(`${by} ${s.mutedBy} ${who}`); setTimeout(() => setToast(''), 3500)
      },
      onClosed: () => { rtc.current = null; setPhase('ended') },
    })
    rtc.current = r
    return r
  }
  function mediaError() { setToast('Camera/mic permission needed'); setTimeout(() => setToast(''), 3000) }
  // Put the room code in the URL so it's shareable and rooms are distinguishable.
  function reflectRoom(code: string) { history.replaceState(null, '', `${localePath(locale, '/apps/calls')}?room=${code}`) }

  function rememberHost(code: string) { try { localStorage.setItem(NAME_KEY, name); localStorage.setItem(HOST_KEY, code) } catch { /* */ } }

  // Host: start the call right away (others still need to be let in).
  async function startHost() {
    setBusy(true)
    const code = room || code6(); setRoom(code); reflectRoom(code); rememberHost(code)
    const r = ensureRoom(code); r.enterLobby(name || s.you, true)
    try { await r.enableMedia(); setPhase('live') } catch { mediaError() } finally { setBusy(false) }
  }
  // Host: create + share the link without joining yet; wait to let people in.
  async function shareHost() {
    const code = room || code6(); setRoom(code); reflectRoom(code); rememberHost(code)
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

  // Returning host (reloaded the ?room link) → re-enter the room immediately.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (isHostReturn && !autoStarted.current) { autoStarted.current = true; startHost() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function hangup() {
    if (!isGuest) { rtc.current?.close(); try { localStorage.removeItem(HOST_KEY) } catch { /* */ } } // host ends → nuke the room
    else rtc.current?.leave()
    rtc.current = null; setPhase('lobby'); setPeers(new Map()); setLocal(null); setChat([]); setRoster(new Map()); setGraceEndsAt(null); setFiles([]); setSelected(''); setView('board')
    history.replaceState(null, '', localePath(locale, '/apps/calls'))
  }
  const newCall = () => window.location.assign(localePath(locale, '/apps/calls'))

  // Host-disconnect grace (guests only): if the host vanishes, count down 2 minutes
  // — a returning host cancels it; on expiry the meeting is nuked for everyone.
  const [, setGraceTick] = useState(0)
  useEffect(() => {
    if (phase !== 'live') return
    const hasHost = [...roster].some(([, i]) => i.role === 'host' && i.inCall)
    if (hasHost) { hadHost.current = true; setGraceEndsAt((g) => (g ? null : g)) }
    else if (isGuest && hadHost.current) setGraceEndsAt((g) => g ?? Date.now() + 120_000)
  }, [roster, isGuest, phase])
  useEffect(() => {
    if (graceEndsAt == null) return
    const iv = window.setInterval(() => {
      if (Date.now() >= graceEndsAt) { window.clearInterval(iv); rtc.current?.close(); rtc.current = null; setGraceEndsAt(null); setPhase('ended') }
      else setGraceTick((t) => t + 1)
    }, 1000)
    return () => window.clearInterval(iv)
  }, [graceEndsAt])

  function toggleMic() { const v = !mic; setMic(v); rtc.current?.toggleMic(v) }
  function toggleCam() { const v = !cam; setCam(v); rtc.current?.toggleCam(v) }
  async function toggleScreen() {
    if (sharing) { rtc.current?.stopScreen(); setSharing(false); setScreenStream(null) }
    else {
      const st = await rtc.current?.shareScreen()
      if (st) { setSharing(true); setScreenStream(st); st.getVideoTracks()[0]?.addEventListener('ended', () => { setSharing(false); setScreenStream(null) }) }
    }
  }
  function sendChat() { const t = msg.trim(); if (!t) return; rtc.current?.broadcast({ t: 'chat', name: name || s.you, text: t }); setChat((c) => [...c, { from: 'me', name: s.you, text: t }]); setMsg('') }
  function pickFiles(fl: FileList | null) {
    if (!fl) return
    for (const f of fl) {
      rtc.current?.sendFile(f)
      const id = `me-${Date.now()}-${f.name}`, url = URL.createObjectURL(f)
      setFiles((fs) => [...fs, { id, name: f.name, url, mime: f.type, from: s.you }])
      setChat((c) => [...c, { from: 'me', name: s.you, fileName: f.name, url }])
    }
  }
  function openFile(id: string) { setSelected(id); setView('file'); setShowFiles(true) }
  function forceMute(id: string) { rtc.current?.forceMute(id); setToast(`${name || s.you} ${s.mutedBy} ${nameOf(id)}`); setTimeout(() => setToast(''), 3500) }
  function toggleParticipants() { setShowParticipants((v) => { if (!v) { setShowChat(false); setUnseen((u) => ({ ...u, p: 0 })) } return !v }) }
  function toggleChat() { setShowChat((v) => { if (!v) { setShowParticipants(false); setUnseen((u) => ({ ...u, c: 0 })) } return !v }) }
  function toggleFiles() { setShowFiles((v) => { if (!v) setUnseen((u) => ({ ...u, f: 0 })); return !v }) }
  function deleteFile(id: string) {
    const gone = files.find((f) => f.id === id); if (gone) URL.revokeObjectURL(gone.url)
    const rest = files.filter((f) => f.id !== id)
    setFiles(rest)
    if (rest.length === 0) { setView('board'); setShowFiles(false); setSelected('') } // last file → back to whiteboard
    else if (selected === id) setSelected(rest[0].id)
  }

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
  // Size the whiteboard to its container in the live layout, and on resize.
  useEffect(() => {
    if (phase !== 'live') return
    const fit = () => { const c = wbRef.current; if (c && (c.width !== c.clientWidth || c.height !== c.clientHeight)) { c.width = c.clientWidth; c.height = c.clientHeight } }
    const t = window.setTimeout(fit, 30); window.addEventListener('resize', fit)
    return () => { window.clearTimeout(t); window.removeEventListener('resize', fit) }
  }, [phase, view, showParticipants, showChat, showFiles, files.length])

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

  if (phase === 'ended') {
    return (
      <Stack data-testid="calls">
        <div className="max-w-[30rem] rounded-lg border border-[color:var(--line)] bg-[var(--surface)] p-6 flex flex-col items-start gap-4" data-testid="call-ended">
          <p className="text-[1.05rem] text-ink">{s.ended}</p>
          <Button variant="primary" onClick={newCall}>{s.newCall}</Button>
        </div>
      </Stack>
    )
  }

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

  const selectedFile = files.find((f) => f.id === selected)
  const participantCount = 1 + inCallPeers.length
  // Whoever is screen-sharing becomes the main stage for everyone.
  const presenterPeer = inCallPeers.find(([, i]) => i.sharing)
  const presenterStream = sharing ? screenStream : (presenterPeer ? peers.get(presenterPeer[0]) : null)
  const presenting = !!presenterStream
  const graceLeft = graceEndsAt ? Math.max(0, graceEndsAt - Date.now()) : 0
  const graceMMSS = `${Math.floor(graceLeft / 60000)}:${String(Math.floor((graceLeft % 60000) / 1000)).padStart(2, '0')}`

  // Portal to <body> so `fixed inset-0` truly covers the viewport (an animated/
  // transformed ancestor would otherwise become its containing block).
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-[var(--bg)]" data-testid="calls-live"
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFiles(e.dataTransfer.files) }}>
      {/* ---- sticky toolbar (replaces the site navbar during a call) ---- */}
      <header className="flex items-center gap-1.5 px-2 sm:px-3 py-2 border-b border-[color:var(--line)] bg-[var(--surface)] flex-wrap">
        <div className="flex items-center gap-0.5">
          {editingName
            ? <input value={name} autoFocus onChange={(e) => setName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false) }} aria-label={s.yourName} data-testid="call-name"
                className="h-9 w-[8.5rem] sm:w-40 px-2.5 rounded-md border border-green-500 bg-[var(--bg)] text-[0.9rem] text-ink focus:outline-none" />
            : <button type="button" onClick={() => setEditingName(true)} title={s.editName} data-testid="call-name-display"
                className="h-9 max-w-[9rem] px-2.5 rounded-md bg-transparent border-0 text-[0.9rem] font-medium text-ink truncate hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] cursor-text text-start">{name || '—'}</button>}
          <IconBtn onClick={() => setName(randName(locale === 'ar'))} title={s.shuffle} testid="call-shuffle"><RefreshIcon /></IconBtn>
        </div>
        <IconBtn onClick={hangup} title={isGuest ? s.hangUp : s.endMeeting} danger testid="call-hangup">{isGuest ? <PhoneIcon /> : <EndCallIcon />}</IconBtn>
        <IconBtn onClick={invite} title={s.shareInvite} testid="call-invite"><ShareIcon /></IconBtn>

        <div className="flex-1" />

        <IconBtn onClick={() => setView('board')} active={view === 'board'} title={s.board} testid="call-board"><PenIcon /></IconBtn>
        {files.length > 0 && <IconBtn onClick={toggleFiles} active={showFiles} title={s.filesTitle} testid="call-files-btn" badge={unseen.f || undefined}><FileIcon /></IconBtn>}
        <IconBtn onClick={toggleScreen} active={sharing} title={s.screen}><ScreenShareIcon /></IconBtn>
        <IconBtn onClick={() => fileRef.current?.click()} title={s.sendFiles} testid="call-files"><UploadIcon /></IconBtn>
        <span className="w-px h-6 bg-[color:var(--line)] mx-0.5" />
        <IconBtn onClick={toggleParticipants} active={showParticipants} title={s.participants} testid="call-participants" badge={unseen.p || undefined}><UsersIcon /></IconBtn>
        <IconBtn onClick={toggleChat} active={showChat} title={s.chat} badge={unseen.c || undefined}><ChatIcon /></IconBtn>
        <span className="w-px h-6 bg-[color:var(--line)] mx-0.5" />
        <IconBtn onClick={toggleCam} active={cam} title={cam ? s.camOff : s.camOn}>{cam ? <CameraIcon /> : <CamOffIcon />}</IconBtn>
        <IconBtn onClick={toggleMic} active={mic} danger={!mic} title={mic ? s.muteMe : s.unmuteMe} testid="call-mic">{mic ? <MicIcon /> : <MicOffIcon />}</IconBtn>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { pickFiles(e.target.files); e.target.value = '' }} />
      </header>

      {graceEndsAt && (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-[0.85rem] font-medium text-white bg-[var(--danger)] border-b border-black/10" data-testid="call-grace">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" /> {s.hostGone} — {s.endsIn} <span className="font-mono tabular-nums">{graceMMSS}</span>
        </div>
      )}

      {/* ---- body ---- */}
      <div className="flex-1 flex min-h-0 relative">
        {/* files list (left) — shown only when the Files panel is toggled open */}
        {showFiles && files.length > 0 && (
          <aside className="w-48 sm:w-56 shrink-0 border-e border-[color:var(--line)] bg-[var(--surface)] overflow-y-auto p-2 flex flex-col gap-0.5 max-[640px]:absolute max-[640px]:inset-0 max-[640px]:w-full max-[640px]:z-30" data-testid="call-filelist">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint px-1 py-1">{s.filesTitle} · {files.length}</p>
            {files.map((f) => (
              <div key={f.id} className={`group flex items-center rounded-md ${selected === f.id && view === 'file' ? 'bg-[color-mix(in_srgb,var(--ink)_12%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]'}`}>
                <button type="button" onClick={() => openFile(f.id)} className="flex-1 min-w-0 text-start px-2 py-1.5 text-[0.82rem] bg-transparent border-0 cursor-pointer text-ink truncate">
                  {f.name}<span className="block text-[0.68rem] text-ink-faint truncate">{f.from}</span>
                </button>
                <button type="button" onClick={() => deleteFile(f.id)} title={s.clear} aria-label={s.clear} data-testid="call-file-del"
                  className="opacity-0 group-hover:opacity-100 grid place-items-center w-7 h-7 me-1 rounded bg-transparent border-0 text-ink-faint hover:text-[var(--danger)] cursor-pointer shrink-0"><TrashIcon className="w-4 h-4" /></button>
              </div>
            ))}
          </aside>
        )}

        {/* main stage: screen-share or file preview (behind) + whiteboard on top */}
        <main className={`flex-1 relative min-w-0 ${presenting || view === 'file' ? 'bg-[color-mix(in_srgb,var(--ink)_90%,black)]' : 'bg-white'}`}>
          {presenting && presenterStream && (
            <StreamVideo stream={presenterStream} muted className="absolute inset-0 w-full h-full object-contain" />
          )}
          {!presenting && view === 'file' && selectedFile && (
            <div className="absolute inset-0 grid place-items-center p-4 overflow-auto">
              {selectedFile.mime.startsWith('image/')
                ? <img src={selectedFile.url} alt={selectedFile.name} className="max-w-full max-h-full object-contain" />
                : <a href={selectedFile.url} download={selectedFile.name} className="flex flex-col items-center gap-2 text-sand-100/80">
                    <DownloadIcon className="w-8 h-8" /><span className="text-[0.9rem]">{selectedFile.name}</span><span className="text-[0.78rem] opacity-70">{s.noPreview}</span>
                  </a>}
            </div>
          )}
          <canvas ref={wbRef} className="absolute inset-0 w-full h-full cursor-crosshair touch-none" onPointerDown={wbDown} onPointerMove={wbMove} onPointerUp={wbUp} onPointerLeave={wbUp} />
          <button type="button" onClick={() => clearBoard()} title={s.clear} aria-label={s.clear}
            className="absolute bottom-3 start-3 grid place-items-center w-9 h-9 rounded-full bg-[var(--surface)] border border-[color:var(--line)] text-ink-soft shadow-[var(--shadow-sm)] hover:text-[var(--danger)] cursor-pointer"><TrashIcon className="w-4 h-4" /></button>
        </main>

        {/* right dock: participants or chat (fullscreen overlay on mobile) */}
        {showParticipants && (
          <aside className="w-56 sm:w-64 shrink-0 border-s border-[color:var(--line)] bg-[var(--surface)] overflow-y-auto p-2.5 flex flex-col gap-2.5 max-[640px]:absolute max-[640px]:inset-0 max-[640px]:w-full max-[640px]:z-30" data-testid="call-participants-panel">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint px-1">{s.participants} · {participantCount}</p>
            {!isGuest && waiting.length > 0 && <LobbyList waiting={waiting} admit={admit} hint={s.shareHint} title={s.lobbyList} admitLabel={s.admit} live />}
            <div className="grid grid-cols-2 gap-2">
              <ParticipantTile name={name || s.you} stream={local} camOn={cam} muted={!mic} self muteLabel={s.muteThem} />
              {inCallPeers.map(([id, info]) => (
                <ParticipantTile key={id} name={info.name || '•'} stream={peers.get(id)} camOn={info.cam} muted={info.muted} self={false} onMute={() => forceMute(id)} muteLabel={s.muteThem} />
              ))}
            </div>
          </aside>
        )}
        {showChat && (
          <aside className="w-64 sm:w-72 shrink-0 border-s border-[color:var(--line)] bg-[var(--surface)] flex flex-col max-[640px]:absolute max-[640px]:inset-0 max-[640px]:w-full max-[640px]:z-30" data-testid="call-chat-panel">
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 text-[0.9rem]">
              {chat.map((m, i) => (
                <div key={i} className={m.from === 'me' ? 'text-end' : ''}>
                  <span className="text-[0.72rem] text-ink-faint">{m.name}</span>{' '}
                  {m.url ? <a href={m.url} download={m.fileName} className="text-green-700 underline inline-flex items-center gap-1"><DownloadIcon className="w-3.5 h-3.5" />{m.fileName}</a>
                    : m.fileName ? <span className="text-ink-faint">↑ {m.fileName}</span>
                      : <span className="text-ink">{m.text}</span>}
                </div>
              ))}
            </div>
            <div className="flex gap-2 p-2 border-t border-[color:var(--line)]">
              <Input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendChat() }} placeholder={s.typeMsg} className="flex-1" />
              <Button variant="primary" onClick={sendChat}>{s.send}</Button>
            </div>
          </aside>
        )}
      </div>

      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] bg-green-700 text-sand-100 px-4 py-2 rounded-md shadow-[var(--shadow-md)] text-[0.9rem]">{toast}</div>}
    </div>,
    document.body,
  )
}

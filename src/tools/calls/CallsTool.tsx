import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, localePath } from '../../i18n'
import { Button, Input } from '../../components/ui'
import { DownloadIcon, UploadIcon, ShareIcon, TrashIcon, RefreshIcon, GripIcon, PhoneIcon, EndCallIcon, UsersIcon, UserPlusIcon, ChatIcon, MicIcon, MicOffIcon, CameraIcon, CamOffIcon, WhiteboardIcon, ScreenShareIcon, FileIcon, EraserIcon, UndoIcon, ChevronDownIcon, CopyIcon, LockIcon } from '../../components/icons'
import type { ReactNode } from 'react'
import { CallRoom, type DataMsg, type PeerInfo, type WbObj } from './rtc'
import { setInCall } from '../../lib/inCall'

const oid = () => Math.random().toString(36).slice(2, 10)
const WB_COLORS = ['#e11', '#151515', '#1f7a3f', '#2563eb', '#f59e0b']
const WB_FONT = 'Arial, Helvetica, sans-serif' // safe font shared by the editor + canvas render
const TXT_PAD = 5 // px inset of text inside the box (matches the editor's padding+border)
// Word-wrap `text` to `maxW` px using the ctx's current font. Honours explicit
// newlines and breaks over-long tokens by character.
function wrapLines(x: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (!isFinite(maxW) || !para) { out.push(para); continue }
    let cur = ''
    for (let tok of para.match(/\S+\s*/g) || [para]) {
      if (x.measureText(cur + tok).width <= maxW) { cur += tok; continue }
      if (cur) { out.push(cur.replace(/\s+$/, '')); cur = '' }
      while (x.measureText(tok).width > maxW && tok.length > 1) {
        let i = 1; while (i < tok.length && x.measureText(tok.slice(0, i + 1)).width <= maxW) i++
        out.push(tok.slice(0, i)); tok = tok.slice(i)
      }
      cur = tok
    }
    out.push(cur.replace(/\s+$/, ''))
  }
  return out
}

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
  ['Rabee', 'ربيع'],
]
const randName = (ar: boolean) => { const b = crypto.getRandomValues(new Uint8Array(1)); const p = KUNYA[b[0] % KUNYA.length]; return ar ? `أبو ${p[1]}` : `Abu ${p[0]}` }
const isDefaultName = (n: string) => KUNYA.some(([en, ar]) => n === `Abu ${en}` || n === `أبو ${ar}`)

const STR = {
  en: {
    title: 'Private call', lead: 'Secure meetings — video, whiteboard, chat and files go straight between browsers. Only the initial handshake, never any data, touches our server.',
    yourName: 'Your name', start: 'Start call', askJoin: 'Ask to join', startOwn: 'Start your own call instead', shuffle: 'Random name', rememberName: 'Tick to remember your name', joining: 'Connecting…', shareInvite: 'Share invite',
    mic: 'Mic', cam: 'Camera', screen: 'Share screen', stopScreen: 'Stop sharing', board: 'Whiteboard', chat: 'Chat', invite: 'Invite', leave: 'Leave',
    you: 'You', waiting: 'Waiting for others to join — share the invite.', clear: 'Clear', typeMsg: 'Message…', send: 'Send', noMessages: 'No messages yet', close: 'Close', reconnecting: 'Quiet — reconnecting…', dropFiles: 'Drop files to send, or tap',
    copied: 'Invite link copied', copy: 'Copy link', copyDone: 'Copied!', shareQrUrl: 'Share QR + URL', shareHint: 'Share the link — people who open it appear here for you to let in.',
    lobbyList: 'Waiting in the lobby', admit: 'Let in', waitingHost: 'Waiting for the host to let you in…', cancel: 'Cancel',
    participants: 'Participants', endMeeting: 'End meeting', hangUp: 'Leave', sendFiles: 'Drop files', dropHere: 'Drop files to share with everyone', muteMe: 'Mute me', unmuteMe: 'Unmute',
    camOn: 'Turn camera on', camOff: 'Turn camera off', mutedBy: 'muted', muteThem: 'Mute for everyone', filesTitle: 'Files', noPreview: 'No preview — download to open', download: 'Download',
    hostGone: 'The host disconnected', endsIn: 'meeting ends in', ended: 'This meeting has ended or can’t be found.', newCall: 'Start a new call',
    youEnded: 'You have left the call', youEndedMeeting: 'You ended the meeting.', stillThere: (n: number) => `${n} ${n === 1 ? 'participant is' : 'participants are'} still there`, rejoin: 'Rejoin', createNew: 'Create a new meeting',
    joined: 'joined', left: 'left', editName: 'Edit your name',
    rotate: 'Rotate (snaps to 45°)', moveText: 'Move', widthText: 'Drag to set width', smaller: 'Smaller', bigger: 'Bigger',
    privacy: 'All data is peer-to-peer, only the handshake uses the server.',
  },
  ar: {
    title: 'مكالمة خاصة', lead: 'اجتماعات آمنة — الفيديو والسبورة والدردشة والملفات تنتقل مباشرةً بين المتصفحات. فقط المصافحة الأولى، ولا أي بيانات، تمر بخادمنا.',
    yourName: 'اسمك', start: 'ابدأ مكالمة', askJoin: 'اطلب الانضمام', startOwn: 'ابدأ مكالمتك الخاصة بدلًا من ذلك', shuffle: 'اسم عشوائي', rememberName: 'حدّد لتذكّر اسمك', joining: 'جارٍ الاتصال…', shareInvite: 'مشاركة الدعوة',
    mic: 'المايك', cam: 'الكاميرا', screen: 'مشاركة الشاشة', stopScreen: 'إيقاف المشاركة', board: 'السبورة', chat: 'الدردشة', invite: 'دعوة', leave: 'مغادرة',
    you: 'أنت', waiting: 'بانتظار انضمام آخرين — شارك الدعوة.', clear: 'مسح', typeMsg: 'رسالة…', send: 'إرسال', noMessages: 'لا رسائل بعد', close: 'إغلاق', reconnecting: 'صامت — إعادة الاتصال…', dropFiles: 'أفلت ملفات للإرسال أو اضغط',
    copied: 'تم نسخ رابط الدعوة', copy: 'نسخ الرابط', copyDone: 'تم النسخ!', shareQrUrl: 'مشاركة الرمز والرابط', shareHint: 'شارك الرابط — يظهر من يفتحه هنا لتسمح له بالدخول.',
    lobbyList: 'في غرفة الانتظار', admit: 'اسمح بالدخول', waitingHost: 'بانتظار أن يسمح لك المضيف بالدخول…', cancel: 'إلغاء',
    participants: 'المشاركون', endMeeting: 'إنهاء الاجتماع', hangUp: 'مغادرة', sendFiles: 'أفلت الملفات', dropHere: 'أفلت الملفات لمشاركتها مع الجميع', muteMe: 'اكتم صوتي', unmuteMe: 'ألغِ الكتم',
    camOn: 'تشغيل الكاميرا', camOff: 'إيقاف الكاميرا', mutedBy: 'كتم', muteThem: 'اكتم للجميع', filesTitle: 'الملفات', noPreview: 'لا معاينة — نزّل للفتح', download: 'تنزيل',
    hostGone: 'انقطع اتصال المضيف', endsIn: 'ينتهي الاجتماع خلال', ended: 'انتهى هذا الاجتماع أو تعذّر العثور عليه.', newCall: 'ابدأ مكالمة جديدة',
    youEnded: 'غادرت المكالمة', youEndedMeeting: 'أنهيت الاجتماع.', stillThere: (n: number) => `لا يزال ${n} من المشاركين هنا`, rejoin: 'أعد الانضمام', createNew: 'أنشئ اجتماعًا جديدًا',
    joined: 'انضمّ', left: 'غادر', editName: 'عدّل اسمك',
    rotate: 'تدوير (يثبُت على ٤٥°)', moveText: 'تحريك', widthText: 'اسحب لتحديد العرض', smaller: 'أصغر', bigger: 'أكبر',
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
function LobbyList({ waiting, admit, hint, title, admitLabel, live, staleIds }: { waiting: [string, PeerInfo][]; admit: (id: string) => void; hint: string; title: string; admitLabel: string; live?: boolean; staleIds?: Set<string> }) {
  if (waiting.length === 0) return live ? null : <p className="max-w-[30rem] text-[0.85rem] text-ink-faint">{hint}</p>
  return (
    <div className="max-w-[30rem] rounded-lg border border-[color:var(--line)] bg-[var(--surface)] p-4 flex flex-col gap-2.5" data-testid={live ? 'call-lobby-live' : 'call-lobby'}>
      <p className="text-[0.82rem] font-semibold text-ink-soft flex items-center justify-between">{title} <span className="font-mono text-ink-faint">{waiting.length}</span></p>
      {waiting.map(([id, info]) => (
        <div key={id} className={`flex items-center gap-3 transition-opacity duration-500 ${staleIds?.has(id) ? 'opacity-40' : ''}`}>
          <span className="w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--color-green-400)_22%,transparent)] text-green-700 grid place-items-center text-[0.78rem] font-semibold shrink-0" aria-hidden="true">{initials(info.name)}</span>
          <span className="flex-1 text-[0.92rem] text-ink truncate">{info.name || '•'}</span>
          <Button variant="primary" onClick={() => admit(id)} data-testid="call-admit" className="!py-1 !px-3 text-[0.8rem] shrink-0">{admitLabel}</Button>
        </div>
      ))}
    </div>
  )
}

// A borderless toolbar icon button: shaded on hover, extra-shaded when active.
function IconBtn({ onClick, title, active, danger, children, testid, badge, big }: { onClick: () => void; title: string; active?: boolean; danger?: boolean; children: ReactNode; testid?: string; badge?: number; big?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} data-testid={testid}
      className={`relative grid place-items-center h-9 min-w-9 px-2 rounded-md border-0 cursor-pointer transition-colors ${big ? '[&_svg]:w-[23px] [&_svg]:h-[23px]' : '[&_svg]:w-[18px] [&_svg]:h-[18px]'} ${
        danger ? 'bg-transparent text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_15%,transparent)]'
          : active ? 'bg-[color-mix(in_srgb,var(--ink)_15%,transparent)] text-ink'
            : 'bg-transparent text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink'}`}>
      {children}
      {badge ? <span className="absolute -top-1 -end-1 min-w-[15px] h-[15px] px-1 rounded-full bg-gold-500 text-white text-[0.6rem] font-bold grid place-items-center">{badge}</span> : null}
    </button>
  )
}

// A dropdown: a trigger button + a floating panel that closes on outside click.
function Menu({ trigger, triggerClass, children, align = 'start', up, testid, full }: { trigger: ReactNode; triggerClass?: string; children: ReactNode; align?: 'start' | 'end'; up?: boolean; testid?: string; full?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!open) return; const h = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }; document.addEventListener('pointerdown', h); return () => document.removeEventListener('pointerdown', h) }, [open])
  return (
    <div ref={ref} className={`relative ${full ? 'w-full' : ''}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} data-testid={testid} className={triggerClass}>{trigger}</button>
      {open && (
        // max-w keeps it on-screen; `full` makes it span the trigger width (mobile bars).
        <div onClick={() => setOpen(false)} className={`absolute z-40 ${full ? 'w-full' : 'min-w-[11rem]'} max-w-[calc(100vw-1rem)] bg-[var(--surface)] border border-[color:var(--line)] rounded-lg shadow-[var(--shadow-md)] p-1 ${up ? 'bottom-full mb-1' : 'top-full mt-1'} ${align === 'end' ? 'end-0' : 'start-0'}`}>{children}</div>
      )}
    </div>
  )
}
function MenuItem({ icon, label, onClick, active, testid }: { icon?: ReactNode; label: string; onClick: () => void; active?: boolean; testid?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-start text-[0.88rem] bg-transparent border-0 cursor-pointer whitespace-nowrap hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] [&_svg]:w-[18px] [&_svg]:h-[18px] ${active ? 'text-green-700 font-semibold' : 'text-ink'}`}>
      {icon}{label}
    </button>
  )
}
const dropTrigger = 'flex items-center gap-1.5 h-9 px-2.5 rounded-md border-0 bg-transparent text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink cursor-pointer text-[0.9rem] font-medium [&_svg]:w-[18px] [&_svg]:h-[18px]'

// A participant square. The <video> stays mounted whenever there's a stream (so
// audio always plays even with the camera off); the avatar just overlays it.
function ParticipantTile({ name, stream, camOn, muted, self, onMute, muteLabel, idle, idleLabel }: { name: string; stream?: MediaStream | null; camOn: boolean; muted: boolean; self: boolean; onMute?: () => void; muteLabel: string; idle?: boolean; idleLabel?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { const el = ref.current; if (el && stream && el.srcObject !== stream) { el.srcObject = stream; el.play?.().catch(() => {}) } }, [stream])
  return (
    <div className={`group relative aspect-square rounded-lg overflow-hidden bg-[color-mix(in_srgb,var(--ink)_8%,var(--surface))] border border-[color:var(--line-soft)] transition-[opacity,filter] duration-500 ${idle ? 'opacity-40 grayscale' : ''}`} title={idle ? idleLabel : undefined}>
      {stream && <video ref={ref} autoPlay playsInline muted={self} className={`absolute inset-0 w-full h-full object-cover ${self ? '-scale-x-100' : ''} ${camOn ? '' : 'invisible'}`} />}
      {!camOn && <div className="absolute inset-0 grid place-items-center bg-[color-mix(in_srgb,var(--ink)_8%,var(--surface))] text-ink-faint/60"><UsersIcon className="w-9 h-9" /></div>}
      {idle && <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-black/30 animate-pulse" aria-hidden="true" />}
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
  // Captured once at mount — we later rewrite the URL to /join?code=…, which must
  // not flip this (it determines host vs guest). `room=` is accepted for old links.
  const [initialRoom] = useState(() => { const p = new URLSearchParams(window.location.search); return p.get('code') || p.get('room') || '' })
  // If this browser hosted this exact room, opening its ?room link means the host
  // is reconnecting (not a guest) — they can resume within the disconnect grace.
  const [isHostReturn] = useState(() => { try { return !!initialRoom && localStorage.getItem(HOST_KEY) === initialRoom } catch { return false } })
  // Only remember a name the user actually TYPED. A stored value that's just the
  // random "Abu …" default (saved by the old behaviour) is ignored → fresh suggestion.
  const storedName = (() => { try { const st = localStorage.getItem(NAME_KEY); return st && !isDefaultName(st) ? st : '' } catch { return '' } })()
  const [name, setName] = useState(() => storedName || randName(locale === 'ar'))
  // A typed (non-default) name shows a "remember me" checkbox; only a ticked custom
  // name is persisted — the random "Abu …" default never sticks.
  const [remember, setRemember] = useState(!!storedName)
  const nameCustom = name.trim() !== '' && !isDefaultName(name)
  function saveName() { try { if (remember && nameCustom) localStorage.setItem(NAME_KEY, name); else localStorage.removeItem(NAME_KEY) } catch { /* */ } }
  const [phase, setPhase] = useState<'lobby' | 'hosting' | 'waiting' | 'live' | 'ended'>('lobby')
  const [room, setRoom] = useState(initialRoom)
  const [busy, setBusy] = useState(false)
  const [forceHost, setForceHost] = useState(false) // escape a stale ?room= guest lobby
  const isGuest = !!initialRoom && !isHostReturn && !forceHost
  // Everyone we've connected to (data channel), with the name/role/lobby state
  // they told us peer-to-peer. The host's waiting list is derived from this.
  const [roster, setRoster] = useState<Map<string, PeerInfo>>(new Map())
  const [graceEndsAt, setGraceEndsAt] = useState<number | null>(null) // host-disconnect deadline
  const hadHost = useRef(false)
  const [ended, setEnded] = useState<{ reason: 'left' | 'ended' | 'gone'; count: number }>({ reason: 'gone', count: 0 })

  const rtc = useRef<CallRoom | null>(null)
  const [local, setLocal] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Map<string, MediaStream>>(new Map())
  const [mic, setMic] = useState(false), [cam, setCam] = useState(false), [sharing, setSharing] = useState(false)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [showParticipants, setShowParticipants] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 640 : true))
  const [showChat, setShowChat] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const dragDepth = useRef(0) // enter/leave fire per child; count to know when we've truly left
  const [shareOpen, setShareOpen] = useState(false)
  const sharedRef = useRef(false) // has the host opened the share dialog at least once?
  const [shareUrl, setShareUrl] = useState('')
  const [shareQr, setShareQr] = useState('')
  const [copiedShare, setCopiedShare] = useState(false)
  const [view, setView] = useState<'board' | 'file'>('board')
  const [files, setFiles] = useState<{ id: string; name: string; url: string; mime: string; from: string }[]>([])
  const [selected, setSelected] = useState<string>('')
  // Unseen-activity badges (p=participants, c=chat, f=files) — set when a panel is
  // closed; a toast also fires unless you're actively drawing.
  const [unseen, setUnseen] = useState({ p: 0, c: 0, f: 0 })
  const [chat, setChat] = useState<ChatItem[]>([])
  const [msg, setMsg] = useState('')
  const [toast, setToast] = useState('')
  const [selfAspect, setSelfAspect] = useState(1) // our whiteboard canvas w/h
  const fileRef = useRef<HTMLInputElement>(null)
  const rosterRef = useRef<Map<string, PeerInfo>>(new Map())

  // whiteboard (object model synced P2P). Each context — the pure board, each
  // shared file, and a screen-share — has its OWN board, keyed below.
  const wbRef = useRef<HTMLCanvasElement>(null)
  const objects = useRef<Map<string, WbObj[]>>(new Map()) // board key → objects (z-order)
  const myStack = useRef<Map<string, string[]>>(new Map()) // board key → ids I added (undo)
  const drawing = useRef<{ board: string; obj: Extract<WbObj, { kind: 'stroke' }> } | null>(null)
  const boardKeyRef = useRef('board') // the active board, set each render from the current view
  const lastPt = useRef<{ x: number; y: number; t: number } | null>(null) // last pointer sample (screen px) for velocity
  const [tool, setTool] = useState<'pen' | 'eraser' | 'text'>('pen')
  const [penColor, setPenColor] = useState(WB_COLORS[0])
  const [penW, setPenW] = useState(0.01) // stroke width as a fraction of the board
  // Text being placed/edited: an object with position, size (board units) and rotation.
  // Text being placed/edited — carries its own text + wrap width so a commit never
  // races with opening a new box (the "goes blank" bug).
  type TextDraft = { u: number; v: number; size: number; rot: number; w: number; text: string }
  const [draft, setDraft] = useState<TextDraft | null>(null)
  const draftRef = useRef<TextDraft | null>(null) // mirror so we can commit from anywhere
  const [textSize, setTextSize] = useState(0.035) // remembered font size (board units)
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const textReady = useRef(false)
  const DEFAULT_TW = 0.4 // default text wrap width (board fraction)
  const incoming = useRef<Map<string, { name: string; mime: string; parts: ArrayBuffer[] }>>(new Map())
  const seen = useRef<Map<string, number>>(new Map()) // id → last heartbeat (ms)
  const panelRef = useRef({ p: true, c: false, f: false }) // which panels are open (for notify)
  const knownInCall = useRef<Set<string>>(new Set()) // ids currently in the call (join/leave detection)
  panelRef.current = { p: showParticipants, c: showChat, f: false }

  // Fire a toast for new activity when its panel is closed, and mark a badge. The
  // toast is suppressed while you're actively drawing; the badge persists.
  function notify(panel: 'p' | 'c' | 'f', message: string) {
    if (panelRef.current[panel]) return // they're looking at it live
    setUnseen((u) => ({ ...u, [panel]: u[panel] + 1 }))
    if (drawing.current === null) { setToast(message); window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(''), 3500) }
  }
  const toastT = useRef<number | undefined>(undefined)

  // Liveness (heartbeat refreshes `seen` every 2s over the data channel):
  //  • quiet > IDLE_MS  → dim the peer (a hiccup, or they're stepping away)
  //  • quiet > GONE_MS  → drop them (tab closed / really gone)
  const IDLE_MS = 5000, GONE_MS = 15_000
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    const iv = window.setInterval(() => {
      const now = Date.now()
      setRoster((r) => {
        let changed = false; const m = new Map(r)
        for (const id of [...m.keys()]) if ((seen.current.get(id) || 0) < now - GONE_MS) { m.delete(id); seen.current.delete(id); changed = true }
        return changed ? m : r
      })
      const stale = new Set<string>()
      for (const [id] of rosterRef.current) if ((seen.current.get(id) || 0) < now - IDLE_MS) stale.add(id)
      setStaleIds((prev) => (prev.size === stale.size && [...stale].every((id) => prev.has(id)) ? prev : stale))
    }, 1200)
    return () => window.clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  rosterRef.current = roster
  const nameOf = useCallback((id: string) => roster.get(id)?.name || '•', [roster])
  // The people the host still needs to let in (guests who haven't joined yet).
  const waiting = [...roster].filter(([, i]) => i.role === 'guest' && !i.inCall)
  // Someone showed up in the waiting list → close the Share invite so the host sees them.
  useEffect(() => { if (waiting.length > 0) setShareOpen(false) }, [waiting.length])
  // In-call participants (excludes those still knocking in the lobby).
  const inCallPeers = [...roster].filter(([, i]) => i.inCall)
  // When a peer joins the call, the host sends the current whiteboard(s) so they
  // see scribbles made before they arrived. Everyone else dedupes by id (no-op).
  const prevInCall = useRef(0)
  useEffect(() => {
    const n = inCallPeers.length
    if (!isGuest && n > prevInCall.current) {
      const boards = [...objects.current.entries()].filter(([, o]) => o.length) as [string, WbObj[]][]
      if (boards.length) rtc.current?.broadcast({ t: 'wb-sync', boards })
    }
    prevInCall.current = n
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCallPeers.length, isGuest])

  function onData(id: string, m: DataMsg) {
    if (m.t === 'chat') { setChat((c) => [...c, { from: id, name: m.name, text: m.text }]); notify('c', `${m.name}: ${m.text}`) }
    else if (m.t === 'wb') {
      const bk = m.b || 'board'; const active = bk === boardKeyRef.current
      if (m.op === 'clear') { objects.current.set(bk, []); if (active) redraw() }
      else if (m.op === 'start') { boardOf(bk).push({ id: m.id, kind: 'stroke', pts: [...m.pt], color: m.color, width: m.width, erase: m.erase, wds: [m.w ?? m.width] }); if (active) redraw() }
      else if (m.op === 'point') { const o = boardOf(bk).find((x) => x.id === m.id); if (o && o.kind === 'stroke') { o.pts.push(...m.pt); (o.wds ||= []).push(m.w ?? o.width); if (active) drawLastSeg(o) } }
      else if (m.op === 'text') { boardOf(bk).push(m.obj); if (active) redraw() }
      else if (m.op === 'remove') { objects.current.set(bk, boardOf(bk).filter((x) => x.id !== m.id)); if (active) redraw() }
    }
    else if (m.t === 'wb-sync') { // a full board snapshot for us (we joined late) — merge by id
      for (const [k, objs] of m.boards) { const arr = boardOf(k); const have = new Set(arr.map((o) => o.id)); for (const o of objs) if (!have.has(o.id)) arr.push(o) }
      redraw()
    }
    else if (m.t === 'file-start') incoming.current.set(m.id, { name: m.name, mime: m.mime, parts: [] })
    else if (m.t === 'file-end') {
      const f = incoming.current.get(m.id); if (!f) return
      const url = URL.createObjectURL(new Blob(f.parts, { type: f.mime || 'application/octet-stream' }))
      setFiles((fs) => [...fs, { id: m.id, name: f.name, url, mime: f.mime, from: nameOf(id) }])
      setChat((c) => [...c, { from: id, name: nameOf(id), fileName: f.name, url }])
      incoming.current.delete(m.id)
      openFile(m.id) // a dropped file is selected for everyone
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
        // Only announce join/leave once WE'RE in the call (a waiting guest shouldn't
        // hear about the meeting's comings and goings).
        if (knownInCall.current.has(pid)) { knownInCall.current.delete(pid); if (rtc.current?.inCall) notify('p', `${rosterRef.current.get(pid)?.name || '•'} ${s.left}`) }
        setPeers((p) => { const n = new Map(p); n.delete(pid); return n }); setRoster((n) => { const m = new Map(n); m.delete(pid); return m })
      },
      onData, onFileChunk,
      onPeerInfo: (id, info) => {
        seen.current.set(id, Date.now())
        if (info.inCall && !knownInCall.current.has(id)) { knownInCall.current.add(id); if (rtc.current?.inCall) notify('p', `${info.name || '•'} ${s.joined}`) }
        setRoster((r2) => new Map(r2).set(id, info))
      },
      onAdmitted: () => setPhase('live'), // rtc enables our media itself
      onMuteNotice: (by, targetId, targetIsMe) => {
        if (targetIsMe) setMic(false)
        const who = targetIsMe ? s.you : (rosterRef.current.get(targetId)?.name || '•')
        setToast(`${by} ${s.mutedBy} ${who}`); setTimeout(() => setToast(''), 3500)
      },
      onClosed: () => { rtc.current = null; setEnded({ reason: 'gone', count: 0 }); setPhase('ended') },
    })
    rtc.current = r
    return r
  }
  function mediaError() { setToast('Camera/mic permission needed'); setTimeout(() => setToast(''), 3000) }
  // Put the room code in the URL so it's shareable and rooms are distinguishable.
  function rememberHost(code: string) { saveName(); try { localStorage.setItem(HOST_KEY, code) } catch { /* */ } }
  // URL for an in-call / invite link vs the bare start page.
  const joinPath = (code: string) => `${localePath(locale, '/apps/calls')}/join?code=${code}`
  const lobbyPath = () => localePath(locale, '/apps/calls')

  // Host: start the call right away (others still need to be let in).
  async function startHost() {
    setBusy(true)
    const code = room || code6(); setRoom(code); rememberHost(code)
    const r = ensureRoom(code); r.enterLobby(name || s.you, true)
    try { await r.enableMedia(); setPhase('live'); if (!sharedRef.current) openShareModal(code) } catch { mediaError() } finally { setBusy(false) }
  }
  // Escape a stale ?room= link: drop the room, become a host, clean the URL.
  function startOwnCall() { setForceHost(true); setRoom(''); try { history.replaceState(null, '', lobbyPath()) } catch { /* */ } }
  // Guest: knock and wait for the host to admit.
  function askToJoin() {
    saveName()
    const code = room.trim(); if (!code) return
    const r = ensureRoom(code); r.enterLobby(name || s.you, false)
    setPhase('waiting')
  }
  // Host: let a specific waiting guest into the call (going live if needed).
  async function admit(id: string) {
    try { await rtc.current?.admit(id); setPhase('live') } catch { mediaError() }
  }

  useEffect(() => () => { rtc.current?.leave() }, [])
  // Tell the deploy auto-reload to hold off while we're engaged in a call.
  useEffect(() => {
    setInCall(phase === 'hosting' || phase === 'waiting' || phase === 'live')
    return () => setInCall(false)
  }, [phase])

  // Returning host (reloaded the ?room link) → re-enter the room immediately.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (isHostReturn && !autoStarted.current) { autoStarted.current = true; startHost() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Entering a call pushes ONE history entry (the room link), so the browser Back
  // button LEAVES the call and returns to a clean lobby — never a stale ?room= trap.
  const pushedCall = useRef(false)
  useEffect(() => {
    const inCall = phase === 'hosting' || phase === 'waiting' || phase === 'live'
    if (inCall && !pushedCall.current && room) {
      pushedCall.current = true
      try { history.pushState({ bisCall: true }, '', joinPath(room)) } catch { /* */ }
    } else if (!inCall) pushedCall.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, room])
  useEffect(() => {
    const onPop = () => {
      if (!pushedCall.current) return // not in a call → let the browser navigate away normally
      pushedCall.current = false
      rtc.current?.leave(); rtc.current = null; resetLive()
      setForceHost(true); setRoom(''); setPhase('lobby') // land on a clean host lobby
      try { history.replaceState(null, '', lobbyPath()) } catch { /* */ }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetLive() { setPeers(new Map()); setLocal(null); setChat([]); setRoster(new Map()); setGraceEndsAt(null); setFiles([]); setSelected(''); setView('board'); setSharing(false); setScreenStream(null); setShareOpen(false); knownInCall.current.clear(); objects.current.clear(); myStack.current.clear() }
  function hangup() {
    if (!isGuest) {
      // Host leaving ends the meeting for everyone (the relay is marked closed, so
      // every peer's poll returns closed → they're dropped into the ended screen).
      rtc.current?.close(); try { localStorage.removeItem(HOST_KEY) } catch { /* */ }
      setEnded({ reason: 'ended', count: 0 }); rtc.current = null; resetLive(); setPhase('ended')
    } else {
      // Guest leaving: show the "you left" screen (with a way back in), not a
      // confusing "ask to join" for the room you just left.
      const others = inCallPeers.length
      rtc.current?.leave(); rtc.current = null; resetLive()
      setEnded({ reason: 'left', count: others }); setPhase('ended')
      history.replaceState(null, '', lobbyPath())
    }
  }
  function rejoin() { setEnded({ reason: 'gone', count: 0 }); setPhase('lobby'); if (isGuest) askToJoin(); else startHost() }
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
      if (Date.now() >= graceEndsAt) { window.clearInterval(iv); rtc.current?.close(); rtc.current = null; setGraceEndsAt(null); setEnded({ reason: 'gone', count: 0 }); setPhase('ended') }
      else setGraceTick((t) => t + 1)
    }, 1000)
    return () => window.clearInterval(iv)
  }, [graceEndsAt])

  // Acquire the device on turn-on and release it on turn-off (so the browser's
  // in-use indicator clears when muted/off). Revert the button if permission is denied.
  async function toggleMic() { const v = !mic; setMic(v); const ok = await rtc.current?.toggleMic(v); if (v && ok === false) setMic(false) }
  async function toggleCam() { const v = !cam; setCam(v); const ok = await rtc.current?.toggleCam(v); if (v && ok === false) setCam(false) }
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
    let lastId = ''
    for (const f of fl) {
      const id = oid(), url = URL.createObjectURL(f) // shared id → same board key on every peer
      rtc.current?.sendFile(f, id)
      setFiles((fs) => [...fs, { id, name: f.name, url, mime: f.type, from: s.you }])
      setChat((c) => [...c, { from: 'me', name: s.you, fileName: f.name, url }])
      lastId = id
    }
    if (lastId) openFile(lastId) // show it to me; peers auto-open it on receipt too
  }
  function openFile(id: string) { setSelected(id); setView('file'); setUnseen((u) => ({ ...u, f: 0 })) }
  function forceMute(id: string) { rtc.current?.forceMute(id); setToast(`${name || s.you} ${s.mutedBy} ${nameOf(id)}`); setTimeout(() => setToast(''), 3500) }
  function toggleParticipants() { setShowParticipants((v) => { if (!v) { setShowChat(false); setUnseen((u) => ({ ...u, p: 0 })) } return !v }) }
  function toggleChat() { setShowChat((v) => { if (!v) { setShowParticipants(false); setUnseen((u) => ({ ...u, c: 0 })) } return !v }) }
  // Keyboard shortcuts (live only): M mute · W whiteboard · S screen · F file · C chat · P/A participants.
  const kbd = useRef<{ live: boolean; act: Record<string, () => void> }>({ live: false, act: {} })
  kbd.current = { live: phase === 'live', act: {
    M: () => toggleMic(), W: () => { setView('board'); setSelected('') }, S: () => toggleScreen(),
    F: () => fileRef.current?.click(), C: () => toggleChat(), P: () => toggleParticipants(), A: () => toggleParticipants(),
  } }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!kbd.current.live || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const fn = kbd.current.act[e.key.toUpperCase()]
      if (fn) { e.preventDefault(); fn() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  function deleteFile(id: string) {
    const gone = files.find((f) => f.id === id); if (gone) URL.revokeObjectURL(gone.url)
    objects.current.delete(`f:${id}`); myStack.current.delete(`f:${id}`) // drop its whiteboard
    const rest = files.filter((f) => f.id !== id)
    setFiles(rest)
    if (rest.length === 0) { setView('board'); setSelected('') } // last file → back to whiteboard
    else if (selected === id) setSelected(rest[0].id)
  }

  // ---- whiteboard ----
  // Coordinates are centred and aspect-preserving: the shorter side spans [-0.5,0.5]
  // and the longer side extends beyond, so a stroke looks the same shape on every
  // screen. Each client sees a different window; the non-common area is faded.
  const halfExtents = (a: number) => [0.5 * Math.max(a, 1), 0.5 * Math.max(1 / a, 1)] as const
  function wbPt(e: React.PointerEvent) {
    const c = wbRef.current!; const r = c.getBoundingClientRect()
    const [hx, hy] = halfExtents(r.width / r.height)
    return { x: ((e.clientX - r.left) / r.width - 0.5) * 2 * hx, y: ((e.clientY - r.top) / r.height - 0.5) * 2 * hy }
  }
  function mapper(c: HTMLCanvasElement) {
    const [hx, hy] = halfExtents(c.width / c.height); const sc = Math.min(c.width, c.height)
    return { sc, px: (u: number) => (u / (2 * hx) + 0.5) * c.width, py: (v: number) => (v / (2 * hy) + 0.5) * c.height }
  }
  // Width (board fraction) at point index i, falling back to the constant base.
  const segW = (o: Extract<WbObj, { kind: 'stroke' }>, i: number) => (o.wds?.[i] ?? o.width)
  // Draw one smoothed, variable-width segment "around" point index i (quadratic
  // through the midpoints of (i-1,i-2)…(i-1,i), so speed-tapered widths blend).
  function strokeSeg(x: CanvasRenderingContext2D, m: ReturnType<typeof mapper>, o: Extract<WbObj, { kind: 'stroke' }>, i: number) {
    const P = (k: number): [number, number] => [m.px(o.pts[2 * k]), m.py(o.pts[2 * k + 1])]
    x.beginPath(); x.lineWidth = Math.max(0.75, segW(o, i) * m.sc)
    if (i >= 2) {
      const [ax, ay] = P(i - 2), [bx, by] = P(i - 1), [cx, cy] = P(i)
      x.moveTo((ax + bx) / 2, (ay + by) / 2); x.quadraticCurveTo(bx, by, (bx + cx) / 2, (by + cy) / 2)
    } else { const [ax, ay] = P(0), [bx, by] = P(1); x.moveTo(ax, ay); x.lineTo(bx, by) }
    x.stroke()
  }
  function drawObj(x: CanvasRenderingContext2D, m: ReturnType<typeof mapper>, o: WbObj) {
    if (o.kind === 'stroke') {
      x.save(); if (o.erase) x.globalCompositeOperation = 'destination-out'
      x.strokeStyle = o.color; x.fillStyle = o.color; x.lineCap = 'round'; x.lineJoin = 'round'
      const n = o.pts.length / 2
      if (n <= 1) { const r = Math.max(0.5, (segW(o, 0) * m.sc) / 2); x.beginPath(); x.arc(m.px(o.pts[0]), m.py(o.pts[1]), r, 0, Math.PI * 2); x.fill() } // a dot
      else for (let i = 1; i < n; i++) strokeSeg(x, m, o, i)
      x.restore()
    } else {
      x.save(); x.translate(m.px(o.u), m.py(o.v)); x.rotate(((o.rot || 0) * Math.PI) / 180)
      const fs = Math.max(10, o.size * m.sc)
      x.fillStyle = o.color; x.font = `600 ${fs}px ${WB_FONT}`; x.textBaseline = 'top'
      const maxW = o.w ? o.w * m.sc : Infinity
      const lines = wrapLines(x, o.text, maxW)
      lines.forEach((ln, i) => x.fillText(ln, TXT_PAD, TXT_PAD + i * fs * 1.3)) // TXT_PAD matches the editor's inset
      x.restore()
    }
  }
  function drawLastSeg(o: WbObj) {
    if (o.kind !== 'stroke') return; const c = wbRef.current; if (!c) return; const x = c.getContext('2d'); if (!x) return
    const m = mapper(c); const n = o.pts.length / 2; if (n < 2) return
    x.save(); if (o.erase) x.globalCompositeOperation = 'destination-out'
    x.strokeStyle = o.color; x.lineCap = 'round'; x.lineJoin = 'round'
    strokeSeg(x, m, o, n - 1); x.restore()
  }
  // Per-board object/undo lists (created on first use).
  const boardOf = (key: string) => { let a = objects.current.get(key); if (!a) { a = []; objects.current.set(key, a) } return a }
  const stackOf = (key: string) => { let a = myStack.current.get(key); if (!a) { a = []; myStack.current.set(key, a) } return a }
  function redraw() {
    const c = wbRef.current; if (!c) return; const x = c.getContext('2d'); if (!x) return
    const m = mapper(c); x.clearRect(0, 0, c.width, c.height); for (const o of boardOf(boardKeyRef.current)) drawObj(x, m, o)
  }
  // Drop an editable text box on the board (commit any open one first).
  function placeText(u: number, v: number) { finishDraft(); setTool('text'); setDraft({ u, v, size: textSize, rot: 0, w: DEFAULT_TW, text: '' }) }
  function wbDown(e: React.PointerEvent) {
    if (tool === 'text') { const p = wbPt(e); placeText(p.x, p.y); return }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const board = boardKeyRef.current
    const p = wbPt(e); const id = oid(); const erase = tool === 'eraser'
    const o: Extract<WbObj, { kind: 'stroke' }> = { id, kind: 'stroke', pts: [p.x, p.y], color: erase ? '#000' : penColor, width: penW, erase, wds: [penW] }
    boardOf(board).push(o); stackOf(board).push(id); drawing.current = { board, obj: o }
    lastPt.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
    rtc.current?.broadcast({ t: 'wb', op: 'start', id, pt: [p.x, p.y], color: o.color, width: penW, erase, w: penW, b: board })
  }
  // Taper the brush with pointer speed (px/ms): slow = thick (up to 1.25× base),
  // fast = thin (down to 0.4× base) — the "living pen" feel from the signature pad.
  function speedWidth(e: React.PointerEvent, base: number) {
    const prev = lastPt.current; if (!prev) return base
    const speed = Math.hypot(e.clientX - prev.x, e.clientY - prev.y) / Math.max(1, e.timeStamp - prev.t)
    const mul = Math.max(0.4, Math.min(1.25, 1.25 - speed * 0.55))
    return base * mul
  }
  function wbMove(e: React.PointerEvent) {
    const d = drawing.current; if (!d) return; const o = d.obj
    const p = wbPt(e); const w = speedWidth(e, o.width)
    o.pts.push(p.x, p.y); (o.wds ||= []).push(w); lastPt.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
    drawLastSeg(o); rtc.current?.broadcast({ t: 'wb', op: 'point', id: o.id, pt: [p.x, p.y], w, b: d.board })
  }
  function wbUp() { drawing.current = null }
  function commitDraft(d: TextDraft) {
    const t = d.text.trim(); if (!t) return
    const board = boardKeyRef.current
    const o: WbObj = { id: oid(), kind: 'text', u: d.u, v: d.v, text: t, color: penColor, size: d.size, rot: d.rot, w: d.w }
    boardOf(board).push(o); stackOf(board).push(o.id); rtc.current?.broadcast({ t: 'wb', op: 'text', obj: o, b: board }); redraw()
  }
  // Commit the current draft (if it has text) and close it. Called on blur / new box.
  function finishDraft() { const d = draftRef.current; draftRef.current = null; if (d) { commitDraft(d); setDraft(null) } }
  const upd = (patch: Partial<TextDraft>) => setDraft((d) => { if (!d) return d; const n = { ...d, ...patch }; draftRef.current = n; return n })
  // Board→screen (client px, relative to the canvas box) for positioning the text editor.
  function b2s(u: number, v: number) {
    const c = wbRef.current; if (!c) return { x: 0, y: 0, sc: 1 }
    const w = c.clientWidth, h = c.clientHeight; const [hx, hy] = halfExtents(w / h)
    return { x: (u / (2 * hx) + 0.5) * w, y: (v / (2 * hy) + 0.5) * h, sc: Math.min(w, h) }
  }
  // Drag a text handle: move the anchor, rotate (snapped to 45°), or set the wrap width.
  function dragText(e: React.PointerEvent, mode: 'move' | 'rotate' | 'width') {
    e.preventDefault(); e.stopPropagation()
    const c = wbRef.current, d0 = draftRef.current; if (!c || !d0) return
    const sc = Math.min(c.clientWidth, c.clientHeight)
    const sx = e.clientX, sy = e.clientY
    const r = c.getBoundingClientRect(); const a = b2s(d0.u, d0.v); const cx = r.left + a.x, cy = r.top + a.y
    const rad = (d0.rot * Math.PI) / 180
    const move = (ev: PointerEvent) => {
      if (mode === 'move') upd({ u: d0.u + (ev.clientX - sx) / sc, v: d0.v + (ev.clientY - sy) / sc })
      else if (mode === 'rotate') { const raw = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90; const near = Math.round(raw / 45) * 45; upd({ rot: Math.abs(raw - near) <= 5 ? near : raw }) } // snap only within 5° of a 45° angle
      else { const localDx = (ev.clientX - sx) * Math.cos(rad) + (ev.clientY - sy) * Math.sin(rad); upd({ w: Math.max(0.08, Math.min(1.6, d0.w + localDx / sc)) }) }
    }
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up) }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up)
  }
  function bumpTextSize(delta: number) {
    const d = draftRef.current; if (!d) return
    const size = Math.min(0.14, Math.max(0.014, d.size + delta)); setTextSize(size); upd({ size })
  }
  function undo() { const board = boardKeyRef.current; const id = stackOf(board).pop(); if (!id) return; objects.current.set(board, boardOf(board).filter((o) => o.id !== id)); redraw(); rtc.current?.broadcast({ t: 'wb', op: 'remove', id, b: board }) }
  function clearBoard(broadcast = true) { const board = boardKeyRef.current; objects.current.set(board, []); myStack.current.set(board, []); redraw(); if (broadcast) rtc.current?.broadcast({ t: 'wb', op: 'clear', b: board }) }
  // Size the whiteboard to its container in the live layout, and on resize.
  useEffect(() => {
    if (phase !== 'live') return
    const fit = () => { const c = wbRef.current; if (!c) return; if (c.width !== c.clientWidth || c.height !== c.clientHeight) { c.width = c.clientWidth; c.height = c.clientHeight }; const a = c.clientWidth / (c.clientHeight || 1); setSelfAspect(a); rtc.current?.setAspect(a); redraw() }
    const t = window.setTimeout(fit, 30); window.addEventListener('resize', fit)
    return () => { window.clearTimeout(t); window.removeEventListener('resize', fit) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, view, selected, sharing, roster, showParticipants, showChat, files.length])

  useEffect(() => { draftRef.current = draft }, [draft])
  // Auto-grow the text box to fit its wrapped content (on text/width/size change).
  useEffect(() => { const el = textInputRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }, [draft?.text, draft?.w, draft?.size])
  // Focus the text box a tick after it opens (autoFocus gets blurred by the click
  // that placed it, since the canvas isn't focusable). Ignore that first blur.
  useEffect(() => {
    if (!draft) { textReady.current = false; return }
    const t = window.setTimeout(() => { textReady.current = true; textInputRef.current?.focus() }, 60)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.u, draft?.v])

  // A screen-share gets a fresh annotation whiteboard on top (and back to a clean
  // board when it ends). Everyone observes the same share state, so all clear.
  // (Per-board whiteboards mean a screen-share gets its own 'screen' board; no need
  // to wipe the pure board when sharing starts.)

  async function shareInvite(code = room) {
    const url = `${SITE}${joinPath(code)}`
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
  // Open the share modal (QR + link + native share). Works before a call too: if
  // there's no room yet we quietly become the host (sharing without joining).
  async function openShareModal(existing?: string) {
    sharedRef.current = true
    let code = existing || room
    if (!code) { code = code6(); setRoom(code); rememberHost(code); ensureRoom(code).enterLobby(name || s.you, true); setPhase('hosting') }
    const url = `${SITE}${joinPath(code)}`
    setShareUrl(url); setShareQr(''); setCopiedShare(false); setShareOpen(true)
    try { const QR = (await import('qrcode')).default; setShareQr(await QR.toDataURL(url, { margin: 1, width: 320, color: { dark: '#0e5a3f', light: '#ffffff' } })) } catch { /* offline */ }
  }
  async function copyShareUrl() { try { await navigator.clipboard.writeText(shareUrl); setCopiedShare(true); setTimeout(() => setCopiedShare(false), 1500) } catch { /* */ } }
  const invite = () => openShareModal()

  const shareModal = shareOpen ? createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 max-[520px]:p-0" onClick={() => setShareOpen(false)} data-testid="call-share-modal">
      <div className="w-full max-w-[23rem] max-[520px]:max-w-none max-[520px]:h-full max-[520px]:rounded-none rounded-2xl bg-green-700 text-sand-100 shadow-[var(--shadow-lg)] p-6 flex flex-col gap-4 items-center max-[520px]:justify-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center w-full">
          <h3 className="flex-1 font-display text-[1.15rem] text-sand-100">{s.shareInvite}</h3>
          <button type="button" onClick={() => setShareOpen(false)} aria-label={s.leave} data-testid="call-share-close" className="w-8 h-8 -me-1 grid place-items-center rounded-md bg-transparent border-0 text-sand-100/70 hover:text-sand-100 hover:bg-white/10 cursor-pointer text-[1.2rem] leading-none">✕</button>
        </div>
        <div className="w-56 h-56 grid place-items-center rounded-xl bg-white p-2.5 shadow-inner">
          {shareQr ? <img src={shareQr} alt="QR" className="w-full h-full" data-testid="call-share-qr" /> : <span className="text-ink-faint text-[0.85rem]">…</span>}
        </div>
        <button type="button" onClick={copyShareUrl} data-testid="call-share-copy"
          className="w-full h-11 rounded-md bg-white/10 text-sand-100 font-medium text-[0.9rem] flex items-center justify-center gap-2 hover:bg-white/20 border border-sand-100/25 cursor-pointer [&_svg]:w-4 [&_svg]:h-4">
          {copiedShare ? <span className="text-green-400 font-bold" aria-hidden="true">✓</span> : <CopyIcon />} {copiedShare ? s.copyDone : s.copy}
        </button>
        <button type="button" onClick={() => shareInvite()} data-testid="call-share-do"
          className="w-full h-11 rounded-md bg-sand-100 text-green-700 font-semibold flex items-center justify-center gap-2 hover:bg-white border-0 cursor-pointer [&_svg]:w-4 [&_svg]:h-4"><ShareIcon /> {s.shareQrUrl}</button>
      </div>
    </div>, document.body) : null

  // Full-screen green setup/ended screen (no site chrome) — the app's front door.
  const greenWrap = 'fixed inset-0 z-[80] overflow-auto bg-green-700 text-sand-100 flex flex-col items-center justify-center px-6 py-10'
  const cream = 'w-full h-12 rounded-md bg-sand-100 text-green-700 font-semibold text-[0.95rem] flex items-center justify-center gap-2 hover:bg-white disabled:opacity-60 disabled:hover:bg-sand-100 border-0 cursor-pointer transition-colors'
  const ghost = 'w-full h-11 rounded-md bg-white/10 text-sand-100 font-medium text-[0.9rem] flex items-center justify-center gap-2 hover:bg-white/20 border border-sand-100/25 cursor-pointer transition-colors'
  const phoneLogo = <EndCallIcon className="w-24 h-24 text-green-500 shrink-0" />

  if (phase === 'ended') {
    return createPortal(
      <div className={greenWrap} data-testid="calls">
        <div className="w-full max-w-[22rem] flex flex-col items-center gap-5 text-center" data-testid="call-ended">
          {phoneLogo}
          {ended.reason === 'left' ? (
            <>
              <p className="text-[1.2rem] font-display">{s.youEnded}</p>
              {ended.count > 0 && <p className="text-[0.9rem] text-sand-100/75">{s.stillThere(ended.count)}</p>}
              <div className="w-full flex flex-col gap-3">
                <button className={cream} onClick={rejoin} data-testid="call-rejoin">{s.rejoin}</button>
                <button className={ghost} onClick={newCall}>{s.createNew}</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[1.15rem] font-display leading-relaxed">{ended.reason === 'ended' ? s.youEndedMeeting : s.ended}</p>
              <button className={cream} onClick={newCall}>{s.createNew}</button>
            </>
          )}
        </div>
      </div>, document.body)
  }

  if (phase !== 'live') {
    return createPortal(
      <div className={greenWrap} data-testid="calls">
        <div className="w-full max-w-[22rem] flex flex-col items-center gap-5">
          {phoneLogo}
          {phase === 'waiting' ? (
            <>
              <p className="text-center text-[1rem] leading-relaxed text-sand-100/90 flex items-center gap-2" data-testid="call-waiting">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--gold-500)] animate-pulse" /> {s.waitingHost}
              </p>
              <p className="font-mono text-[1.1rem] tracking-[0.15em] text-sand-100/70">{room}</p>
              <button className={ghost} onClick={hangup} data-testid="call-cancel">{s.cancel}</button>
            </>
          ) : (
            <>
              <p className="text-center text-[0.95rem] leading-relaxed text-sand-100/85">{s.lead}</p>
              <div className="w-full flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[0.8rem] font-medium text-sand-100/80 ps-0.5">{s.yourName}:</span>
                  <div className="relative">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={s.yourName} aria-label={s.yourName} data-testid="call-name" className="pe-11 h-12" />
                    {nameCustom ? (
                      // Typed your own name → offer to remember it (with a nudge bubble).
                      <>
                        {!remember && (
                          <div className="absolute bottom-full end-1 mb-2 z-10 w-max max-w-[13rem] rounded-lg bg-sand-100 text-green-900 text-[0.72rem] font-medium px-2.5 py-1.5 shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:end-4 after:border-[6px] after:border-transparent after:border-t-sand-100" data-testid="call-remember-hint">{s.rememberName}</div>
                        )}
                        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} data-testid="call-remember" title={s.rememberName} aria-label={s.rememberName}
                          className="absolute inset-y-0 end-3 my-auto w-5 h-5 accent-green-600 cursor-pointer" />
                      </>
                    ) : (
                      <button type="button" onClick={() => setName(randName(locale === 'ar'))} title={s.shuffle} aria-label={s.shuffle} data-testid="call-shuffle"
                        className="absolute inset-y-0 end-1.5 my-auto h-8 w-8 grid place-items-center rounded-md bg-transparent border-0 text-ink-faint hover:text-ink hover:bg-black/5 cursor-pointer">
                        <RefreshIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </label>
                {isGuest ? (
                  <>
                    <button className={cream} disabled={busy} onClick={askToJoin} data-testid="call-join">{busy ? s.joining : s.askJoin}</button>
                    <button type="button" onClick={startOwnCall} data-testid="call-start-own"
                      className="text-[0.82rem] text-sand-100/70 hover:text-sand-100 bg-transparent border-0 cursor-pointer underline underline-offset-2">{s.startOwn}</button>
                  </>
                ) : (
                  <div className="flex gap-3">
                    <button className={`${cream} flex-1`} disabled={busy} onClick={startHost} data-testid="call-start">{busy ? s.joining : s.start}</button>
                    <button type="button" onClick={() => openShareModal()} data-testid="call-share"
                      className="flex-1 h-12 rounded-md bg-white/10 text-sand-100 font-semibold text-[0.95rem] flex items-center justify-center gap-2 hover:bg-white/20 border border-sand-100/25 cursor-pointer transition-colors [&_svg]:w-4 [&_svg]:h-4"><UserPlusIcon /> {s.invite}</button>
                  </div>
                )}
              </div>
              <p className="text-[0.78rem] text-sand-100/70 flex items-start gap-1.5"><LockIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span>{s.privacy}</span></p>
            </>
          )}

          {/* Host waiting list (people knocking), or a hint while nobody's here yet. */}
          {!isGuest && phase === 'hosting' && (
            <div className="w-full">
              {waiting.length > 0
                ? <LobbyList waiting={waiting} admit={admit} hint="" title={s.lobbyList} admitLabel={s.admit} staleIds={staleIds} live />
                : <p className="text-center text-[0.85rem] text-sand-100/70">{s.shareHint}</p>}
            </div>
          )}
        </div>

        {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-sand-100 px-4 py-2 rounded-md shadow-[var(--shadow-md)] text-[0.9rem]">{toast}</div>}
        {shareModal}
      </div>, document.body)
  }

  const selectedFile = files.find((f) => f.id === selected)
  const participantCount = 1 + inCallPeers.length
  // Whoever is screen-sharing becomes the main stage for everyone.
  const presenterPeer = inCallPeers.find(([, i]) => i.sharing)
  const presenterStream = sharing ? screenStream : (presenterPeer ? peers.get(presenterPeer[0]) : null)
  const presenting = !!presenterStream
  // The active whiteboard follows the stage: a screen-share, a file, or the pure board.
  boardKeyRef.current = presenting ? 'screen' : view === 'file' && selected ? `f:${selected}` : 'board'
  // Whiteboard: fade the part of our canvas that isn't in everyone's common view.
  const selfHx = 0.5 * Math.max(selfAspect, 1), selfHy = 0.5 * Math.max(1 / selfAspect, 1)
  const asp = [selfAspect, ...inCallPeers.map(([, i]) => i.aspect || 1)]
  const cx = Math.min(...asp.map((a) => 0.5 * Math.max(a, 1))), cy = Math.min(...asp.map((a) => 0.5 * Math.max(1 / a, 1)))
  const fadeX = (0.5 - cx / (2 * selfHx)) * 100, fadeY = (0.5 - cy / (2 * selfHy)) * 100
  const showFade = view === 'board' && !presenting && (fadeX > 0.5 || fadeY > 0.5)
  const graceLeft = graceEndsAt ? Math.max(0, graceEndsAt - Date.now()) : 0
  const graceMMSS = `${Math.floor(graceLeft / 60000)}:${String(Math.floor((graceLeft % 60000) / 1000)).padStart(2, '0')}`

  // Portal to <body> so `fixed inset-0` truly covers the viewport (an animated/
  // transformed ancestor would otherwise become its containing block).
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-[var(--bg)]" data-testid="calls-live"
      onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); dragDepth.current++; setDragOver(true) } }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
      onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragOver(false) }}
      onDrop={(e) => { e.preventDefault(); dragDepth.current = 0; setDragOver(false); pickFiles(e.dataTransfer.files) }}>
      {shareModal}
      {/* ---- sticky toolbar (replaces the site navbar during a call) ---- */}
      <header className="flex items-center gap-1.5 px-2 sm:px-3 py-2 border-b border-[color:var(--line)] bg-[var(--surface)] flex-wrap">
        {editingName
          ? <div className="relative">
              <input value={name} autoFocus onChange={(e) => setName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false) }} aria-label={s.yourName} data-testid="call-name"
                className="h-9 w-[8.5rem] sm:w-44 ps-2.5 pe-8 rounded-md border border-green-500 bg-[var(--bg)] text-[0.9rem] text-ink focus:outline-none" />
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setName(randName(locale === 'ar'))} title={s.shuffle} aria-label={s.shuffle} data-testid="call-shuffle"
                className="absolute inset-y-0 end-1 my-auto h-7 w-7 grid place-items-center rounded bg-transparent border-0 text-ink-faint hover:text-ink hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] cursor-pointer [&_svg]:w-4 [&_svg]:h-4"><RefreshIcon /></button>
            </div>
          : <button type="button" onClick={() => setEditingName(true)} title={s.editName} data-testid="call-name-display"
              className="h-9 max-w-[12rem] px-2.5 rounded-md bg-transparent border-0 text-[0.9rem] font-medium text-ink hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] cursor-text text-start flex items-center gap-1">
              <span className="truncate">{name || '—'}</span>{inCallPeers.length > 0 && <span className="text-ink-faint shrink-0">+{inCallPeers.length}</span>}</button>}
        <IconBtn onClick={invite} title={s.shareInvite} testid="call-invite"><UserPlusIcon /></IconBtn>

        <div className="flex-1" />

        {/* main-view dropdown: whiteboard / share screen / drop files (upload lives here) */}
        <Menu testid="call-view" triggerClass={dropTrigger} align="end"
          trigger={<>{presenting ? <ScreenShareIcon /> : view === 'file' ? <FileIcon /> : <WhiteboardIcon />}<span className="max-[420px]:hidden max-w-[9rem] truncate">{presenting ? s.screen : view === 'file' ? (selectedFile?.name || s.filesTitle) : s.board}</span><ChevronDownIcon className="w-3.5 h-3.5 opacity-60 shrink-0" /></>}>
          <MenuItem icon={<WhiteboardIcon />} label={s.board} onClick={() => { setView('board'); setSelected('') }} active={view === 'board' && !presenting} testid="view-board" />
          <MenuItem icon={<ScreenShareIcon />} label={sharing ? s.stopScreen : s.screen} onClick={toggleScreen} active={sharing} />
          <MenuItem icon={<UploadIcon />} label={s.sendFiles} onClick={() => fileRef.current?.click()} testid="call-upload" />
        </Menu>

        {/* participants / chat / call controls — top on desktop, bottom bar on mobile */}
        <span className="w-px h-6 bg-[color:var(--line)] mx-0.5 max-[640px]:hidden" />
        <span className="max-[640px]:hidden flex items-center gap-1.5">
          <IconBtn onClick={toggleParticipants} active={showParticipants} title={s.participants} testid="call-participants" badge={unseen.p || undefined}><UsersIcon /></IconBtn>
          <IconBtn onClick={toggleChat} active={showChat} title={s.chat} badge={unseen.c || undefined}><ChatIcon /></IconBtn>
          <span className="w-px h-6 bg-[color:var(--line)] mx-0.5" />
          <IconBtn onClick={toggleCam} active={cam} title={cam ? s.camOff : s.camOn} testid="call-cam">{cam ? <CameraIcon /> : <CamOffIcon />}</IconBtn>
          <IconBtn onClick={toggleMic} active={mic} danger={!mic} title={mic ? s.muteMe : s.unmuteMe} testid="call-mic">{mic ? <MicIcon /> : <MicOffIcon />}</IconBtn>
          <IconBtn onClick={hangup} title={isGuest ? s.hangUp : s.endMeeting} danger big testid="call-hangup">{isGuest ? <PhoneIcon /> : <EndCallIcon />}</IconBtn>
        </span>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { pickFiles(e.target.files); e.target.value = '' }} />
      </header>

      {/* MOBILE file picker: a full-width dropdown docked under the toolbar (the
          desktop equivalent is the docked side panel). */}
      {files.length > 0 && (
        <div className="hidden max-[640px]:block border-b border-[color:var(--line)] bg-[var(--surface)] px-2 py-1.5" data-testid="call-filebar">
          <Menu full testid="call-filebar-menu"
            triggerClass="flex items-center justify-between gap-1.5 w-full h-9 px-2.5 rounded-md border border-[color:var(--line)] bg-[var(--bg)] text-[0.9rem] text-ink cursor-pointer [&_svg]:w-[18px] [&_svg]:h-[18px]"
            trigger={<><span className="flex items-center gap-1.5 min-w-0"><FileIcon />{unseen.f > 0 && <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />}<span className="truncate">{view === 'file' && selectedFile ? selectedFile.name : `${s.filesTitle} · ${files.length}`}</span></span><ChevronDownIcon className="opacity-60 shrink-0" /></>}>
            {files.map((f) => (
              <div key={f.id} className={`group flex items-center rounded-md ${selected === f.id && view === 'file' ? 'bg-[color-mix(in_srgb,var(--ink)_12%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]'}`}>
                <button type="button" onClick={() => openFile(f.id)} data-testid="call-file-open" className="flex-1 min-w-0 text-start px-2 py-2 text-[0.85rem] bg-transparent border-0 cursor-pointer text-ink truncate">
                  {f.name}<span className="block text-[0.66rem] text-ink-faint truncate">{f.from}</span>
                </button>
                <a href={f.url} download={f.name} title={s.download} aria-label={s.download} data-testid="call-file-dl"
                  className="grid place-items-center w-8 h-8 rounded bg-transparent text-ink-faint hover:text-green-700 cursor-pointer shrink-0"><DownloadIcon className="w-4 h-4" /></a>
                <button type="button" onClick={() => deleteFile(f.id)} title={s.clear} aria-label={s.clear} data-testid="call-file-del"
                  className="grid place-items-center w-8 h-8 me-1 rounded bg-transparent border-0 text-ink-faint hover:text-[var(--danger)] cursor-pointer shrink-0"><TrashIcon className="w-4 h-4" /></button>
              </div>
            ))}
          </Menu>
        </div>
      )}

      {graceEndsAt && (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-[0.85rem] font-medium text-white bg-[var(--danger)] border-b border-black/10" data-testid="call-grace">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" /> {s.hostGone} — {s.endsIn} <span className="font-mono tabular-nums">{graceMMSS}</span>
        </div>
      )}

      {/* ---- body ---- */}
      <div className="flex-1 flex min-h-0 relative">
        {/* docked file list — DESKTOP only (mobile uses the Files dropdown) */}
        {files.length > 0 && (
          <aside className="flex max-[640px]:hidden w-48 sm:w-56 shrink-0 flex-col border-e border-[color:var(--line)] bg-[var(--surface)] overflow-y-auto p-2 gap-0.5" data-testid="call-filelist">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint px-1 py-1">{s.filesTitle} · {files.length}</p>
            {files.map((f) => (
              <div key={f.id} className={`group flex items-center rounded-md ${selected === f.id && view === 'file' ? 'bg-[color-mix(in_srgb,var(--ink)_12%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]'}`}>
                <button type="button" onClick={() => openFile(f.id)} data-testid="call-file-open" className="flex-1 min-w-0 text-start px-2 py-1.5 text-[0.82rem] bg-transparent border-0 cursor-pointer text-ink truncate">
                  {f.name}<span className="block text-[0.68rem] text-ink-faint truncate">{f.from}</span>
                </button>
                <a href={f.url} download={f.name} title={s.download} aria-label={s.download} data-testid="call-file-dl"
                  className="opacity-0 group-hover:opacity-100 grid place-items-center w-7 h-7 rounded bg-transparent text-ink-faint hover:text-green-700 cursor-pointer shrink-0"><DownloadIcon className="w-4 h-4" /></a>
                <button type="button" onClick={() => deleteFile(f.id)} title={s.clear} aria-label={s.clear} data-testid="call-file-del"
                  className="opacity-0 group-hover:opacity-100 grid place-items-center w-7 h-7 me-1 rounded bg-transparent border-0 text-ink-faint hover:text-[var(--danger)] cursor-pointer shrink-0"><TrashIcon className="w-4 h-4" /></button>
              </div>
            ))}
          </aside>
        )}

        {/* main stage: screen-share or file preview (behind) + whiteboard on top */}
        <main className={`flex-1 relative min-w-0 overflow-hidden ${presenting || view === 'file' ? 'bg-[color-mix(in_srgb,var(--ink)_90%,black)]' : 'bg-white'}`}>
          {dragOver && (
            <div className="absolute inset-0 z-40 p-4 pointer-events-none" data-testid="call-dropzone">
              <div className="w-full h-full grid place-items-center rounded-xl border-2 border-dashed border-green-500 bg-[color-mix(in_srgb,var(--green-400)_18%,transparent)]">
                <div className="flex flex-col items-center gap-2 text-green-700"><UploadIcon className="w-9 h-9" /><span className="font-semibold text-[1rem]">{s.dropHere}</span></div>
              </div>
            </div>
          )}
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
              <a href={selectedFile.url} download={selectedFile.name} title={s.download} aria-label={s.download} data-testid="call-file-dl-main"
                className="absolute top-3 end-3 flex items-center gap-1.5 px-3 h-9 rounded-md bg-black/45 hover:bg-black/60 text-sand-100 text-[0.82rem] no-underline"><DownloadIcon className="w-4 h-4" /> {s.download}</a>
            </div>
          )}
          <canvas ref={wbRef} className={`absolute inset-0 w-full h-full touch-none ${tool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`} onPointerDown={wbDown} onPointerMove={wbMove} onPointerUp={wbUp} onPointerLeave={wbUp} />
          {showFade && <div className="absolute pointer-events-none" style={{ left: `${fadeX}%`, right: `${fadeX}%`, top: `${fadeY}%`, bottom: `${fadeY}%`, boxShadow: '0 0 0 9999px color-mix(in srgb, var(--ink) 38%, transparent)' }} data-testid="call-fade" />}
          {draft && (() => {
            const pos = b2s(draft.u, draft.v); const fontPx = draft.size * pos.sc
            const boxW = draft.w * pos.sc // content width; wrapping matches the canvas render
            const stop = (e: React.SyntheticEvent) => e.preventDefault() // keep the box focused (don't blur→commit)
            return (
              // Anchored at the text's top-left (border-box corner) so the glyphs sit
              // exactly where they render on commit. The whole rig rotates as one.
              <div className="absolute z-20" style={{ left: pos.x, top: pos.y, transform: `rotate(${draft.rot}deg)`, transformOrigin: 'top left' }}>
                {/* rotate handle: centred above, with a line down to the box */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-4 w-px h-4 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]" />
                <button type="button" onPointerDown={(e) => dragText(e, 'rotate')} onMouseDown={stop} title={s.rotate} data-testid="wb-text-rotate"
                  className="absolute left-1/2 -translate-x-1/2 -top-[2.6rem] w-7 h-7 grid place-items-center rounded-full bg-green-600 text-white border-0 cursor-grab shadow touch-none [&_svg]:w-3.5 [&_svg]:h-3.5"><RefreshIcon /></button>
                {/* move handle: left of the box */}
                <span onPointerDown={(e) => dragText(e, 'move')} onMouseDown={stop} title={s.moveText} data-testid="wb-text-move"
                  className="absolute top-1/2 -translate-y-1/2 -left-9 w-7 h-7 grid place-items-center rounded-full bg-[var(--surface)] border border-[color:var(--line)] shadow cursor-move touch-none text-ink-soft hover:text-ink [&_svg]:w-3.5 [&_svg]:h-3.5"><GripIcon /></span>
                {/* width handle: right of the box (sets wrapping) */}
                <span onPointerDown={(e) => dragText(e, 'width')} onMouseDown={stop} title={s.widthText} data-testid="wb-text-width"
                  className="absolute top-1/2 -translate-y-1/2 -right-3 w-2.5 h-8 rounded-full bg-green-600 border-2 border-[var(--surface)] shadow cursor-ew-resize touch-none" />
                <textarea ref={textInputRef} value={draft.text} rows={1}
                  onChange={(e) => upd({ text: e.target.value })} onBlur={() => { if (textReady.current) finishDraft() }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { draftRef.current = null; setDraft(null) } }} data-testid="wb-textinput"
                  style={{ width: boxW + 2 * TXT_PAD, fontSize: fontPx, color: penColor, lineHeight: 1.3, fontFamily: WB_FONT }}
                  className="block box-border resize-none overflow-hidden bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] rounded-[2px] outline-none font-semibold p-1 border border-dashed border-[color-mix(in_srgb,var(--ink)_45%,transparent)]" />
                {/* font size, kept upright */}
                <div className="absolute top-full mt-3 left-0 flex items-center gap-0.5 bg-[var(--surface)] border border-[color:var(--line)] rounded-full px-1 py-0.5 shadow-sm" style={{ transform: `rotate(${-draft.rot}deg)`, transformOrigin: 'top left' }} data-testid="wb-text-size">
                  <button type="button" onMouseDown={stop} onClick={() => bumpTextSize(-0.008)} title={s.smaller} className="w-6 h-6 grid place-items-center rounded-full bg-transparent border-0 text-ink cursor-pointer text-[1.05rem] leading-none">−</button>
                  <span className="text-[0.7rem] text-ink-faint tabular-nums w-6 text-center">{Math.round(fontPx)}</span>
                  <button type="button" onMouseDown={stop} onClick={() => bumpTextSize(0.008)} title={s.bigger} className="w-6 h-6 grid place-items-center rounded-full bg-transparent border-0 text-ink cursor-pointer text-[1.05rem] leading-none">+</button>
                </div>
              </div>
            )
          })()}

          {/* whiteboard tools */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 bg-[var(--surface)] border border-[color:var(--line)] rounded-full shadow-[var(--shadow-md)] px-1.5 py-1" data-testid="wb-tools">
            {[0.005, 0.011, 0.022].map((w, i) => (
              <button key={w} type="button" onClick={() => { setTool('pen'); setPenW(w) }} title={`Pen ${['S', 'M', 'L'][i]}`} aria-label={`Pen ${i}`}
                className={`grid place-items-center w-8 h-8 rounded-full border-0 cursor-pointer shrink-0 ${tool === 'pen' && penW === w ? 'bg-[color-mix(in_srgb,var(--ink)_14%,transparent)]' : 'bg-transparent hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]'}`}>
                <span className="rounded-full border-2 border-[color:var(--ink)]" style={{ width: `${6 + i * 4}px`, height: `${6 + i * 4}px` }} />
              </button>
            ))}
            <span className="w-px h-5 bg-[color:var(--line)] mx-0.5 shrink-0" />
            <Menu align="start" testid="wb-color" triggerClass="flex items-center gap-1 h-8 px-1.5 rounded-full border-0 bg-transparent hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] cursor-pointer shrink-0"
              trigger={<><span className="w-5 h-5 rounded-full border border-[color:var(--line)]" style={{ background: penColor }} /><ChevronDownIcon className="w-3 h-3 text-ink-faint" /></>}>
              <div className="grid grid-cols-5 gap-1">
                {WB_COLORS.map((col) => (
                  <button key={col} type="button" onClick={() => setPenColor(col)} aria-label={col} title={col}
                    className={`w-7 h-7 rounded-full cursor-pointer border-2 ${penColor === col ? 'border-[color:var(--ink)]' : 'border-transparent'}`} style={{ background: col }} />
                ))}
              </div>
            </Menu>
            <span className="w-px h-5 bg-[color:var(--line)] mx-0.5 shrink-0" />
            <button type="button" onClick={() => setTool('eraser')} title="Eraser" aria-label="Eraser" data-testid="wb-eraser"
              className={`grid place-items-center w-8 h-8 rounded-full border-0 cursor-pointer shrink-0 [&_svg]:w-[18px] [&_svg]:h-[18px] ${tool === 'eraser' ? 'bg-[color-mix(in_srgb,var(--ink)_14%,transparent)] text-ink' : 'text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]'}`}><EraserIcon /></button>
            <button type="button" onClick={() => placeText(-0.15, -0.06)} title="Text" aria-label="Text" data-testid="wb-text"
              className={`grid place-items-center w-8 h-8 rounded-full border-0 cursor-pointer shrink-0 font-display font-bold text-[1.05rem] ${tool === 'text' ? 'bg-[color-mix(in_srgb,var(--ink)_14%,transparent)] text-ink' : 'text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]'}`}>T</button>
            <button type="button" onClick={undo} title="Undo" aria-label="Undo" data-testid="wb-undo"
              className="grid place-items-center w-8 h-8 rounded-full border-0 cursor-pointer shrink-0 text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] [&_svg]:w-[18px] [&_svg]:h-[18px]"><UndoIcon /></button>
            <button type="button" onClick={() => clearBoard()} title={s.clear} aria-label={s.clear} data-testid="wb-clear"
              className="grid place-items-center w-8 h-8 rounded-full border-0 cursor-pointer shrink-0 text-ink-soft hover:text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] [&_svg]:w-[17px] [&_svg]:h-[17px]"><TrashIcon /></button>
          </div>
        </main>

        {/* right dock: participants or chat (fullscreen overlay on mobile) */}
        {showParticipants && (
          <aside className="w-56 sm:w-64 shrink-0 border-s border-[color:var(--line)] bg-[var(--surface)] overflow-y-auto p-2.5 flex flex-col gap-2.5 max-[640px]:absolute max-[640px]:inset-0 max-[640px]:w-full max-[640px]:z-30" data-testid="call-participants-panel">
            <div className="flex items-center justify-between px-1">
              <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">{s.participants} · {participantCount}</p>
              <button type="button" onClick={() => setShowParticipants(false)} aria-label="Close" data-testid="call-participants-close" className="hidden max-[640px]:grid place-items-center w-8 h-8 -me-1 rounded-md text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] bg-transparent border-0 cursor-pointer text-[1.15rem] leading-none">✕</button>
            </div>
            {!isGuest && waiting.length > 0 && <LobbyList waiting={waiting} admit={admit} hint={s.shareHint} title={s.lobbyList} admitLabel={s.admit} live staleIds={staleIds} />}
            <div className="grid grid-cols-2 gap-2">
              <ParticipantTile name={name || s.you} stream={local} camOn={cam} muted={!mic} self muteLabel={s.muteThem} />
              {inCallPeers.map(([id, info]) => (
                <ParticipantTile key={id} name={info.name || '•'} stream={peers.get(id)} camOn={info.cam} muted={info.muted} self={false} onMute={() => forceMute(id)} muteLabel={s.muteThem} idle={staleIds.has(id)} idleLabel={s.reconnecting} />
              ))}
            </div>
          </aside>
        )}
        {showChat && (
          <aside className="w-64 sm:w-72 shrink-0 border-s border-[color:var(--line)] bg-[var(--surface)] flex flex-col max-[640px]:absolute max-[640px]:inset-0 max-[640px]:w-full max-[640px]:z-30" data-testid="call-chat-panel">
            <div className="hidden max-[640px]:flex items-center justify-between px-3 py-2 border-b border-[color:var(--line)]">
              <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">{s.chat}</p>
              <button type="button" onClick={() => setShowChat(false)} aria-label="Close" data-testid="call-chat-close" className="grid place-items-center w-8 h-8 -me-1 rounded-md text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] bg-transparent border-0 cursor-pointer text-[1.15rem] leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 text-[0.9rem]">
              {chat.length === 0 && <p className="m-auto text-ink-faint/60 text-[0.85rem]" data-testid="call-chat-empty">{s.noMessages}</p>}
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

      {/* ---- mobile bottom bar ---- */}
      <footer className="hidden max-[640px]:flex items-center gap-1.5 px-2 py-2 border-t border-[color:var(--line)] bg-[var(--surface)]">
        {showParticipants || showChat ? (
          // A panel is open → the same spot becomes a Close button (back to the view behind).
          <button type="button" className={dropTrigger} data-testid="call-panels-close" aria-label={s.close}
            onClick={() => { setShowParticipants(false); setShowChat(false) }}>
            {showChat ? <ChatIcon /> : <UsersIcon />}<span>{showChat ? s.chat : s.participants}</span><span className="text-[1.15rem] leading-none ms-0.5">✕</span>
          </button>
        ) : (
          <Menu up testid="call-panels" triggerClass={dropTrigger}
            trigger={<>{<UsersIcon />}<span>{s.participants}</span>{(unseen.p + unseen.c) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />}<ChevronDownIcon className="w-3.5 h-3.5 opacity-60" /></>}>
            <MenuItem icon={<UsersIcon />} label={`${s.participants} · ${participantCount}`} onClick={() => { setShowParticipants(true); setShowChat(false); setUnseen((u) => ({ ...u, p: 0 })) }} active={showParticipants} />
            <MenuItem icon={<ChatIcon />} label={s.chat} onClick={() => { setShowChat(true); setShowParticipants(false); setUnseen((u) => ({ ...u, c: 0 })) }} active={showChat} />
          </Menu>
        )}
        <div className="flex-1" />
        <IconBtn onClick={toggleCam} active={cam} title={cam ? s.camOff : s.camOn}>{cam ? <CameraIcon /> : <CamOffIcon />}</IconBtn>
        <IconBtn onClick={toggleMic} active={mic} danger={!mic} title={mic ? s.muteMe : s.unmuteMe}>{mic ? <MicIcon /> : <MicOffIcon />}</IconBtn>
        <IconBtn onClick={hangup} title={isGuest ? s.hangUp : s.endMeeting} danger big>{isGuest ? <PhoneIcon /> : <EndCallIcon />}</IconBtn>
      </footer>

      {toast && <div className="fixed bottom-16 max-[640px]:bottom-20 left-1/2 -translate-x-1/2 z-[90] bg-green-700 text-sand-100 px-4 py-2 rounded-md shadow-[var(--shadow-md)] text-[0.9rem]">{toast}</div>}
    </div>,
    document.body,
  )
}

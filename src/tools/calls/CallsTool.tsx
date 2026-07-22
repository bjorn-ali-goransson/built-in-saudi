import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, localePath } from '../../i18n'
import { Button, Input } from '../../components/ui'
import { DownloadIcon, UploadIcon, ShareIcon, TrashIcon, RefreshIcon, GripIcon, PhoneIcon, EndCallIcon, UsersIcon, UserPlusIcon, ChatIcon, MicIcon, MicOffIcon, CameraIcon, CamOffIcon, WhiteboardIcon, ScreenShareIcon, FileIcon, EraserIcon, UndoIcon, ChevronDownIcon, CopyIcon, CheckIcon, HijabiIcon, LockIcon, CogIcon, BellIcon, DockIcon, ExpandIcon, MoreVIcon } from '../../components/icons'
import { CallRoom, roomStatus, signalRoom, type DataMsg, type DiagSnapshot, type PeerInfo, type WbObj } from './rtc'
import { setInCall } from '../../lib/inCall'
import { STR } from './strings'
import {
  oid, WB_COLORS, EMOJI, TAGS_EN, TAGS_AR, TAGS_KEY, isTag, WB_FONT, TXT_PAD, wrapLines,
  SITE, NAME_KEY, HOST_KEY, code6, randName, isDefaultName, chime, osNotify, startRingtone,
} from './helpers'
import {
  StreamVideo, LobbyList, IconBtn, Menu, MenuItem, dropTrigger, AudioSinks,
  DeviceGroup, useSpeaking, DebugPanel, ParticipantTile, DeclineComposer,
} from './parts'
import { CallLinkPanel, IncomingCallNote } from './CallLinkPanel'
import { getMyCallLink, ringCallLink } from '../../lib/callLink'

type ChatItem = { id: string; from: string; name: string; text?: string; fileName?: string; url?: string; reactions?: Record<string, string[]> }

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
  // A visitor from /call/?c=… carries the name they typed there (via sessionStorage,
  // not the URL) so they knock without re-entering it.
  const [name, setName] = useState(() => {
    try { if (new URLSearchParams(window.location.search).has('knock')) { const n = sessionStorage.getItem('bis-call-guest-name'); if (n) return n } } catch { /* */ }
    return storedName || randName(locale === 'ar')
  })
  // A typed (non-default) name shows a "remember me" checkbox; only a ticked custom
  // name is persisted — the random "Abu …" default never sticks.
  const [remember, setRemember] = useState(!!storedName)
  const nameCustom = name.trim() !== '' && !isDefaultName(name)
  // The current name was loaded from this browser's storage (a remembered name).
  const savedName = !!storedName && name === storedName
  function saveName() { try { if (remember && nameCustom) localStorage.setItem(NAME_KEY, name); else localStorage.removeItem(NAME_KEY) } catch { /* */ } }
  // Forget the stored name and drop back to a fresh random suggestion.
  function clearSavedName() { try { localStorage.removeItem(NAME_KEY) } catch { /* */ } setRemember(false); setName(randName(locale === 'ar', gender === 'f')) }
  // Random-name gender: the inset toggle flips it and re-rolls a matching kunya.
  const [gender, setGender] = useState<'m' | 'f'>('m')
  function toggleGender() { const g = gender === 'm' ? 'f' : 'm'; setGender(g); setName(randName(locale === 'ar', g === 'f')) }
  const [phase, setPhase] = useState<'lobby' | 'hosting' | 'waiting' | 'live' | 'ended'>('lobby')
  const [room, setRoom] = useState(initialRoom)
  const [busy, setBusy] = useState(false)
  // ?host=1 (owner answering a ring) forces the host role; also used to escape a
  // stale ?room= guest lobby (startOwnCall).
  const [forceHost, setForceHost] = useState(() => { try { return new URLSearchParams(window.location.search).has('host') } catch { return false } })
  const isGuest = !!initialRoom && !isHostReturn && !forceHost
  // A guest arriving via a link: probe the relay first (spinner) so we don't show
  // "enter your name / ask to join" for a meeting that's already gone. Skipped for a
  // /call visitor (knock=1), who knocks into a room its host hasn't joined yet.
  const [checking, setChecking] = useState(() => { try { const p = new URLSearchParams(window.location.search); return !!initialRoom && !isHostReturn && !p.has('host') && !p.has('knock') } catch { return !!initialRoom && !isHostReturn } })
  // Everyone we've connected to (data channel), with the name/role/lobby state
  // they told us peer-to-peer. The host's waiting list is derived from this.
  const [roster, setRoster] = useState<Map<string, PeerInfo>>(new Map())
  const [graceEndsAt, setGraceEndsAt] = useState<number | null>(null) // host-disconnect deadline
  const hadHost = useRef(false)
  const [ended, setEnded] = useState<{ reason: 'left' | 'ended' | 'gone' | 'declined' | 'notadmitted'; count: number; message?: string }>({ reason: 'gone', count: 0 })
  // Busy-call handling: a ring that arrives while we're in a call surfaces as a
  // banner (not a takeover). `declineTarget` opens the "send a note" composer.
  const [incomingRing, setIncomingRing] = useState<{ room: string; caller: string } | null>(null)
  const [declineTarget, setDeclineTarget] = useState<{ room: string; mode: 'screen' | 'banner' } | null>(null)
  const addWindowRef = useRef(0) // admit knockers until this time (owner chose "Add to call")

  const rtc = useRef<CallRoom | null>(null)
  // On-screen diagnostics (connection + media state) for debugging. Enabled purely
  // by ?debug=1 in the URL — which the host's invite link carries — so a guest lands
  // with it on and there's no button to find. Read once at mount.
  const [debug] = useState(() => { try { return new URLSearchParams(window.location.search).has('debug') } catch { return false } })
  // Personal "call me" link flow. The VISITOR opens /call/?c=… → arrives here with
  // `knock=1` and auto-knocks into a fresh room, then WAITS in the lobby. The link
  // OWNER, woken by the ring push, arrives with `host=1&ring=1&link=<code>`: they
  // host that room and admit the visitor themselves (no auto-admit). `incomingLink`
  // drives the "stop receiving calls" affordance offered exactly on an incoming call.
  const [knockParam] = useState(() => { try { return new URLSearchParams(window.location.search).has('knock') } catch { return false } })
  // A /call visitor carries the owner's link code so Rejoin can ring them again,
  // plus the owner's name (if the link had it) so an unanswered call can joke about
  // who ghosted (#193).
  const [ringCode] = useState(() => { try { return new URLSearchParams(window.location.search).has('knock') ? (sessionStorage.getItem('bis-call-ring-code') || '') : '' } catch { return '' } })
  const [linkOwnerName] = useState(() => { try { return new URLSearchParams(window.location.search).has('knock') ? (sessionStorage.getItem('bis-call-owner-name') || '') : '' } catch { return '' } })
  const [ownerHost] = useState(() => { try { return new URLSearchParams(window.location.search).has('host') } catch { return false } })
  const [incomingLink] = useState(() => { try { const p = new URLSearchParams(window.location.search); return p.has('ring') ? (p.get('link') || '') : '' } catch { return '' } })
  // Who's ringing (carried in the ring push URL) so the incoming screen can name them.
  const [incomingName] = useState(() => { try { return new URLSearchParams(window.location.search).get('caller') || '' } catch { return '' } })
  // An incoming ring shows a phone-style "someone is calling" screen; hosting waits
  // for the explicit Answer tap (which is also the gesture that unlocks the mic).
  const [answered, setAnswered] = useState(false)
  const answeredRef = useRef(false)
  // True only during the brief auto-admit of an answered/added caller, so the lobby
  // list doesn't flash on screen before they're let in (#202).
  const [autoAdmitting, setAutoAdmitting] = useState(false)
  // Whether this browser already has a personal call link (hides Start call/Invite).
  const [hasCallLink, setHasCallLink] = useState(() => { try { return !!getMyCallLink() } catch { return false } })
  const [diag, setDiag] = useState<DiagSnapshot | null>(null)
  const [local, setLocal] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Map<string, MediaStream>>(new Map())
  const [mic, setMic] = useState(false), [cam, setCam] = useState(false), [sharing, setSharing] = useState(false)
  // Input/output device selection (camera, mic, speaker). Labels only populate once
  // permission is granted, so we re-enumerate whenever the cam/mic turn on.
  const [mediaDevices, setMediaDevices] = useState<MediaDeviceInfo[]>([])
  const [camId, setCamId] = useState(''), [micId, setMicId] = useState(''), [spkId, setSpkId] = useState('')
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [editingName, setEditingName] = useState(false)
  // Open by default on every size: desktop shows the side dock, mobile the bottom
  // split. (Mobile used to start whiteboard-fullscreen; now it starts split.)
  // The dock has three modes now: participants, chat, and reactions (null = closed).
  const [dockMode, setDockMode] = useState<'p' | 'c' | 'r' | null>('p')
  const showParticipants = dockMode === 'p', showChat = dockMode === 'c', showReactions = dockMode === 'r'
  // Mobile bottom-dock height (px); null = default 46vh. Dragged via the dock header.
  const [dockH, setDockH] = useState<number | null>(null)
  const dockDrag = useRef<{ startY: number; startH: number; max: number } | null>(null)
  const [maximized, setMaximized] = useState(false) // dock filling the whole mobile view
  const lastPanel = useRef<'p' | 'c' | 'r'>('p') // reopen this mode from the footer dock icon
  // Explain-first notifications: show an in-call banner rationale, and only call the
  // browser's requestPermission() when the user clicks Enable (never auto-prompt).
  const [notifyBar, setNotifyBar] = useState(() => {
    try { return typeof Notification !== 'undefined' && Notification.permission === 'default' && localStorage.getItem('bis-call-notify-off') !== '1' } catch { return false }
  })
  function enableNotify() { try { Notification.requestPermission().catch(() => {}) } catch { /* */ } setNotifyBar(false) }
  function dismissNotify() { setNotifyBar(false); try { localStorage.setItem('bis-call-notify-off', '1') } catch { /* */ } }
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
  // Live floating reactions drifting up the stage (self + peers). `emoji` is any
  // reaction string — an emoji or a word tag.
  const [floats, setFloats] = useState<{ id: string; emoji: string; who: string; x: number }[]>([])
  // User-defined word tags (persisted), plus the composer for adding one.
  const [customTags, setCustomTags] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(TAGS_KEY) || '[]') } catch { return [] } })
  const [tagDraft, setTagDraft] = useState('')
  function addCustomTag() {
    const t = tagDraft.trim(); if (!t) return
    setCustomTags((cur) => { if (cur.includes(t) || [...TAGS_EN, ...TAGS_AR].includes(t)) return cur; const next = [...cur, t]; try { localStorage.setItem(TAGS_KEY, JSON.stringify(next)) } catch { /* */ } return next })
    setTagDraft('')
  }
  const [msg, setMsg] = useState('')
  const [toast, setToast] = useState('')
  const [selfAspect, setSelfAspect] = useState(1) // our whiteboard canvas w/h
  const fileRef = useRef<HTMLInputElement>(null)
  const rosterRef = useRef<Map<string, PeerInfo>>(new Map())
  const chatRef = useRef<ChatItem[]>([])

  // whiteboard (object model synced P2P). Each context — the pure board, each
  // shared file, and a screen-share — has its OWN board, keyed below.
  const wbRef = useRef<HTMLCanvasElement>(null)
  const objects = useRef<Map<string, WbObj[]>>(new Map()) // board key → objects (z-order)
  const myStack = useRef<Map<string, string[]>>(new Map()) // board key → ids I added (undo)
  const drawing = useRef<{ board: string; obj: Extract<WbObj, { kind: 'stroke' }> } | null>(null)
  const boardKeyRef = useRef('board') // the active board, set each render from the current view
  const lastPt = useRef<{ x: number; y: number; t: number } | null>(null) // last pointer sample (screen px) for velocity
  const pointers = useRef<Set<number>>(new Set()) // active touch pointers — 2+ means pinch-zoom, not a stroke
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
  const connectedOnce = useRef(false) // have we ever reached a 'connected' peer? (guest stuck-waiting detection)
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
        for (const id of [...m.keys()]) if ((seen.current.get(id) || 0) < now - GONE_MS) {
          const info = m.get(id)
          // A guest who went quiet while still waiting → keep them listed, marked "left".
          if (info && info.role === 'guest' && !info.inCall) setLeftWaiters((l) => l.some((w) => w.id === id) ? l : [...l, { id, name: info.name }])
          m.delete(id); seen.current.delete(id); changed = true
        }
        return changed ? m : r
      })
      const stale = new Set<string>()
      for (const [id] of rosterRef.current) if ((seen.current.get(id) || 0) < now - IDLE_MS) stale.add(id)
      setStaleIds((prev) => (prev.size === stale.size && [...stale].every((id) => prev.has(id)) ? prev : stale))
    }, 1200)
    return () => window.clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the screen awake during a live call so the phone doesn't dim/lock and
  // suspend the media. The OS releases the lock whenever the tab is hidden, so
  // re-acquire it when we come back to the foreground. Auto-released on leave.
  useEffect(() => {
    if (phase !== 'live') return
    let lock: WakeLockSentinel | null = null
    let done = false
    const acquire = async () => {
      try { lock = (await navigator.wakeLock?.request('screen')) ?? null } catch { /* unsupported / denied */ }
    }
    acquire()
    const onVisible = () => { if (!document.hidden && !done) acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { done = true; document.removeEventListener('visibilitychange', onVisible); lock?.release().catch(() => {}) }
  }, [phase])

  // If a knocking guest hasn't connected to the host within a few seconds, say so
  // (instead of an indefinite silent spinner). Cleared once a peer connects.
  const [waitSlow, setWaitSlow] = useState(false)
  useEffect(() => {
    if (phase !== 'waiting') { setWaitSlow(false); return }
    connectedOnce.current = false
    const t = window.setTimeout(() => { if (!connectedOnce.current) setWaitSlow(true) }, 30_000)
    return () => window.clearTimeout(t)
  }, [phase])

  // Poll the RTC engine for a diagnostics snapshot while the debug panel is open.
  // Runs in every connected phase (hosting/waiting/live), not just live — a guest
  // stuck in the lobby (data channel never opens) is exactly when you need it.
  useEffect(() => {
    const connected = phase === 'live' || phase === 'waiting' || phase === 'hosting'
    if (!debug || !connected) { setDiag(null); return }
    const tick = () => setDiag(rtc.current?.diag() ?? null)
    tick()
    const iv = window.setInterval(tick, 1000)
    return () => window.clearInterval(iv)
  }, [debug, phase])

  // Enumerate cam/mic/speaker devices for the picker. Re-runs when cam/mic turn on
  // (device labels are blank until permission is granted) and on hot-plug.
  useEffect(() => {
    const md = navigator.mediaDevices
    if (!md?.enumerateDevices) return
    const load = () => md.enumerateDevices().then(setMediaDevices).catch(() => {})
    load()
    md.addEventListener?.('devicechange', load)
    return () => md.removeEventListener?.('devicechange', load)
  }, [cam, mic])

  rosterRef.current = roster
  chatRef.current = chat
  if (dockMode) lastPanel.current = dockMode
  const phaseRef = useRef(phase); phaseRef.current = phase
  // "Checking again" spinner: shown once half the current relay-poll delay has
  // elapsed (only while waiting/hosting — not needed in a live call).
  const [recheck, setRecheck] = useState(false)
  const recheckT = useRef<number | undefined>(undefined)
  const nameOf = useCallback((id: string) => roster.get(id)?.name || '•', [roster])
  // The people the host still needs to let in (guests who haven't joined yet).
  const waiting = [...roster].filter(([, i]) => i.role === 'guest' && !i.inCall)
  // Guests who left while still waiting — kept in the list, shown as "left".
  const [leftWaiters, setLeftWaiters] = useState<{ id: string; name: string }[]>([])
  const knockSeen = useRef<Set<string>>(new Set())
  // A new knocker → close the Share invite, chime, and (host) let it be seen.
  useEffect(() => {
    const freshNames: string[] = []
    for (const [id, info] of waiting) if (!knockSeen.current.has(id)) { knockSeen.current.add(id); freshNames.push(info.name || '•') }
    if (freshNames.length) {
      setShareOpen(false)
      // If we answered an incoming ring — or just chose "Add to call" while busy —
      // the caller who knocks comes straight in. Hide the lobby flash meanwhile
      // (#202), and clear the answer flag so a LATER re-call must be admitted by hand
      // rather than auto-let-in (#199).
      if (!isGuest && (answeredRef.current || Date.now() < addWindowRef.current)) {
        answeredRef.current = false
        setAutoAdmitting(true)
        Promise.all(waiting.map(([id]) => admit(id))).finally(() => setAutoAdmitting(false))
      } else if (!isGuest) { chime(); osNotify(freshNames.join(', '), s.waitingToJoin) }
      // A returning guest (same name) supersedes their old "left" entry.
      const names = new Set(waiting.map(([, i]) => i.name))
      setLeftWaiters((l) => l.filter((w) => !names.has(w.name)))
    }
  }, [waiting, isGuest])
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
    if (m.t === 'chat') { setChat((c) => [...c, { id: m.id, from: id, name: m.name, text: m.text }]); notify('c', `${m.name}: ${m.text}`) }
    else if (m.t === 'react') addFloat(m.emoji, m.name)
    else if (m.t === 'msg-react') {
      // A remote reaction toggled on a message → notify (like a chat) if chat is closed,
      // but only when it ADDS (not when they remove their reaction).
      const cur = chatRef.current.find((c) => c.id === m.id)
      const wasPresent = !!cur?.reactions?.[m.emoji]?.includes(m.name)
      applyMsgReact(m.id, m.emoji, m.name)
      if (!wasPresent) notify('c', `${m.name} · ${m.emoji}`)
    }
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
    else if (m.t === 'view') { if (m.file) openFile(m.file); else { setView('board'); setSelected('') } }
    else if (m.t === 'file-start') incoming.current.set(m.id, { name: m.name, mime: m.mime, parts: [] })
    else if (m.t === 'file-end') {
      const f = incoming.current.get(m.id); if (!f) return
      const url = URL.createObjectURL(new Blob(f.parts, { type: f.mime || 'application/octet-stream' }))
      setFiles((fs) => [...fs, { id: m.id, name: f.name, url, mime: f.mime, from: nameOf(id) }])
      setChat((c) => [...c, { id: m.id, from: id, name: nameOf(id), fileName: f.name, url }])
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
        else {
          // A guest who left while still waiting — keep them in the list, marked "left".
          const info = rosterRef.current.get(pid)
          if (info && info.role === 'guest') setLeftWaiters((l) => l.some((w) => w.id === pid) ? l : [...l, { id: pid, name: info.name }])
        }
        setPeers((p) => { const n = new Map(p); n.delete(pid); return n }); setRoster((n) => { const m = new Map(n); m.delete(pid); return m })
      },
      onData, onFileChunk,
      onPeer: (id, state) => {
        if (state === 'connected') connectedOnce.current = true
        else if (state === 'failed') {
          // Surface the failure instead of silently dropping the peer.
          const who = rosterRef.current.get(id)?.name || '•'
          setToast(`${s.connectFail} ${who}`); window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(''), 6000)
        }
      },
      onPeerInfo: (id, info) => {
        seen.current.set(id, Date.now())
        if (info.inCall && !knownInCall.current.has(id)) { knownInCall.current.add(id); if (rtc.current?.inCall) { notify('p', `${info.name || '•'} ${s.joined}`); osNotify(info.name || '•', s.joined) } }
        setRoster((r2) => new Map(r2).set(id, info))
      },
      onAdmitted: () => setPhase('live'), // rtc enables our media itself
      onMuteNotice: (by, targetId, targetIsMe) => {
        if (targetIsMe) setMic(false)
        const who = targetIsMe ? s.you : (rosterRef.current.get(targetId)?.name || '•')
        setToast(`${by} ${s.mutedBy} ${who}`); setTimeout(() => setToast(''), 3500)
      },
      // The relay closed. If WE already hung up (phase 'ended'), leave that screen
      // as-is — don't overwrite "you left / you ended" with "meeting can't be found".
      onClosed: () => { rtc.current = null; if (phaseRef.current === 'ended') return; setEnded({ reason: 'gone', count: 0 }); setPhase('ended') },
      // Waiting caller: the busy owner told us to join their current call instead —
      // re-knock in that room (our name is already in sessionStorage).
      onRedirect: (dest) => { try { window.location.assign(`${localePath(locale, '/apps/calls')}?code=${dest}&knock=1`) } catch { /* */ } },
      // Waiting caller: the owner declined us, optionally with a note to show.
      onDeclined: (message) => { rtc.current?.close(); rtc.current = null; setEnded({ reason: 'declined', count: 0, message }); setPhase('ended') },
      onPollCycle: (delayMs) => {
        // A poll just finished → hide the spinner, then re-show it once half the
        // wait has passed, so it signals "checking again" only while lobby-waiting.
        window.clearTimeout(recheckT.current); setRecheck(false)
        if (delayMs >= 250 && (phaseRef.current === 'waiting' || phaseRef.current === 'hosting')) {
          recheckT.current = window.setTimeout(() => setRecheck(true), delayMs / 2)
        }
      },
    })
    rtc.current = r
    return r
  }
  function mediaError() { setToast('Camera/mic permission needed'); setTimeout(() => setToast(''), 3000) }
  // Put the room code in the URL so it's shareable and rooms are distinguishable.
  function rememberHost(code: string) { saveName(); try { localStorage.setItem(HOST_KEY, code) } catch { /* */ } }
  // URL for an in-call / invite link vs the bare start page. When the host is
  // debugging, carry ?debug=1 into the invite so a (non-technical) guest lands with
  // diagnostics already on — no need to ask them to tap the bug button.
  const joinPath = (code: string) => `${localePath(locale, '/apps/calls')}/join?code=${code}${debug ? '&debug=1' : ''}`
  const lobbyPath = () => localePath(locale, '/apps/calls')

  // Host: start the call right away (others still need to be let in).
  async function startHost() {
    setBusy(true)
    const code = room || code6(); setRoom(code); rememberHost(code)
    const r = ensureRoom(code); r.enterLobby(name || s.you, true)
    // Desktop: auto-open the Share dialog on start — but NOT when answering a ring
    // (someone is already calling; there's nothing to share). Mobile skips it too.
    try { await r.enableMedia(); setPhase('live'); if (!sharedRef.current && !incomingLink && window.innerWidth > 640) openShareModal(code) } catch { mediaError() } finally { setBusy(false) }
  }
  // Answer an incoming ring: host the room (the tap unlocks the mic) and let the
  // caller in as soon as they knock (answeredRef gates the auto-admit below).
  function answerCall() { setAnswered(true); answeredRef.current = true; startHost() }
  // Decline the full incoming ring — open the "send a note" composer first.
  function declineCall() { setDeclineTarget({ room: initialRoom, mode: 'screen' }) }
  // Busy: a ring arrived while we're in a call — surfaced as a banner via the
  // global useIncomingCall hook. Add-to-call redirects the caller into THIS room;
  // Decline opens the note composer aimed at the caller's room.
  useEffect(() => {
    function onRing(e: Event) {
      if (phaseRef.current !== 'live') return
      try {
        const url = (e as CustomEvent<{ url?: string }>).detail?.url || ''
        const p = new URLSearchParams(url.split('?')[1] || '')
        const rm = p.get('code') || ''
        if (rm) setIncomingRing({ room: rm, caller: p.get('caller') || '' })
      } catch { /* */ }
    }
    window.addEventListener('bis-incoming-ring', onRing)
    return () => window.removeEventListener('bis-incoming-ring', onRing)
  }, [])
  // The busy banner has no live channel to the caller's room, so if the caller
  // gives up (hangs up / closes the tab) nothing tells us — auto-dismiss it after a
  // ring's worth of time so it never lingers forever (#190).
  useEffect(() => {
    if (!incomingRing) return
    const t = window.setTimeout(() => setIncomingRing(null), 45_000)
    return () => window.clearTimeout(t)
  }, [incomingRing])
  // Ring a sound while a call is coming in — the full incoming screen OR the busy
  // banner — and stop the moment it's answered/dismissed (#197).
  useEffect(() => {
    const calling = (!!incomingLink && !answered) || !!incomingRing
    if (!calling) return
    const stop = startRingtone()
    return stop
  }, [incomingLink, answered, incomingRing])
  function addToCall() {
    if (!incomingRing || !room) return
    signalRoom(incomingRing.room, 'redirect', { room })
    addWindowRef.current = Date.now() + 60_000 // auto-admit their knock for a minute
    setToast(s.addingToCall); setTimeout(() => setToast(''), 3500)
    setIncomingRing(null)
  }
  // Send the decline note (canned or custom; may be empty) to the caller's room,
  // then dismiss — leaving a live call intact, or exiting the incoming screen.
  function sendDecline(msg: string) {
    const target = declineTarget
    setDeclineTarget(null)
    if (!target) return
    signalRoom(target.room, 'decline', { msg: msg.slice(0, 200) })
    if (target.mode === 'screen') { try { window.location.assign(localePath(locale, '/apps/calls')) } catch { /* */ } }
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
  // Tell the deploy auto-reload to hold off while we're engaged — including a
  // call-link caller waiting to be connected (#195). Kept out of the cleanup so a
  // phase→phase transition never dips to "not in a call" (which would let a deferred
  // deploy reload mid-connect); only a real unmount clears it.
  useEffect(() => {
    const engaged = phase === 'hosting' || phase === 'waiting' || phase === 'live' || (knockParam && phase === 'lobby')
    setInCall(engaged)
  }, [phase, knockParam])
  useEffect(() => () => setInCall(false), [])

  // Returning host (reloaded the ?room link), or the link owner woken by a ring
  // (?host=1) → re-enter / host the room immediately.
  const autoStarted = useRef(false)
  useEffect(() => {
    // A host reload re-enters immediately; a fresh ring (ownerHost + incomingLink)
    // instead shows the ringing screen and waits for Answer.
    if ((isHostReturn || (ownerHost && !incomingLink)) && !autoStarted.current) { autoStarted.current = true; startHost() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Hardening (#188): the /join route only makes sense with a code (or a host/ring/
  // knock flag). Landing on a bare /apps/calls/join — no query — is meaningless and,
  // on GitHub Pages, served as the SPA 404 fallback. Clean the URL back to the calls
  // root so a stray /join lands on the normal start screen, not a dead join page.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const hasState = initialRoom || p.has('host') || p.has('ring') || p.has('knock')
      if (window.location.pathname.replace(/\/$/, '').endsWith('/join') && !hasState) {
        history.replaceState(null, '', lobbyPath())
      }
    } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A /call visitor (?knock=1) auto-knocks into the room and waits to be let in.
  const autoKnocked = useRef(false)
  useEffect(() => {
    if (knockParam && !autoKnocked.current) { autoKnocked.current = true; askToJoin() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Verify a guest's link before showing the join controls.
  useEffect(() => {
    if (!checking) return
    let alive = true
    roomStatus(initialRoom).then((st) => {
      if (!alive) return
      if (st === 'open') setChecking(false)
      else { setEnded({ reason: 'gone', count: 0 }); setPhase('ended') }
    })
    return () => { alive = false }
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

  function resetLive() { setPeers(new Map()); setLocal(null); setChat([]); setRoster(new Map()); setGraceEndsAt(null); setFiles([]); setSelected(''); setView('board'); setSharing(false); setScreenStream(null); setShareOpen(false); knownInCall.current.clear(); objects.current.clear(); myStack.current.clear(); setLeftWaiters([]); knockSeen.current.clear() }
  function hangup() {
    if (!isGuest) {
      // Host leaving ends the meeting for everyone (the relay is marked closed, so
      // every peer's poll returns closed → they're dropped into the ended screen).
      rtc.current?.close(); try { localStorage.removeItem(HOST_KEY) } catch { /* */ }
      setEnded({ reason: 'ended', count: 0 }); rtc.current = null; resetLive(); setPhase('ended')
      history.replaceState(null, '', lobbyPath()) // clean URL: a reload (e.g. deploy) lands on the host lobby, not ?code= guest mode
    } else {
      // Guest leaving. If they were actually in the call, show "you left" (with a way
      // back in). If they hung up while still WAITING to be admitted (#191), there's
      // no call to have "left" — offer "Call again" instead of "Rejoin".
      const wasAdmitted = phaseRef.current === 'live'
      const others = inCallPeers.length
      rtc.current?.leave(); rtc.current = null; resetLive()
      setEnded({ reason: wasAdmitted ? 'left' : 'notadmitted', count: wasAdmitted ? others : 0 }); setPhase('ended')
      history.replaceState(null, '', lobbyPath())
    }
  }
  function rejoin() {
    setEnded({ reason: 'gone', count: 0 }); setPhase('lobby')
    if (isGuest) {
      // Call-link visitor: ring the owner again so a missed call re-notifies them.
      if (ringCode && room) ringCallLink(ringCode, room, name || 'Someone')
      askToJoin()
    } else startHost()
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
      if (Date.now() >= graceEndsAt) { window.clearInterval(iv); rtc.current?.close(); rtc.current = null; setGraceEndsAt(null); setEnded({ reason: 'gone', count: 0 }); setPhase('ended') }
      else setGraceTick((t) => t + 1)
    }, 1000)
    return () => window.clearInterval(iv)
  }, [graceEndsAt])

  // Acquire the device on turn-on and release it on turn-off (so the browser's
  // in-use indicator clears when muted/off). Revert the button if permission is denied.
  async function toggleMic() { const v = !mic; setMic(v); const ok = await rtc.current?.toggleMic(v); if (v && ok === false) setMic(false) }
  const speaking = useSpeaking(local, mic) // flash the mic icon while the local user talks
  async function toggleCam() { const v = !cam; setCam(v); const ok = await rtc.current?.toggleCam(v); if (v && ok === false) setCam(false) }
  function screenToast(msg: string) { setToast(msg); window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(''), 5000) }
  async function toggleScreen() {
    if (sharing) { rtc.current?.stopScreen(); setSharing(false); setScreenStream(null); return }
    // iOS Safari doesn't implement getDisplayMedia at all — say so up front.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) { screenToast(s.screenUnsupported); return }
    try {
      const st = await rtc.current!.shareScreen()
      setSharing(true); setScreenStream(st); st.getVideoTracks()[0]?.addEventListener('ended', () => { setSharing(false); setScreenStream(null) })
    } catch (e) {
      const err = e as DOMException
      // The user dismissing the OS picker is not an error — stay quiet.
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') return
      // Otherwise surface the real reason (e.g. NotReadableError, NotSupportedError)
      // so mobile failures are diagnosable instead of silent.
      screenToast(`${s.screenFailed}: ${err?.name || err?.message || 'error'}`)
    }
  }
  function sendChat() { const t = msg.trim(); if (!t) return; const id = oid(); rtc.current?.broadcast({ t: 'chat', id, name: name || s.you, text: t }); setChat((c) => [...c, { id, from: 'me', name: s.you, text: t }]); setMsg('') }
  // Live meeting reaction: drift a floating emoji/tag up the stage (with the
  // reactor's name above it) and tell everyone.
  function addFloat(emoji: string, who: string) {
    const id = oid(), x = 8 + Math.random() * 84
    setFloats((f) => [...f, { id, emoji, who, x }])
    window.setTimeout(() => setFloats((f) => f.filter((it) => it.id !== id)), 2500)
  }
  function sendReaction(emoji: string) { const who = name || s.you; addFloat(emoji, who); rtc.current?.broadcast({ t: 'react', emoji, name: who }) }
  // Toggle `who`'s reaction on a message (used both locally and for peers).
  function applyMsgReact(id: string, emoji: string, who: string) {
    setChat((c) => c.map((m) => {
      if (m.id !== id) return m
      const r = { ...(m.reactions || {}) }
      const list = r[emoji] || []
      r[emoji] = list.includes(who) ? list.filter((n) => n !== who) : [...list, who]
      if (r[emoji].length === 0) delete r[emoji]
      return { ...m, reactions: r }
    }))
  }
  function reactToMsg(id: string, emoji: string) { const who = name || s.you; applyMsgReact(id, emoji, who); rtc.current?.broadcast({ t: 'msg-react', id, emoji, name: who }) }
  function pickFiles(fl: FileList | null) {
    if (!fl) return
    let lastId = ''
    for (const f of fl) {
      const id = oid(), url = URL.createObjectURL(f) // shared id → same board key on every peer
      rtc.current?.sendFile(f, id)
      setFiles((fs) => [...fs, { id, name: f.name, url, mime: f.type, from: s.you }])
      setChat((c) => [...c, { id, from: 'me', name: s.you, fileName: f.name, url }])
      lastId = id
    }
    if (lastId) openFile(lastId) // show it to me; peers auto-open it on receipt too
  }
  function openFile(id: string) { setSelected(id); setView('file'); setUnseen((u) => ({ ...u, f: 0 })) }
  // A user switching the main stage (a file, or '' for the whiteboard) switches it
  // for everyone — broadcast so peers follow. Remote 'view' messages call the local
  // setters directly (no rebroadcast).
  function syncView(file: string) {
    if (file) openFile(file); else { setView('board'); setSelected('') }
    rtc.current?.broadcast({ t: 'view', file })
  }
  function forceMute(id: string) { rtc.current?.forceMute(id); setToast(`${name || s.you} ${s.mutedBy} ${nameOf(id)}`); setTimeout(() => setToast(''), 3500) }
  const seenPanel = (m: 'p' | 'c' | 'r') => { if (m === 'p') setUnseen((u) => ({ ...u, p: 0 })); else if (m === 'c') setUnseen((u) => ({ ...u, c: 0 })) }
  // Open a dock mode (participants / chat / reactions), or close it if it's already showing.
  function toggleMode(m: 'p' | 'c' | 'r') { setDockMode((cur) => (cur === m ? null : m)); seenPanel(m) }
  function pickPanel(m: 'p' | 'c' | 'r') { setDockMode(m); seenPanel(m) }
  // Footer dock icon: close the dock if open, else reopen the last mode.
  function toggleDock() {
    if (dockMode) { setDockMode(null); setMaximized(false) }
    else { setDockMode(lastPanel.current); seenPanel(lastPanel.current) }
  }
  // Keyboard shortcuts (live only): M mute · W whiteboard · S screen · F file · C chat · P/A participants.
  const kbd = useRef<{ live: boolean; act: Record<string, () => void> }>({ live: false, act: {} })
  kbd.current = { live: phase === 'live', act: {
    M: () => toggleMic(), W: () => { setView('board'); setSelected('') }, S: () => toggleScreen(),
    F: () => fileRef.current?.click(), C: () => toggleMode('c'), P: () => toggleMode('p'), A: () => toggleMode('p'),
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
  // A stroke aborted mid-draw (a second finger landed → pinch-zoom): remove the
  // partial stroke locally + for peers, and release any capture so the browser zooms.
  function cancelStroke() {
    for (const pid of pointers.current) { try { wbRef.current?.releasePointerCapture(pid) } catch { /* not captured */ } }
    const d = drawing.current; if (!d) return
    const arr = boardOf(d.board); const i = arr.findIndex((o) => o.id === d.obj.id); if (i >= 0) arr.splice(i, 1)
    const st = stackOf(d.board); const si = st.lastIndexOf(d.obj.id); if (si >= 0) st.splice(si, 1)
    rtc.current?.broadcast({ t: 'wb', op: 'remove', id: d.obj.id, b: d.board })
    drawing.current = null; redraw()
  }
  function wbDown(e: React.PointerEvent) {
    if (e.pointerType === 'touch') {
      pointers.current.add(e.pointerId)
      // Pinch-zoom beats multi-finger drawing: a 2nd finger cancels the stroke and
      // hands the gesture to the browser (canvas has touch-action: pinch-zoom).
      if (pointers.current.size > 1) { cancelStroke(); return }
    }
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
    if (e.pointerType === 'touch' && pointers.current.size > 1) return // pinch in progress
    const d = drawing.current; if (!d) return; const o = d.obj
    const p = wbPt(e); const w = speedWidth(e, o.width)
    o.pts.push(p.x, p.y); (o.wds ||= []).push(w); lastPt.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
    drawLastSeg(o); rtc.current?.broadcast({ t: 'wb', op: 'point', id: o.id, pt: [p.x, p.y], w, b: d.board })
  }
  function wbUp(e?: React.PointerEvent) { if (e) pointers.current.delete(e.pointerId); drawing.current = null }
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
  }, [phase, view, selected, sharing, roster, dockMode, files.length])

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
      <div className="relative w-full max-w-[23rem] max-[520px]:max-w-none max-[520px]:h-full max-[520px]:rounded-none rounded-2xl bg-green-700 text-sand-100 shadow-[var(--shadow-lg)] p-6 flex flex-col gap-4 items-center" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setShareOpen(false)} aria-label={s.leave} data-testid="call-share-close" className="absolute top-3 end-3 w-9 h-9 grid place-items-center rounded-md bg-transparent border-0 text-sand-100/70 hover:text-sand-100 hover:bg-white/10 cursor-pointer text-[1.25rem] leading-none">✕</button>
        <h3 className="w-full font-display text-[1.15rem] text-sand-100 pe-8">{s.shareInvite}</h3>
        {/* On mobile fullscreen, centre the QR + actions below the top-pinned header. */}
        <div className="w-full flex flex-col items-center gap-4 max-[520px]:flex-1 max-[520px]:justify-center">
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
      </div>
    </div>, document.body) : null

  // The setup/ended "front door" — a green panel that now lives INSIDE the site
  // chrome (global header + footer via Layout), not a full-screen portal. It fills
  // at least the viewport minus the sticky header (68px desktop / 60px mobile).
  // Full-bleed: break out of ToolPage's centred `.wrap` (horizontal) and cancel its
  // vertical padding, so the green panel reaches every edge between header + footer.
  const greenWrap = 'bg-green-700 text-sand-100 flex flex-col items-center justify-center px-6 py-14 w-screen mx-[calc(50%-50vw)] my-[calc(clamp(1.5rem,4vw,2.5rem)*-1)] min-h-[calc(100dvh-68px)] max-[560px]:min-h-[calc(100dvh-60px)]'
  const cream = 'w-full h-12 rounded-md bg-sand-100 text-green-700 font-semibold text-[0.95rem] flex items-center justify-center gap-2 hover:bg-white disabled:opacity-60 disabled:hover:bg-sand-100 border-0 cursor-pointer transition-colors'
  const ghost = 'w-full h-11 rounded-md bg-white/10 text-sand-100 font-medium text-[0.9rem] flex items-center justify-center gap-2 hover:bg-white/20 border border-sand-100/25 cursor-pointer transition-colors'
  const ringing = !!incomingLink && !answered
  // Incoming screen: the phone bounces instead of pulsing (#189). Other green
  // screens (ended/waiting) keep it still — `ringing` is only true while an
  // unanswered ring is on screen.
  const phoneLogo = <EndCallIcon className={`w-24 h-24 text-green-500 shrink-0 ${ringing ? '[animation:bis-bounce-y_1s_ease-in-out_infinite]' : ''}`} />
  const declineComposerEl = declineTarget ? (
    <DeclineComposer title={s.declineMsgTitle} canned={s.cannedDecline} placeholder={s.customMsgPh} sendLabel={s.sendAndDecline} justLabel={s.justDecline} cancelLabel={s.cancel} onSend={sendDecline} onCancel={() => setDeclineTarget(null)} />
  ) : null
  // A call-link caller retries by CALLING the owner again (named, if known) — a plain
  // "Rejoin/Call again" for anyone else (#199, #193).
  const callAgainLabel = ringCode && linkOwnerName ? s.callNameAgain(linkOwnerName) : s.callAgain

  if (phase === 'ended') {
    return (
      <div className={greenWrap} data-testid="calls">
        <div className="w-full max-w-[22rem] flex flex-col items-center gap-5 text-center" data-testid="call-ended">
          {phoneLogo}
          {ended.reason === 'left' ? (
            <>
              <p className="text-[1.2rem] font-display">{s.youEnded}</p>
              {ended.count > 0 && <p className="text-[0.9rem] text-sand-100/75">{s.stillThere(ended.count)}</p>}
              <div className="w-full flex flex-col gap-3">
                <button className={cream} onClick={rejoin} data-testid="call-rejoin">{ringCode ? callAgainLabel : s.rejoin}</button>
                <button className={ghost} onClick={newCall}>{s.createAnother}</button>
              </div>
            </>
          ) : ended.reason === 'declined' ? (
            // The link owner declined this caller — show their note as the reason.
            <>
              <p className="text-[1.2rem] font-display" data-testid="call-declined">{s.declinedTitle}</p>
              <p className="text-[0.95rem] text-sand-100/85 leading-relaxed" data-testid="call-declined-msg">{ended.message?.trim() ? `“${ended.message.trim()}”` : s.declinedGeneric}</p>
              <button className={cream} onClick={newCall}>{s.createNew}</button>
            </>
          ) : ended.reason === 'notadmitted' ? (
            // Hung up while still waiting to be admitted (#191): there was no call to
            // "leave", so offer "Call again" rather than "you left / Rejoin". For a
            // call-link call the owner simply didn't pick up → joke that they ghosted
            // it, naming them if the link carried a name (#193).
            <>
              <p className="text-[1.2rem] font-display" data-testid="call-notadmitted">{ringCode ? s.ghosted(linkOwnerName) : s.callEnded}</p>
              <button className={cream} onClick={rejoin} data-testid="call-again">{callAgainLabel}</button>
            </>
          ) : (
            <>
              <p className="text-[1.15rem] font-display leading-relaxed">{ended.reason === 'ended' ? s.youEndedMeeting : s.ended}</p>
              <button className={cream} onClick={newCall}>{s.createNew}</button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (phase !== 'live') {
    return (
      <div className={`${greenWrap} ${ringing ? '[animation:bis-call-flash_2.2s_ease-in-out_infinite]' : ''}`} data-testid="calls">
        <div className="w-full max-w-[22rem] flex flex-col items-center gap-5">
          {phoneLogo}
          {checking ? (
            <div className="flex flex-col items-center gap-3" data-testid="call-checking">
              <span className="w-7 h-7 rounded-full border-2 border-sand-100/25 border-t-sand-100 animate-spin" />
              <p className="text-sand-100/80 text-[0.95rem]">{s.checkingMeeting}</p>
            </div>
          ) : phase === 'waiting' ? (
            <>
              <p className="text-center text-[1rem] leading-relaxed text-sand-100/90 flex items-center gap-2" data-testid="call-waiting">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--gold-500)] animate-pulse" /> {s.waitingHost}
              </p>
              {/* Halfway through each poll wait, show we're checking the relay again. */}
              <span className={`w-5 h-5 rounded-full border-2 border-sand-100/25 border-t-sand-100 transition-opacity duration-200 ${recheck ? 'opacity-100 animate-spin' : 'opacity-0'}`} data-testid="call-recheck" aria-hidden={!recheck} />
              {waitSlow && <p className="max-w-[22rem] text-center text-[0.85rem] leading-relaxed text-[var(--gold-400)]" data-testid="call-wait-slow">{s.waitSlow}</p>}
              <button className={ghost} onClick={hangup} data-testid="call-cancel">{s.cancel}</button>
            </>
          ) : incomingLink && !answered ? (
            // Incoming ring — a prominent, phone-style "someone is calling" screen that
            // names the caller. No sharing UI (someone is already calling). Answer hosts
            // + lets the caller in.
            <>
              <div className="flex flex-col items-center gap-2">
                <p className="text-[0.72rem] uppercase tracking-[0.22em] text-sand-100/60">{s.incomingCall}</p>
                <p className="text-center text-[1.5rem] font-display leading-tight" data-testid="call-incoming-title">{incomingName ? s.isCalling(incomingName) : s.someoneCalling}</p>
              </div>
              <div className="w-full flex flex-col gap-3">
                <button className={cream} onClick={answerCall} data-testid="call-answer"><PhoneIcon /> {s.answer}</button>
                <button className={ghost} onClick={declineCall} data-testid="call-decline"><EndCallIcon className="w-4 h-4" /> {s.decline}</button>
              </div>
              <IncomingCallNote locale={locale} linkCode={incomingLink} />
            </>
          ) : (
            <>
              <p className="text-center text-[0.95rem] leading-relaxed text-sand-100/85">{s.lead}</p>
              <div className="w-full flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[0.8rem] font-medium text-sand-100/80 ps-0.5">{s.yourName}:</span>
                  <div className="relative">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={s.yourName} aria-label={s.yourName} data-testid="call-name" className={`${!savedName && !nameCustom ? 'pe-[4.75rem]' : 'pe-11'} h-12`} />
                    {savedName ? (
                      // Name loaded from this browser's storage → a checkmark (not the
                      // shuffle icon); tap it to forget the saved name + go random.
                      <button type="button" onClick={clearSavedName} title={s.savedNameHint} aria-label={s.savedNameHint} data-testid="call-name-saved"
                        className="absolute inset-y-0 end-1.5 my-auto h-8 w-8 grid place-items-center rounded-md bg-transparent border-0 text-green-600 hover:text-green-700 hover:bg-black/5 cursor-pointer">
                        <CheckIcon className="w-[18px] h-[18px]" />
                      </button>
                    ) : nameCustom ? (
                      // Typed your own name → offer to remember it (with a nudge bubble).
                      <>
                        {!remember && (
                          <div className="absolute bottom-full end-1 mb-2 z-10 w-max max-w-[13rem] rounded-lg bg-sand-100 text-green-900 text-[0.72rem] font-medium px-2.5 py-1.5 shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:end-4 after:border-[6px] after:border-transparent after:border-t-sand-100" data-testid="call-remember-hint">{s.rememberName}</div>
                        )}
                        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} data-testid="call-remember" title={s.rememberName} aria-label={s.rememberName}
                          className="absolute inset-y-0 end-3 my-auto w-5 h-5 accent-green-600 cursor-pointer" />
                      </>
                    ) : (
                      // Random name → a single female-name toggle (hijabi icon, lit when
                      // on / dimmed when off) next to shuffle. Off = a male name.
                      <div className="absolute inset-y-0 end-1.5 my-auto h-8 flex items-center gap-1">
                        <button type="button" onClick={toggleGender} aria-pressed={gender === 'f'} title={gender === 'f' ? s.femaleOn : s.femaleOff} aria-label={gender === 'f' ? s.femaleOn : s.femaleOff} data-testid="call-gender"
                          className={`h-8 w-8 grid place-items-center rounded-md border-0 cursor-pointer transition-colors ${gender === 'f' ? 'text-green-600 bg-green-600/12' : 'text-ink-faint/40 bg-transparent hover:text-ink-faint hover:bg-black/5'}`}>
                          <HijabiIcon className="w-[19px] h-[19px]" />
                        </button>
                        <button type="button" onClick={() => setName(randName(locale === 'ar', gender === 'f'))} title={s.shuffle} aria-label={s.shuffle} data-testid="call-shuffle"
                          className="h-8 w-8 grid place-items-center rounded-md bg-transparent border-0 text-ink-faint hover:text-ink hover:bg-black/5 cursor-pointer">
                          <RefreshIcon className="w-4 h-4" />
                        </button>
                      </div>
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
                  // Always available — even with a personal call link published, you can
                  // still start a fresh meeting and invite people to it (#194).
                  <div className="flex gap-3">
                    <button className={`${cream} flex-1`} disabled={busy} onClick={startHost} data-testid="call-start">{busy ? s.joining : s.start}</button>
                    <button type="button" onClick={() => openShareModal()} data-testid="call-share"
                      className="flex-1 h-12 rounded-md bg-white/10 text-sand-100 font-semibold text-[0.95rem] flex items-center justify-center gap-2 hover:bg-white/20 border border-sand-100/25 cursor-pointer transition-colors [&_svg]:w-4 [&_svg]:h-4"><UserPlusIcon /> {s.invite}</button>
                  </div>
                )}
              </div>
              {!isGuest && !initialRoom && !incomingLink && (
                <div className="w-full flex flex-col gap-1.5">
                  {/* "receive calls" separator above the Call Me box (#196). */}
                  <div className="flex items-center gap-2.5 my-0.5 text-sand-100/45" data-testid="call-receive-sep">
                    <span className="h-px flex-1 bg-sand-100/20" />
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em]">{s.receiveCalls}</span>
                    <span className="h-px flex-1 bg-sand-100/20" />
                  </div>
                  {hasCallLink && <p className="text-[0.82rem] font-semibold text-sand-100/85 ps-0.5" data-testid="call-link-set-note">{s.callLinkSet}</p>}
                  <CallLinkPanel locale={locale} name={name} site={SITE} onLinkChange={setHasCallLink} />
                </div>
              )}
              {/* Hidden once a personal call link is published — that panel is the focus. */}
              {!hasCallLink && <p className="text-[0.78rem] text-sand-100/70 flex items-start gap-1.5" data-testid="call-privacy"><LockIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span>{s.privacy}</span></p>}
            </>
          )}

          {/* Host waiting list (people knocking). */}
          {!isGuest && phase === 'hosting' && waiting.length > 0 && !autoAdmitting && (
            <div className="w-full"><LobbyList waiting={waiting} admit={admit} hint="" title={s.lobbyList} admitLabel={s.admit} leftLabel={s.leftLobby} left={leftWaiters} staleIds={staleIds} live /></div>
          )}

          {/* Diagnostics on the connecting/waiting screen too — a guest whose data
              channel never opens can't reach the in-call panel. No button here: it's
              driven purely by ?debug=1 in the URL, which the host's invite carries, so
              a non-technical guest lands with it on and nothing to tap. */}
          {debug && (phase === 'waiting' || phase === 'hosting') && (
            <div className="w-full [&_[data-testid=call-debug]]:bg-black/20 [&_[data-testid=call-debug]]:border-sand-100/15 [&_*]:!text-sand-100/85" data-testid="call-debug-wait">
              <DebugPanel diag={diag} mic={mic} cam={cam} />
            </div>
          )}
        </div>

        {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-sand-100 px-4 py-2 rounded-md shadow-[var(--shadow-md)] text-[0.9rem]">{toast}</div>}
        {shareModal}
        {declineComposerEl}
      </div>
    )
  }

  const selectedFile = files.find((f) => f.id === selected)
  const participantCount = 1 + inCallPeers.length
  // Elastic participant grid (P2P → assume ≤6). 1: full. 2: side-by-side, or stacked
  // 50/50 when the dock is maximised. 3–4: 2×2. 5–6: 2×3. Tiles fill their cells.
  const gridN = Math.min(participantCount, 6)
  const gridCols = gridN <= 1 ? 1 : gridN === 2 && maximized ? 1 : 2
  const gridRows = gridN <= 1 ? 1 : gridN === 2 ? (maximized ? 2 : 1) : Math.ceil(gridN / 2)
  // Fed to the grid as CSS vars consumed only at max-[640px] — desktop keeps its
  // square 2-col sidebar grid; mobile uses the elastic fill layout.
  const tilesStyle = { ['--gc' as string]: `repeat(${gridCols},minmax(0,1fr))`, ['--gr' as string]: `repeat(${gridRows},minmax(0,1fr))` } as React.CSSProperties
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

  const cams = mediaDevices.filter((d) => d.kind === 'videoinput')
  const mics = mediaDevices.filter((d) => d.kind === 'audioinput')
  const spks = mediaDevices.filter((d) => d.kind === 'audiooutput')
  // Camera / mic / speaker picker. `up` opens it upward (mobile bottom bar).
  const deviceMenu = (up?: boolean) => (
    <Menu testid={up ? 'call-devices-m' : 'call-devices'} align="end" up={up} triggerClass="grid place-items-center h-9 min-w-9 px-2 rounded-md border-0 bg-transparent text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink cursor-pointer [&_svg]:w-[18px] [&_svg]:h-[18px]" trigger={<CogIcon />}>
      <div className="min-w-[13rem] max-w-[80vw]">
        <DeviceGroup label={s.camera} items={cams} value={camId} onPick={(id) => { setCamId(id); rtc.current?.switchCamera(id) }} />
        <DeviceGroup label={s.microphone} items={mics} value={micId} onPick={(id) => { setMicId(id); rtc.current?.switchMic(id) }} />
        {spks.length > 0 && <DeviceGroup label={s.speaker} items={spks} value={spkId} onPick={setSpkId} />}
      </div>
    </Menu>
  )
  // Drag the mobile dock header to resize it — up to the toolbar (maximise) or down
  // to a sliver. The dock's bottom is anchored (above the footer), so height = the
  // anchored bottom minus the pointer's Y.
  function dockDown(e: React.PointerEvent) {
    const aside = (e.currentTarget as HTMLElement).parentElement
    if (!aside) return
    const r = aside.getBoundingClientRect()
    // Delta-based: remember where the grab started + the height then, so the dock
    // resizes by how far you move — no jump from snapping its top to the cursor.
    dockDrag.current = { startY: e.clientY, startH: r.height, max: r.bottom - 52 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function dockMove(e: React.PointerEvent) {
    const d = dockDrag.current; if (!d) return
    setMaximized(false) // a manual drag overrides "maximised"
    setDockH(Math.max(120, Math.min(d.max, d.startH + (d.startY - e.clientY))))
  }
  function dockUp(e: React.PointerEvent) {
    dockDrag.current = null
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* */ }
  }
  // Mobile-only dock header: drag to resize; a title DROPDOWN switches
  // participants/chat; buttons to maximise and to close. The whole bar is the drag
  // handle — interactive children stopPropagation their pointerdown so a tap on them
  // doesn't start a resize.
  const stopDrag = (e: React.PointerEvent) => e.stopPropagation()
  const dockHeader = (
    <div className="hidden max-[640px]:flex items-center justify-between shrink-0 relative border-b border-[color:var(--line)] bg-[var(--surface)] ps-1.5 pe-1.5 h-11 touch-none select-none cursor-row-resize"
      data-testid="call-dock-header" onPointerDown={dockDown} onPointerMove={dockMove} onPointerUp={dockUp} onPointerCancel={dockUp}>
      <div onPointerDown={stopDrag}>
        <Menu align="start" testid="call-dock-title" triggerClass="flex items-center gap-1 h-8 px-2 rounded-md bg-transparent border-0 cursor-pointer text-[0.82rem] font-semibold text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] [&_svg]:w-[16px] [&_svg]:h-[16px]"
          trigger={<>{showReactions ? <span className="text-[1rem] leading-none">🙂</span> : showChat ? <ChatIcon /> : <UsersIcon />}<span>{showReactions ? s.reactions : showChat ? s.chat : s.participants}</span><ChevronDownIcon className="opacity-60" /></>}>
          <MenuItem icon={<UsersIcon />} label={`${s.participants} · ${participantCount}`} testid="call-dock-pick-p" onClick={() => pickPanel('p')} active={showParticipants} />
          <MenuItem icon={<ChatIcon />} label={s.chat} testid="call-dock-pick-c" onClick={() => pickPanel('c')} active={showChat} />
          <MenuItem icon={<span className="text-[1rem] leading-none">🙂</span>} label={s.reactions} testid="call-dock-pick-r" onClick={() => pickPanel('r')} active={showReactions} />
        </Menu>
      </div>
      {/* Grab handle centred across the whole header (not tucked beside the title). */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-[3px] pointer-events-none" aria-hidden="true"><span className="w-8 h-[2px] rounded-full bg-ink-faint/45" /><span className="w-8 h-[2px] rounded-full bg-ink-faint/45" /></span>
      <div className="flex items-center" onPointerDown={stopDrag}>
        <button type="button" onClick={() => setMaximized((m) => !m)} data-testid="call-dock-max" aria-label={maximized ? s.restore : s.maximize} title={maximized ? s.restore : s.maximize}
          className="grid place-items-center w-8 h-8 rounded-md text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] bg-transparent border-0 cursor-pointer [&_svg]:w-[16px] [&_svg]:h-[16px]"><ExpandIcon /></button>
        <button type="button" onClick={() => { setDockMode(null); setMaximized(false) }} data-testid="call-dock-close" aria-label={s.close}
          className="grid place-items-center w-8 h-8 rounded-md text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] bg-transparent border-0 cursor-pointer text-[1.15rem] leading-none">✕</button>
      </div>
    </div>
  )
  // Height style for the mobile dock (a CSS var the max-[640px] class consumes; on
  // desktop the class doesn't apply, so the var is harmlessly ignored).
  const dockStyle = { ['--dock-h' as string]: dockH != null ? `${dockH}px` : undefined } as React.CSSProperties
  const canShareScreen = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia
  // Shared reaction picker: emojis + word tags (+ a custom-tag composer). Used as the
  // dock body when `showReactions` AND inside each message's react menu. Every
  // control stopsPropagation so, inside a Menu, picking doesn't close it (you can
  // toggle several); the Menu closes on outside click. A reaction is any string.
  const reactionPicker = (onPick: (r: string) => void, cls = 'w-[17rem] max-w-[calc(100vw-2rem)]') => {
    const tagCls = 'h-8 px-2.5 rounded-md text-[0.82rem] font-medium border border-[color:var(--line)] bg-[var(--surface)] text-ink cursor-pointer hover:border-green-500 whitespace-nowrap'
    return (
      <div className={cls}>
        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(2.4rem,1fr))] gap-0.5">
          {EMOJI.map((e) => (
            <button key={e} type="button" data-testid="call-react-pick" onClick={(ev) => { ev.stopPropagation(); onPick(e) }}
              className="grid place-items-center h-10 rounded-md text-[1.5rem] leading-none bg-transparent border-0 cursor-pointer hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]">{e}</button>
          ))}
        </div>
        <p className="text-[0.66rem] font-semibold uppercase tracking-wide text-ink-faint px-1 pt-2 pb-1 mt-1 border-t border-[color:var(--line-soft)]">{s.tags}</p>
        <div className="flex flex-wrap gap-1">
          {[...TAGS_EN, ...TAGS_AR, ...customTags].map((t) => (
            <button key={t} type="button" data-testid="call-react-tag" onClick={(ev) => { ev.stopPropagation(); onPick(t) }} className={tagCls}>{t}</button>
          ))}
        </div>
        <div className="flex gap-1 mt-1.5">
          <input value={tagDraft} onClick={(ev) => ev.stopPropagation()} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addCustomTag() } }} placeholder={s.addTag} data-testid="call-tag-input"
            className="flex-1 min-w-0 h-8 px-2 rounded-md border border-[color:var(--line)] bg-[var(--bg)] text-[0.85rem] text-ink focus:outline-none focus:border-green-500" />
          <button type="button" onClick={(ev) => { ev.stopPropagation(); addCustomTag() }} aria-label={s.addTag} data-testid="call-tag-add" className="grid place-items-center w-8 h-8 shrink-0 rounded-md bg-green-600 text-sand-100 border-0 cursor-pointer text-[1.15rem] leading-none">+</button>
        </div>
      </div>
    )
  }

  // Portal to <body> so `fixed inset-0` truly covers the viewport (an animated/
  // transformed ancestor would otherwise become its containing block).
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-[var(--bg)]" data-testid="calls-live"
      onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); dragDepth.current++; setDragOver(true) } }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
      onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragOver(false) }}
      onDrop={(e) => { e.preventDefault(); dragDepth.current = 0; setDragOver(false); pickFiles(e.dataTransfer.files) }}>
      {shareModal}
      {declineComposerEl}
      {/* Busy: a personal-link ring arrived while we're in a call — a docked banner
          (not a takeover). Add pulls them into THIS room; Decline sends a note. */}
      {incomingRing && (
        <div className="w-full bg-green-700 text-sand-100 px-3 py-2 flex items-center gap-3 flex-wrap shrink-0 [animation:bis-call-flash_2.2s_ease-in-out_infinite]" data-testid="call-busy-banner">
          {/* A phone bouncing horizontally toward a couple of motion arrows (#192). */}
          <span className="shrink-0 flex items-center gap-0.5 [animation:bis-bounce-x_0.9s_ease-in-out_infinite]" aria-hidden="true" data-testid="call-busy-phone">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 6l5 6-5 6M12 6l5 6-5 6" opacity={0.85} /></svg>
            <PhoneIcon className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.92rem] font-semibold leading-tight truncate">{s.busyRinging(incomingRing.caller)}</p>
            <p className="text-[0.75rem] text-sand-100/70">{s.inACall}</p>
          </div>
          <button onClick={addToCall} data-testid="call-busy-add" className="h-9 px-3 rounded-md bg-sand-100 text-green-800 text-[0.85rem] font-semibold cursor-pointer hover:bg-white flex items-center gap-1.5 [&_svg]:w-4 [&_svg]:h-4"><UserPlusIcon /> {s.addToCall}</button>
          <button onClick={() => { setDeclineTarget({ room: incomingRing.room, mode: 'banner' }); setIncomingRing(null) }} data-testid="call-busy-decline" className="h-9 px-3 rounded-md bg-white/10 text-sand-100 text-[0.85rem] font-medium border border-sand-100/25 cursor-pointer hover:bg-white/20">{s.decline}</button>
        </div>
      )}
      <AudioSinks streams={[...peers.entries()]} sinkId={spkId} />
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
          <MenuItem icon={<WhiteboardIcon />} label={s.board} onClick={() => syncView('')} active={view === 'board' && !presenting} testid="view-board" />
          {/* getDisplayMedia is desktop-only — hide the option where it can't work
              (mobile browsers, incl. Chrome for Android) rather than offer a dead button. */}
          {canShareScreen && <MenuItem icon={<ScreenShareIcon />} label={sharing ? s.stopScreen : s.screen} onClick={toggleScreen} active={sharing} />}
          <MenuItem icon={<UploadIcon />} label={s.sendFiles} onClick={() => fileRef.current?.click()} testid="call-upload" />
        </Menu>

        {/* participants / chat / call controls — top on desktop, bottom bar on mobile */}
        <span className="w-px h-6 bg-[color:var(--line)] mx-0.5 max-[640px]:hidden" />
        <span className="max-[640px]:hidden flex items-center gap-1.5">
          <IconBtn onClick={() => toggleMode('p')} active={showParticipants} title={s.participants} testid="call-participants" badge={unseen.p || undefined}><UsersIcon /></IconBtn>
          <IconBtn onClick={() => toggleMode('c')} active={showChat} title={s.chat} badge={unseen.c || undefined}><ChatIcon /></IconBtn>
          <IconBtn onClick={() => toggleMode('r')} active={showReactions} title={s.reactions} testid="call-react"><span className="text-[1.15rem] leading-none">🙂</span></IconBtn>
          <span className="w-px h-6 bg-[color:var(--line)] mx-0.5" />
          <IconBtn onClick={toggleCam} active={cam} title={cam ? s.camOff : s.camOn} testid="call-cam">{cam ? <CameraIcon /> : <CamOffIcon />}</IconBtn>
          <IconBtn onClick={toggleMic} active={mic} danger={!mic} flash={speaking} title={mic ? s.muteMe : s.unmuteMe} testid="call-mic">{mic ? <MicIcon /> : <MicOffIcon />}</IconBtn>
          {deviceMenu()}
          <IconBtn onClick={hangup} title={isGuest ? s.hangUp : s.endMeeting} danger big testid="call-hangup">{isGuest ? <PhoneIcon /> : <EndCallIcon />}</IconBtn>
        </span>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { pickFiles(e.target.files); e.target.value = '' }} />
      </header>

      {/* Explain-first notifications: rationale + Enable (which is the ONLY place we
          call requestPermission). Edge-docked bar under the toolbar; dismissible. */}
      {notifyBar && (
        <div className="flex items-center gap-2.5 flex-wrap px-3 py-2 border-b border-[color:var(--line)] bg-[color-mix(in_srgb,var(--color-green-400)_12%,var(--surface))]" data-testid="call-notify-bar">
          <BellIcon className="w-4 h-4 text-green-700 shrink-0" />
          <span className="text-[0.85rem] text-ink leading-snug flex-1 min-w-[12rem]">{s.notifyWhy}</span>
          <button type="button" onClick={enableNotify} data-testid="call-notify-enable"
            className="flex-none inline-flex items-center h-8 px-3 rounded-md bg-green-600 text-sand-100 text-[0.82rem] font-semibold border-0 cursor-pointer hover:bg-green-700">{s.notifyEnable}</button>
          <button type="button" onClick={dismissNotify} aria-label={s.close} data-testid="call-notify-dismiss"
            className="flex-none grid place-items-center w-8 h-8 rounded-md text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] bg-transparent border-0 cursor-pointer text-[1.05rem] leading-none">✕</button>
        </div>
      )}

      {/* MOBILE file picker: a full-width dropdown docked under the toolbar (the
          desktop equivalent is the docked side panel). */}
      {files.length > 0 && (
        <div className="hidden max-[640px]:block border-b border-[color:var(--line)] bg-[var(--surface)] px-2 py-1.5" data-testid="call-filebar">
          <Menu full testid="call-filebar-menu"
            triggerClass="flex items-center justify-between gap-1.5 w-full h-9 px-2.5 rounded-md border border-[color:var(--line)] bg-[var(--bg)] text-[0.9rem] text-ink cursor-pointer [&_svg]:w-[18px] [&_svg]:h-[18px]"
            trigger={<><span className="flex items-center gap-1.5 min-w-0"><FileIcon />{unseen.f > 0 && <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />}<span className="truncate">{view === 'file' && selectedFile ? selectedFile.name : `${s.filesTitle} · ${files.length}`}</span></span><ChevronDownIcon className="opacity-60 shrink-0" /></>}>
            {files.map((f) => (
              <div key={f.id} className={`group flex items-center rounded-md ${selected === f.id && view === 'file' ? 'bg-[color-mix(in_srgb,var(--ink)_12%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]'}`}>
                <button type="button" onClick={() => syncView(f.id)} data-testid="call-file-open" className="flex-1 min-w-0 text-start px-2 py-2 text-[0.85rem] bg-transparent border-0 cursor-pointer text-ink truncate">
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
      {/* Desktop: whiteboard + side dock in a row. Mobile: a vertical split —
          whiteboard on top, the participants/chat dock docked to the bottom half. */}
      <div className="flex-1 flex min-h-0 relative max-[640px]:flex-col">
        {/* docked file list — DESKTOP only (mobile uses the Files dropdown) */}
        {files.length > 0 && (
          <aside className="flex max-[640px]:hidden w-48 sm:w-56 shrink-0 flex-col border-e border-[color:var(--line)] bg-[var(--surface)] overflow-y-auto p-2 gap-0.5" data-testid="call-filelist">
            <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint px-1 py-1">{s.filesTitle} · {files.length}</p>
            {files.map((f) => (
              <div key={f.id} className={`group flex items-center rounded-md ${selected === f.id && view === 'file' ? 'bg-[color-mix(in_srgb,var(--ink)_12%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]'}`}>
                <button type="button" onClick={() => syncView(f.id)} data-testid="call-file-open" className="flex-1 min-w-0 text-start px-2 py-1.5 text-[0.82rem] bg-transparent border-0 cursor-pointer text-ink truncate">
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
        <main className={`flex-1 relative min-w-0 overflow-hidden max-[640px]:min-h-0 ${maximized ? 'max-[640px]:hidden' : ''} ${presenting || view === 'file' ? 'bg-[color-mix(in_srgb,var(--ink)_90%,black)]' : 'bg-white'}`}>
          {/* Live reactions drifting up the stage. */}
          <div className="absolute inset-0 z-30 overflow-hidden pointer-events-none" data-testid="call-reactions" aria-hidden="true">
            {floats.map((f) => (
              <span key={f.id} className="absolute bottom-[12%] -translate-x-1/2 flex flex-col items-center gap-1.5 will-change-transform [animation:reactFloat_2.5s_ease-out_forwards]" style={{ left: `${f.x}%` }}>
                <span className="text-[0.68rem] font-semibold text-ink-soft whitespace-nowrap leading-none [text-shadow:0_1px_3px_var(--bg)]">{f.who}</span>
                {isTag(f.emoji)
                  ? <span className="inline-block px-3 py-1 rounded-full bg-green-700 text-sand-100 text-[0.95rem] font-semibold whitespace-nowrap shadow-[var(--shadow-md)]">{f.emoji}</span>
                  : <span className="text-[2.4rem] drop-shadow leading-none">{f.emoji}</span>}
              </span>
            ))}
          </div>
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
              {/* z-30 lifts the download button above the annotation canvas so it's
                  clickable, while the canvas stays drawable everywhere else. */}
              <a href={selectedFile.url} download={selectedFile.name} title={s.download} aria-label={s.download} data-testid="call-file-dl-main"
                className="absolute top-3 end-3 z-30 flex items-center gap-1.5 px-3 h-9 rounded-md bg-black/45 hover:bg-black/60 text-sand-100 text-[0.82rem] no-underline"><DownloadIcon className="w-4 h-4" /> {s.download}</a>
            </div>
          )}
          <canvas ref={wbRef} className={`absolute inset-0 w-full h-full touch-pinch-zoom ${tool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`} onPointerDown={wbDown} onPointerMove={wbMove} onPointerUp={wbUp} onPointerLeave={wbUp} onPointerCancel={wbUp} />
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
          <aside style={dockStyle} className={`w-56 sm:w-64 shrink-0 border-s border-[color:var(--line)] bg-[var(--surface)] overflow-y-auto overflow-x-hidden flex flex-col max-[640px]:w-full max-[640px]:border-s-0 max-[640px]:border-t ${maximized ? 'max-[640px]:flex-1' : 'max-[640px]:[height:var(--dock-h,46vh)]'}`} data-testid="call-participants-panel">
            {dockHeader}
            {/* Knocks first — pinned above the video grid so the host never misses
                someone waiting, even on a short mobile dock where the elastic grid
                would otherwise push the list out of view. */}
            {!isGuest && (waiting.length > 0 || leftWaiters.length > 0) && !autoAdmitting && (
              <div className="shrink-0 p-2.5 border-b border-[color:var(--line-soft)]">
                <LobbyList waiting={waiting} admit={admit} hint={s.shareHint} title={s.lobbyList} admitLabel={s.admit} leftLabel={s.leftLobby} left={leftWaiters} live staleIds={staleIds} />
              </div>
            )}
            {/* Full-bleed elastic video grid: tiles fill their cells (no gaps/margins),
                the layout (cols×rows) adapts to the participant count + maximise. */}
            <div className="grid grid-cols-2 gap-0 max-[640px]:flex-1 max-[640px]:min-h-0 max-[640px]:[grid-template-columns:var(--gc)] max-[640px]:[grid-template-rows:var(--gr)]" style={tilesStyle} data-testid="call-tiles">
              <ParticipantTile name={name || s.you} stream={local} camOn={cam} muted={!mic} self muteLabel={s.muteThem} />
              {inCallPeers.map(([id, info]) => (
                <ParticipantTile key={id} name={info.name || '•'} stream={peers.get(id)} camOn={info.cam} muted={info.muted} self={false} onMute={() => forceMute(id)} muteLabel={s.muteThem} idle={staleIds.has(id)} idleLabel={s.reconnecting} />
              ))}
            </div>
            {debug && <div className="shrink-0 p-2.5"><DebugPanel diag={diag} mic={mic} cam={cam} /></div>}
          </aside>
        )}
        {showChat && (
          <aside style={dockStyle} className={`w-64 sm:w-72 shrink-0 border-s border-[color:var(--line)] bg-[var(--surface)] flex flex-col max-[640px]:w-full max-[640px]:border-s-0 max-[640px]:border-t ${maximized ? 'max-[640px]:flex-1' : 'max-[640px]:[height:var(--dock-h,46vh)]'}`} data-testid="call-chat-panel">
            {dockHeader}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 text-[0.9rem]">
              {chat.length === 0 && <p className="m-auto text-ink-faint/60 text-[0.85rem]" data-testid="call-chat-empty">{s.noMessages}</p>}
              {chat.map((m, i) => {
                const mine = m.from === 'me'
                const reacts = m.reactions ? Object.entries(m.reactions) : []
                return (
                  <div key={i} className={`group/msg flex flex-col max-w-[85%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
                    {!mine && <span className="text-[0.68rem] text-ink-faint px-1.5 pb-0.5">{m.name}</span>}
                    <div className={`flex items-center gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
                      {/* Speech bubble: tail corner squared toward the sender's side. */}
                      <div className={`px-3 py-1.5 rounded-2xl leading-snug break-words ${mine ? 'bg-green-600 text-sand-100 rounded-ee-sm' : 'bg-[color-mix(in_srgb,var(--ink)_8%,var(--surface))] text-ink rounded-es-sm'}`}>
                        {m.url ? <a href={m.url} download={m.fileName} className={`underline inline-flex items-center gap-1 ${mine ? 'text-sand-100' : 'text-green-700'}`}><DownloadIcon className="w-3.5 h-3.5" />{m.fileName}</a>
                          : m.fileName ? <span className="opacity-80 inline-flex items-center gap-1"><UploadIcon className="w-3.5 h-3.5" />{m.fileName}</span>
                            : m.text}
                      </div>
                      {/* React to this message — a "more" affordance (not a default
                          emoji). Reveal on hover (desktop), always on touch. The menu
                          holds the full picker (emojis + tags), toggling on each pick. */}
                      <Menu align={mine ? 'end' : 'start'} testid="call-msg-react"
                        triggerClass="grid place-items-center w-7 h-7 shrink-0 rounded-full bg-transparent border-0 cursor-pointer text-ink-faint hover:text-ink opacity-0 group-hover/msg:opacity-100 max-[640px]:opacity-100 hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] [&_svg]:w-4 [&_svg]:h-4" trigger={<MoreVIcon />}>
                        {reactionPicker((r) => reactToMsg(m.id, r))}
                      </Menu>
                    </div>
                    {reacts.length > 0 && (() => {
                      const latest3 = reacts.slice(-3)
                      const total = reacts.reduce((n, [, names]) => n + names.length, 0)
                      const mineReacted = reacts.some(([, names]) => names.includes(name || s.you))
                      const breakdown = reacts.map(([r, names]) => `${r} · ${names.join(', ')}`).join('\n')
                      // A single "pill": the 3 latest reactions stacked + the total.
                      // Hover shows the breakdown; click/tap opens the who-reacted list.
                      return (
                        <div className={`mt-0.5 ${mine ? 'self-end' : 'self-start'}`} data-testid="call-msg-reacts">
                          <Menu align={mine ? 'end' : 'start'} testid="call-msg-reacts-pill"
                            triggerClass={`inline-flex items-center gap-1 h-6 ps-1 pe-1.5 rounded-full border cursor-pointer ${mineReacted ? 'border-green-500 bg-[color-mix(in_srgb,var(--color-green-400)_16%,transparent)]' : 'border-[color:var(--line)] bg-[var(--surface)] hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]'}`}
                            trigger={<span className="inline-flex items-center gap-1" title={breakdown}>
                              <span className="flex -space-x-2">
                                {latest3.map(([r], k) => (
                                  <span key={r} style={{ zIndex: latest3.length - k }} className={`relative inline-grid place-items-center h-[1.3rem] rounded-full bg-[var(--surface)] border border-[color:var(--line)] text-[0.72rem] leading-none overflow-hidden ${isTag(r) ? 'px-1.5 max-w-[3.75rem] whitespace-nowrap' : 'w-[1.3rem]'}`}>{r}</span>
                                ))}
                              </span>
                              <span className="text-[0.72rem] font-medium text-ink-soft ps-0.5">{total}</span>
                            </span>}>
                            <div className="min-w-[11rem] max-w-[16rem] flex flex-col gap-0.5">
                              {reacts.map(([r, names]) => (
                                <button key={r} type="button" onClick={() => reactToMsg(m.id, r)}
                                  className={`flex items-start gap-2 px-2 py-1.5 rounded-md text-start hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] ${names.includes(name || s.you) ? 'bg-[color-mix(in_srgb,var(--color-green-400)_12%,transparent)]' : ''}`}>
                                  <span className="text-[0.95rem] leading-tight shrink-0">{r}</span>
                                  <span className="text-[0.78rem] text-ink-soft leading-snug">{names.join(', ')}</span>
                                </button>
                              ))}
                            </div>
                          </Menu>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2 p-2 border-t border-[color:var(--line)]">
              <Input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendChat() }} placeholder={s.typeMsg} className="flex-1" />
              <Button variant="primary" onClick={sendChat}>{s.send}</Button>
            </div>
          </aside>
        )}
        {showReactions && (
          <aside style={dockStyle} className={`w-56 sm:w-64 shrink-0 border-s border-[color:var(--line)] bg-[var(--surface)] flex flex-col max-[640px]:w-full max-[640px]:border-s-0 max-[640px]:border-t ${maximized ? 'max-[640px]:flex-1' : 'max-[640px]:[height:var(--dock-h,46vh)]'}`} data-testid="call-reactions-panel">
            {dockHeader}
            <div className="flex-1 overflow-y-auto p-3">{reactionPicker(sendReaction, 'w-full')}</div>
          </aside>
        )}
      </div>

      {/* ---- mobile bottom bar ---- */}
      <footer className="hidden max-[640px]:flex items-center gap-1.5 px-2 py-2 border-t border-[color:var(--line)] bg-[var(--surface)]">
        {/* A docking icon toggles the dock (reopening the last panel); the panel
            CHOICE now lives in the dock's own title dropdown. */}
        <IconBtn onClick={toggleDock} active={!!dockMode} title={s.dock} testid="call-dock-toggle" badge={(unseen.p + unseen.c) || undefined}><DockIcon /></IconBtn>
        <IconBtn onClick={() => toggleMode('r')} active={showReactions} title={s.reactions} testid="call-react-open"><span className="text-[1.2rem] leading-none">🙂</span></IconBtn>
        <div className="flex-1" />
        {deviceMenu(true)}
        <IconBtn onClick={toggleCam} active={cam} title={cam ? s.camOff : s.camOn}>{cam ? <CameraIcon /> : <CamOffIcon />}</IconBtn>
        <IconBtn onClick={toggleMic} active={mic} danger={!mic} flash={speaking} title={mic ? s.muteMe : s.unmuteMe}>{mic ? <MicIcon /> : <MicOffIcon />}</IconBtn>
        <IconBtn onClick={hangup} title={isGuest ? s.hangUp : s.endMeeting} danger big>{isGuest ? <PhoneIcon /> : <EndCallIcon />}</IconBtn>
      </footer>

      {toast && <div className="fixed bottom-16 max-[640px]:bottom-20 left-1/2 -translate-x-1/2 z-[90] bg-green-700 text-sand-100 px-4 py-2 rounded-md shadow-[var(--shadow-md)] text-[0.9rem]">{toast}</div>}
    </div>,
    document.body,
  )
}

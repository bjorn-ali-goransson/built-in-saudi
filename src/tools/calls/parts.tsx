// Presentational pieces for the Calls tool — stateless-ish building blocks the
// orchestrator (CallsTool) composes. Kept here so the main file stays about flow.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../../components/ui'
import { UsersIcon, MicIcon, MicOffIcon } from '../../components/icons'
import type { DiagSnapshot, PeerInfo } from './rtc'
import { initials } from './helpers'

export function StreamVideo({ stream, className, muted, mirror }: { stream: MediaStream; className?: string; muted?: boolean; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${mirror ? '-scale-x-100 ' : ''}${className || ''}`} />
}

// The host's "Waiting in the lobby" list — a card of guests with a Let-in button.
export function LobbyList({ waiting, admit, hint, title, admitLabel, leftLabel, left, live, staleIds }: { waiting: [string, PeerInfo][]; admit: (id: string) => void; hint: string; title: string; admitLabel: string; leftLabel: string; left?: { id: string; name: string }[]; live?: boolean; staleIds?: Set<string> }) {
  const gone = left || []
  if (waiting.length === 0 && gone.length === 0) return live ? null : <p className="max-w-[30rem] text-[0.85rem] text-ink-faint">{hint}</p>
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
      {gone.map((w) => (
        <div key={w.id} className="flex items-center gap-3 opacity-55" data-testid="call-lobby-left">
          <span className="w-8 h-8 rounded-full bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink-faint grid place-items-center text-[0.78rem] font-semibold shrink-0" aria-hidden="true">{initials(w.name)}</span>
          <span className="flex-1 text-[0.92rem] text-ink-soft truncate line-through decoration-1">{w.name || '•'}</span>
          <span className="text-[0.78rem] text-ink-faint italic shrink-0">{leftLabel}</span>
        </div>
      ))}
    </div>
  )
}

// A borderless toolbar icon button: shaded on hover, extra-shaded when active.
export function IconBtn({ onClick, title, active, danger, children, testid, badge, big, flash }: { onClick: () => void; title: string; active?: boolean; danger?: boolean; children: ReactNode; testid?: string; badge?: number; big?: boolean; flash?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} data-testid={testid}
      className={`relative grid place-items-center h-9 min-w-9 px-2 rounded-md border-0 cursor-pointer transition-colors ${big ? '[&_svg]:w-[23px] [&_svg]:h-[23px]' : '[&_svg]:w-[18px] [&_svg]:h-[18px]'} ${
        flash ? 'bg-[color-mix(in_srgb,var(--color-green-500)_28%,transparent)] text-green-700 ring-2 ring-green-500 [animation:mic-pulse_0.9s_ease-in-out_infinite]'
          : danger ? 'bg-transparent text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_15%,transparent)]'
            : active ? 'bg-[color-mix(in_srgb,var(--ink)_15%,transparent)] text-ink'
              : 'bg-transparent text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink'}`}>
      {children}
      {badge ? <span className="absolute -top-1 -end-1 min-w-[15px] h-[15px] px-1 rounded-full bg-gold-500 text-white text-[0.6rem] font-bold grid place-items-center">{badge}</span> : null}
    </button>
  )
}

// A dropdown: a trigger button + a floating panel that closes on outside click.
export function Menu({ trigger, triggerClass, children, align = 'start', up, testid, full }: { trigger: ReactNode; triggerClass?: string; children: ReactNode; align?: 'start' | 'end'; up?: boolean; testid?: string; full?: boolean }) {
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
export function MenuItem({ icon, label, onClick, active, testid }: { icon?: ReactNode; label: string; onClick: () => void; active?: boolean; testid?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-start text-[0.88rem] bg-transparent border-0 cursor-pointer whitespace-nowrap hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] [&_svg]:w-[18px] [&_svg]:h-[18px] ${active ? 'text-green-700 font-semibold' : 'text-ink'}`}>
      {icon}{label}
    </button>
  )
}
export const dropTrigger = 'flex items-center gap-1.5 h-9 px-2.5 rounded-md border-0 bg-transparent text-ink-soft hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink cursor-pointer text-[0.9rem] font-medium [&_svg]:w-[18px] [&_svg]:h-[18px]'

// Remote audio plays through dedicated, always-mounted <audio> sinks rather than
// the tile's <video>: a cam-off tile hides its video (`invisible`), and some
// browsers (iOS Safari especially) won't play audio from a hidden video. The
// late-arriving audio track can also be autoplay-blocked, so retry play() on the
// next user gesture. One sink per remote peer stream.
function PeerAudio({ stream, sinkId }: { stream: MediaStream; sinkId?: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.srcObject !== stream) el.srcObject = stream
    const play = () => { el.play?.().catch(() => {}) }
    play()
    document.addEventListener('pointerdown', play)
    document.addEventListener('keydown', play)
    return () => { document.removeEventListener('pointerdown', play); document.removeEventListener('keydown', play) }
  }, [stream])
  // Route playback to the chosen speaker (output device). setSinkId isn't in the
  // lib DOM types and is unsupported on some browsers, so guard + cast.
  useEffect(() => {
    const el = ref.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null
    if (el && sinkId && el.setSinkId) el.setSinkId(sinkId).catch(() => {})
  }, [sinkId, stream])
  return <audio ref={ref} autoPlay className="hidden" />
}
export function AudioSinks({ streams, sinkId }: { streams: [string, MediaStream][]; sinkId?: string }) {
  return <>{streams.map(([id, s]) => <PeerAudio key={id} stream={s} sinkId={sinkId} />)}</>
}

// One labelled section of the device picker (Camera / Microphone / Speaker). With
// no explicit choice yet, the first device is shown as active (the browser default).
export function DeviceGroup({ label, items, value, onPick }: { label: string; items: MediaDeviceInfo[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="py-1 border-t border-[color:var(--line-soft)] first:border-t-0">
      <p className="px-3 pt-1 pb-0.5 text-[0.66rem] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      {items.length === 0
        ? <p className="px-3 py-1 text-[0.82rem] text-ink-faint/70">—</p>
        : items.map((d, i) => (
          <MenuItem key={d.deviceId || i} label={d.label || `${label} ${i + 1}`}
            active={value ? value === d.deviceId : i === 0} onClick={() => onPick(d.deviceId)} />
        ))}
    </div>
  )
}

// Voice-activity detection: true while the stream's audio is above a speaking
// threshold (with a short linger so it doesn't strobe). Taps the mic via a Web
// Audio analyser — never connected to output, so it can't cause echo. `active`
// gates it to when the mic is actually on.
export function useSpeaking(stream: MediaStream | null, active: boolean): boolean {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    const track = active ? stream?.getAudioTracks()[0] : null
    if (!track) { setSpeaking(false); return }
    let ctx: AudioContext | null = null
    let iv = 0
    let lastAbove = 0
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      ctx = new AC()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      iv = window.setInterval(() => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v }
        const rms = Math.sqrt(sum / data.length)
        const now = ctx!.currentTime * 1000
        if (rms > 0.035) lastAbove = now
        const on = now - lastAbove < 350
        setSpeaking((prev) => (prev === on ? prev : on))
      }, 100)
    } catch { /* audio unavailable */ }
    return () => { window.clearInterval(iv); ctx?.close().catch(() => {}) }
  }, [stream, active])
  return speaking
}

// A live read-out of the call's connection + media state, so a tester can screenshot
// exactly what's happening (is the mic acquired? is audio being sent/received? did
// the peer connection actually connect?). Toggled from the participants panel.
export function DebugPanel({ diag, mic, cam }: { diag: DiagSnapshot | null; mic: boolean; cam: boolean }) {
  const line = 'font-mono text-[0.62rem] leading-[1.35] break-all'
  return (
    <div className="rounded-md border border-[color:var(--line)] bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface))] p-2 flex flex-col gap-1" data-testid="call-debug">
      <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-ink-faint">Diagnostics · UI mic {mic ? 'on' : 'off'} / cam {cam ? 'on' : 'off'}</p>
      {!diag ? <p className={line}>connecting…</p> : (
        <>
          <p className={line}>me {diag.me} · {diag.role} · inCall {String(diag.inCall)} · muted {String(diag.muted)}</p>
          <p className={line}>myMic [{diag.mic}] · myCam [{diag.cam}]</p>
          {diag.peers.length === 0 && <p className={line}>no peers connected</p>}
          {diag.peers.map((p) => (
            <div key={p.id} className={`${line} border-t border-[color:var(--line-soft)] pt-1`}>
              <div>▸ {p.name} ({p.id}) theirInCall {String(p.theirInCall)}</div>
              <div>conn <b>{p.conn}</b> · ice {p.ice} · dc {p.dc}</div>
              <div>sendMic [{p.sendMic}] · sendCam [{p.sendCam}]</div>
              <div>recvAudio [{p.recvAudio}] · recvVideo [{p.recvVideo}]</div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// A participant square. The <video> stays mounted whenever there's a stream; it's
// always muted (audio is handled by the AudioSinks above), the avatar overlays it.
export function ParticipantTile({ name, stream, camOn, muted, self, onMute, muteLabel, idle, idleLabel }: { name: string; stream?: MediaStream | null; camOn: boolean; muted: boolean; self: boolean; onMute?: () => void; muteLabel: string; idle?: boolean; idleLabel?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { const el = ref.current; if (el && stream && el.srcObject !== stream) { el.srcObject = stream; el.play?.().catch(() => {}) } }, [stream])
  return (
    <div className={`group relative w-full aspect-square max-[640px]:aspect-auto max-[640px]:h-full max-[640px]:min-h-0 min-w-0 overflow-hidden bg-[color-mix(in_srgb,var(--ink)_8%,var(--surface))] transition-[opacity,filter] duration-500 ${idle ? 'opacity-40 grayscale' : ''}`} title={idle ? idleLabel : undefined}>
      {stream && <video ref={ref} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover ${self ? '-scale-x-100' : ''} ${camOn ? '' : 'invisible'}`} />}
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

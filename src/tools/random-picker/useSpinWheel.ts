import { useEffect, useRef, useState } from 'react'
import type { SpinSound } from './audio'

const SPIN_MS = 3500
/** The single definition of the spin's motion — the sound follows the rendered rotation, so it needs no copy. */
export const SPIN_TRANSITION = `transform ${SPIN_MS}ms cubic-bezier(0.2,0.8,0.1,1)`

/**
 * One spin's lifecycle: pick a winner, rotate the wheel to it, follow the *rendered*
 * rotation frame-by-frame (a tick per segment-width swept), resolve on transitionend.
 */
export function useSpinWheel(options: string[], sound: SpinSound) {
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState('')
  const wheelRef = useRef<SVGSVGElement | null>(null)
  const raf = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  // The in-flight winner's name; non-null exactly while a spin is unresolved.
  const pending = useRef<string | null>(null)

  useEffect(() => () => {
    cancelAnimationFrame(raf.current)
    window.clearTimeout(timer.current)
  }, [])

  /** The wheel's rendered rotation in degrees, read back from the computed transform. */
  function wheelAngle(): number {
    const el = wheelRef.current
    if (!el) return 0
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform)
    if (!m) return 0
    const [a, b] = m[1].split(',').map(Number)
    return (Math.atan2(b, a) * 180) / Math.PI
  }

  // Follow the wheel's actual rendered rotation and click each time it sweeps another
  // segment-width — the CSS transition is the single source of truth, so the sound
  // can't drift from the visuals however the easing or duration are tuned.
  function followRotation(seg: number) {
    cancelAnimationFrame(raf.current)
    let last = wheelAngle()
    let traveled = 0
    const step = () => {
      if (pending.current === null) return
      const a = wheelAngle()
      let d = a - last
      if (d < -180) d += 360 // the computed angle wraps at 360; the wheel only turns forward
      last = a
      if (d > 0) {
        const before = Math.floor(traveled / seg)
        traveled += d
        if (Math.floor(traveled / seg) > before) sound.tick()
      }
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  /** Resolve the spin (idempotent): ding, reveal the winner, stop following. */
  function settle() {
    if (pending.current === null) return
    cancelAnimationFrame(raf.current)
    window.clearTimeout(timer.current)
    sound.ding()
    setWinner(pending.current)
    pending.current = null
    setSpinning(false)
  }

  function spin() {
    const n = options.length
    if (n < 2 || spinning) return
    setWinner('')
    setSpinning(true)
    const idx = crypto.getRandomValues(new Uint32Array(1))[0] % n
    const seg = 360 / n
    // put segment idx centre under the top pointer: target = k*360 - (idx*seg + seg/2)
    const turns = 5
    const delta = turns * 360 + (360 - ((rot % 360) + idx * seg + seg / 2)) % 360 + 360
    setRot(rot + delta)
    pending.current = options[idx]
    sound.prime() // resume/create the AudioContext within the click gesture
    followRotation(seg)
    // transitionend resolves the spin; this is a safety net for a missed event
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(settle, SPIN_MS + 250)
  }

  return { rot, spinning, winner, wheelRef, spin, settle }
}

import { useEffect, useRef, useState } from 'react'
import type { SpinSound } from './audio'

const SPIN_MS = 3500
/** The single definition of the spin's motion — the sound follows the rendered rotation, so it needs no copy. */
export const SPIN_TRANSITION = `transform ${SPIN_MS}ms cubic-bezier(0.2,0.8,0.1,1)`

/** Pick a winner, rotate the wheel to it, and tick each time a slice passes the pointer. */
export function useSpinWheel(options: string[], sound: SpinSound) {
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState('')
  const wheelRef = useRef<SVGSVGElement | null>(null)
  const raf = useRef(0)
  const timer = useRef<number | undefined>(undefined)

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

  /** Tick whenever the wheel's rendered rotation sweeps past another slice boundary. */
  function tickOnSliceCrossings(seg: number, totalDeg: number) {
    cancelAnimationFrame(raf.current)
    let last = wheelAngle()
    let traveled = 0
    const step = () => {
      const a = wheelAngle()
      let d = a - last
      if (d < -180) d += 360 // the computed angle wraps at 360; the wheel only turns forward
      last = a
      if (d > 0) {
        if (Math.floor((traveled + d) / seg) > Math.floor(traveled / seg)) sound.tick()
        traveled += d
      }
      if (traveled < totalDeg - 0.5) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
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
    sound.prime() // resume/create the AudioContext within the click gesture
    tickOnSliceCrossings(seg, delta)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      sound.ding()
      setWinner(options[idx])
      setSpinning(false)
    }, SPIN_MS + 100)
  }

  return { rot, spinning, winner, wheelRef, spin }
}

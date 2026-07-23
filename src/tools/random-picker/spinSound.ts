import { useEffect, useState } from 'react'

/**
 * All of the Random Picker's sound: a lazily-created WebAudio beeper plus the
 * rAF loop that ticks whenever the wheel's rendered rotation passes a slice.
 * Every method is safe to call while muted or with audio unavailable.
 */
export class SpinSound {
  enabled = true
  private ac: AudioContext | null = null
  private raf = 0

  private ctx(): AudioContext | null {
    if (!this.ac) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ac = new AC()
    }
    if (this.ac.state === 'suspended') this.ac.resume()
    return this.ac
  }

  /** Create/resume the context — must happen inside a user gesture (autoplay policy). */
  prime() {
    if (this.enabled) this.ctx()
  }

  tick(freq = 760, dur = 0.05, gain = 0.14) {
    if (!this.enabled) return // gate at fire-time so a mid-spin mute goes silent
    const ac = this.ctx()
    if (!ac) return
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, ac.currentTime)
    g.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur)
    osc.connect(g).connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + dur)
  }

  ding() {
    this.tick(880, 0.12, 0.16)
    this.tick(1320, 0.18, 0.12)
  }

  /**
   * Tick each slice-crossing by following the wheel's actual rendered rotation —
   * the CSS transition stays the single source of truth, so the sound can't
   * drift from the visuals. Stops itself once `totalDeg` has been swept.
   */
  followSpin(el: SVGSVGElement | null, sliceDeg: number, totalDeg: number) {
    cancelAnimationFrame(this.raf)
    if (!el) return
    const angle = () => {
      const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform)
      if (!m) return 0
      const [a, b] = m[1].split(',').map(Number)
      return (Math.atan2(b, a) * 180) / Math.PI
    }
    let last = angle()
    let traveled = 0
    const step = () => {
      const a = angle()
      let d = a - last
      if (d < -180) d += 360 // the computed angle wraps at 360; the wheel only turns forward
      last = a
      if (d > 0) {
        if (Math.floor((traveled + d) / sliceDeg) > Math.floor(traveled / sliceDeg)) this.tick()
        traveled += d
      }
      if (traveled < totalDeg - 0.5) this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
  }

  close() {
    cancelAnimationFrame(this.raf)
    this.ac?.close()
    this.ac = null
  }
}

/** The sound on/off preference (persisted) and the SpinSound lifecycle. */
export function useSpinSound() {
  const [snd] = useState(() => new SpinSound())
  const [sound, setSound] = useState(() => {
    try { return localStorage.getItem('bis-picker-sound') !== 'off' } catch { return true }
  })

  useEffect(() => {
    snd.enabled = sound
    try { localStorage.setItem('bis-picker-sound', sound ? 'on' : 'off') } catch { /* ignore */ }
  }, [snd, sound])
  useEffect(() => () => snd.close(), [snd])

  function toggle() {
    const next = !sound
    snd.enabled = next // before the effect runs — a mid-spin tick may fire first
    if (next) snd.prime() // create/resume inside the click gesture
    setSound(next)
  }

  return { snd, sound, toggle }
}

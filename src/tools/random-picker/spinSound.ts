import { useEffect, useState } from 'react'

/**
 * All of the Random Picker's sound: a lazily-created WebAudio beeper plus the
 * requestAnimationFrame loop that ticks whenever the wheel's rendered rotation passes a slice.
 * Every method is safe to call while muted or with audio unavailable.
 */
export class SpinSound {
  enabled = true
  private ac: AudioContext | null = null
  private raf = 0

  private ensureAudio(): AudioContext | null {
    if (!this.ac) {
      if (typeof AudioContext === 'undefined') return null
      this.ac = new AudioContext()
    }
    if (this.ac.state === 'suspended') this.ac.resume()
    return this.ac
  }

  /** Create/resume the context — must happen inside a user gesture (autoplay policy). */
  unlock() {
    if (this.enabled) this.ensureAudio()
  }

  tick(freq = 760, dur = 0.05, gain = 0.14) {
    if (!this.enabled) return // gate at fire-time so a mid-spin mute goes silent
    const ac = this.ensureAudio()
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
   * Tick each time the spinning wheel sweeps past another slice boundary.
   * Watches the wheel's actual on-screen rotation once per frame, so the sound
   * always matches what the eye sees. Stops itself after `totalDeg` of travel.
   */
  followSpin(wheel: SVGSVGElement | null, sliceDeg: number, totalDeg: number) {
    cancelAnimationFrame(this.raf)
    if (!wheel) return
    let previous = rotationOf(wheel)
    let traveled = 0
    const everyFrame = () => {
      const current = rotationOf(wheel)
      const moved = degreesMovedForward(previous, current)
      previous = current
      const boundariesCrossed = Math.floor((traveled + moved) / sliceDeg) - Math.floor(traveled / sliceDeg)
      if (boundariesCrossed > 0) this.tick()
      traveled += moved
      if (traveled < totalDeg - 0.5) this.raf = requestAnimationFrame(everyFrame)
    }
    this.raf = requestAnimationFrame(everyFrame)
  }

  close() {
    cancelAnimationFrame(this.raf)
    this.ac?.close()
    this.ac = null
  }
}

/** The element's current on-screen rotation in degrees (0–360), read from its rendered CSS transform. */
function rotationOf(el: Element): number {
  const { a, b } = new DOMMatrix(getComputedStyle(el).transform)
  return (Math.atan2(b, a) * 180) / Math.PI
}

/**
 * How far the wheel turned between two angle readings, in degrees.
 * The reported angle jumps back to 0 after passing 360; since the wheel only
 * spins forward, a "backwards" reading just means we crossed that seam.
 */
function degreesMovedForward(previous: number, current: number): number {
  const moved = current - previous
  return moved < -180 ? moved + 360 : Math.max(0, moved)
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
    if (next) snd.unlock() // create/resume inside the click gesture
    setSound(next)
  }

  return { snd, sound, toggle }
}

import { useEffect, useState } from 'react'
import { rotationOf, degreesMovedForward } from '../../lib/rotation'

/**
 * All of the Random Picker's sound: a lazily-created WebAudio beeper plus the
 * requestAnimationFrame loop that ticks whenever the wheel's rendered rotation passes a slice.
 * Every method is safe to call while muted or with audio unavailable.
 */
export class SpinSound {
  /** Master on/off switch (the user's mute toggle). While false, every play method is silent. */
  enabled = true
  private ac: AudioContext | null = null
  private raf = 0

  /** Get the audio engine, ready to play: created on first use, un-paused if the browser paused it. */
  private ensureAudio(): AudioContext | null {
    if (!this.ac) {
      if (typeof AudioContext === 'undefined') return null
      this.ac = new AudioContext()
    }
    if (this.ac.state === 'suspended') this.ac.resume()
    return this.ac
  }

  /**
   * Start the audio engine early so later ticks play instantly. Browsers only
   * allow audio to start from a user gesture, so call this inside a click handler.
   */
  unlock() {
    if (this.enabled) this.ensureAudio()
  }

  /**
   * Play one short beep — the wheel's tick.
   * @param freq  pitch in Hz (higher = brighter)
   * @param dur   length in seconds
   * @param gain  volume, 0–1
   */
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

  /** Play the two-note winner chime shown when the wheel settles. */
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

  /** Release everything: stop the follow loop and shut down the audio engine. Call on unmount. */
  close() {
    cancelAnimationFrame(this.raf)
    this.ac?.close()
    this.ac = null
  }
}

/** The sound on/off preference (persisted to localStorage) and the SpinSound lifecycle. */
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

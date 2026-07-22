/**
 * Lazily-created WebAudio beeper for the wheel's spin ticks and winner ding.
 * Every method is safe to call while muted or with audio unavailable.
 */
export class SpinSound {
  enabled = true
  private ac: AudioContext | null = null

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

  close() {
    this.ac?.close()
    this.ac = null
  }
}

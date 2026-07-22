// Pure, dependency-light helpers for the Calls tool — no React, no JSX.
export const oid = () => Math.random().toString(36).slice(2, 10)
export const WB_COLORS = ['#e11', '#151515', '#1f7a3f', '#2563eb', '#f59e0b']
// A small, no-library emoji palette for live reactions + message reactions.
export const EMOJI = ['👍', '❤️', '😂', '🤣', '😮', '😢', '🙏', '🤲', '😀', '😊', '😍', '😎', '🤔', '😅', '🥳', '😴', '🙈', '👎', '👏', '🙌', '👋', '🤝', '💪', '🔥', '💯', '⭐', '🎉', '✅', '❌', '💡', '👀', '🚀', '☕', '🎯']
// Word tags (wordmarks) usable as reactions alongside emojis. Custom ones the user
// adds are appended (persisted). A reaction/float is just a string — emoji OR tag.
export const TAGS_EN = ['ok', 'yes', 'no', 'soon', 'BRB', 'lol', 'bruh', 'why?', 'what?', 'khalas', 'ya3', 'tamm']
export const TAGS_AR = ['هلا', 'السلام عليكم', 'حياك', 'بالجنة', 'تبشر', 'شكرا', 'تم', 'ابشر']
export const TAGS_KEY = 'bis-call-tags'
export const isTag = (r: string) => /[\p{L}\p{N}]/u.test(r) // contains a letter/number → text tag, not an emoji
export const WB_FONT = 'Arial, Helvetica, sans-serif' // safe font shared by the editor + canvas render
export const TXT_PAD = 5 // px inset of text inside the box (matches the editor's padding+border)

// Word-wrap `text` to `maxW` px using the ctx's current font. Honours explicit
// newlines and breaks over-long tokens by character.
export function wrapLines(x: CanvasRenderingContext2D, text: string, maxW: number): string[] {
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

export const SITE = 'https://built-in-saudi.com'
export const NAME_KEY = 'bis-call-name'
export const HOST_KEY = 'bis-call-host' // the room code this browser is hosting (for reconnect)
export const code6 = () => { const A = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const b = crypto.getRandomValues(new Uint8Array(7)); for (let i = 0; i < 7; i++) s += A[b[i] % A.length]; return s }

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
// A kunya, male ("Abu …") by default or female ("Umm …") when `female` is set.
export const randName = (ar: boolean, female = false) => {
  const b = crypto.getRandomValues(new Uint8Array(1))
  const p = KUNYA[b[0] % KUNYA.length]
  const pre = female ? (ar ? 'أم' : 'Umm') : (ar ? 'أبو' : 'Abu')
  return `${pre} ${ar ? p[1] : p[0]}`
}
export const isDefaultName = (n: string) => KUNYA.some(([en, ar]) =>
  n === `Abu ${en}` || n === `أبو ${ar}` || n === `Umm ${en}` || n === `أم ${ar}`)

// A short two-note chime (Web Audio — no asset) for when someone knocks to join.
let _ac: AudioContext | null = null
export function chime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    if (!_ac) _ac = new AC()
    if (_ac.state === 'suspended') _ac.resume()
    const ctx = _ac, t0 = ctx.currentTime
    for (const [i, f] of [880, 1174].entries()) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination)
      const t = t0 + i * 0.13
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.26)
      o.start(t); o.stop(t + 0.28)
    }
  } catch { /* audio unavailable */ }
}

// A looping "someone is calling" ringtone (two-tone ring-ring, then a pause, every
// ~2.6s) built from the same Web Audio context — no asset. Returns a stop() handle.
// Autoplay rules mean it only sounds once the page has had a user gesture; the busy
// banner (owner already in a call) always has one, so that case always rings.
export function startRingtone(): () => void {
  let stopped = false
  let timer = 0
  const burst = () => {
    if (stopped) return
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      if (!_ac) _ac = new AC()
      if (_ac.state === 'suspended') _ac.resume()
      const ctx = _ac, t0 = ctx.currentTime
      // Two quick rings (a classic "ring ring"), then silence until the next cycle.
      for (const start of [0, 0.42]) {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = 1046; o.connect(g); g.connect(ctx.destination)
        const t = t0 + start
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.03)
        g.gain.setValueAtTime(0.16, t + 0.28); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.34)
        o.start(t); o.stop(t + 0.36)
      }
    } catch { /* audio unavailable */ }
  }
  burst()
  timer = window.setInterval(burst, 2600)
  return () => { stopped = true; window.clearInterval(timer) }
}

// System notification for "someone entered" — only when the tab is hidden (a
// focused tab already gets the chime + in-app toast). Prefer the SW registration
// (works installed / on more browsers) and fall back to the Notification ctor.
export async function osNotify(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return
    const reg = await navigator.serviceWorker?.ready.catch(() => null)
    if (reg?.showNotification) await reg.showNotification(title, { body, tag: 'bis-call-enter', icon: '/icon.svg' })
    else new Notification(title, { body })
  } catch { /* */ }
}

export const initials = (nm: string) => nm.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '•'

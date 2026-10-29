// Dragging the fill handle: extend what the selected cells say.
//
// The rules people expect from every spreadsheet, kept deliberately small:
//  - two or more numbers continue their straight-line trend (1, 3 → 5, 7);
//    a single number is copied, as Excel does without Ctrl;
//  - a word ending in a number counts on ("Item 1" → "Item 2");
//  - day and month names continue the week or the year, in English or Arabic;
//  - an ISO date steps by a day, or by whatever step two dates establish;
//  - a formula is copied with its relative references moved;
//  - anything else repeats.
import { shiftFormula } from '../engine/formula'

const LISTS: string[][] = [
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
  ['Q1', 'Q2', 'Q3', 'Q4'],
]

const isNum = (s: string) => /^\s*-?(\d+\.?\d*|\.\d+)(e-?\d+)?\s*$/i.test(s)
const TEXT_NUM = /^(.*?)(\d+)(\D*)$/
const pad = (v: number, like: string) => (like.length > 1 && like[0] === '0' ? String(v).padStart(like.length, '0') : String(v))
const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/

function listOf(v: string): { list: string[]; i: number; upper: boolean } | null {
  for (const list of LISTS) {
    const i = list.findIndex((x) => x.toLowerCase() === v.toLowerCase())
    if (i >= 0) return { list, i, upper: v === v.toUpperCase() && v !== v.toLowerCase() }
  }
  return null
}

function decimals(n: string): number { const m = n.match(/\.(\d+)/); return m ? m[1].length : 0 }

/**
 * Continue `src` (the selected cells along the fill direction, in order) for `n`
 * more cells. `dRow`/`dCol` is how far each new cell is from the one it copies,
 * per step, for moving a formula's references.
 */
export function extendSeries(src: string[], n: number, step: { dRow: number; dCol: number }): string[] {
  const out: string[] = []
  if (!src.length || n <= 0) return out
  const k = src.length
  const nums = src.every((s) => isNum(s))
  if (nums && k >= 2) {
    const xs = src.map(Number)
    // Least-squares line through the points, so 1,2,4 continues sensibly too.
    const mx = (k - 1) / 2
    const my = xs.reduce((a, b) => a + b, 0) / k
    let num = 0
    let den = 0
    xs.forEach((y, i) => { num += (i - mx) * (y - my); den += (i - mx) ** 2 })
    const slope = num / den
    const dp = Math.max(...src.map(decimals))
    for (let j = 0; j < n; j++) {
      const v = my + slope * (k + j - mx)
      out.push(String(+v.toFixed(Math.min(10, dp + 2))))
    }
    return out
  }
  const dates = src.every((s) => isoDate.test(s.trim()))
  if (dates) {
    const t = src.map((s) => Date.parse(s.trim() + 'T00:00:00Z'))
    const day = 86_400_000
    const stepDays = k >= 2 ? Math.round((t[k - 1] - t[k - 2]) / day) : 1
    // Month steps keep the day of month (Jan 31 → Feb 28 is not what anybody wants from 1-of-month dates).
    const sameDay = k >= 2 && src.every((s) => s.slice(8) === src[0].slice(8))
    const monthStep = sameDay && k >= 2 ? (+src[k - 1].slice(0, 4) - +src[k - 2].slice(0, 4)) * 12 + (+src[k - 1].slice(5, 7) - +src[k - 2].slice(5, 7)) : 0
    for (let j = 1; j <= n; j++) {
      if (monthStep) {
        const [y, m, d] = src[k - 1].split('-').map(Number)
        const mm = m - 1 + monthStep * j
        const yy = y + Math.floor(mm / 12)
        const mo = ((mm % 12) + 12) % 12
        out.push(`${yy}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
      } else out.push(new Date(t[k - 1] + stepDays * j * day).toISOString().slice(0, 10))
    }
    return out
  }
  // "Item 1", "Item 2" → "Item 3": a shared prefix and suffix around a counting number.
  const tn = src.map((x) => x.match(TEXT_NUM))
  if (tn.every((m) => m && !isNum(m[0]) && !m[0].startsWith('=')) && tn.every((m) => m![1] === tn[0]![1] && m![3] === tn[0]![3])) {
    const ns = tn.map((m) => +m![2])
    const step1 = k >= 2 ? ns[k - 1] - ns[k - 2] : 1
    const steady = ns.every((v, i) => i === 0 || v - ns[i - 1] === step1)
    if (steady) {
      for (let j = 1; j <= n; j++) out.push(tn[0]![1] + pad(ns[k - 1] + step1 * j, tn[k - 1]![2]) + tn[0]![3])
      return out
    }
  }
  for (let j = 0; j < n; j++) {
    const i = j % k
    const s = src[i]
    const cycle = Math.floor(j / k) + 1
    if (s.startsWith('=')) { out.push(shiftFormula(s, step.dRow * (k * cycle), step.dCol * (k * cycle))); continue }
    const l = listOf(s.trim())
    if (l && (k === 1 || src.every((x) => listOf(x.trim())?.list === l.list))) {
      const base = listOf(src[k - 1].trim())!.i
      const v = l.list[(base + j + 1) % l.list.length]
      out.push(l.upper ? v.toUpperCase() : v)
      continue
    }
    const m = s.match(TEXT_NUM)
    if (m && !isNum(s)) {
      out.push(m[1] + pad(+m[2] + cycle, m[2]) + m[3])
      continue
    }
    out.push(s)
  }
  return out
}

import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Textarea, Stack, Check, Panel } from '../../components/ui'
import { WheelIcon, TrashIcon } from '../../components/icons'
import { Wheel } from './Wheel'

const STORE = 'bis-spin-names'

const STR = {
  en: {
    names: 'Names, one per line', placeholder: 'Ahmed\nFatimah\nKhalid\nNoura',
    spin: 'Spin', spinning: 'Spinning…',
    winner: 'Winner', removeWinner: 'Remove the winner after each spin',
    remove: 'Remove', again: 'Spin again', clear: 'Clear all',
    count: (n: number) => `${n} name${n === 1 ? '' : 's'}`,
    empty: 'Add at least two names to spin.',
    allGone: 'Everyone has been drawn.',
    fair: 'The wheel lands on a slice chosen with crypto.getRandomValues — the same source used for keys, not Math.random. The spin you watch is the animation catching up to a result already decided fairly.',
  },
  ar: {
    names: 'الأسماء، اسم في كل سطر', placeholder: 'أحمد\nفاطمة\nخالد\nنورة',
    spin: 'أدر', spinning: 'يدور…',
    winner: 'الفائز', removeWinner: 'احذف الفائز بعد كل دورة',
    remove: 'احذف', again: 'أدر مجددًا', clear: 'امسح الكل',
    count: (n: number) => `${n.toLocaleString('ar')} اسمًا`,
    empty: 'أضف اسمين على الأقل لتبدأ.',
    allGone: 'سُحبت جميع الأسماء.',
    fair: 'تقف العجلة على شريحة تُختار عبر crypto.getRandomValues — المصدر نفسه المستخدم للمفاتيح، لا Math.random. والدوران الذي تراه هو الحركة تلحق بنتيجة حُسمت بعدل مسبقًا.',
  },
}

/** An unbiased index in [0, n) — rejection sampling, since a plain modulo of a
 *  32-bit value skews toward the low indices when n does not divide 2^32. */
function fairIndex(n: number): number {
  const limit = Math.floor(0xffffffff / n) * n
  const buf = new Uint32Array(1)
  let v = 0
  do { crypto.getRandomValues(buf); v = buf[0] } while (v >= limit)
  return v % n
}

export default function SpinWheelTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [raw, setRaw] = useState('')
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [autoRemove, setAutoRemove] = useState(false)
  const rafRef = useRef(0)

  useEffect(() => {
    try { setRaw(localStorage.getItem(STORE) ?? '') } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORE, raw) } catch { /* ignore */ }
  }, [raw])
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const names = raw.split('\n').map((l) => l.trim()).filter(Boolean)

  function spin() {
    if (names.length < 2 || spinning) return
    setSpinning(true)
    setWinner(null)
    const index = fairIndex(names.length)
    const slice = (Math.PI * 2) / names.length
    // Land the pointer (at -90°) in the middle of the chosen slice, after a few
    // full turns so it reads as a spin rather than a jump.
    const target = Math.PI * 2 * 5 + (Math.PI * 1.5 - (index + 0.5) * slice)
    const from = angle % (Math.PI * 2)
    const start = performance.now()
    const dur = 4200
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      // Ease out cubic — fast off the line, long settle.
      const eased = 1 - (1 - t) ** 3
      setAngle(from + (target - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
      else {
        setSpinning(false)
        setWinner(names[index])
        if (autoRemove) setRaw(names.filter((_, i) => i !== index).join('\n'))
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  return (
    <Stack data-testid="spin-wheel">
      <div className="flex flex-col min-[760px]:flex-row gap-5">
        <div className="flex flex-col gap-2 min-[760px]:w-[18rem]">
          <label className="text-[0.8rem] text-ink-faint">{s.names}</label>
          <Textarea className="min-h-[14rem]" dir="auto" data-testid="sw-names"
            placeholder={s.placeholder} value={raw} onChange={(e) => setRaw(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9rem] text-ink-faint" data-testid="sw-count">{s.count(names.length)}</span>
            <Button className="px-2 py-1" onClick={() => { setRaw(''); setWinner(null) }} data-testid="sw-clear">
              <TrashIcon /> {s.clear}
            </Button>
          </div>
          <Check>
            <input type="checkbox" checked={autoRemove} data-testid="sw-autoremove"
              onChange={(e) => setAutoRemove(e.target.checked)} /> {s.removeWinner}
          </Check>
        </div>

        <div className="flex flex-col items-center gap-3 flex-1">
          <Wheel names={names} angle={angle} />
          <Button variant="primary" onClick={spin} disabled={names.length < 2 || spinning} data-testid="sw-spin">
            <WheelIcon /> {spinning ? s.spinning : s.spin}
          </Button>
          {names.length < 2 && (
            <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="sw-empty">
              {names.length === 0 && autoRemove ? s.allGone : s.empty}
            </p>
          )}
          {winner && (
            <Panel className="flex flex-col items-center gap-1 w-full" data-testid="sw-winner">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.winner}</span>
              <span className="font-display text-[clamp(1.6rem,6vw,2.4rem)] text-green-700 rtl:font-ar" data-testid="sw-winner-name">{winner}</span>
            </Panel>
          )}
        </div>
      </div>

      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.fair}</p>
    </Stack>
  )
}
